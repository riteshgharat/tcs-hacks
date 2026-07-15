import { SITES } from "./selectors";

const SITE = SITES.chatgpt;

export interface Extraction {
  prompt: string;
  response: string;
  assistantEl: HTMLElement;
  usedFallback: boolean;
}

function textOf(el: Element | null): string {
  if (!el) return "";
  return (el.textContent ?? "").replace(/\s+/g, " ").trim();
}

/** Find conversation thread root with fallback chain. */
export function findThreadRoot(): HTMLElement | null {
  const official = document.querySelector(SITE.selectors.thread);
  if (official instanceof HTMLElement) return official;

  const classHint = document.querySelector('main [class*="thread"], main [class*="conversation"]');
  if (classHint instanceof HTMLElement) {
    console.warn("[gt] fallback used: thread class hint");
    return classHint;
  }

  const main = document.querySelector("main");
  if (main instanceof HTMLElement) {
    console.warn("[gt] fallback used: main as thread root");
    return main;
  }

  console.warn("[gt] selectors broken on chatgpt: thread root not found");
  return null;
}

function queryUserMessages(root: ParentNode): HTMLElement[] {
  const official = [...root.querySelectorAll(SITE.selectors.userMessage)].filter(
    (el): el is HTMLElement => el instanceof HTMLElement,
  );
  if (official.length > 0) return official;

  const articles = [...root.querySelectorAll("article")].filter((el): el is HTMLElement => {
    if (!(el instanceof HTMLElement)) return false;
    const role = el.getAttribute("data-message-author-role");
    if (role === "user") return true;
    const cls = el.className?.toString?.() ?? "";
    return /user/i.test(cls) && !/assistant/i.test(cls);
  });
  if (articles.length > 0) {
    console.warn("[gt] fallback used: user article heuristics");
    return articles;
  }
  return [];
}

function queryAssistantMessages(root: ParentNode): HTMLElement[] {
  const official = [
    ...root.querySelectorAll(SITE.selectors.assistantMessage),
  ].filter((el): el is HTMLElement => el instanceof HTMLElement);
  if (official.length > 0) return official;

  const articles = [...root.querySelectorAll("article")].filter((el): el is HTMLElement => {
    if (!(el instanceof HTMLElement)) return false;
    const role = el.getAttribute("data-message-author-role");
    if (role === "assistant") return true;
    const cls = el.className?.toString?.() ?? "";
    return /assistant|bot|agent/i.test(cls);
  });
  if (articles.length > 0) {
    console.warn("[gt] fallback used: assistant article heuristics");
    return articles;
  }

  // Paragraph-count heuristic: large text blocks after user messages
  const candidates = [...root.querySelectorAll("div")].filter((el): el is HTMLElement => {
    if (!(el instanceof HTMLElement)) return false;
    const ps = el.querySelectorAll("p").length;
    return ps >= 1 && (el.textContent?.trim().length ?? 0) > 40;
  });
  if (candidates.length > 0) {
    console.warn("[gt] fallback used: paragraph count heuristic");
    return [candidates[candidates.length - 1]!];
  }

  console.warn("[gt] selectors broken on chatgpt: no assistant messages");
  return [];
}

export function findLastAssistantMessage(root?: ParentNode | null): HTMLElement | null {
  const scope = root ?? findThreadRoot() ?? document;
  const list = queryAssistantMessages(scope);
  return list.length > 0 ? list[list.length - 1]! : null;
}

export function findLastUserPrompt(
  root: ParentNode | null,
  beforeEl: Element,
): string {
  const scope = root ?? document;
  const users = queryUserMessages(scope);
  // Prefer the last user message that appears before the assistant node in document order
  let last: HTMLElement | null = null;
  for (const u of users) {
    const pos = beforeEl.compareDocumentPosition(u);
    if (pos & Node.DOCUMENT_POSITION_PRECEDING || u.contains(beforeEl)) {
      last = u;
    } else if (u === beforeEl) {
      last = u;
    }
  }
  if (!last && users.length > 0) last = users[users.length - 1]!;
  return textOf(last);
}

/** True when Copy toolbar is present or streaming cursor is gone. */
export function isStreamComplete(assistantEl: HTMLElement): boolean {
  if (assistantEl.querySelector(SITE.selectors.streamDoneSignal)) return true;
  // Alternate Copy buttons
  if (
    assistantEl.querySelector(
      '[aria-label*="Copy" i], button[data-testid*="copy" i]',
    )
  ) {
    return true;
  }
  const streaming = assistantEl.querySelector(
    '[class*="streaming" i], [class*="result-streaming" i], .result-streaming',
  );
  if (streaming) return false;
  // If no streaming marker and message has substantial text, treat as done
  const text = textOf(assistantEl);
  return text.length > 0;
}

export function extractLatestPair(root?: ParentNode | null): Extraction | null {
  const thread = root ?? findThreadRoot();
  const assistantEl = findLastAssistantMessage(thread);
  if (!assistantEl) return null;

  const usedFallback =
    !assistantEl.matches(SITE.selectors.assistantMessage) &&
    !assistantEl.getAttribute("data-message-author-role");

  const prompt = findLastUserPrompt(thread, assistantEl);
  const response = textOf(assistantEl);
  if (!prompt || !response) return null;

  return { prompt, response, assistantEl, usedFallback };
}
