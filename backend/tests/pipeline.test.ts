import { test, expect, describe, beforeAll } from "bun:test";
import dataset from "../dataset.json" with { type: "json" };
import { evaluate } from "../src/engine/pipeline.ts";
import { _resetDb } from "../src/db/sqlite.ts";
import { llmEnabled } from "../src/config.ts";
import type { DatasetPair } from "./dataset.types.ts";

const pairs = (dataset as { pairs: DatasetPair[] }).pairs;

// Use a temp DB for pipeline tests so we don't pollute dev DB.
beforeAll(() => {
  process.env.DB_PATH =
    "C:\\Users\\RITESH\\AppData\\Local\\Temp\\opencode\\guardrail-test.sqlite";
  _resetDb();
});

describe("pipeline — full dataset", () => {
  for (const p of pairs) {
    const isLLMOnlyFail =
      p.expected_rule_id === null && p.expected_verdict === "Fail";
    const isRuleCatchable = p.expected_rule_id !== null && p.expected_verdict === "Fail";
    const isCleanPass = p.expected_verdict === "Pass";

    test(`${p.id} [${p.expected_category}/${p.expected_verdict}]`, async () => {
      const result = await evaluate({
        prompt: p.prompt,
        response: p.response,
        source: p.source,
        language: p.language,
      });

      // Verdict assertion policy:
      //  - rule-catchable Fails: always assert Fail (rules must catch regardless of LLM).
      //  - clean Passes: always assert Pass (must not over-flag, with or without LLM).
      //  - LLM-only Fails: assert Fail only when LLM is wired; in degraded (rules-only)
      //    mode they are expected to Pass — documented limitation. Still assert the
      //    response is valid (no crash, valid shape).
      if (isRuleCatchable) {
        expect(result.verdict).toBe("Fail");
      } else if (isCleanPass) {
        expect(result.verdict).toBe("Pass");
        expect(result.risk_category).toBe("none");
        expect(result.flagged_phrase).toBe("");
        expect(result.safer_rewrite).toBe("");
      } else if (isLLMOnlyFail) {
        if (llmEnabled) {
          expect(result.verdict).toBe("Fail");
          expect(result.risk_category).toBe(p.expected_category);
        } else {
          // Degraded mode: LLM not available → rules can't catch → Pass is acceptable.
          expect(["Pass", "Fail"]).toContain(result.verdict);
          expect(result.llm_judge).toBeNull();
        }
      }

      // Band tolerance: allow ±1 band drift (score can vary, band edges fuzzy).
      if (result.verdict === p.expected_verdict) {
        const bandDiff = Math.abs(result.risk_band - p.expected_score_band);
        expect(bandDiff).toBeLessThanOrEqual(1);
      }

      // Rule-catchable: rule must have fired with the expected rule id.
      if (isRuleCatchable) {
        expect(result.rule_engine.fired).toBe(true);
        expect(result.rule_engine.matched_rule_id).toBe(p.expected_rule_id);
        expect(result.risk_category).toBe(p.expected_category);
      }

      // Fail: flagged phrase must be a real substring of the response (or empty
      // only if anchoring failed — rare, accept either).
      if (result.verdict === "Fail" && result.flagged_phrase !== "") {
        expect(p.response).toContain(result.flagged_phrase);
      }
    });
  }
});

describe("pipeline — degraded mode (rules-only) known limitations", () => {
  test("LLM-only pairs still produce a valid verdict in degraded mode", async () => {
    const p = pairs.find((x) => x.id === "p02")!;
    const result = await evaluate({
      prompt: p.prompt,
      response: p.response,
      source: p.source,
    });
    expect(["Pass", "Fail"]).toContain(result.verdict);
    if (!llmEnabled) {
      expect(result.llm_judge).toBeNull();
    }
  });
});

describe("pipeline — idempotency + history", () => {
  test("evaluation_id is a UUID and created_at is ISO 8601", async () => {
    const result = await evaluate({
      prompt: "Explain indexes.",
      response: "An index speeds up queries.",
      source: "manual",
    });
    expect(result.evaluation_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
    expect(result.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
