import { Database, type SQLQueryBindings } from "bun:sqlite";
import { config } from "../config.ts";
import type { HistoryRecord } from "../engine/schema.ts";

interface HistoryRow {
  evaluation_id: string;
  verdict: string;
  risk_category: string;
  risk_score: number;
  risk_band: number;
  source: string;
  detected_language: string;
  prompt_preview: string;
  response_preview: string;
  flagged_phrase: string;
  created_at: string;
}

let db: Database | null = null;

function getDb(): Database {
  if (db) return db;
  db = new Database(config.dbPath, { create: true });
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  migrate(db);
  return db;
}

function migrate(database: Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS history (
      evaluation_id   TEXT PRIMARY KEY,
      verdict         TEXT NOT NULL,
      risk_category   TEXT NOT NULL,
      risk_score      INTEGER NOT NULL,
      risk_band       INTEGER NOT NULL,
      source          TEXT NOT NULL,
      detected_language TEXT NOT NULL,
      prompt_preview  TEXT NOT NULL,
      response_preview TEXT NOT NULL,
      flagged_phrase  TEXT NOT NULL,
      created_at      TEXT NOT NULL
    );
  `);
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_history_created_at ON history(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_history_category ON history(risk_category);
    CREATE INDEX IF NOT EXISTS idx_history_source ON history(source);
    CREATE INDEX IF NOT EXISTS idx_history_verdict ON history(verdict);
  `);
}

export interface HistoryInsert {
  evaluation_id: string;
  verdict: "Pass" | "Fail";
  risk_category: string;
  risk_score: number;
  risk_band: number;
  source: string;
  detected_language: string;
  prompt_preview: string;
  response_preview: string;
  flagged_phrase: string;
  created_at: string;
}

export function insertHistory(rec: HistoryInsert): void {
  const database = getDb();
  const stmt = database.prepare(`
    INSERT INTO history (
      evaluation_id, verdict, risk_category, risk_score, risk_band,
      source, detected_language, prompt_preview, response_preview,
      flagged_phrase, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    rec.evaluation_id,
    rec.verdict,
    rec.risk_category,
    rec.risk_score,
    rec.risk_band,
    rec.source,
    rec.detected_language,
    rec.prompt_preview,
    rec.response_preview,
    rec.flagged_phrase,
    rec.created_at
  );
}

export interface HistoryQuery {
  category?: string;
  source?: string;
  verdict?: "Pass" | "Fail";
  language?: string;
  from?: string; // ISO date
  to?: string;
  limit?: number;
  offset?: number;
  sort?: "newest" | "oldest" | "score_desc";
}

export interface HistoryPage {
  items: HistoryRecord[];
  total: number;
  limit: number;
  offset: number;
}

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

export function queryHistory(q: HistoryQuery): HistoryPage {
  const database = getDb();
  const limit = Math.min(Math.max(q.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  const offset = Math.max(q.offset ?? 0, 0);
  const sort = q.sort ?? "newest";
  const orderBy =
    sort === "oldest"
      ? "created_at ASC"
      : sort === "score_desc"
      ? "risk_score DESC, created_at DESC"
      : "created_at DESC";

  const where: string[] = [];
  const params: SQLQueryBindings[] = [];
  if (q.category) {
    where.push("risk_category = ?");
    params.push(q.category);
  }
  if (q.source) {
    where.push("source = ?");
    params.push(q.source);
  }
  if (q.verdict) {
    where.push("verdict = ?");
    params.push(q.verdict);
  }
  if (q.language) {
    where.push("detected_language = ?");
    params.push(q.language);
  }
  if (q.from) {
    where.push("date(created_at) >= date(?)");
    params.push(q.from);
  }
  if (q.to) {
    where.push("date(created_at) <= date(?)");
    params.push(q.to);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const countRow = database
    .prepare(`SELECT COUNT(*) as n FROM history ${whereSql}`)
    .get(...params) as { n: number } | null;
  const total = countRow?.n ?? 0;

  const rows = database
    .prepare(
      `SELECT evaluation_id, verdict, risk_category, risk_score, risk_band,
              source, detected_language, prompt_preview, response_preview,
              flagged_phrase, created_at
       FROM history ${whereSql}
       ORDER BY ${orderBy}
       LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset) as HistoryRow[];

  const items: HistoryRecord[] = rows.map((r) => ({
    evaluation_id: r.evaluation_id,
    verdict: r.verdict as "Pass" | "Fail",
    risk_category: r.risk_category as HistoryRecord["risk_category"],
    risk_score: r.risk_score,
    risk_band: r.risk_band as HistoryRecord["risk_band"],
    source: r.source as HistoryRecord["source"],
    detected_language: r.detected_language,
    prompt_preview: r.prompt_preview,
    response_preview: r.response_preview,
    flagged_phrase: r.flagged_phrase,
    created_at: r.created_at,
  }));

  return { items, total, limit, offset };
}

// Health probe for /health endpoint.
export function dbHealthy(): boolean {
  try {
    const database = getDb();
    database.prepare("SELECT 1").get();
    return true;
  } catch {
    return false;
  }
}

// Test helper: close + null the handle so a new DB path can be opened.
export function _resetDb(): void {
  if (db) {
    try {
      db.close();
    } catch {
      // ignore
    }
  }
  db = null;
}
