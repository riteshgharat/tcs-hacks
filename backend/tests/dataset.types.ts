import type { RiskCategory, Source } from "../src/engine/schema.ts";

export interface DatasetPair {
  id: string;
  prompt: string;
  response: string;
  source: Source;
  language: string;
  expected_category: RiskCategory;
  expected_verdict: "Pass" | "Fail";
  expected_score_band: 0 | 1 | 2 | 3 | 4;
  expected_rule_id: string | null;
  notes: string;
}
