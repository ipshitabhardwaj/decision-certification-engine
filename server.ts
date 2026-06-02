import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { 
  ingestTransaction, 
  ingestRegistry, 
  normalizeEvent, 
  evaluateRules, 
  generateCertificate, 
  verifyCertificate 
} from './src/engine.js';
import { 
  IngestedSource, 
  DecisionCertificate, 
  RuleConfig, 
  CanonicalEvent 
} from './src/types.js';

const app = express();
const PORT = 3000;

app.use(express.json());

// In-memory repositories
let transactionSources: IngestedSource[] = [];
let registrySources: IngestedSource[] = [];
let certificates: Record<string, DecisionCertificate> = {};
let canonicalEvents: Record<string, CanonicalEvent> = {};

// Helper to seed initial sample records
function seedDatabase() {
  transactionSources = [];
  registrySources = [];
  certificates = {};
  canonicalEvents = {};

  // Source B: Initial Registry CSV data
  const sampleRegistryCSV = 
`accountId,status,kycVerified
ACC001,active,true
ACC002,active,false
ACC003,inactive,true
ACC004,active,true
ACC005,active,true`;

  const regSource = ingestRegistry(sampleRegistryCSV, '2026-06-01T12:00:00Z');
  registrySources.push(regSource);

  // Source A: 6 Sample Transaction Feeds
  // 1. Standard eligible transaction (ACC001 is active, KYC=true, amount=5000 -> APPROVE)
  const tx1 = {
    transactionId: 'TX001',
    accountId: 'ACC001',
    amount: 5000,
    currency: 'INR',
    sourceTimestamp: '2026-06-01T12:05:00Z'
  };
  transactionSources.push(ingestTransaction(tx1, '2026-06-01T12:05:05Z'));

  // 2. KYC verification failed (ACC002 index has kycVerified=false -> REJECT)
  const tx2 = {
    transactionId: 'TX002',
    accountId: 'ACC002',
    amount: 15200,
    currency: 'USD',
    sourceTimestamp: '2026-06-01T12:10:00Z'
  };
  transactionSources.push(ingestTransaction(tx2, '2026-06-01T12:10:10Z'));

  // 3. User account inactive (ACC003 is inactive -> REJECT)
  const tx3 = {
    transactionId: 'TX003',
    accountId: 'ACC003',
    amount: 85000,
    currency: 'EUR',
    sourceTimestamp: '2026-06-01T12:15:00Z'
  };
  transactionSources.push(ingestTransaction(tx3, '2026-06-01T12:15:15Z'));

  // 4. Over maximum threshold limit (ACC004 is safe, but amount=150000 exceeds maxAmount=100000 -> REJECT)
  const tx4 = {
    transactionId: 'TX004',
    accountId: 'ACC004',
    amount: 150000,
    currency: 'INR',
    sourceTimestamp: '2026-06-01T12:20:00Z'
  };
  transactionSources.push(ingestTransaction(tx4, '2026-06-01T12:20:20Z'));

  // 5. Missing registry account data (ACC099 has no record -> INSUFFICIENT_DATA)
  const tx5 = {
    transactionId: 'TX005',
    accountId: 'ACC099',
    amount: 9900,
    currency: 'GBP',
    sourceTimestamp: '2026-06-01T12:25:00Z'
  };
  transactionSources.push(ingestTransaction(tx5, '2026-06-01T12:25:25Z'));

  // 6. Duplicate transaction (Subsequent feed with exact duplicate transactionId TX001 -> MANUAL_REVIEW)
  const tx6 = {
    transactionId: 'TX001', // Identical TX Id
    accountId: 'ACC001',
    amount: 5000,
    currency: 'INR',
    sourceTimestamp: '2026-06-01T12:28:00Z' // Later duplicate timestamp
  };
  transactionSources.push(ingestTransaction(tx6, '2026-06-01T12:28:30Z'));
}

// Initial seed
seedDatabase();

