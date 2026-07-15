import { z } from "zod";
import { config } from "../config.ts";
import type { EvaluateRequest } from "../engine/schema.ts";

export const sourceSchema = z.enum([
  "manual",
  "chatgpt",
  "gemini",
  "deepseek",
  "other",
]);

export const evaluateRequestSchema = z.object({
  prompt: z.string().min(1).max(config.maxInputChars),
  response: z.string().min(1).max(config.maxInputChars),
  source: sourceSchema,
  language: z.string().optional(),
}) satisfies z.ZodType<EvaluateRequest>;

export const batchRequestSchema = z.object({
  items: z.array(evaluateRequestSchema).min(1).max(50),
});

export type ValidationError = { field: string; message: string };

export function formatZodError(err: z.ZodError): ValidationError[] {
  return err.issues.map((issue) => ({
    field: issue.path.join(".") || "(root)",
    message: issue.message,
  }));
}

// LLM judge output parsing
import type { LLMJudgeRaw, RiskCategory } from "../engine/schema.ts";

const riskCategories: RiskCategory[] = [
  "unsafe_content",
  "bias",
  "confidential_leakage",
  "unsupported_claims",
  "hallucination",
  "none",
];

export const llmJudgeRawSchema = z.object({
  category: z.enum(riskCategories as [RiskCategory, ...RiskCategory[]]),
  risk_score: z.number().int(),
  flagged_phrase: z.string(),
  rationale: z.string(),
  safer_rewrite: z.string(),
});

export function parseLLMJudgeRaw(raw: unknown): LLMJudgeRaw | null {
  const parsed = llmJudgeRawSchema.safeParse(raw);
  if (!parsed.success) return null;
  const v = parsed.data;
  let score = Math.round(v.risk_score);
  if (score < 0) score = 0;
  if (score > 100) score = 100;
  return {
    category: v.category,
    risk_score: score,
    flagged_phrase: v.flagged_phrase,
    rationale: v.rationale,
    safer_rewrite: v.safer_rewrite,
  };
}
