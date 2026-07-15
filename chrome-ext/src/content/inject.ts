import type { EvaluateResponse, ExtMessage, ExtResponse, ExtensionSettings } from "../api";
import { DEFAULT_SETTINGS } from "../api";
import {
  extractLatestPair,
  findLastAssistantMessage,
  findLastUserPrompt,
  findThreadRoot,
  isStreamComplete,
} from "./sites/chatgpt";
import { getReadySite } from "./sites/selectors";

const LOG = "[gt]";
const SITE_ID = "chatgpt";

type BadgeState =
  | { kind: "evaluating" }
  | { kind: "offline" }
  | { kind: "error"; message?: string }
  | { kind: "result"; result: EvaluateResponse };

let settings: ExtensionSettings = { ...DEFAULT_SETTINGS };
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let observer: MutationObserver | null = null;

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch (e) {
    console.warn(LOG, "handler error", e);
    return fallback;
  }
}

async function loadSettings(): Promise<void> {
  try {
    const stored = await chrome.storage.local.get([
      "backendUrl",
      "compactMode",
      "enabledSites",
      "showSaferRewrite",
    ]);
    settings = {
      backendUrl:
        typeof stored.backendUrl === "string" && stored.backendUrl.trim()
          ? stored.backendUrl.trim()
          : DEFAULT_SETTINGS.backendUrl,
      compactMode: Boolean(stored.compactMode ?? DEFAULT_SETTINGS.compactMode),
      enabledSites: Array.isArray(stored.enabledSites)
        ? (stored.enabledSites as string[])
        : DEFAULT_SETTINGS.enabledSites,
      showSaferRewrite:
        stored.showSaferRewrite !== undefined
          ? Boolean(stored.showSaferRewrite)
          : DEFAULT_SETTINGS.showSaferRewrite,
    };
  } catch (e) {
    console.warn(LOG, "settings load failed", e);
    settings = { ...DEFAULT_SETTINGS };
  }
}

function bandColor(band: number): { fg: string; bg: string; border: string } {
  switch (band) {
    case 0:
      return { fg: "#3dd68c", bg: "rgba(61,214,140,0.10)", border: "rgba(61,214,140,0.35)" };
    case 1:
      return { fg: "#f5c451", bg: "rgba(245,196,81,0.10)", border: "rgba(245,196,81,0.35)" };
    case 2:
      return { fg: "#ff9f43", bg: "rgba(255,159,67,0.10)", border: "rgba(255,159,67,0.40)" };
    case 3:
      return { fg: "#ff5c5c", bg: "rgba(255,92,92,0.12)", border: "rgba(255,92,92,0.45)" };
    case 4:
      return { fg: "#d12b2b", bg: "rgba(209,43,43,0.15)", border: "rgba(209,43,43,0.55)" };
    default:
      return { fg: "#9aa4b2", bg: "rgba(154,164,178,0.12)", border: "rgba(154,164,178,0.35)" };
  }
}

const SHADOW_CSS = `
:host { all: initial; font-family: ui-sans-serif, system-ui, sans-serif; }
* { box-sizing: border-box; }
.wrap { position: relative; display: inline-flex; flex-direction: column; align-items: flex-end; gap: 6px; }
.badge {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 4px 10px; border-radius: 999px; border: 1px solid;
  font-size: 12px; font-weight: 600; line-height: 1.2; cursor: pointer;
  color: var(--fg); background: var(--bg); border-color: var(--border);
  user-select: none;
}
.badge:focus-visible { outline: 2px solid #5b8def; outline-offset: 2px; }
.dot { width: 7px; height: 7px; border-radius: 50%; background: var(--fg); flex-shrink: 0; }
.spin {
  width: 10px; height: 10px; border: 2px solid var(--fg); border-top-color: transparent;
  border-radius: 50%; animation: gtspin .7s linear infinite;
}
@keyframes gtspin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) {
  .spin { animation: none; border-top-color: var(--fg); opacity: .5; }
}
.popover {
  position: absolute; right: 0; bottom: calc(100% + 8px); z-index: 2147483646;
  width: min(340px, 90vw); max-height: 360px; overflow: auto;
  padding: 12px; border-radius: 10px;
  background: #0f1419; color: #e8edf2; border: 1px solid #2a3441;
  box-shadow: 0 8px 24px rgba(0,0,0,.45); font-size: 12px; line-height: 1.45;
}
.popover[hidden] { display: none !important; }
.popover h3 { margin: 0 0 8px; font-size: 13px; font-weight: 700; }
.meta { color: #9aa4b2; margin-bottom: 8px; }
.section { margin-top: 10px; }
.section label {
  display: block; font-size: 10px; letter-spacing: .04em; text-transform: uppercase;
  color: #9aa4b2; margin-bottom: 4px;
}
.flag {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px; padding: 8px; border-left: 4px solid var(--fg);
  background: var(--bg); border-radius: 0 6px 6px 0; white-space: pre-wrap; word-break: break-word;
}
.rationale, .rewrite { white-space: pre-wrap; word-break: break-word; color: #e8edf2; }
.actions { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
.btn {
  appearance: none; border: 1px solid #2a3441; background: #1a222d; color: #e8edf2;
  border-radius: 6px; padding: 5px 10px; font-size: 11px; font-weight: 600; cursor: pointer;
}
.btn:hover { background: #243040; }
.btn:focus-visible { outline: 2px solid #5b8def; outline-offset: 2px; }
.err { color: #ff8a8a; }
`;

