import { Hono, type Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { evaluateRequestSchema, formatZodError } from "../lib/validate.ts";
import { evaluate } from "../engine/pipeline.ts";
import { uuid } from "../lib/id.ts";
import type { ErrorResponse } from "./types.ts";

export const evaluateRoute = new Hono();

evaluateRoute.post("/", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return errorResp(c, "E_VALIDATION", "Body must be valid JSON.", 400, {});
  }

  const parsed = evaluateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return errorResp(
      c,
      "E_VALIDATION",
      "Request validation failed.",
      400,
      formatZodError(parsed.error)
    );
  }

  // Trim strings before processing.
  const req = {
    ...parsed.data,
    prompt: parsed.data.prompt.trim(),
    response: parsed.data.response.trim(),
  };
  if (req.prompt === "" || req.response === "") {
    return errorResp(c, "E_VALIDATION", "prompt and response must not be empty.", 400);
  }

  const result = await evaluate(req);
  return c.json(result, 200);
});

export function errorResp(
  c: Context,
  code: string,
  message: string,
  status: ContentfulStatusCode,
  details?: unknown
) {
  const body: ErrorResponse = {
    error: { code, message, ...(details === undefined ? {} : { details }) },
    request_id: uuid(),
  };
  return c.json(body, status);
}
