import type {
  EvaluateResponse,
  ExtMessage,
  ExtResponse,
  HealthResponse,
} from "../api";
import { DEFAULT_SETTINGS } from "../api";

async function getBackendUrl(): Promise<string> {
  try {
    const stored = await chrome.storage.local.get("backendUrl");
    const url =
      typeof stored.backendUrl === "string" && stored.backendUrl.trim()
        ? stored.backendUrl.trim()
        : DEFAULT_SETTINGS.backendUrl;
    return url.replace(/\/$/, "");
  } catch {
    return DEFAULT_SETTINGS.backendUrl;
  }
}

async function evaluate(msg: Extract<ExtMessage, { type: "EVALUATE" }>): Promise<ExtResponse> {
  const base = await getBackendUrl();
  const url = `${base}/api/v1/evaluate`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: msg.prompt,
        response: msg.response,
        source: msg.source,
      }),
    });

    if (!res.ok) {
      let code = "E_INTERNAL";
      let message = `Backend returned ${res.status}`;
      try {
        const body = (await res.json()) as {
          error?: { code?: string; message?: string };
        };
        if (body.error?.code) code = body.error.code;
        if (body.error?.message) message = body.error.message;
      } catch {
        /* ignore parse */
      }
      return { type: "EVAL_ERROR", code, message };
    }

    const result = (await res.json()) as EvaluateResponse;
    return { type: "EVAL_RESULT", result };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return {
      type: "EVAL_ERROR",
      code: "E_OFFLINE",
      message: message || "Backend unreachable",
    };
  }
}

async function fetchHealth(): Promise<ExtResponse> {
  const base = await getBackendUrl();
  const url = `${base}/api/v1/health`;
  try {
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) {
      return {
        type: "EVAL_ERROR",
        code: "E_DEGRADED",
        message: `Health check failed (${res.status})`,
      };
    }
    const health = (await res.json()) as HealthResponse;
    return { type: "HEALTH", health };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return {
      type: "EVAL_ERROR",
      code: "E_OFFLINE",
      message: message || "Backend unreachable",
    };
  }
}

chrome.runtime.onMessage.addListener((msg: ExtMessage, _sender, sendResponse) => {
  if (!msg || typeof msg !== "object" || !("type" in msg)) {
    sendResponse({
      type: "EVAL_ERROR",
      code: "E_VALIDATION",
      message: "Invalid message",
    } satisfies ExtResponse);
    return false;
  }

  if (msg.type === "EVALUATE") {
    evaluate(msg)
      .then(sendResponse)
      .catch((e: unknown) =>
        sendResponse({
          type: "EVAL_ERROR",
          code: "E_INTERNAL",
          message: e instanceof Error ? e.message : String(e),
        } satisfies ExtResponse),
      );
    return true;
  }

  if (msg.type === "HEALTH") {
    fetchHealth()
      .then(sendResponse)
      .catch((e: unknown) =>
        sendResponse({
          type: "EVAL_ERROR",
          code: "E_INTERNAL",
          message: e instanceof Error ? e.message : String(e),
        } satisfies ExtResponse),
      );
    return true;
  }

  sendResponse({
    type: "EVAL_ERROR",
    code: "E_VALIDATION",
    message: `Unknown message type`,
  } satisfies ExtResponse);
  return false;
});
