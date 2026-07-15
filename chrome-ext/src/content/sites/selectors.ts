import type { Source } from "../api";

export interface SiteSelectors {
  thread: string;
  userMessage: string;
  assistantMessage: string;
  /** Selector whose presence inside an assistant message means streaming is done */
  streamDoneSignal: string;
}

export interface SiteConfig {
  id: Source;
  match: string[];
  selectors: SiteSelectors;
  status: "ready" | "stub";
}

export const SITES: Record<string, SiteConfig> = {
  chatgpt: {
    id: "chatgpt",
    match: ["https://chatgpt.com/*", "https://chat.openai.com/*"],
    selectors: {
      thread: '[id^="thread-"]',
      userMessage: '[data-message-author-role="user"]',
      assistantMessage: '[data-message-author-role="assistant"]',
      streamDoneSignal: '[aria-label="Copy"]',
    },
    status: "ready",
  },
  gemini: {
    id: "gemini",
    match: ["https://gemini.google.com/*"],
    selectors: {
      thread: "chat-window",
      userMessage: "user-query",
      assistantMessage: "model-response",
      streamDoneSignal: ".done-icon",
    },
    status: "stub",
  },
  deepseek: {
    id: "deepseek",
    match: ["https://chat.deepseek.com/*"],
    selectors: {
      thread: '[class*="chat"]',
      userMessage: '[class*="user"]',
      assistantMessage: '[class*="assistant"]',
      streamDoneSignal: '[class*="copy"]',
    },
    status: "stub",
  },
};

export function getReadySite(id: string): SiteConfig | null {
  const site = SITES[id];
  if (!site || site.status !== "ready") return null;
  return site;
}