// Load Rules dynamically from disk configuration
function loadRuleConfig(): RuleConfig {
  try {
    const filePath = path.join(process.cwd(), 'rules.json');
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (e) {
    console.warn('Could not read rules.json from disk, falling back to default values', e);
    return {
      requireActiveAccount: true,
      requireKYC: true,
      maxAmount: 100000
    };
  }
}

/**
 * API Endpoints
 */

// Retrieve full state for the reviews panel component
app.get('/api/database-state', (req, res) => {
  const currentRules = loadRuleConfig();
  res.json({
    transactionSources,
    registrySources,
    canonicalEvents: Object.values(canonicalEvents),
    certificates: Object.values(certificates),
    rules: currentRules
  });
});

// Reset databases to baseline seed
app.post('/api/reset', (req, res) => {
  seedDatabase();
  res.json({ status: 'Database state reset to default 6 sample events.' });
});

// POST /events - Create or ingest event (Transaction or Registry info)
app.post('/api/events', (req, res) => {
  const { type, payload } = req.body;

  if (!type || !payload) {
    res.status(400).json({ error: 'Missing type or payload attributes.' });
    return;
  }

  try {
    if (type === 'transaction') {
      const result = ingestTransaction(payload);
      transactionSources.push(result);
      res.status(201).json({
        message: 'Transaction event ingested successfully.',
        ingestedSource: result
      });
    } else if (type === 'registry') {
      const result = ingestRegistry(payload);
      registrySources.push(result);
      res.status(201).json({
        message: 'Registry account records ingested successfully.',
        ingestedSource: result
      });
    } else {
      res.status(400).json({ error: 'Invalid source type specified. Use "transaction" or "registry".' });
    }
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to ingest event: ' + err.message });
  }
});

// POST /evaluate/:transactionId - Evaluate settlement status of an ingested transaction
app.post('/api/evaluate/:transactionId', (req, res) => {
  const { transactionId } = req.params;

  // Find the transaction record with specific transactionId
  // In case of duplicates, find the one that corresponds to this transition evaluation.
  // Note: Standard evaluation will extract both first and duplicates respectively or work on the specified one.
  const txCandidates = transactionSources.filter(src => src.id === transactionId);

  if (txCandidates.length === 0) {
    res.status(404).json({ error: `Transaction ${transactionId} not found in ingestion records.` });
    return;
  }

  // We evaluate the most recently added transaction match
  const selectedTx = txCandidates[txCandidates.length - 1];

  try {
    const rulesConfig = loadRuleConfig();

    // 1. Normalization Layer: Merge both Transaction and Registry inputs
    const { event, registryInputHash } = normalizeEvent(selectedTx, registrySources, transactionSources);
    canonicalEvents[transactionId] = event;

    // 2. Rule Engine: Run deterministic decisions
    const { decision, triggerRecommendation, results, auditTrail } = evaluateRules(event, rulesConfig);

    // 3. Certificate Layer: Package into Machine-Verifiable JSON Certification format
    const certificate = generateCertificate(
      event,
      selectedTx,
      registryInputHash,
      results,
      decision,
      triggerRecommendation,
      auditTrail
    );

    // Save certificate
    certificates[transactionId] = certificate;

    res.json({
      decision,
      triggerRecommendation,
      certificate
    });
  } catch (err: any) {
    console.error('Error evaluating rules:', err);
    res.status(500).json({ error: 'Evaluation system failed: ' + err.message });
  }
});

// GET /certificate/:transactionId - Retrieve evaluated certificate
app.get('/api/certificate/:transactionId', (req, res) => {
  const { transactionId } = req.params;
  const cert = certificates[transactionId];

  if (!cert) {
    res.status(404).json({ error: `No decision certificate exists yet for transaction ${transactionId}. Evaluate it first.` });
    return;
  }

  res.json(cert);
});

// GET /certificate/:transactionId/verify - Verify certificate integrity
app.get('/api/certificate/:transactionId/verify', (req, res) => {
  const { transactionId } = req.params;
  const cert = certificates[transactionId];

  if (!cert) {
    res.status(404).json({ error: `No matching decision certificate found to verify for transaction ${transactionId}.` });
    return;
  }

  const verified = verifyCertificate(cert);
  
  // Expose verify details
  const { certificateHash, ...incompleteCert } = cert;
  const canonicalString = JSON.stringify(incompleteCert); // we trace the internal format
  
  res.json({
    transactionId,
    verified,
    certificateHash,
    message: verified 
      ? 'Deterministic Integrity Verified. Hash matches exactly.' 
      : 'Integrity Check Failed! Certificate attributes have been modified.'
  });
});

/**
 * Front-end Static and Development Engine Hook-up
 */
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Pre-Settlement Engine running on http://localhost:${PORT}`);
  });
}

startServer();
