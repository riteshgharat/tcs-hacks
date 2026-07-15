import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

function bool(key: string, fallback: boolean): boolean {
  const v = process.env[key];
  if (!v) return fallback;
  return v.trim().toLowerCase() === "true" || v.trim() === "1";
}

function str(key: string, fallback: string): string {
  const v = process.env[key];
  return v && v.trim() !== "" ? v : fallback;
}

function int(key: string, fallback: number): number {
  const v = process.env[key];
  if (!v) return fallback;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

function list(key: string, fallback: string[]): string[] {
  const v = process.env[key];
  if (!v) return fallback;
  return v.split(",").map((s) => s.trim()).filter((s) => s !== "");
}

const dbPath = resolve(str("DB_PATH", "./data/guardrail.sqlite"));
const dbDir = dirname(dbPath);
if (!existsSync(dbDir)) mkdirSync(dbDir, { recursive: true });

export const config = {
  backendPort: int("BACKEND_PORT", 8787),
  dbPath,
  corsOrigins: list("CORS_ORIGINS", [
    "http://localhost:5173",
    "chrome-extension://*",
  ]),
  llm: {
    baseURL: str("LLM_BASE_URL", "https://api.vultrinference.com/v1"),
    apiKey: process.env.LLM_API_KEY?.trim() ?? "",
    model: str("LLM_MODEL", "llama-3.1-8b-instruct"),
    timeoutMs: int("LLM_TIMEOUT_MS", 15000),
    maxRetries: int("LLM_MAX_RETRIES", 2),
    useJsonMode: bool("LLM_USE_JSON_MODE", false),
  },
  engineVersion: str("ENGINE_VERSION", "1.0.0"),
  defaultRuleLang: str("DEFAULT_RULE_LANG", "en-v1"),
  maxInputChars: int("MAX_INPUT_CHARS", 16000),
} as const;

export const llmEnabled = config.llm.apiKey !== "";
