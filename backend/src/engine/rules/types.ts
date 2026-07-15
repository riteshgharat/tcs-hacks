import type { Confidence, RiskCategory } from "../schema.ts";

export interface Rule {
  id: string; // e.g. "en-v1.pii.password"
  category: RiskCategory;
  // matcher: either a regex (run on response) or a function for staged logic
  match: (ctx: MatchContext) => RuleMatch | null;
  score: number; // 0-100, base score on match
  confidence: Confidence;
  rationaleTemplate: string; // {{phrase}} substituted
  rewriteTemplate?: string; // {{phrase}} substituted; LLM preferred when invoked
}

export interface MatchContext {
  prompt: string;
  response: string;
  detectedLanguage: string;
}

export interface RuleMatch {
  rule_id: string;
  category: RiskCategory;
  score: number;
  confidence: Confidence;
  flagged_phrase: string;
  rationale: string;
  safer_rewrite?: string;
}

export function applyTemplate(
  template: string,
  phrase: string
): string {
  return template.replace(/\{\{phrase\}\}/g, phrase);
}
