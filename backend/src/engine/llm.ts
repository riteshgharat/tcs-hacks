import OpenAI from "openai";
import { config, llmEnabled } from "../config.ts";
import type { LLMJudgeRaw, LLMJudgeTrace } from "./schema.ts";
import { parseLLMJudgeRaw } from "../lib/validate.ts";
import {
  SYSTEM_PROMPT,
  buildUserPrompt,
  FEW_SHOT_EXAMPLES,
  type FewShotExample,
} from "./llm.prompts.ts";

export type LLMReason =
  | "no_rule_match"
  | "unsupported_language"
  | "needs_nuance"
  | "rule_low_confidence";

interface CallArgs {
  prompt: string;
  response: string;
  detectedLanguage: string;
  reason: LLMReason;
  hint?: string;
}

// Lazy-init the client so config can be read at call time (tests may swap env).
let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (client) return client;
  client = new OpenAI({
    baseURL: config.llm.baseURL,
    apiKey: config.llm.apiKey || "missing",
    timeout: config.llm.timeoutMs,
    maxRetries: config.llm.maxRetries,
  });
  return client;
}

function buildMessages(
  systemPrompt: string,
  userContent: string,
  fewShots: FewShotExample[]
) {
  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: systemPrompt },
  ];
  for (const ex of fewShots) {
    messages.push({ role: "user", content: ex.user });
    messages.push({ role: "assistant", content: ex.assistant });
  }
  messages.push({ role: "user", content: userContent });
  return messages;
}

function extractJson(content: string): unknown | null {
  // Try direct parse first.
  try {
    return JSON.parse(content);
  } catch {
    // fall through
  }
  // Regex extract first {...} block.
  const m = content.match(/\{[\s\S]*\}/);
  if (m) {
    try {
      return JSON.parse(m[0]);
    } catch {
      // fall through
    }
  }
  return null;
}

// Returns parsed LLM judge result + trace, or null on failure (caller falls back to rules).
export async function callLLMJudge(args: CallArgs): Promise<{
  raw: LLMJudgeRaw;
  trace: LLMJudgeTrace;
} | null> {
  if (!llmEnabled) return null;

  const userContent = buildUserPrompt({
    prompt: args.prompt,
    response: args.response,
    detectedLanguage: args.detectedLanguage,
    hint: args.hint,
  });

  const messages = buildMessages(SYSTEM_PROMPT, userContent, FEW_SHOT_EXAMPLES);

  const startedAt = Date.now();
  let content: string | null = null;
  try {
    const completion = await getClient().chat.completions.create({
      model: config.llm.model,
      messages,
      temperature: 0.1,
      max_tokens: 800,
      ...(config.llm.useJsonMode ? { response_format: { type: "json_object" as const } } : {}),
    });
    content = completion.choices[0]?.message?.content ?? null;
  } catch (err) {
    console.error("[llm] call failed:", err instanceof Error ? err.message : err);
    return null;
  }
  const latencyMs = Date.now() - startedAt;

  if (!content) {
    console.error("[llm] empty content in response");
    return null;
  }

  const parsed = extractJson(content);
  if (parsed === null) {
    console.error("[llm] JSON parse failed; raw content:", content.slice(0, 200));
    return null;
  }

  const raw = parseLLMJudgeRaw(parsed);
  if (!raw) {
    console.error("[llm] schema validation failed for parsed object");
    return null;
  }

  // Validate flagged_phrase is a substring of response (case-sensitive, trimmed).
  let flaggedPhrase = raw.flagged_phrase;
  if (flaggedPhrase !== "") {
    const trimmed = flaggedPhrase.trim();
    if (!args.response.includes(trimmed)) {
      flaggedPhrase = "";
    } else {
      flaggedPhrase = trimmed;
    }
  }

  const trace: LLMJudgeTrace = {
    invoked: true,
    reason: args.reason,
    category: raw.category,
    risk_score: raw.risk_score,
    flagged_phrase: flaggedPhrase,
    rationale:
      flaggedPhrase === "" && raw.flagged_phrase !== ""
        ? `${raw.rationale} (flagged phrase not found verbatim in response; reset.)`
        : raw.rationale,
    safer_rewrite: raw.safer_rewrite,
    model: config.llm.model,
    latency_ms: latencyMs,
  };

  return {
    raw: { ...raw, flagged_phrase: flaggedPhrase },
    trace,
  };
}

// Reset client (test helper).
export function _resetClient(): void {
  client = null;
}
