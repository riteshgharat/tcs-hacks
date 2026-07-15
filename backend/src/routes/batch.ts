import { Hono } from "hono";
import { batchRequestSchema, formatZodError } from "../lib/validate.ts";
import { evaluate } from "../engine/pipeline.ts";
import { errorResp } from "./evaluate.ts";
import type { BatchResponse } from "./types.ts";
import type { EvaluateResponse, RiskCategory } from "../engine/schema.ts";

export const batchRoute = new Hono();

batchRoute.post("/", async (c) => {
  let reqBody: unknown;
  try {
    reqBody = await c.req.json();
  } catch {
    return errorResp(c, "E_VALIDATION", "Body must be valid JSON.", 400);
  }

  const parsed = batchRequestSchema.safeParse(reqBody);
  if (!parsed.success) {
    // Distinguish batch-too-large from generic validation for clarity.
    const items = (reqBody as { items?: unknown[] })?.items;
    if (Array.isArray(items) && items.length > 50) {
      return errorResp(c, "E_BATCH_TOO_LARGE", "Batch exceeds 50 items.", 400);
    }
    return errorResp(
      c,
      "E_VALIDATION",
      "Batch validation failed.",
      400,
      formatZodError(parsed.error)
    );
  }

  const items = parsed.data.items.map((d) => ({
    ...d,
    prompt: d.prompt.trim(),
    response: d.response.trim(),
  }));

  const results: EvaluateResponse[] = [];
  for (const item of items) {
    if (item.prompt === "" || item.response === "") {
      // Per-item validation failure → degraded EvaluateResponse with verdict Fail.
      results.push({
        verdict: "Fail",
        risk_category: "none",
        risk_score: 0,
        risk_band: 0,
        flagged_phrase: "",
        rationale: "Validation failed: prompt or response empty.",
        safer_rewrite: "",
        detected_language: "und",
        rule_engine: {
          fired: false,
          category: "none",
          risk_score: 0,
          matched_rule_id: null,
          flagged_phrase: "",
          confidence: "low",
        },
        llm_judge: null,
        source: item.source,
        evaluation_id: crypto.randomUUID(),
        rule_version: "n/a",
        engine_version: "n/a",
        created_at: new Date().toISOString(),
      });
      continue;
    }
    try {
      const result = await evaluate(item);
      results.push(result);
    } catch (err) {
      results.push({
        verdict: "Fail",
        risk_category: "none",
        risk_score: 0,
        risk_band: 0,
        flagged_phrase: "",
        rationale: `Evaluation error: ${err instanceof Error ? err.message : "unknown"}`,
        safer_rewrite: "",
        detected_language: "und",
        rule_engine: {
          fired: false,
          category: "none",
          risk_score: 0,
          matched_rule_id: null,
          flagged_phrase: "",
          confidence: "low",
        },
        llm_judge: null,
        source: item.source,
        evaluation_id: crypto.randomUUID(),
        rule_version: "n/a",
        engine_version: "n/a",
        created_at: new Date().toISOString(),
      });
    }
  }

  const byCategory: Record<string, number> = {};
  let pass = 0;
  let fail = 0;
  for (const r of results) {
    if (r.verdict === "Pass") pass++;
    else fail++;
    if (r.risk_category !== "none") {
      const cat = r.risk_category as RiskCategory;
      byCategory[cat] = (byCategory[cat] ?? 0) + 1;
    }
  }

  const body: BatchResponse = {
    results,
    summary: { total: results.length, pass, fail, by_category: byCategory },
  };
  return c.json(body, 200);
});
