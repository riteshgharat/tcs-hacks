// API response shapes not defined in engine/schema.ts (engine schema = Data_Schema.md
// contract). These are endpoint-level envelopes.
import type { HistoryRecord } from "../engine/schema.ts";

export interface HealthResponse {
  status: "ok" | "degraded";
  engine_version: string;
  rule_version: string;
  llm_enabled: boolean;
  llm_model: string | null;
  db_path: string;
  uptime_s: number;
}

export interface LanguagesResponse {
  rule_supported: { code: string; name: string; rule_version: string }[];
  llm_fallback: boolean;
}

export interface BatchResponse {
  results: import("../engine/schema.ts").EvaluateResponse[];
  summary: {
    total: number;
    pass: number;
    fail: number;
    by_category: Record<string, number>;
  };
}

export interface HistoryResponse {
  items: HistoryRecord[];
  total: number;
  limit: number;
  offset: number;
}

export interface ErrorResponse {
  error: { code: string; message: string; details?: unknown };
  request_id: string;
}
