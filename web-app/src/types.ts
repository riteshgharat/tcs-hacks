export type Verdict = "Pass" | "Fail";

export type RiskCategory =
  | "unsafe_content"
  | "bias"
  | "confidential_leakage"
  | "unsupported_claims"
  | "hallucination"
  | "none";

export interface EvaluateRequest {
  prompt: string;
  response: string;
  source: "manual";
  language?: string;
}

export interface EvaluateResponse {
  verdict: Verdict;
  risk_category: RiskCategory;
  risk_score: number;
  risk_band: 0 | 1 | 2 | 3 | 4;
  flagged_phrase: string;
  rationale: string;
  safer_rewrite: string;
  detected_language: string;
  rule_engine: {
    fired: boolean;
    category: RiskCategory | "none";
    risk_score: number;
    matched_rule_id: string | null;
    flagged_phrase: string;
    confidence: "high" | "medium" | "low";
  };
  llm_judge: {
    invoked: boolean;
    category: RiskCategory;
    risk_score: number;
    flagged_phrase: string;
    rationale: string;
    safer_rewrite: string;
    model: string;
    latency_ms: number;
  } | null;
  source: string;
  evaluation_id: string;
  rule_version: string;
  engine_version: string;
  created_at: string;
}

export interface HistoryRecord {
  evaluation_id: string;
  verdict: Verdict;
  risk_category: RiskCategory;
  risk_score: number;
  risk_band: 0 | 1 | 2 | 3 | 4;
  source: string;
  detected_language: string;
  prompt_preview: string;
  response_preview: string;
  flagged_phrase: string;
  created_at: string;
}

export interface HistoryResponse {
  items: HistoryRecord[];
  total: number;
  limit: number;
  offset: number;
}