function ensureBadgeHost(assistantEl: Element): HTMLElement {
  let host = assistantEl.querySelector(":scope > .gt-badge-host") as HTMLElement | null;
  if (!host) {
    host = document.createElement("div");
    host.className = "gt-badge-host";
    host.style.cssText = "margin-top:8px;display:flex;justify-content:flex-end;";
    assistantEl.appendChild(host);
  }
  return host;
}

function clearBadge(assistantEl: Element): void {
  const host = assistantEl.querySelector(":scope > .gt-badge-host");
  host?.remove();
}

function ariaFor(state: BadgeState): string {
  if (state.kind === "evaluating") return "Evaluating guardrails";
  if (state.kind === "offline") return "Guardrail engine offline";
  if (state.kind === "error") return `Guardrail error${state.message ? `: ${state.message}` : ""}`;
  const r = state.result;
  return `${r.verdict}, ${r.risk_category.replace(/_/g, " ")}, risk ${r.risk_score}`;
}

function badgeLabel(state: BadgeState, compact: boolean): string {
  if (state.kind === "evaluating") {
    return compact ? "…" : "Evaluating";
  }
  if (state.kind === "offline") {
    return compact ? "⚠" : "⚠ offline";
  }
  if (state.kind === "error") {
    return compact ? "!" : "! Error";
  }
  const r = state.result;
  if (compact) return String(r.risk_score);
  if (r.verdict === "Pass") return `✓ ${r.risk_score}`;
  return `⚠ ${r.risk_score}`;
}

function renderPopoverBody(result: EvaluateResponse, showRewrite: boolean): string {
  const cat = result.risk_category.replace(/_/g, " ");
  const showFlag = result.flagged_phrase.trim().length > 0;
  const showRw = showRewrite && result.safer_rewrite.trim().length > 0;
  return `
    <h3>${result.verdict} · ${cat} · ${result.risk_score}</h3>
    <div class="meta">band ${result.risk_band} · ${result.detected_language} · ${result.rule_version}</div>
    ${
      showFlag
        ? `<div class="section"><label>Flagged phrase</label><div class="flag"></div></div>`
        : ""
    }
    ${
      result.rationale
        ? `<div class="section"><label>Rationale</label><div class="rationale"></div></div>`
        : ""
    }
    ${
      showRw
        ? `<div class="section"><label>→ Safer rewrite</label><div class="rewrite"></div></div>`
        : ""
    }
    <div class="actions">
      ${showRw ? `<button type="button" class="btn" data-gt-copy>Copy rewrite</button>` : ""}
      <button type="button" class="btn" data-gt-reeval>Re-evaluate</button>
      <button type="button" class="btn" data-gt-close>Close</button>
    </div>
  `;
}

type HostCleanup = () => void;

