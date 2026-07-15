import { Hono } from "hono";
import { cors } from "hono/cors";
import { config } from "./config.ts";
import { evaluateRoute } from "./routes/evaluate.ts";
import { batchRoute } from "./routes/batch.ts";
import { historyRoute } from "./routes/history.ts";
import { healthRoute, languagesHandler } from "./routes/health.ts";
import type { ErrorResponse } from "./routes/types.ts";

const app = new Hono();

// CORS: allow configured origins + chrome-extension://* wildcard (MVP).
const allowedOrigins = new Set(
  config.corsOrigins.filter((o) => o !== "chrome-extension://*")
);
const allowExtension = config.corsOrigins.includes("chrome-extension://*");

app.use(
  "*",
  cors({
    origin: (origin) => {
      if (!origin) return null;
      if (allowExtension && origin.startsWith("chrome-extension://")) return origin;
      if (allowedOrigins.has(origin)) return origin;
      return null;
    },
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type"],
    maxAge: 600,
  })
);

// Routes — all under /api/v1 per API_Contract.md.
const v1 = new Hono();
v1.route("/evaluate", evaluateRoute);
v1.route("/evaluate/batch", batchRoute);
v1.route("/history", historyRoute);
v1.route("/health", healthRoute);
v1.get("/languages", languagesHandler);
app.route("/api/v1", v1);

// Root health shortcut (convenience).
app.get("/health", (c) => c.json({ status: "ok", engine_version: config.engineVersion }));

// 404 handler — uniform ErrorResponse shape.
app.notFound((c) => {
  const body: ErrorResponse = {
    error: { code: "E_NOT_FOUND", message: "Unknown path." },
    request_id: crypto.randomUUID(),
  };
  return c.json(body, 404);
});

// Method not allowed + generic error handler.
app.onError((err, c) => {
  console.error("[server] unhandled error:", err);
  const body: ErrorResponse = {
    error: {
      code: "E_INTERNAL",
      message: err instanceof Error ? err.message : "Internal error",
    },
    request_id: crypto.randomUUID(),
  };
  return c.json(body, 500);
});

const port = config.backendPort;
export default {
  port,
  fetch: app.fetch,
};

console.log(`[guardrail-engine] listening on http://localhost:${port} (api: /api/v1)`);
console.log(`[guardrail-engine] LLM enabled: ${config.llm.apiKey ? "yes" : "no (rules-only fallback)"}`);
