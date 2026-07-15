// TS types mirroring docs/Data_Schema.md (FROZEN v1.0). Single source of truth for backend.
// Do not re-define these types elsewhere.

export type RiskCategory =
  | "unsafe_content"
  | "bias"
  | "confidential_leakage"
  | "unsupported_claims"
  | "hallucination"
  | "none";

export type Verdict = "Pass" | "Fail";

export type Source = "manual" | "chatgpt" | "gemini" | "deepseek" | "other";

export type RiskBand = 0 | 1 | 2 | 3 | 4;

export type Confidence = "high" | "medium" | "low";

export interface EvaluateRequest {
  prompt: string;
  response: string;
  source: Source;
  language?: string;
}

export interface RuleEngineTrace {
  fired: boolean;
  category: RiskCategory | "none";
  risk_score: number;
  matched_rule_id: string | null;
  flagged_phrase: string;
  confidence: Confidence;
}

export interface LLMJudgeTrace {
  invoked: boolean;
  reason: "no_rule_match" | "unsupported_language" | "needs_nuance" | "rule_low_confidence";
  category: RiskCategory;
  risk_score: number;
  flagged_phrase: string;
  rationale: string;
  safer_rewrite: string;
  model: string;
  latency_ms: number;
}

export interface EvaluateResponse {
  verdict: Verdict;
  risk_category: RiskCategory;
  risk_score: number;
  risk_band: RiskBand;
  flagged_phrase: string;
  rationale: string;
  safer_rewrite: string;
  detected_language: string;
  rule_engine: RuleEngineTrace;
  llm_judge: LLMJudgeTrace | null;
  source: Source;
  evaluation_id: string;
  rule_version: string;
  engine_version: string;
  created_at: string;
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  request_id: string;
}

export interface HistoryRecord {
  evaluation_id: string;
  verdict: Verdict;
  risk_category: RiskCategory;
  risk_score: number;
  risk_band: RiskBand;
  source: Source;
  detected_language: string;
  prompt_preview: string;
  response_preview: string;
  flagged_phrase: string;
  created_at: string;
}

// LLM judge raw output (parsed from provider response)
export interface LLMJudgeRaw {
  category: RiskCategory;
  risk_score: number;
  flagged_phrase: string;
  rationale: string;
  safer_rewrite: string;
}

export function bandFromScore(score: number): RiskBand {
  if (score <= 20) return 0;
  if (score <= 40) return 1;
  if (score <= 60) return 2;
  if (score <= 80) return 3;
  return 4;
}

export function verdictFromScore(score: number, category: RiskCategory): Verdict {
  return score > 40 && category !== "none" ? "Fail" : "Pass";
}

export function preview(text: string, n = 200): string {
  return text.length > n ? text.slice(0, n) : text;
}
