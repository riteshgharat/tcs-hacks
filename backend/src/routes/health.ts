import { Hono, type Context } from "hono";
import { config, llmEnabled } from "../config.ts";
import { dbHealthy } from "../db/history.ts";
import type { HealthResponse, LanguagesResponse } from "./types.ts";

export const healthRoute = new Hono();

healthRoute.get("/", (c) => {
  const healthy = dbHealthy();
  const body: HealthResponse = {
    status: healthy ? "ok" : "degraded",
    engine_version: config.engineVersion,
    rule_version: config.defaultRuleLang,
    llm_enabled: llmEnabled,
    llm_model: llmEnabled ? config.llm.model : null,
    db_path: config.dbPath,
    uptime_s: Math.round(process.uptime()),
  };
  if (!healthy) return c.json(body, 503);
  return c.json(body, 200);
});

export function languagesHandler(c: Context): Response {
  const body: LanguagesResponse = {
    rule_supported: [
      {
        code: "en",
        name: "English",
        rule_version: config.defaultRuleLang,
      },
    ],
    llm_fallback: llmEnabled,
  };
  return c.json(body, 200);
}
