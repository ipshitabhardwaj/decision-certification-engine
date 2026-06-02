import crypto from 'crypto';
import { 
  IngestedSource, 
  CanonicalEvent, 
  RuleResult, 
  RuleConfig, 
  DecisionOutcome, 
  TriggerRecommendation, 
  DecisionCertificate 
} from './types.js';

/**
 * Computes a standard SHA-256 hash of a string.
 */
export function computeSHA256(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Recursively orders keys of an object to perform deterministic JSON stringification.
 * Ensures the exact same content always generates the exact same hash.
 */
export function deterministicStringify(obj: any): string {
  if (obj === null || obj === undefined) return 'null';
  if (typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(item => deterministicStringify(item)).join(',') + ']';
  }
  const sortedKeys = Object.keys(obj).sort();
  const pairs = sortedKeys.map(key => {
    return JSON.stringify(key) + ':' + deterministicStringify(obj[key]);
  });
  return '{' + pairs.join(',') + '}';
}

/**
 * Ingests a JSON transaction feed.
 */
export function ingestTransaction(rawTx: any, timestampOverride?: string): IngestedSource {
  const transactionId = rawTx.transactionId || `TX_UNKNOWN_${Date.now()}`;
  const rawPayload = JSON.stringify(rawTx);
  const rawPayloadHash = computeSHA256(rawPayload);
  const now = timestampOverride || new Date().toISOString();

  return {
    id: transactionId,
    type: 'TRANSACTION_FEED',
    sourceTimestamp: rawTx.sourceTimestamp || now,
    ingestionTimestamp: now,
    rawPayload,
    rawPayloadHash
  };
}

/**
 * Parses and ingests CSV or JSON Registry entries.
 * Supporting both forms allows robust ingestion and testing.
 */
export function ingestRegistry(rawRegistry: any, timestampOverride?: string): IngestedSource {
  const now = timestampOverride || new Date().toISOString();
  let rawPayload = '';
  
  if (typeof rawRegistry === 'string') {
    rawPayload = rawRegistry;
  } else {
    rawPayload = JSON.stringify(rawRegistry);
  }

  const rawPayloadHash = computeSHA256(rawPayload);

  return {
    id: `REGISTRY_${rawPayloadHash.substring(0, 8)}`,
    type: 'ACCOUNT_REGISTRY',
    sourceTimestamp: now,
    ingestionTimestamp: now,
    rawPayload,
    rawPayloadHash
  };
}

/**
 * Parse registry file (CSV or JSON) to look up account record details.
 */
export function lookupAccountInRegistry(accountId: string, registrySources: IngestedSource[]): { status?: string, kycVerified?: boolean, sourceHash: string | null } {
  // Let's sweep through all ingested registry records, newest first
  for (let i = registrySources.length - 1; i >= 0; i--) {
    const reg = registrySources[i];
    try {
      // Check if CSV format
      if (reg.rawPayload.includes('accountId')) {
        const lines = reg.rawPayload.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        // Find header matching accountId,status,kycVerified
        const header = lines[0].split(',').map(h => h.trim());
        const kIdIdx = header.indexOf('accountId');
        const statusIdx = header.indexOf('status');
        const kycIdx = header.indexOf('kycVerified');
        
        if (kIdIdx !== -1) {
          for (let j = 1; j < lines.length; j++) {
            const cols = lines[j].split(',').map(c => c.trim());
            if (cols[kIdIdx] === accountId) {
              const status = statusIdx !== -1 ? cols[statusIdx] : undefined;
              const kycVerifiedStr = kycIdx !== -1 ? cols[kycIdx].toLowerCase() : 'false';
              const kycVerified = kycVerifiedStr === 'true' || kycVerifiedStr === 'yes' || kycVerifiedStr === '1';
              return { status, kycVerified, sourceHash: reg.rawPayloadHash };
            }
          }
        }
      } else {
        // Try parsing as JSON array or single object
        const parsed = JSON.parse(reg.rawPayload);
        const rows = Array.isArray(parsed) ? parsed : [parsed];
        const match = rows.find((r: any) => r.accountId === accountId);
        if (match) {
          return { 
            status: match.status || match.accountStatus, 
            kycVerified: match.kycVerified === true || String(match.kycVerified).toLowerCase() === 'true',
            sourceHash: reg.rawPayloadHash 
          };
        }
      }
    } catch (e) {
      // Ignore parse issues in individual legacy elements
    }
  }
  return { sourceHash: null };
}

/**
 * Normalizes all source data into a single canonical event schema.
 * Merges transaction data with registry verification data and detects duplicate txId.
 */
export function normalizeEvent(
  txSource: IngestedSource, 
  registrySources: IngestedSource[], 
  allTxSources: IngestedSource[]
): { event: CanonicalEvent; registryInputHash: string | null } {
  const txData = JSON.parse(txSource.rawPayload);
  const accountId = txData.accountId;
  const transactionId = txSource.id;

  const auditTrail: string[] = [];
  auditTrail.push(`Ingested raw transaction ${transactionId} (timestamp: ${txSource.sourceTimestamp}).`);

  // Detect duplicate transactions
  // Definition: Another transaction feed with the same transactionId was ingested earlier (at an earlier ingestion time, or simply exists)
  const isDuplicate = allTxSources.some(other => 
    other.id === transactionId && 
    other.rawPayloadHash !== txSource.rawPayloadHash
  ) || allTxSources.filter(other => other.id === transactionId).length > 1;

  if (isDuplicate) {
    auditTrail.push(`Duplicate transaction detected: transaction ID ${transactionId} has multiple submissions.`);
  }

  // Lookup Registry data
  const { status, kycVerified, sourceHash } = lookupAccountInRegistry(accountId, registrySources);

  if (sourceHash) {
    auditTrail.push(`Aligned account details with registry node (Registry hash: ${sourceHash}).`);
  } else {
    auditTrail.push(`Warning: No matching registry registry entry found for account ${accountId}.`);
  }

  const event: CanonicalEvent = {
    transactionId,
    accountId,
    amount: Number(txData.amount),
    currency: txData.currency || 'USD',
    accountStatus: status,
    kycVerified: kycVerified,
    sourceTimestamp: txSource.sourceTimestamp,
    ingestionTimestamp: txSource.ingestionTimestamp,
    isDuplicate,
    auditTrail
  };

  return { event, registryInputHash: sourceHash };
}

/**
 * Evaluates configured deterministic rules. This trace-log trace is fully auditable.
 */
export function evaluateRules(
  event: CanonicalEvent, 
  config: RuleConfig
): { 
  decision: DecisionOutcome; 
  triggerRecommendation: TriggerRecommendation; 
  results: RuleResult[]; 
  auditTrail: string[];
} {
  const results: RuleResult[] = [];
  const runAuditTrail: string[] = [];

  // Check manual review first for duplicates
  if (event.isDuplicate) {
    runAuditTrail.push("Rule Check bypassed: Duplicate transaction flagged. Forcing manual review.");
    return {
      decision: 'manual_review',
      triggerRecommendation: 'manual_review',
      results,
      auditTrail: runAuditTrail
    };
  }

  // Check insufficient data
  if (event.accountStatus === undefined || event.kycVerified === undefined) {
    runAuditTrail.push("Rule Check: Registry data missing/incomplete. Forcing insufficient_data.");
    return {
      decision: 'insufficient_data',
      triggerRecommendation: 'insufficient_data',
      results,
      auditTrail: runAuditTrail
    };
  }

  let failedAny = false;

  // Rule 1: Account must be active
  if (config.requireActiveAccount) {
    const passed = event.accountStatus === 'active';
    results.push({
      ruleName: 'requireActiveAccount',
      expected: 'active',
      actual: event.accountStatus,
      passed
    });
    runAuditTrail.push(`Rule Evaluation: requireActiveAccount - Expected: active, Actual: ${event.accountStatus}. Pass: ${passed}`);
    if (!passed) failedAny = true;
  }

  // Rule 2: KYC must be verified
  if (config.requireKYC) {
    const passed = event.kycVerified === true;
    results.push({
      ruleName: 'requireKYC',
      expected: true,
      actual: event.kycVerified,
      passed
    });
    runAuditTrail.push(`Rule Evaluation: requireKYC - Expected: true, Actual: ${event.kycVerified}. Pass: ${passed}`);
    if (!passed) failedAny = true;
  }

  // Rule 3: Max amount threshold (Optional limit rule)
  if (config.maxAmount) {
    const passed = event.amount <= config.maxAmount;
    results.push({
      ruleName: 'maxAmount',
      expected: `<= ${config.maxAmount}`,
      actual: event.amount,
      passed
    });
    runAuditTrail.push(`Rule Evaluation: maxAmount - Expected: <= ${config.maxAmount}, Actual: ${event.amount}. Pass: ${passed}`);
    if (!passed) failedAny = true;
  }

  let decision: DecisionOutcome = 'approve';
  let triggerRecommendation: TriggerRecommendation = 'release_settlement';

  if (failedAny) {
    decision = 'reject';
    triggerRecommendation = 'reject';
    runAuditTrail.push("Rule Evaluation complete: One or more deterministic constraints failed. Settlement Rejected.");
  } else {
    runAuditTrail.push("Rule Evaluation complete: All deterministic rules satisfied. Settlement Approved.");
  }

  return {
    decision,
    triggerRecommendation,
    results,
    auditTrail: runAuditTrail
  };
}

/**
 * Creates the machine-readable Decision Certificate with a verifiable SHA-256 integrity hash.
 */
export function generateCertificate(
  event: CanonicalEvent,
  txSource: IngestedSource,
  registryInputHash: string | null,
  rulesEvaluated: RuleResult[],
  finalDecision: DecisionOutcome,
  triggerRecommendation: TriggerRecommendation,
  runAuditTrail: string[]
): DecisionCertificate {
  const timestamp = new Date().toISOString();
  
  // Combine all audits
  const combinedAudit = [
    ...event.auditTrail,
    ...runAuditTrail,
    `Decision Certificate issued with status: ${finalDecision}, trigger: ${triggerRecommendation}.`
  ];

  const incompleteCert: Omit<DecisionCertificate, 'certificateHash'> = {
    certificateId: `CERT-${event.transactionId}-${computeSHA256(event.transactionId + timestamp).substring(0, 8)}`,
    transactionId: event.transactionId,
    normalizedEvent: event,
    sourceInputsUsed: {
      transactionFeedHash: txSource.rawPayloadHash,
      accountRegistryHash: registryInputHash
    },
    rulesEvaluated,
    finalDecision,
    triggerRecommendation,
    auditTrail: combinedAudit,
    timestamp
  };

  // Perform deterministic serialization to generate hash
  const canonicalString = deterministicStringify(incompleteCert);
  const certificateHash = computeSHA256(canonicalString);

  return {
    ...incompleteCert,
    certificateHash
  };
}

/**
 * Verifies certificate integrity by recomputing hash excluding certificateHash itself.
 */
export function verifyCertificate(certificate: DecisionCertificate): boolean {
  try {
    const { certificateHash, ...incompleteCert } = certificate;
    const canonicalString = deterministicStringify(incompleteCert);
    const recomputedHash = computeSHA256(canonicalString);
    return recomputedHash === certificateHash;
  } catch (e) {
    return false;
  }
}
