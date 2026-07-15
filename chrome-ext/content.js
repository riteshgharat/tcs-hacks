// Content script — evaluates ChatGPT responses in real time.

const BACKEND = "http://localhost:8787/api/v1";

// ChatGPT DOM selectors (as of 2024/07).
const USER_SELECTOR = '[data-message-author-role="user"]';
const ASSISTANT_SELECTOR = '[data-message-author-role="assistant"]';
const THREAD_SELECTOR = 'main [class*="thread"]'; // heuristic fallback

let threadRoot = null;

function findThread() {
  return (
    document.querySelector('main') ||
    document.querySelector('[id^="thread-"]') ||
    document.body
  );
}

function getLastUserPrompt() {
  const nodes = Array.from(document.querySelectorAll(USER_SELECTOR));
  if (!nodes.length) return "";
  const last = nodes[nodes.length - 1];
  return (last.textContent || "").trim();
}

function getAssistantText(el) {
  return (el.textContent || "").trim();
}

function isStreaming(el) {
  // Streaming in-progress: Copy button not yet present, or cursor element exists.
  const hasCopy = el.querySelector('[aria-label="Copy"]') !== null;
  const hasCursor = el.querySelector('.result-streaming, [class*="streaming"]') !== null;
  return !hasCopy || hasCursor;
}

function makeBadge(result) {
  const pass = result.verdict === "Pass";
  const w = document.createElement("span");
  w.style.cssText = `
    display:inline-flex;align-items:center;gap:4px;
    margin-top:6px;padding:2px 8px;border-radius:9999px;
    font-size:12px;font-family:system-ui,sans-serif;line-height:1.4;
    border:1px solid ${pass ? "#3dd68c" : "#ff5c5c"};
    background:${pass ? "rgba(61,214,140,0.12)" : "rgba(255,92,92,0.12)"};
    color:${pass ? "#3dd68c" : "#ff5c5c"};cursor:pointer;
  `;
  w.innerHTML = `${pass ? "✓ Pass" : "⚠ Fail"} · ${result.risk_score}`;
  w.title = `${result.risk_category}: ${result.rationale}`;
  w.addEventListener("click", (e) => {
    e.stopPropagation();
    showDetail(elOffsetParent(w) || w, result);
  });
  return w;
}

function showDetail(anchor, result) {
  // Remove existing detail popup.
  const prev = document.querySelector(".gt-detail");
  if (prev) prev.remove();

  const d = document.createElement("div");
  d.className = "gt-detail";
  d.style.cssText = `
    position:absolute;z-index:9999;max-width:360px;
    background:#0f1117;border:1px solid #2a313c;border-radius:8px;
    padding:10px 12px;color:#e6edf3;font-size:13px;
    box-shadow:0 8px 24px rgba(0,0,0,0.5);
  `;
  const cat = result.risk_category !== "none" ? `<div style="color:${result.verdict==='Pass'?'#3dd68c':'#ff5c5c'};font-weight:600;margin-bottom:4px;">${result.verdict} · ${result.risk_category} · ${result.risk_score}</div>` : "";
  const phrase = result.flagged_phrase ? `<div style="margin:6px 0;padding:6px;border-left:3px solid #ff5c5c;background:rgba(255,92,92,0.08);font-family:monospace;font-size:12px;">${result.flagged_phrase}</div>` : "";
  const rationale = result.rationale ? `<div style="margin-bottom:6px;color:#ccc;">${result.rationale}</div>` : "";
  const rewrite = result.safer_rewrite ? `<div style="padding:6px;background:#161b22;border-radius:4px;font-family:monospace;font-size:12px;color:#eee;">${result.safer_rewrite}</div>` : "";
  d.innerHTML = cat + phrase + rationale + rewrite;

  document.body.appendChild(d);
  const rect = anchor.getBoundingClientRect();
  d.style.left = `${rect.left + window.scrollX}px`;
  d.style.top = `${rect.bottom + window.scrollY + 4}px`;

  function close() { d.remove(); document.removeEventListener("click", close); }
  setTimeout(() => document.addEventListener("click", close), 0);
}

function elOffsetParent(el) {
  while (el && el !== document.body) {
    if (el.offsetParent) return el.offsetParent;
    el = el.parentElement;
  }
  return document.body;
}

function evaluateAndBadge(assistantEl) {
  if (assistantEl.dataset.gtEvaluated) return;

  const prompt = getLastUserPrompt();
  const response = getAssistantText(assistantEl);
  if (!prompt || !response || response.length < 5) return;

  assistantEl.dataset.gtEvaluated = "true";
  assistantEl.dataset.gtStatus = "evaluating";

  // Show evaluating badge immediately.
  const evalBadge = document.createElement("span");
  evalBadge.style.cssText = "display:inline-flex;margin-top:6px;padding:2px 8px;border-radius:9999px;font-size:12px;border:1px solid #6b7480;background:rgba(107,116,128,0.12);color:#9aa5b1;";
  evalBadge.textContent = "Evaluating…";
  assistantEl.appendChild(evalBadge);

  chrome.runtime.sendMessage({ type: "EVALUATE", prompt, response, source: "chatgpt" }, (res) => {
    evalBadge.remove();
    if (!res || !res.ok) {
      const err = document.createElement("span");
      err.style.cssText = "display:inline-flex;margin-top:6px;padding:2px 8px;border-radius:9999px;font-size:12px;border:1px solid #6b7480;background:rgba(107,116,128,0.12);color:#9aa5b1;";
      err.textContent = "Offline ⚠";
      assistantEl.appendChild(err);
      return;
    }
    const result = res.result;
    const b = makeBadge(result);
    assistantEl.appendChild(b);
  });
}

function observe() {
  threadRoot = findThread();
  if (!threadRoot) return;

  const observer = new MutationObserver(() => {
    const assistants = Array.from(threadRoot.querySelectorAll(ASSISTANT_SELECTOR));
    for (const el of assistants) {
      if (el.dataset.gtEvaluated || el.dataset.gtStatus === "evaluating") continue;
      if (isStreaming(el)) {
        // Wait for completion.
        continue;
      }
      evaluateAndBadge(el);
    }
  });

  observer.observe(threadRoot, { childList: true, subtree: true, characterData: true });

  // Initial scan for already-rendered messages.
  const assistants = Array.from(threadRoot.querySelectorAll(ASSISTANT_SELECTOR));
  for (const el of assistants) {
    if (!el.dataset.gtEvaluated && !isStreaming(el)) evaluateAndBadge(el);
  }
}

// Wait for ChatGPT to render.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", observe);
} else {
  observe();
}