function renderBadge(assistantEl: HTMLElement, state: BadgeState): void {
  const host = ensureBadgeHost(assistantEl) as HTMLElement & {
    __gtCleanup?: HostCleanup;
  };
  // Drop previous document-level listeners from last render
  if (typeof host.__gtCleanup === "function") {
    host.__gtCleanup();
    host.__gtCleanup = undefined;
  }
  const root = host.shadowRoot ?? host.attachShadow({ mode: "open" });
  root.innerHTML = "";

  const colors =
    state.kind === "result"
      ? bandColor(state.result.risk_band)
      : { fg: "#9aa4b2", bg: "rgba(154,164,178,0.12)", border: "rgba(154,164,178,0.35)" };

  const style = document.createElement("style");
  style.textContent = SHADOW_CSS;

  const wrap = document.createElement("div");
  wrap.className = "wrap";
  wrap.style.setProperty("--fg", colors.fg);
  wrap.style.setProperty("--bg", colors.bg);
  wrap.style.setProperty("--border", colors.border);

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "badge";
  btn.setAttribute("data-gt-popover-trigger", "");
  btn.setAttribute("role", "button");
  btn.setAttribute("aria-haspopup", "dialog");
  btn.setAttribute("aria-expanded", "false");
  btn.setAttribute("aria-label", ariaFor(state));

  const dot = document.createElement("span");
  if (state.kind === "evaluating") {
    dot.className = "spin";
    dot.setAttribute("aria-hidden", "true");
  } else {
    dot.className = "dot";
    dot.setAttribute("aria-hidden", "true");
  }
  btn.appendChild(dot);

  const label = document.createElement("span");
  label.textContent = badgeLabel(state, settings.compactMode);
  btn.appendChild(label);

  const popover = document.createElement("div");
  popover.className = "popover";
  popover.setAttribute("role", "dialog");
  popover.hidden = true;

  if (state.kind === "result") {
    popover.innerHTML = renderPopoverBody(state.result, settings.showSaferRewrite);
    const flagEl = popover.querySelector(".flag");
    if (flagEl) flagEl.textContent = state.result.flagged_phrase;
    const ratEl = popover.querySelector(".rationale");
    if (ratEl) ratEl.textContent = state.result.rationale;
    const rwEl = popover.querySelector(".rewrite");
    if (rwEl) rwEl.textContent = state.result.safer_rewrite;
  } else if (state.kind === "offline") {
    popover.innerHTML = `<h3>Offline</h3><p class="err">Guardrail engine unreachable. Start the backend or check the URL in the extension popup.</p><div class="actions"><button type="button" class="btn" data-gt-close>Close</button></div>`;
  } else if (state.kind === "error") {
    popover.innerHTML = `<h3>Error</h3><p class="err"></p><div class="actions"><button type="button" class="btn" data-gt-reeval>Retry</button><button type="button" class="btn" data-gt-close>Close</button></div>`;
    const errEl = popover.querySelector(".err");
    if (errEl) errEl.textContent = state.message || "Evaluation failed";
  } else {
    popover.innerHTML = `<h3>Evaluating…</h3><p class="meta">Sending prompt + response to your Guardrail Engine.</p>`;
  }

  const closePopover = () => {
    popover.hidden = true;
    btn.setAttribute("aria-expanded", "false");
  };

  const openPopover = () => {
    if (state.kind === "evaluating") return;
    popover.hidden = false;
    btn.setAttribute("aria-expanded", "true");
  };

  const togglePopover = () => {
    if (popover.hidden) openPopover();
    else closePopover();
  };

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    safe(togglePopover, undefined);
  });

  popover.querySelector("[data-gt-close]")?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    safe(closePopover, undefined);
  });

  popover.querySelector("[data-gt-copy]")?.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (state.kind !== "result") return;
    try {
      await navigator.clipboard.writeText(state.result.safer_rewrite);
    } catch (err) {
      console.warn(LOG, "clipboard failed", err);
    }
  });

  popover.querySelector("[data-gt-reeval]")?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    safe(() => {
      assistantEl.dataset.gtEvaluated = "false";
      delete assistantEl.dataset.gtEvaluated;
      clearBadge(assistantEl);
      void evaluateAndBadge(assistantEl);
    }, undefined);
  });

  const onDocClick = (ev: MouseEvent) => {
    const path = ev.composedPath();
    if (!path.includes(host) && !popover.hidden) closePopover();
  };
  const onKey = (ev: KeyboardEvent) => {
    if (ev.key === "Escape" && !popover.hidden) {
      closePopover();
    }
  };
  document.addEventListener("click", onDocClick, true);
  document.addEventListener("keydown", onKey, true);
  host.__gtCleanup = () => {
    document.removeEventListener("click", onDocClick, true);
    document.removeEventListener("keydown", onKey, true);
  };

  wrap.appendChild(btn);
  wrap.appendChild(popover);
  root.appendChild(style);
  root.appendChild(wrap);
}

