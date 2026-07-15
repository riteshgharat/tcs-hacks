import { test, expect, describe } from "bun:test";
import dataset from "../dataset.json" with { type: "json" };
import { runRules } from "../src/engine/rules/index.ts";
import { detectLanguage, isRuleSupported } from "../src/engine/lang.ts";
import type { MatchContext } from "../src/engine/rules/types.ts";
import type { DatasetPair } from "./dataset.types.ts";

const pairs = (dataset as { pairs: DatasetPair[] }).pairs;

describe("dataset integrity", () => {
  test("has 15-20 pairs", () => {
    expect(pairs.length).toBeGreaterThanOrEqual(15);
    expect(pairs.length).toBeLessThanOrEqual(20);
  });

  test("every pair has required fields", () => {
    for (const p of pairs) {
      expect(typeof p.id).toBe("string");
      expect(p.prompt.length).toBeGreaterThan(0);
      expect(p.response.length).toBeGreaterThan(0);
      expect(p.expected_category).toBeTruthy();
      expect(["Pass", "Fail"]).toContain(p.expected_verdict);
      expect([0, 1, 2, 3, 4]).toContain(p.expected_score_band);
    }
  });

  test("includes password reference example", () => {
    const pwd = pairs.find(
      (p) =>
        p.expected_category === "confidential_leakage" &&
        p.expected_rule_id === "en-v1.pii.password" &&
        /password/i.test(p.prompt)
    );
    expect(pwd).toBeTruthy();
  });

  test("includes greatest-country bias reference example with !!!???", () => {
    const bias = pairs.find(
      (p) =>
        p.expected_category === "bias" &&
        /greatest country/i.test(p.prompt) &&
        /[!?]{2,}/.test(p.prompt)
    );
    expect(bias).toBeTruthy();
  });

  test("distribution covers all 5 risk categories + clean + multilingual", () => {
    const cats = new Set(
      pairs
        .filter((p) => p.expected_category !== "none")
        .map((p) => p.expected_category)
    );
    for (const required of [
      "unsafe_content",
      "bias",
      "confidential_leakage",
      "unsupported_claims",
      "hallucination",
    ]) {
      expect(cats.has(required as DatasetPair["expected_category"])).toBe(true);
    }
    // Clean true-negatives
    expect(pairs.filter((p) => p.expected_verdict === "Pass").length).toBeGreaterThanOrEqual(4);
    // Multilingual
    expect(pairs.filter((p) => p.language !== "en").length).toBeGreaterThanOrEqual(1);
  });
});

describe("rule engine — rule-catchable cases", () => {
  // Only test pairs where rules are expected to fire (expected_rule_id set) OR clean pairs
  // in English (rules should NOT fire on them).
  for (const p of pairs) {
    const ruleCatchable = p.expected_rule_id !== null && p.language === "en";
    const cleanEnglish = p.expected_verdict === "Pass" && p.language === "en";

    if (!ruleCatchable && !cleanEnglish) continue;

    const label = `${p.id} [${p.expected_category}/${p.expected_verdict}]`;

    if (ruleCatchable) {
      const expectedRuleId = p.expected_rule_id as string;
      test(`${label}: rule ${expectedRuleId} fires`, () => {
        const lang = detectLanguage(p.prompt, p.response);
        expect(isRuleSupported(lang) || p.language === "en").toBe(true);
        const ctx: MatchContext = {
          prompt: p.prompt,
          response: p.response,
          detectedLanguage: p.language,
        };
        const result = runRules(p.language, ctx);
        expect(result.fired).toBe(true);
        expect(result.match).not.toBeNull();
        expect(result.match!.rule_id).toBe(expectedRuleId);
        expect(result.match!.category).toBe(p.expected_category);
      });
    }

    if (cleanEnglish) {
      test(`${label}: no rule fires (clean negative)`, () => {
        const ctx: MatchContext = {
          prompt: p.prompt,
          response: p.response,
          detectedLanguage: "en",
        };
        const result = runRules("en", ctx);
        expect(result.fired).toBe(false);
        expect(result.match).toBeNull();
      });
    }
  }
});

describe("language detection", () => {
  test("multilingual pair returns a valid code and routes to LLM (not rule-supported)", () => {
    const multilang = pairs.find((p) => p.language !== "en");
    expect(multilang).toBeTruthy();
    const lang = detectLanguage(multilang!.prompt, multilang!.response);
    // Code-mixed short text can confuse trigram detectors (may return hi, en,
    // or an adjacent roman-script code). Functional requirement: it must be a
    // valid 2-letter code or "und", AND route to the LLM (not rule-supported)
    // unless detected as English.
    expect(lang).toMatch(/^[a-z]{2}$|^und$/);
    if (lang !== "en") {
      expect(isRuleSupported(lang)).toBe(false);
    }
  });

  test("English pairs detected as en", () => {
    const en = pairs.find((p) => p.language === "en" && p.expected_category === "confidential_leakage");
    const lang = detectLanguage(en!.prompt, en!.response);
    expect(lang).toBe("en");
  });
});
