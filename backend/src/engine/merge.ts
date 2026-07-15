import type {
  EvaluateRequest,
  LLMJudgeTrace,
  RuleEngineTrace,
  RiskCategory,
  Verdict,
} from "./schema.ts";
import type { RuleMatch } from "./rules/types.ts";
import { bandFromScore, verdictFromScore } from "./schema.ts";

export interface MergeInputs {
  request: EvaluateRequest;
  detectedLanguage: string;
  ruleTrace: RuleEngineTrace;
  dominantMatch: RuleMatch | null;
  llmTrace: LLMJudgeTrace | null;
  llmRawCategory: RiskCategory | null;
  llmRawScore: number | null;
  llmRawPhrase: string | null;
  llmRawRationale: string | null;
  llmRawRewrite: string | null;
}

export interface MergedVerdict {
  risk_category: RiskCategory;
  risk_score: number;
  flagged_phrase: string;
  rationale: string;
  safer_rewrite: string;
  verdict: Verdict;
}

export function mergeVerdict(inputs: MergeInputs): MergedVerdict {
  const {
    dominantMatch,
    llmTrace,
    llmRawCategory,
    llmRawScore,
    llmRawPhrase,
    llmRawRationale,
    llmRawRewrite,
  } = inputs;

  // Case 1: rule fired at high confidence — rule wins outright, LLM not invoked.
  if (dominantMatch && dominantMatch.confidence === "high") {
    const score = dominantMatch.score;
    return {
      risk_category: dominantMatch.category,
      risk_score: score,
      flagged_phrase: dominantMatch.flagged_phrase,
      rationale: dominantMatch.rationale,
      safer_rewrite: dominantMatch.safer_rewrite ?? "",
      verdict: verdictFromScore(score, dominantMatch.category),
    };
  }

  // Case 2: rule fired at medium/low confidence — LLM invoked to confirm + merge.
  if (dominantMatch && llmTrace && llmRawCategory !== null && llmRawScore !== null) {
    const score = Math.max(dominantMatch.score, llmRawScore);
    const category: RiskCategory =
      score === dominantMatch.score ? dominantMatch.category : llmRawCategory;
    const flaggedPhrase = longerOf(dominantMatch.flagged_phrase, llmTrace.flagged_phrase);
    const rationale = combineRationale(dominantMatch.rationale, llmRawRationale ?? "");
    const saferRewrite = llmRawRewrite && llmRawRewrite !== ""
      ? llmRawRewrite
      : dominantMatch.safer_rewrite ?? "";
    return {
      risk_category: category,
      risk_score: score,
      flagged_phrase: flaggedPhrase,
      rationale,
      safer_rewrite: saferRewrite,
      verdict: verdictFromScore(score, category),
    };
  }

  // Case 3: rule fired at medium/low confidence but LLM unavailable — use rule verdict.
  if (dominantMatch) {
    const score = dominantMatch.score;
    return {
      risk_category: dominantMatch.category,
      risk_score: score,
      flagged_phrase: dominantMatch.flagged_phrase,
      rationale: dominantMatch.rationale,
      safer_rewrite: dominantMatch.safer_rewrite ?? "",
      verdict: verdictFromScore(score, dominantMatch.category),
    };
  }

  // Case 4: no rule fired — LLM verdict (or Pass if LLM unavailable).
  if (llmTrace && llmRawCategory !== null && llmRawScore !== null) {
    const score = llmRawScore;
    return {
      risk_category: llmRawCategory,
      risk_score: score,
      flagged_phrase: llmTrace.flagged_phrase,
      rationale: llmRawRationale ?? "",
      safer_rewrite: llmRawRewrite ?? "",
      verdict: verdictFromScore(score, llmRawCategory),
    };
  }

  // Case 5: no rule, no LLM — clean Pass.
  return {
    risk_category: "none",
    risk_score: 0,
    flagged_phrase: "",
    rationale: "No rules fired; LLM judge unavailable. Response passed by default (degraded mode).",
    safer_rewrite: "",
    verdict: "Pass",
  };
}

function longerOf(a: string, b: string): string {
  if (a.length >= b.length) return a;
  return b;
}

function combineRationale(rule: string, llm: string): string {
  const t = llm.trim();
  if (t === "") return rule;
  return `${rule} LLM confirms: ${t}`;
}

// Re-export band for convenience in pipeline.
export { bandFromScore };
