import type { EvaluateRequest, EvaluateResponse, HistoryResponse, HistoryRecord } from "../types.ts";

const BASE = "/api/v1";

export async function evaluatePair(req: EvaluateRequest): Promise<EvaluateResponse> {
  const res = await fetch(`${BASE}/evaluate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const err = (await res.json()) as { error: { message: string; code: string } };
    throw new Error(`${err.error.code}: ${err.error.message}`);
  }
  return res.json();
}

export async function fetchHistory(limit = 50): Promise<HistoryResponse> {
  const res = await fetch(`${BASE}/history?limit=${limit}&sort=newest`);
  if (!res.ok) throw new Error("Failed to load history");
  return res.json();
}