async function sendMessage(msg: ExtMessage): Promise<ExtResponse> {
  return (await chrome.runtime.sendMessage(msg)) as ExtResponse;
}

async function evaluateAndBadge(assistantEl: HTMLElement): Promise<void> {
  try {
    assistantEl.dataset.gtEvaluated = "true";
    renderBadge(assistantEl, { kind: "evaluating" });

    const pair = extractLatestPair();
    if (pair && pair.assistantEl === assistantEl) {
      await runEval(assistantEl, pair.prompt, pair.response);
      return;
    }

    // Extract from this node if pair matching failed (DOM churn)
    const response = (assistantEl.textContent ?? "").replace(/\s+/g, " ").trim();
    const prompt = findLastUserPrompt(findThreadRoot(), assistantEl);
    if (!prompt || !response) {
      renderBadge(assistantEl, { kind: "error", message: "Could not extract prompt/response" });
      return;
    }
    await runEval(assistantEl, prompt, response);
  } catch (e) {
    console.warn(LOG, "evaluateAndBadge failed", e);
    try {
      renderBadge(assistantEl, {
        kind: "error",
        message: e instanceof Error ? e.message : String(e),
      });
    } catch {
      /* swallow */
    }
  }
}

async function runEval(
  assistantEl: HTMLElement,
  prompt: string,
  response: string,
): Promise<void> {
  const res = await sendMessage({
    type: "EVALUATE",
    prompt,
    response,
    source: "chatgpt",
  });

  if (res?.type === "EVAL_RESULT") {
    renderBadge(assistantEl, { kind: "result", result: res.result });
    return;
  }

  if (res?.type === "EVAL_ERROR" && (res.code === "E_OFFLINE" || /fetch|network|Failed/i.test(res.message))) {
    renderBadge(assistantEl, { kind: "offline" });
    return;
  }

  renderBadge(assistantEl, {
    kind: "error",
    message: res?.type === "EVAL_ERROR" ? `${res.code}: ${res.message}` : "Unknown error",
  });
}

function onMutations(): void {
  safe(() => {
    if (!settings.enabledSites.includes(SITE_ID)) return;
    if (!getReadySite(SITE_ID)) return;

    const root = findThreadRoot();
    const lastAssistant = findLastAssistantMessage(root);
    if (!lastAssistant) return;

    if (lastAssistant.dataset.gtEvaluated === "true") return;

    // Mark streaming on first sight
    if (!lastAssistant.dataset.gtSeen) {
      lastAssistant.dataset.gtSeen = "true";
      lastAssistant.dataset.gtStreaming = "true";
    }

    if (!isStreamComplete(lastAssistant)) {
      lastAssistant.dataset.gtStreaming = "true";
      return;
    }

    delete lastAssistant.dataset.gtStreaming;
    lastAssistant.dataset.gtEvaluated = "true";
    void evaluateAndBadge(lastAssistant);
  }, undefined);
}

function scheduleScan(): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    onMutations();
  }, 300);
}

function startObserver(): void {
  safe(() => {
    // Observe documentElement so SPA navigations / thread swaps stay in view
    if (observer) observer.disconnect();
    observer = new MutationObserver(() => scheduleScan());
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    scheduleScan();
  }, undefined);
}

async function init(): Promise<void> {
  try {
    if (!getReadySite(SITE_ID)) {
      console.warn(LOG, "site not ready");
      return;
    }
    await loadSettings();
    chrome.storage.onChanged.addListener((_changes, area) => {
      if (area !== "local") return;
      safe(() => {
        void loadSettings().then(() => scheduleScan());
      }, undefined);
    });
    startObserver();
  } catch (e) {
    console.warn(LOG, "init failed", e);
  }
}

void init();
