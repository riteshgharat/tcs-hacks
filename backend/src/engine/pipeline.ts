import { config } from "../config.ts";
import type {
  EvaluateRequest,
  EvaluateResponse,
  LLMJudgeTrace,
  RiskCategory,
  RuleEngineTrace,
} from "./schema.ts";
import { bandFromScore, preview } from "./schema.ts";
import { uuid } from "../lib/id.ts";
import { detectLanguage, isRuleSupported } from "./lang.ts";
import { runRules } from "./rules/index.ts";
import type { MatchContext } from "./rules/types.ts";
import { callLLMJudge, type LLMReason } from "./llm.ts";
import { mergeVerdict } from "./merge.ts";
import { insertHistory } from "../db/history.ts";

export async function evaluate(req: EvaluateRequest): Promise<EvaluateResponse> {
  const detectedLanguage = req.language && req.language.trim() !== ""
    ? req.language.trim()
    : detectLanguage(req.prompt, req.response);

  const ctx: MatchContext = {
    prompt: req.prompt,
    response: req.response,
    detectedLanguage,
  };

  const ruleVersion = config.defaultRuleLang; // "en-v1"
  const ruleResult = isRuleSupported(detectedLanguage)
    ? runRules(detectedLanguage, ctx, ruleVersion)
    : { fired: false, match: null, allMatches: [] };

  const dominantMatch = ruleResult.match;

  // Decide whether to invoke LLM and why.
  let llmReason: LLMReason | null = null;
  let llmHint: string | undefined;

  if (!isRuleSupported(detectedLanguage)) {
    llmReason = "unsupported_language";
  } else if (dominantMatch && (dominantMatch.confidence === "medium" || dominantMatch.confidence === "low")) {
    llmReason = "rule_low_confidence";
    llmHint = `rule_engine_suspects: ${dominantMatch.category}`;
  } else if (!dominantMatch) {
    // No rule fired. Check if prompt shape suggests a nuance category.
    if (needsNuanceCheck(ctx)) {
      llmReason = "needs_nuance";
      llmHint = nuanceHint(ctx);
    } else {
      llmReason = "no_rule_match";
    }
  }

  const ruleTrace: RuleEngineTrace = {
    fired: ruleResult.fired,
    category: dominantMatch?.category ?? "none",
    risk_score: dominantMatch?.score ?? 0,
    matched_rule_id: dominantMatch?.rule_id ?? null,
    flagged_phrase: dominantMatch?.flagged_phrase ?? "",
    confidence: dominantMatch?.confidence ?? "low",
  };

  let llmTrace: LLMJudgeTrace | null = null;
  let llmRawCategory: RiskCategory | null = null;
  let llmRawScore: number | null = null;
  let llmRawPhrase: string | null = null;
  let llmRawRationale: string | null = null;
  let llmRawRewrite: string | null = null;

  // Only invoke LLM if a reason exists AND rule isn't high-confidence.
  if (llmReason !== null && !(dominantMatch && dominantMatch.confidence === "high")) {
    const result = await callLLMJudge({
      prompt: req.prompt,
      response: req.response,
      detectedLanguage,
      reason: llmReason,
      hint: llmHint,
    });
    if (result) {
      llmTrace = result.trace;
      llmRawCategory = result.raw.category;
      llmRawScore = result.raw.risk_score;
      llmRawPhrase = result.raw.flagged_phrase;
      llmRawRationale = result.raw.rationale;
      llmRawRewrite = result.raw.safer_rewrite;
    }
  }

  const merged = mergeVerdict({
    request: req,
    detectedLanguage,
    ruleTrace,
    dominantMatch,
    llmTrace,
    llmRawCategory,
    llmRawScore,
    llmRawPhrase,
    llmRawRationale,
    llmRawRewrite,
  });

  const evaluationId = uuid();
  const createdAt = new Date().toISOString();

  const response: EvaluateResponse = {
    verdict: merged.verdict,
    risk_category: merged.risk_category,
    risk_score: merged.risk_score,
    risk_band: bandFromScore(merged.risk_score),
    flagged_phrase: merged.flagged_phrase,
    rationale: merged.rationale,
    safer_rewrite: merged.safer_rewrite,
    detected_language: detectedLanguage,
    rule_engine: ruleTrace,
    llm_judge: llmTrace,
    source: req.source,
    evaluation_id: evaluationId,
    rule_version: ruleVersion,
    engine_version: config.engineVersion,
    created_at: createdAt,
  };

  // Persist history (best-effort; failure does not break evaluation).
  try {
    insertHistory({
      evaluation_id: evaluationId,
      verdict: response.verdict,
      risk_category: response.risk_category,
      risk_score: response.risk_score,
      risk_band: response.risk_band,
      source: response.source,
      detected_language: response.detected_language,
      prompt_preview: preview(req.prompt),
      response_preview: preview(req.response),
      flagged_phrase: response.flagged_phrase,
      created_at: createdAt,
    });
  } catch (err) {
    console.error("[history] insert failed:", err instanceof Error ? err.message : err);
  }

  return response;
}

// Heuristic: does the prompt suggest a nuance category even though no rule fired?
function needsNuanceCheck(ctx: MatchContext): boolean {
  const p = ctx.prompt.toLowerCase();
  // Loaded-opinion shape without Stage A punctuation? Still worth an LLM check.
  if (/\b(greatest|best|worst|smartest|superior)\b/.test(p)) return true;
  // Opinion/subjective question patterns.
  if (/\bwhich\b.*\b(is|are)\b.*\?/.test(p)) return true;
  // "Is there a law/study/report about" — hallucination risk.
  if (/\b(law|study|report|paper|statistic)\b/.test(p)) return true;
  // Absolute claim prompts.
  if (/\b(always|never|guaranteed|proven)\b/.test(p)) return true;
  return false;
}

function nuanceHint(ctx: MatchContext): string {
  const p = ctx.prompt.toLowerCase();
  if (/\b(greatest|best|worst|smartest|superior)\b/.test(p) || /\bwhich\b.*\b(is|are)\b.*\?/.test(p)) {
    return "rule_engine_suspects: bias";
  }
  if (/\b(law|study|report|paper|statistic)\b/.test(p)) {
    return "rule_engine_suspects: hallucination";
  }
  if (/\b(always|never|guaranteed|proven)\b/.test(p)) {
    return "rule_engine_suspects: unsupported_claims";
  }
  return "";
}
