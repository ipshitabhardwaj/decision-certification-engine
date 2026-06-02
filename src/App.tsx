import React, { useEffect, useState } from 'react';
import { 
  ShieldCheck, 
  ShieldAlert, 
  RefreshCw, 
  Play, 
  Database, 
  FileJson, 
  Plus, 
  CheckCircle2, 
  AlertCircle, 
  Fingerprint, 
  Info,
  Layers,
  Check,
  AlertTriangle,
  Loader,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  HelpCircle,
  FileText,
  UserCheck,
  Building,
  Coins
} from 'lucide-react';
import { 
  IngestedSource, 
  CanonicalEvent, 
  DecisionCertificate, 
  RuleConfig, 
  DecisionOutcome, 
  TriggerRecommendation 
} from './types';

export default function App() {
  // State elements
  const [transactionSources, setTransactionSources] = useState<IngestedSource[]>([]);
  const [registrySources, setRegistrySources] = useState<IngestedSource[]>([]);
  const [canonicalEvents, setCanonicalEvents] = useState<CanonicalEvent[]>([]);
  const [certificates, setCertificates] = useState<DecisionCertificate[]>([]);
  const [rules, setRules] = useState<RuleConfig | null>(null);
  
  const [selectedTxId, setSelectedTxId] = useState<string>('TX001');
  const [activeTab, setActiveTab] = useState<'review' | 'ingest'>('review');
  const [loading, setLoading] = useState<boolean>(false);
  const [evaluating, setEvaluating] = useState<string | null>(null);
  const [verifying, setVerifying] = useState<boolean>(false);

  // Collapsible section states for modern clean viewport
  const [showRawSourcePayloads, setShowRawSourcePayloads] = useState<boolean>(false);
  const [showCanonicalJSON, setShowCanonicalJSON] = useState<boolean>(false);
  const [showCertificateJSON, setShowCertificateJSON] = useState<boolean>(false);

  // Ingestion form state
  const [customTxId, setCustomTxId] = useState<string>('');
  const [customAccountId, setCustomAccountId] = useState<string>('ACC001');
  const [customAmount, setCustomAmount] = useState<string>('4500');
  const [customCurrency, setCustomCurrency] = useState<string>('INR');
  const [customRegAccountId, setCustomRegAccountId] = useState<string>('');
  const [customRegStatus, setCustomRegStatus] = useState<string>('active');
  const [customRegKyc, setCustomRegKyc] = useState<string>('true');
  const [ingestSuccess, setIngestSuccess] = useState<string>('');

  // Verification status check
  const [verificationResult, setVerificationResult] = useState<{
    verified: boolean;
    certificateHash: string;
    message: string;
  } | null>(null);

  // Fetch complete DB state from Express Server
  const fetchState = async (autoSelectId?: string) => {
    try {
      setLoading(true);
      const res = await fetch('/api/database-state');
      if (res.ok) {
        const data = await res.json();
        setTransactionSources(data.transactionSources || []);
        setRegistrySources(data.registrySources || []);
        setCanonicalEvents(data.canonicalEvents || []);
        setCertificates(data.certificates || []);
        setRules(data.rules || null);

        // Auto-select first transaction if none selected or on initial load
        if (autoSelectId) {
          setSelectedTxId(autoSelectId);
        } else if (data.transactionSources?.length > 0 && !selectedTxId) {
          setSelectedTxId(data.transactionSources[0].id);
        }
      }
    } catch (e) {
      console.error('Error reading engine databases state:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchState('TX001');
  }, []);

  // Trigger Evaluate action
  const evaluateTransaction = async (txId: string) => {
    try {
      setEvaluating(txId);
      setVerificationResult(null);
      const res = await fetch(`/api/evaluate/${txId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      if (res.ok) {
        await fetchState(txId);
      } else {
        const err = await res.json();
        alert('Evaluation failed: ' + err.error);
      }
    } catch (e) {
      console.error('Error evaluating rules schema:', e);
    } finally {
      setEvaluating(null);
    }
  };

  // Trigger verify action
  const verifyCertificateHandshake = async (txId: string) => {
    try {
      setVerifying(true);
      const res = await fetch(`/api/certificate/${txId}/verify`);
      if (res.ok) {
        const data = await res.json();
        setVerificationResult({
          verified: data.verified,
          certificateHash: data.certificateHash,
          message: data.message
        });
      } else {
        const err = await res.json();
        alert('Integrity check failed: ' + err.error);
      }
    } catch (e) {
      console.error('Error performing verification validation:', e);
    } finally {
      setVerifying(false);
    }
  };

  // Reset database state
  const resetEngineToSeed = async () => {
    if (confirm('Restore transaction and registry repository to the baseline 6 sample transactions?')) {
      try {
        setLoading(true);
        const res = await fetch('/api/reset', { method: 'POST' });
        if (res.ok) {
          setVerificationResult(null);
          await fetchState('TX001');
        }
      } catch (e) {
        console.error('Database reset failed:', e);
      } finally {
        setLoading(false);
      }
    }
  };

  // Ingest manual custom source event
  const handleIngestTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customTxId || !customAccountId || !customAmount) {
      alert('Please fill out all transaction parameters.');
      return;
    }

    try {
      const payload = {
        transactionId: customTxId,
        accountId: customAccountId,
        amount: Number(customAmount),
        currency: customCurrency,
        sourceTimestamp: new Date().toISOString()
      };

      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'transaction',
          payload
        })
      });

      if (res.ok) {
  setIngestSuccess(`Transaction ${customTxId} successfully ingested!`);
  setCustomTxId('');
  await fetchState(customTxId);
  setTimeout(() => setIngestSuccess(''), 5000);
      } else {
        const err = await res.json();
        alert('Ingestion failed: ' + err.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleIngestRegistry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customRegAccountId) {
      alert('Please specify an Account ID.');
      return;
    }

    try {
      const csvString = `${customRegAccountId},${customRegStatus},${customRegKyc}`;

      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'registry',
          payload: csvString
        })
      });

      if (res.ok) {
        setIngestSuccess(`Account ${customRegAccountId} metadata registered!`);
        setCustomRegAccountId('');
        await fetchState();
        setTimeout(() => setIngestSuccess(''), 5000);
      } else {
        const err = await res.json();
        alert('Registry Ingestion failed: ' + err.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Helpers to scan current items
  const selectedTxSource = transactionSources.find(tx => tx.id === selectedTxId);
  const selectedCanonical = canonicalEvents.find(ev => ev.transactionId === selectedTxId);
  const selectedCertificate = certificates.find(cert => cert.transactionId === selectedTxId);

  // Status Badge Pickers (Modern minimal styling)
  const getOutcomeStatusProps = (decision?: string) => {
    if (!decision) return {
      bg: 'bg-amber-50 text-amber-800 border-amber-200',
      label: 'Unevaluated',
      text: 'Requires analysis',
      color: 'text-amber-600',
      fill: 'bg-amber-500'
    };
    switch (decision) {
      case 'approve':
        return {
          bg: 'bg-emerald-50 text-emerald-800 border-emerald-250/70',
          label: 'APPROVE',
          text: 'Decision meets all criteria',
          color: 'text-emerald-600',
          fill: 'bg-emerald-500'
        };
      case 'reject':
        return {
          bg: 'bg-rose-50 text-rose-800 border-rose-200/80',
          label: 'REJECT',
          text: 'Rule verification failed',
          color: 'text-rose-600',
          fill: 'bg-rose-500'
        };
      case 'manual_review':
        return {
          bg: 'bg-amber-50 text-amber-800 border-amber-200/90',
          label: 'MANUAL REVIEW',
          text: 'Duplicate identifier escalated for operator review',
          color: 'text-amber-600',
          fill: 'bg-amber-500'
        };
      case 'insufficient_data':
        return {
          bg: 'bg-slate-50 text-slate-700 border-slate-200',
          label: 'INSUFFICIENT DATA',
          text: 'Missing corresponding registry profile entry',
          color: 'text-slate-500',
          fill: 'bg-slate-400'
        };
      default:
        return {
          bg: 'bg-slate-100 text-slate-800 border-slate-300',
          label: decision.toUpperCase(),
          text: 'Unknown result status',
          color: 'text-slate-600',
          fill: 'bg-slate-500'
        };
    }
  };

  const getSaaSBadge = (decision?: string) => {
    const props = getOutcomeStatusProps(decision);
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono font-bold tracking-wide rounded-full border ${props.bg}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${props.fill}`}></span>
        {props.label}
      </span>
    );
  };

  const triggerRecommendationMap = (decision?: string) => {
    switch (decision) {
      case 'approve':
        return {
          action: 'Proceed Event',
          desc: 'Instructing downstream execution pipeline to dispatch event payload.',
          badgeColor: 'bg-emerald-500 text-white shadow-emerald-200/50',
          icon: <CheckCircle2 className="text-white" size={18} />
        };
      case 'reject':
        return {
          action: 'Halt Execution',
          desc: 'Event has been rejected automatically because of failed configuration rules.',
          badgeColor: 'bg-rose-500 text-white shadow-rose-200/50',
          icon: <AlertCircle className="text-white" size={18} />
        };
      case 'manual_review':
        return {
          action: 'Escalate to Review',
          desc: 'Trigger flag active. Escalated to pipeline operations team for administrative sign-off.',
          badgeColor: 'bg-amber-500 text-black shadow-amber-200/50',
          icon: <AlertTriangle className="text-black" size={18} />
        };
      case 'insufficient_data':
        return {
          action: 'Pending Profile Integration',
          desc: 'Evaluation hold: Account identity possesses no recorded reference registry profile.',
          badgeColor: 'bg-slate-600 text-white shadow-slate-200',
          icon: <Info className="text-white" size={18} />
        };
      default:
        return {
          action: 'Policy Check Required',
          desc: 'Please run rule trace checks to verify execution conditions and metrics.',
          badgeColor: 'bg-slate-200 text-slate-700',
          icon: <HelpCircle size={18} />
        };
    }
  };

  return (
    <div className="min-h-screen bg-[#fafbfc] text-[#1e293b] font-sans antialiased">
      {/* SaaS Premium Header Bar */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-md px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-slate-900 rounded-lg text-white shadow-sm shadow-slate-900/10">
            <ShieldCheck size={20} strokeWidth={2.5} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold px-1.5 py-0.5 bg-slate-100 rounded text-slate-600 tracking-tight">DECISION ENGINE</span>
              <span className="text-[10px] text-slate-400 font-mono">v1.0-TS</span>
            </div>
            <h1 className="text-sm font-semibold text-slate-900 tracking-tight mt-0.5">Decision Certification Platform</h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 bg-slate-50 border border-slate-100 rounded-md px-2.5 py-1 text-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-slate-400 font-mono">System Clock: </span>
            <span className="font-mono text-slate-700 font-medium">2026-06-01 UTC</span>
          </div>

          <button
            onClick={resetEngineToSeed}
            className="flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-950 border border-slate-200 hover:border-slate-300 px-3 py-1.5 rounded-md text-xs font-medium shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-all cursor-pointer font-sans"
            title="Reset repository to original baseline index"
          >
            <RefreshCw size={13} className={`text-slate-450 ${loading ? "animate-spin" : ""}`} />
            <span>Reset Dataset</span>
          </button>
        </div>
      </header>

      {/* Main Container Workspace Area */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        
        {/* Intro Block / Problem statement review banner */}
        <div className="mb-8 border border-slate-100 bg-[#f8fafc]/50 rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.01)]">
          <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wider mb-2 font-mono flex items-center gap-2">
            <Layers size={14} className="text-slate-500" /> Deterministic Decision Pipeline
          </h2>
          <p className="text-slate-500 text-xs leading-relaxed max-w-4xl">
            This platform processes multi-source event feeds to evaluate deterministic transaction outcomes. Incoming events (Source A) are unified with reference registries (Source B), evaluated against rule sets from <code className="font-mono text-slate-700 bg-slate-100 px-1 py-0.5 rounded text-[11.5px]">rules.json</code>, and certified with cryptographic, tamper-proof Decision Certificates secured by SHA-256 hashing.
          </p>
        </div>

        {/* Tab & Filter Panel */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          {/* Custom Segmented Tab Controller */}
          <div className="bg-slate-100 p-0.5 rounded-lg flex border border-slate-200/40 w-full sm:w-auto">
            <button
              onClick={() => { setActiveTab('review'); setVerificationResult(null); }}
              className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider transition-all duration-150 cursor-pointer ${
                activeTab === 'review' 
                  ? 'bg-white text-slate-900 shadow-[0_2px_4px_rgba(0,0,0,0.04)] ring-1 ring-slate-150' 
                  : 'text-slate-450 hover:text-slate-900'
              }`}
            >
              Decision Pipeline Studio
            </button>
            <button
              onClick={() => { setActiveTab('ingest'); setVerificationResult(null); }}
              className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider transition-all duration-150 cursor-pointer ${
                activeTab === 'ingest' 
                  ? 'bg-white text-slate-900 shadow-[0_2px_4px_rgba(0,0,0,0.04)] ring-1 ring-slate-150' 
                  : 'text-slate-450 hover:text-slate-900'
              }`}
            >
              Event Ingestion Hub
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
            <span>Rules.json Policy:</span>
            <span className="bg-amber-50 text-amber-900/90 border border-amber-200/50 px-2 py-0.5 rounded">Active Rules Connected</span>
          </div>
        </div>

        {/* Dynamic Workspace based on Active Tabs */}
        {activeTab === 'review' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* LEFT RAIL: Transactions Queue panel */}
            <div className="lg:col-span-4 space-y-4">
              
              {/* Rules.json Status Visualizer */}
              <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3">
                  <div className="flex items-center gap-1.5">
                    <Database size={15} className="text-slate-500" />
                    <span className="text-xs font-bold font-sans text-slate-700 uppercase tracking-tight">Active Config Matrix</span>
                  </div>
                  <span className="font-mono text-[9px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">deterministic</span>
                </div>
                {rules ? (
                  <div className="space-y-2 text-xs font-mono">
                    <div className="flex justify-between items-center py-0.5">
                      <span className="text-slate-400">requireActiveAccount</span>
                      <span className="text-slate-800 font-medium">{String(rules.requireActiveAccount)}</span>
                    </div>
                    <div className="flex justify-between items-center py-0.5">
                      <span className="text-slate-400">requireKYC</span>
                      <span className="text-slate-800 font-medium">{String(rules.requireKYC)}</span>
                    </div>
                    <div className="flex justify-between items-center py-0.5">
                      <span className="text-slate-400">maxAmountThreshold</span>
                      <span className="text-slate-800 font-medium">100,000 INR</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-slate-400 italic text-xs py-1">Missing config file schema.</div>
                )}
              </div>

              {/* Event list header */}
              <div className="bg-white border border-slate-200/85 rounded-xl shadow-md flex flex-col">
                <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-xl">
                  <div>
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-tighter">Event Queue</h3>
                    <p className="text-[10px] text-slate-400 font-mono">Select target to evaluate</p>
                  </div>
                  <span className="bg-slate-200 text-slate-700 text-[10.5px] px-2 py-0.5 rounded-full font-mono font-medium">
                    {transactionSources.length} Events
                  </span>
                </div>

                <div className="p-2 space-y-2 max-h-[520px] overflow-y-auto">
                  {transactionSources.map((tx, idx) => {
                    const parsed = JSON.parse(tx.rawPayload);
                    const matchedCert = certificates.find(c => c.transactionId === tx.id);
                    const isSelected = selectedTxId === tx.id;
                    
                    // Count duplicates to represent flag status
                    const duplicateCount = transactionSources.filter(t => t.id === tx.id).length;
                    const isDupFlagged = duplicateCount > 1;

                    return (
                      <button
                        key={`${tx.id}-${tx.rawPayloadHash}-${idx}`}
                        onClick={() => {
                          setSelectedTxId(tx.id);
                          setVerificationResult(null);
                        }}
                        className={`w-full p-3.5 rounded-lg border text-left transition-all duration-150 cursor-pointer ${
                          isSelected 
                            ? 'bg-slate-900 border-slate-900 text-white shadow-md shadow-slate-900/10' 
                            : 'bg-white border-slate-150 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs font-bold font-mono tracking-wider">{tx.id}</span>
                          {matchedCert ? (
                            <span className={`text-[9.5px] font-mono font-bold uppercase px-1.5 py-0.5 rounded ${
                              isSelected
                                ? 'bg-white/10 text-slate-100'
                                : 'bg-slate-100 text-slate-800'
                            }`}>
                              {matchedCert.finalDecision}
                            </span>
                          ) : (
                            <span className={`text-[9.5px] font-mono font-bold uppercase px-1.5 py-0.5 rounded ${
                              isSelected ? 'bg-white/15 text-slate-300' : 'bg-slate-100 text-slate-450'
                            }`}>
                              pending
                            </span>
                          )}
                        </div>

                        <div className="flex justify-between items-center mt-2.5">
                          <div className="text-[11px]">
                            <span className={isSelected ? 'text-slate-300' : 'text-slate-400'}>Acc: </span>
                            <span className={`font-mono font-bold ${isSelected ? 'text-white' : 'text-slate-700'}`}>{parsed.accountId}</span>
                          </div>
                          
                          <span className={`font-mono text-xs font-semibold ${isSelected ? 'text-emerald-350' : 'text-slate-900'}`}>
                            {parsed.amount?.toLocaleString()} {parsed.currency || 'INR'}
                          </span>
                        </div>

                        {isDupFlagged && (
                          <div className={`mt-2 pt-2 border-t text-[10px] flex items-center gap-1.5 ${
                            isSelected ? 'border-white/10 text-amber-200' : 'border-slate-100 text-amber-600'
                          }`}>
                            <AlertTriangle size={11} />
                            <span>Duplicate Event Tagged</span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>

            {/* RIGHT WORKSPACE: Step-by-step Review Pipeline Dashboard */}
            <div className="lg:col-span-8 space-y-6">
              
              {/* CURRENT SELECTION METRICS SUMMARY BLOCK */}
              <div className="bg-white border border-slate-200/80 rounded-xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-slate-400 text-xs font-mono uppercase">Selected Event</span>
                    <ArrowRight size={12} className="text-slate-400" />
                    <span className="text-slate-900 text-sm font-mono font-bold">{selectedTxId}</span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 tracking-tight">Decision Pipeline</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Analyzing integrity and evaluating rule compliance of current unified state.
                  </p>
                </div>

                {!selectedCertificate ? (
                  <div>
                    <button
                      onClick={() => evaluateTransaction(selectedTxId)}
                      disabled={evaluating === selectedTxId}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 hover:scale-[1.01] transition-all px-4 py-2.5 rounded-lg text-xs font-bold tracking-wide text-white font-sans shadow-md cursor-pointer"
                    >
                      {evaluating === selectedTxId ? (
                        <>
                          <Loader size={13} className="animate-spin text-slate-600" />
                          <span>Evaluating Logic Policies...</span>
                        </>
                      ) : (
                        <>
                          <Play size={13} fill="currentColor" />
                          <span>Evaluate Event {selectedTxId}</span>
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 bg-[#f8fafc] border border-slate-150 p-2 rounded-lg">
                    <span className="text-[11px] text-slate-450 font-mono">STATUS:</span>
                    {getSaaSBadge(selectedCertificate.finalDecision)}
                  </div>
                )}
              </div>

              {/* 1. SOURCE DATA SECTION */}
              <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-blue-50 flex items-center justify-center font-bold text-[11px] text-blue-600 font-mono">1</div>
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Source Data</h3>
                  </div>
                  <button 
                    onClick={() => setShowRawSourcePayloads(!showRawSourcePayloads)}
                    className="text-xs text-slate-450 hover:text-slate-900 font-medium flex items-center gap-1 cursor-pointer transition-all"
                  >
                    {showRawSourcePayloads ? 'Collapse JSON Code' : 'Display Code Payload'}
                    {showRawSourcePayloads ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                </div>

                 {selectedTxSource ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* Source A Details card */}
                    <div className="border border-slate-150 rounded-lg p-4 bg-slate-50/40">
                      <div className="flex items-center gap-2 mb-2">
                        <Coins className="text-slate-500" size={14} />
                        <span className="text-[11px] font-bold text-slate-700 uppercase tracking-tight">Source A: Event Payload</span>
                      </div>
                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between"><span className="text-slate-450">Event ID</span> <span className="font-mono text-slate-800 font-bold">{selectedTxId}</span></div>
                        <div className="flex justify-between"><span className="text-slate-450">Account Reference</span> <span className="font-mono text-slate-800 font-bold">{JSON.parse(selectedTxSource.rawPayload).accountId}</span></div>
                        <div className="flex justify-between"><span className="text-slate-450">Value / Size</span> <span className="font-mono text-slate-800 font-semibold text-slate-900">{JSON.parse(selectedTxSource.rawPayload).amount?.toLocaleString()} {JSON.parse(selectedTxSource.rawPayload).currency || 'INR'}</span></div>
                        <div className="flex justify-between"><span className="text-slate-450">Ingestion Time</span> <span className="font-mono text-slate-500">{new Date(selectedTxSource.sourceTimestamp).toLocaleTimeString()}</span></div>
                      </div>
                    </div>

                    {/* Source B Details card */}
                    <div className="border border-slate-150 rounded-lg p-4 bg-slate-50/40">
                      <div className="flex items-center gap-2 mb-2">
                        <Building className="text-slate-500" size={14} />
                        <span className="text-[11px] font-bold text-slate-700 uppercase tracking-tight">Source B: Reference Profile</span>
                      </div>
                      
                      {(() => {
                        const parsedTx = JSON.parse(selectedTxSource.rawPayload);
                        const matchedLines: string[] = [];
                        registrySources.forEach(reg => {
                          if (reg.rawPayload.includes('accountId')) {
                            reg.rawPayload.split('\n').filter(l => l.includes(parsedTx.accountId)).forEach(line => {
                              matchedLines.push(line.trim());
                            });
                          }
                        });

                        if (matchedLines.length > 0) {
                          const cols = matchedLines[0].split(',');
                          return (
                            <div className="space-y-1.5 text-xs">
                              <div className="flex justify-between"><span className="text-slate-450">AccountId</span> <span className="font-mono font-bold text-slate-800">{cols[0]}</span></div>
                              <div className="flex justify-between">
                                <span className="text-slate-450">Registry Status</span> 
                                <span className={`font-mono font-bold uppercase text-[10px] px-1.5 rounded ${
                                  cols[1]?.trim() === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                }`}>{cols[1]}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-450">Verification Status</span> 
                                <span className={`font-mono font-bold uppercase text-[10px] px-1.5 rounded ${
                                  cols[2]?.trim() === 'true' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                }`}>{cols[2]}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-450">Registry Hash Key</span> 
                                <span className="font-mono text-slate-400 font-bold" title={selectedTxSource.rawPayloadHash}>{selectedTxSource.rawPayloadHash.substring(0, 10)}...</span>
                              </div>
                            </div>
                          );
                        } else {
                          return (
                            <div className="flex items-center gap-2 text-rose-600 font-medium py-3 text-xs leading-normal">
                              <AlertCircle size={14} />
                              <span>No profile matched for reference identifier {parsedTx.accountId}.</span>
                            </div>
                          );
                        }
                      })()}
                    </div>

                    {showRawSourcePayloads && (
                      <div className="col-span-1 md:col-span-2 pt-2">
                        <div className="bg-slate-900 rounded-lg p-4 font-mono text-[11px] leading-relaxed text-slate-300 relative">
                          <div className="text-[10px] text-slate-500 uppercase border-b border-slate-800 pb-1.5 mb-2.5">Raw JSON Event Payload</div>
                          <pre className="overflow-x-auto whitespace-pre-wrap">{JSON.stringify(JSON.parse(selectedTxSource.rawPayload), null, 2)}</pre>
                        </div>
                      </div>
                    )}

                  </div>
                ) : (
                  <div className="text-slate-450 italic text-xs py-2 text-center">Select an element from the event queue.</div>
                )}
              </div>

              {/* 2. CANONICAL NORMALIZED EVENT */}
              <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-indigo-50 flex items-center justify-center font-bold text-[11px] text-indigo-600 font-mono">2</div>
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Unified Event Schema</h3>
                  </div>
                  {selectedCanonical && (
                    <button 
                      onClick={() => setShowCanonicalJSON(!showCanonicalJSON)}
                      className="text-xs text-slate-450 hover:text-slate-900 font-medium flex items-center gap-1 cursor-pointer transition-all"
                    >
                      {showCanonicalJSON ? 'Hide JSON Schema' : 'View Unified Schema'}
                      {showCanonicalJSON ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                  )}
                </div>

                {selectedCanonical ? (
                  <div className="space-y-4">
                    <p className="text-xs text-slate-500 leading-normal">
                      The ingestion normalizer merged all feeds into a unified event state, establishing schema uniformity:
                    </p>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div className="border border-slate-100 rounded-lg p-3 bg-slate-50/30">
                        <span className="text-[10px] text-slate-400 font-mono uppercase block mb-0.5">Event ID</span>
                        <span className="text-xs font-mono font-bold text-slate-800">{selectedCanonical.transactionId}</span>
                      </div>
                      <div className="border border-slate-100 rounded-lg p-3 bg-slate-50/30">
                        <span className="text-[10px] text-slate-400 font-mono uppercase block mb-0.5">Value Level</span>
                        <span className="text-xs font-mono font-bold text-slate-800">{selectedCanonical.amount?.toLocaleString()} {selectedCanonical.currency}</span>
                      </div>
                      <div className="border border-slate-100 rounded-lg p-3 bg-slate-50/30">
                        <span className="text-[10px] text-slate-400 font-mono uppercase block mb-0.5">Registry Status</span>
                        <span className="text-xs font-mono font-bold text-slate-800">{selectedCanonical.accountStatus || 'N/A'}</span>
                      </div>
                      <div className="border border-slate-100 rounded-lg p-3 bg-slate-50/30">
                        <span className="text-[10px] text-slate-400 font-mono uppercase block mb-0.5">Verification Status</span>
                        <span className="text-xs font-mono font-bold text-slate-800">{String(selectedCanonical.kycVerified ?? 'N/A')}</span>
                      </div>
                    </div>

                    {selectedCanonical.isDuplicate && (
                      <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-xs font-medium leading-relaxed flex gap-2.5">
                        <AlertTriangle className="text-amber-600 flex-shrink-0 mt-0.5" size={16} />
                        <div>
                          <span className="font-bold">Duplicate Identifier Safeguard Activated: ID {selectedCanonical.transactionId}</span>
                          <p className="text-[11px] text-amber-700 select-normal leading-relaxed mt-0.5">
                            This event has been safeguarded because an entry with a duplicate ID is active in the validator node queue ledger.
                          </p>
                        </div>
                      </div>
                    )}

                    {showCanonicalJSON && (
                      <div className="bg-slate-900 rounded-lg p-4 font-mono text-[11px] text-slate-350">
                        <div className="text-[10px] text-slate-500 uppercase border-b border-slate-850 pb-2 mb-2">Canonical Event JSON Value</div>
                        <pre className="overflow-x-auto whitespace-pre-wrap">{JSON.stringify(selectedCanonical, null, 2)}</pre>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-6 border border-dashed border-slate-150 rounded-xl bg-slate-50/40">
  <p className="text-slate-450 mb-3 text-xs">Unified schema normalization pending execution.</p>
  <p className="text-slate-400 text-[11px] font-mono">
    Click <span className="font-bold text-slate-600">Evaluate Event {selectedTxId}</span> above to run the full pipeline.
  </p>
</div>
                )}
              </div>

              {/* 3. RULE ENGINE & DECISION OUTCOME */}
              <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-sm space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                  <div className="w-5 h-5 rounded-full bg-emerald-50 flex items-center justify-center font-bold text-[11px] text-emerald-600 font-mono">3</div>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Config Rule Trace</h3>
                </div>

                {selectedCertificate ? (
                  <div className="space-y-4">
                    
                    {/* Constraints Tracer lists */}
                    <div className="space-y-2">
                      <span className="text-[11.5px] font-bold text-slate-700 tracking-tight font-sans">Evaluated Conditions Trace:</span>
                      
                      {selectedCertificate.rulesEvaluated.length === 0 ? (
                        <div className="p-3 bg-slate-50 border border-slate-150 text-slate-500 rounded-lg font-mono text-[11.5px] leading-relaxed flex gap-2">
                          <Info size={14} className="mt-0.5 flex-shrink-0 text-slate-400" />
                          <span>Standard constraint validation was bypassed because of duplication triggers or missing registry matches, forcing safety escalation.</span>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          {selectedCertificate.rulesEvaluated.map((rule, idx) => (
                            <div key={idx} className="border border-slate-150 rounded-lg p-3 bg-slate-50/20 font-sans">
                              <div className="flex justify-between items-center mb-1.5">
                                <span className="text-xs font-mono font-bold text-slate-700">{rule.ruleName}</span>
                                {rule.passed ? (
                                  <span className="text-emerald-700 text-[10px] font-bold font-mono bg-emerald-100 px-1.5 py-0.5 rounded">PASS</span>
                                ) : (
                                  <span className="text-rose-700 text-[10px] font-bold font-mono bg-rose-100 px-1.5 py-0.5 rounded">FAIL</span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-450 leading-relaxed font-mono">
                                Target Expected: <b>{String(rule.expected)}</b>
                                <br />
                                Parameter Value: <b className={rule.passed ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>{String(rule.actual)}</b>
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Immutable logs */}
                    <div className="space-y-2 pt-2">
                      <span className="text-[11.5px] font-bold text-slate-700 block tracking-tight font-sans">Policy Execution History Trace:</span>
                      <div className="bg-slate-50 text-[11.5px] font-mono text-slate-600 border border-slate-200/40 rounded-lg p-3 space-y-1.5 max-h-[140px] overflow-y-auto">
                        {selectedCertificate.auditTrail.map((log, idx) => {
                          const cleanLog = log
                            .replace(/pre-settlement/gi, 'pipeline')
                            .replace(/settlement/gi, 'execution queue')
                            .replace(/compliance check/gi, 'policy condition');
                          return (
                            <div key={idx} className="flex gap-2 leading-relaxed border-b border-slate-100/50 pb-1.5 last:border-none last:pb-0">
                              <span className="text-[10px] text-slate-400 font-mono">[{idx+1}]</span>
                              <span className="text-slate-600">{cleanLog}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Bold visible Result Display */}
                    <div className="border border-slate-200 rounded-xl p-5 mt-4 bg-slate-50/40 space-y-4">
                      <span className="text-[11px] text-slate-400 uppercase tracking-wider font-mono font-semibold block border-b border-slate-200/50 pb-1.5">Deterministic Decision Output</span>
                      
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg text-white font-bold text-xs uppercase tracking-widest ${getOutcomeStatusProps(selectedCertificate.finalDecision).fill}`}>
                            {selectedCertificate.finalDecision === 'approve' && <CheckCircle2 size={18} />}
                            {selectedCertificate.finalDecision === 'reject' && <AlertCircle size={18} />}
                            {selectedCertificate.finalDecision === 'manual_review' && <AlertTriangle size={18} />}
                            {selectedCertificate.finalDecision === 'insufficient_data' && <Info size={18} />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-lg font-bold text-slate-900 tracking-tight uppercase font-sans">
                                {selectedCertificate.finalDecision === 'approve' && 'APPROVE'}
                                {selectedCertificate.finalDecision === 'reject' && 'REJECT'}
                                {selectedCertificate.finalDecision === 'manual_review' && 'MANUAL REVIEW'}
                                {selectedCertificate.finalDecision === 'insufficient_data' && 'INSUFFICIENT DATA'}
                              </h4>
                              {getSaaSBadge(selectedCertificate.finalDecision)}
                            </div>
                            <p className="text-xs text-slate-500 mt-1 font-sans">
                              {getOutcomeStatusProps(selectedCertificate.finalDecision).text}
                            </p>
                          </div>
                        </div>

                        {/* Recommendation Callout */}
                        <div className="w-full sm:w-auto">
                          <div className="bg-white border border-slate-200 p-3 rounded-lg text-slate-800 shadow-sm flex items-center gap-2.5">
                            <div className={`w-2 h-2 rounded-full ${getOutcomeStatusProps(selectedCertificate.finalDecision).fill}`}></div>
                            <div className="font-mono text-xs">
                              <span className="text-[10.5px] text-slate-400 uppercase block leading-normal">Trigger Outcome</span>
                              <b className="text-slate-900 font-bold select-all tracking-tight text-[12.5px]">{triggerRecommendationMap(selectedCertificate.finalDecision).action}</b>
                            </div>
                          </div>
                        </div>
                      </div>

                      <p className="text-[11.5px] text-slate-500 font-sans italic bg-white/70 border border-slate-100 p-2.5 rounded text-left">
                        {triggerRecommendationMap(selectedCertificate.finalDecision).desc}
                      </p>
                    </div>

                  </div>
                ) : (
                  <div className="text-center py-6 text-slate-450 italic text-xs border border-dashed border-slate-150 rounded-xl bg-slate-50/40">
                    Rule trace details unavailable until evaluation procedures are activated.
                  </div>
                )}
              </div>

              {/* 4. VERIFIABLE OUTCOME CERTIFICATE */}
              <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-blue-50 flex items-center justify-center font-bold text-[11px] text-blue-600 font-mono">4</div>
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Verifiable Decision Certificate</h3>
                  </div>
                  {selectedCertificate && (
                    <button 
                      onClick={() => setShowCertificateJSON(!showCertificateJSON)}
                      className="text-xs text-slate-450 hover:text-slate-900 font-medium flex items-center gap-1 cursor-pointer transition-all"
                    >
                      {showCertificateJSON ? 'Hide Certificate Code' : 'Expose JSON Certificate'}
                      {showCertificateJSON ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                  )}
                </div>

                {selectedCertificate ? (
                  <div className="space-y-4">
                    
                    {/* Compact layout card resembling clean ticket */}
                    <div className="border border-slate-200 rounded-lg p-5 bg-slate-50/30 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2 text-xs">
                        <div>
                          <span className="text-[10px] text-slate-400 font-mono uppercase block">Certificate ID</span>
                          <span className="font-mono text-slate-800 font-bold select-all">{selectedCertificate.certificateId}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-mono uppercase block">Associated Event ID</span>
                          <span className="font-mono text-slate-800 font-bold select-all">{selectedCertificate.transactionId}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-mono uppercase block">Signature Timestamp</span>
                          <span className="font-mono text-slate-800">{new Date(selectedCertificate.timestamp).toLocaleString()}</span>
                        </div>
                      </div>

                      <div className="space-y-2 text-xs flex flex-col justify-between">
                        <div>
                          <span className="text-[10px] text-slate-400 font-mono uppercase block">Deterministic Integrity SHA-256</span>
                          <span className="font-mono text-[11px] text-slate-800 font-semibold break-all bg-white border border-slate-150 p-1.5 rounded select-all block mt-1" title={selectedCertificate.certificateHash}>
                            {selectedCertificate.certificateHash}
                          </span>
                        </div>

                        {/* Prompt-driven audit trigger verification button */}
                        <div className="flex gap-2">
                          <button
                            onClick={() => verifyCertificateHandshake(selectedCertificate.transactionId)}
                            className="bg-slate-900 hover:bg-slate-850 hover:scale-[1.01] text-xs px-4 py-2 cursor-pointer font-bold rounded-lg text-white uppercase transition-all tracking-wide font-sans shadow-sm inline-flex items-center gap-1.5"
                          >
                            Verify Integrity Certificate
                          </button>
                        </div>
                      </div>
                    </div>

                    {verificationResult && (
                      <div className={`p-4 rounded-xl border ${
                        verificationResult.verified 
                          ? 'bg-emerald-50 border-emerald-250/70 text-emerald-900' 
                          : 'bg-rose-50 border-rose-200 text-rose-900'
                      }`}>
                        <div className="flex items-center gap-2 font-bold mb-1.5 text-xs font-sans">
                          {verificationResult.verified ? (
                            <ShieldCheck size={16} className="text-emerald-600" />
                          ) : (
                            <ShieldAlert size={16} className="text-rose-600" />
                          )}
                          <span className="tracking-wider uppercase">
                            {verificationResult.verified ? "CRYPTOGRAPHIC INTEGRITY CONFIRMED" : "INTEGRITY TAMPERED FLAG"}
                          </span>
                        </div>
                        <p className="text-[11.5px] font-sans leading-relaxed">{verificationResult.message}</p>
                        
                        <div className="mt-3.5 pt-3.5 border-t border-slate-200/50 text-[10px] font-mono text-slate-450 break-all leading-normal">
                          Recomputed SHA-256 Verification Key: <br className="sm:hidden" />
                          <b className="text-slate-700">{verificationResult.certificateHash}</b>
                        </div>
                      </div>
                    )}

                    {showCertificateJSON && (
                      <div className="bg-slate-900 rounded-lg p-4 font-mono text-[11px] text-slate-350 relative">
                        <div className="text-[10px] text-slate-550 border-b border-slate-850 pb-2 mb-2 uppercase">Official Signed JSON Certificate Document</div>
                        <pre className="overflow-x-auto whitespace-pre-wrap">{JSON.stringify(selectedCertificate, null, 2)}</pre>
                      </div>
                    )}

                  </div>
                ) : (
                  <div className="text-center py-6 text-slate-450 italic text-xs border border-dashed border-slate-150 rounded-xl bg-slate-50/40">
                    Decision Certificate will be generated on rule evaluation execution.
                  </div>
                )}
              </div>

            </div>

          </div>
        ) : (
          /* TAB B: Raw event ingestion hubs */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-white p-6 rounded-xl border border-slate-200/80 shadow-md">
            
            {/* SOURCE A FORM */}
            <div className="border border-slate-150 p-6 rounded-xl bg-slate-50/20 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-150">
                  <div className="p-1.5 bg-emerald-50 rounded-lg text-emerald-700">
                    <Plus size={16} strokeWidth={2.5} />
                  </div>
                  <h3 className="font-bold text-slate-800 uppercase tracking-tight text-xs">Ingest JSON Event Payload (Source A)</h3>
                </div>

                <form onSubmit={handleIngestTransaction} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase font-mono">Event ID * (use duplicate IDs to trigger Manual Review escalation)</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. TX001"
                      value={customTxId}
                      onChange={(e) => setCustomTxId(e.target.value.toUpperCase())}
                      className="w-full bg-white border border-slate-200 hover:border-slate-300 focus:border-slate-500 px-3.5 py-2 rounded-lg text-xs font-mono text-slate-800 focus:outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase font-mono">Account Reference Node * (e.g. ACC001, ACC002)</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. ACC001"
                      value={customAccountId}
                      onChange={(e) => setCustomAccountId(e.target.value.toUpperCase())}
                      className="w-full bg-white border border-slate-200 hover:border-slate-300 focus:border-slate-500 px-3.5 py-2 rounded-lg text-xs font-mono text-slate-800 focus:outline-none transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase font-mono">Event Volume / Size *</label>
                      <input
                        type="number"
                        required
                        placeholder="e.g. 1500"
                        value={customAmount}
                        onChange={(e) => setCustomAmount(e.target.value)}
                        className="w-full bg-white border border-slate-200 hover:border-slate-300 focus:border-slate-500 px-3.5 py-2 rounded-lg text-xs font-mono text-slate-800 focus:outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase font-mono">Currency Value Unit</label>
                      <select
                        value={customCurrency}
                        onChange={(e) => setCustomCurrency(e.target.value)}
                        className="w-full bg-white border border-slate-200 hover:border-slate-300 focus:border-slate-500 px-3 py-2 rounded-lg text-xs font-mono text-slate-800 focus:outline-none transition-all"
                      >
                        <option value="INR">INR (₹)</option>
                        <option value="USD">USD ($)</option>
                        <option value="EUR">EUR (€)</option>
                        <option value="GBP">GBP (£)</option>
                      </select>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-slate-900 hover:bg-slate-850 hover:scale-[1.01] py-2 rounded-lg text-xs font-bold font-sans tracking-wider text-white uppercase shadow-sm cursor-pointer transition-all mt-4"
                  >
                    Ingest Event Payload
                  </button>
                </form>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200/55 rounded-lg text-slate-500 text-[11px] font-sans leading-relaxed">
                <span className="font-bold text-slate-700 block mb-0.5">Automated timestamp signature:</span> Secure deterministic node records ingestion timestamps on receipt, immediately tracking integrity parameters.
              </div>
            </div>

            {/* SOURCE B FORM */}
            <div className="border border-slate-150 p-6 rounded-xl bg-slate-50/20 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-150">
                  <div className="p-1.5 bg-blue-50 rounded-lg text-blue-700">
                    <Database size={16} />
                  </div>
                  <h3 className="font-bold text-slate-800 uppercase tracking-tight text-xs">Append CSV Registry Profile (Source B)</h3>
                </div>

                <form onSubmit={handleIngestRegistry} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase font-mono">Reference Account ID *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. ACC009"
                      value={customRegAccountId}
                      onChange={(e) => setCustomRegAccountId(e.target.value.toUpperCase())}
                      className="w-full bg-white border border-slate-200 hover:border-slate-300 focus:border-slate-500 px-3.5 py-2 rounded-lg text-xs font-mono text-slate-800 focus:outline-none transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase font-mono">Registry Status State</label>
                      <select
                        value={customRegStatus}
                        onChange={(e) => setCustomRegStatus(e.target.value)}
                        className="w-full bg-white border border-slate-200 hover:border-slate-300 focus:border-slate-500 px-3 py-2 rounded-lg text-xs font-mono text-slate-800 focus:outline-none transition-all"
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                        <option value="restricted">Restricted</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase font-mono">Verification Status Flag</label>
                      <select
                        value={customRegKyc}
                        onChange={(e) => setCustomRegKyc(e.target.value)}
                        className="w-full bg-white border border-slate-200 hover:border-slate-300 focus:border-slate-500 px-3 py-2 rounded-lg text-xs font-mono text-slate-800 focus:outline-none transition-all"
                      >
                        <option value="true">True (Passed)</option>
                        <option value="false">False (Failed)</option>
                      </select>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-slate-900 hover:bg-slate-850 hover:scale-[1.01] py-2 rounded-lg text-xs font-bold font-sans tracking-wider text-white uppercase shadow-sm cursor-pointer transition-all mt-4"
                  >
                    Append CSV Profile Record
                  </button>
                </form>

                {ingestSuccess && (
                  <div className="mt-4 p-3 bg-emerald-50 text-emerald-900 font-sans font-medium text-xs border border-emerald-200/60 rounded-lg">
                    {ingestSuccess}
                  </div>
                )}
              </div>

              <div className="p-4 bg-white border border-slate-150 rounded-xl space-y-2">
                <span className="text-[9.5px] font-mono text-slate-450 tracking-wider uppercase block border-b border-slate-100 pb-1 font-semibold">Active Registrations in node</span>
                <div className="font-mono text-[10.5px] text-slate-600 max-h-[140px] overflow-y-auto space-y-1.5">
                  {registrySources.map((reg, idx) => (
                    <div key={idx} className="bg-slate-50 border border-slate-150 px-3 py-2 rounded-lg whitespace-pre-wrap leading-normal">
                      <div className="text-[9px] text-slate-400 font-semibold mb-1">Payload SHA-256: {reg.rawPayloadHash.substring(0, 16)}...</div>
                      <div className="text-slate-800 font-bold select-all bg-white border border-slate-100 px-2 py-1 rounded">{reg.rawPayload}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        )}

      </main>
    </div>
  );
}
