import { Hono } from "hono";
import { queryHistory, type HistoryQuery } from "../db/history.ts";
import { errorResp } from "./evaluate.ts";
import type { HistoryResponse } from "./types.ts";

export const historyRoute = new Hono();

const SORT_VALUES = new Set(["newest", "oldest", "score_desc"]);
const VERDICT_VALUES = new Set(["Pass", "Fail"]);

historyRoute.get("/", (c) => {
  const q = c.req.query();
  const sort = q.sort;
  const verdict = q.verdict;
  if (sort !== undefined && !SORT_VALUES.has(sort)) {
    return errorResp(c, "E_BAD_QUERY", `sort must be one of newest|oldest|score_desc.`, 400);
  }
  if (verdict !== undefined && !VERDICT_VALUES.has(verdict)) {
    return errorResp(c, "E_BAD_QUERY", `verdict must be Pass or Fail.`, 400);
  }

  const limit = q.limit !== undefined ? Number.parseInt(q.limit, 10) : undefined;
  const offset = q.offset !== undefined ? Number.parseInt(q.offset, 10) : undefined;
  if ((limit !== undefined && !Number.isFinite(limit)) || (offset !== undefined && !Number.isFinite(offset))) {
    return errorResp(c, "E_BAD_QUERY", "limit and offset must be integers.", 400);
  }

  const query: HistoryQuery = {
    category: q.category,
    source: q.source,
    verdict: verdict as HistoryQuery["verdict"],
    language: q.language,
    from: q.from,
    to: q.to,
    limit,
    offset,
    sort: sort as HistoryQuery["sort"],
  };

  const page = queryHistory(query);
  const body: HistoryResponse = {
    items: page.items,
    total: page.total,
    limit: page.limit,
    offset: page.offset,
  };
  return c.json(body, 200);
});
