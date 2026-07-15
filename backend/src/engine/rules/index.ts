import type { Rule, RuleMatch, MatchContext } from "./types.ts";
import * as enV1 from "./en-v1.ts";

export const RULE_SETS: Record<string, Rule[]> = {
  "en-v1": enV1.rules,
};

export function getRules(lang: string, ruleVersion?: string): Rule[] {
  // Prefer explicit rule version; else default to "<lang>-v1".
  if (ruleVersion && RULE_SETS[ruleVersion]) return RULE_SETS[ruleVersion];
  const key = `${lang}-v1`;
  return RULE_SETS[key] ?? [];
}

export interface RuleEngineResult {
  fired: boolean;
  match: RuleMatch | null;
  allMatches: RuleMatch[]; // if multiple rules fire, keep all for combine
}

// Run all rules for the detected language; collect every match (rule set is
// designed to be mostly mutually exclusive, but combine logic handles overlap).
export function runRules(
  lang: string,
  ctx: MatchContext,
  ruleVersion?: string
): RuleEngineResult {
  const rules = getRules(lang, ruleVersion);
  const allMatches: RuleMatch[] = [];
  for (const rule of rules) {
    const m = rule.match(ctx);
    if (m) allMatches.push(m);
  }
  // Pick the highest-scoring match as the dominant one.
  if (allMatches.length === 0) {
    return { fired: false, match: null, allMatches: [] };
  }
  const dominant = allMatches.reduce((best, m) =>
    m.score > best.score ? m : best
  );
  return { fired: true, match: dominant, allMatches };
}
