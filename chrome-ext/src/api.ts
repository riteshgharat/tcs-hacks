/** Shared message types + API shapes for the Guardrail Tester extension. */

export type Source = "manual" | "chatgpt" | "gemini" | "deepseek" | "other";

export type RiskCategory =
  | "unsafe_content"
  | "bias"
  | "confidential_leakage"
  | "unsupported_claims"
  | "hallucination"
  | "none";

export type RiskBand = 0 | 1 | 2 | 3 | 4;

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
  confidence: "high" | "medium" | "low";
}

export interface LLMJudgeTrace {
  invoked: boolean;
  reason:
    | "no_rule_match"
    | "unsupported_language"
    | "needs_nuance"
    | "rule_low_confidence";
  category: RiskCategory;
  risk_score: number;
  flagged_phrase: string;
  rationale: string;
  safer_rewrite: string;
  model: string;
  latency_ms: number;
}

export interface EvaluateResponse {
  verdict: "Pass" | "Fail";
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

export interface HealthResponse {
  status: "ok";
  engine_version: string;
  rule_version: string;
  llm_enabled: boolean;
  llm_model: string | null;
  db_path: string;
  uptime_s: number;
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  request_id: string;
}

/** Content script / popup → service worker */
export type ExtMessage =
  | {
      type: "EVALUATE";
      prompt: string;
      response: string;
      source: Source;
    }
  | { type: "HEALTH" };

/** Service worker → content script / popup */
export type ExtResponse =
  | { type: "EVAL_RESULT"; result: EvaluateResponse }
  | { type: "EVAL_ERROR"; code: string; message: string }
  | { type: "HEALTH"; health: HealthResponse };

export interface ExtensionSettings {
  backendUrl: string;
  compactMode: boolean;
  enabledSites: string[];
  showSaferRewrite: boolean;
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  backendUrl: "http://localhost:8787",
  compactMode: false,
  enabledSites: ["chatgpt"],
  showSaferRewrite: true,
};
