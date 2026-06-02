/**
 * Shared Type Definitions for Financial Pre-Settlement Verification Engine
 */

export type SourceType = 'TRANSACTION_FEED' | 'ACCOUNT_REGISTRY';

export interface IngestedSource {
  id: string;
  type: SourceType;
  sourceTimestamp: string;
  ingestionTimestamp: string;
  rawPayload: string;
  rawPayloadHash: string;
}

export interface CanonicalEvent {
  transactionId: string;
  accountId: string;
  amount: number;
  currency: string;
  accountStatus?: string;
  kycVerified?: boolean;
  sourceTimestamp: string;
  ingestionTimestamp: string;
  isDuplicate: boolean;
  auditTrail: string[];
}

export interface RuleResult {
  ruleName: string;
  expected: any;
  actual: any;
  passed: boolean;
}

export type DecisionOutcome = 'approve' | 'reject' | 'manual_review' | 'insufficient_data';
export type TriggerRecommendation = 'release_settlement' | 'reject' | 'manual_review' | 'insufficient_data';

export interface RuleConfig {
  requireActiveAccount: boolean;
  requireKYC: boolean;
  maxAmount: number;
}

export interface DecisionCertificate {
  certificateId: string;
  transactionId: string;
  normalizedEvent: CanonicalEvent;
  sourceInputsUsed: {
    transactionFeedHash: string;
    accountRegistryHash: string | null;
  };
  rulesEvaluated: RuleResult[];
  finalDecision: DecisionOutcome;
  triggerRecommendation: TriggerRecommendation;
  auditTrail: string[];
  timestamp: string;
  certificateHash: string;
}

export interface IngestEventRequest {
  type: 'transaction' | 'registry';
  payload: any; // Can be SourceA JSON or SourceB CSV/JSON
}

export interface EvaluateResponse {
  decision: DecisionOutcome;
  triggerRecommendation: TriggerRecommendation;
  certificate: DecisionCertificate | null;
  message?: string;
}

export interface DashboardState {
  sources: IngestedSource[];
  isVerified: boolean;
  canVerify: boolean;
}
