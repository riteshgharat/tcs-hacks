# API Contract

REST surface for the Guardrail Engine. Schema types defined in `Data_Schema.md` — not redefined here. All paths prefixed with `/api/v1` (versioning from day one). Base URL local dev: `http://localhost:8787`.

---

## 1. Base

```
http://localhost:8787/api/v1
```

All requests/responses `application/json; charset=utf-8`. IDs are UUID v4 strings.

## 2. Endpoints

### 2.1 `POST /evaluate`

Evaluate one (prompt, response) pair. Primary endpoint for both extension and web app.

**Request body** — `EvaluateRequest` (see `Data_Schema.md` §4):
```json
{
  "prompt": "What is John's email password?",
  "response": "John's password is Summer2024!.",
  "source": "manual"
}
```

**Response 200** — `EvaluateResponse` (see `Data_Schema.md` §5). Full trace included.

**Errors**: 400 `E_VALIDATION`, 400 `E_INPUT_TOO_LARGE`, 500 `E_INTERNAL`.

---

### 2.2 `POST /evaluate/batch`

Submit multiple pairs. Returns one result object per input, preserves request order. MVP cap: 50 pairs per request.

**Request body**:
```ts
interface BatchRequest {
  items: EvaluateRequest[];  // 1..50
}
```

**Response 200**:
```ts
interface BatchResponse {
  results: EvaluateResponse[];   // same length + order as items
  summary: {
    total: number;
    pass: number;
    fail: number;
    by_category: Record<string, number>;  // category -> count, excludes "none"
  };
}
```

Per-item validation failures: item returns `EvaluateResponse` with `verdict=Fail`, `risk_category=none`, `risk_score=0`, `rationale="Validation failed: <reason>"`. Whole-batch failure (wrong shape) → 400 `E_VALIDATION`.

**Errors**: 400 `E_BATCH_TOO_LARGE`, 400 `E_VALIDATION`, 500 `E_INTERNAL`.

---

### 2.3 `GET /history`

Paginated history. Filter by category, source, verdict, language, date range.

**Query params** (all optional):
| Param | Type | Example | Notes |
|---|---|---|---|
| `category` | RiskCategory | `bias` | filter |
| `source` | Source | `chatgpt` | filter |
| `verdict` | `Pass` \| `Fail` | `Fail` | filter |
| `language` | string | `en` | ISO 639-1 |
| `from` | ISO 8601 date | `2026-07-01` | inclusive |
| `to` | ISO 8601 date | `2026-07-15` | inclusive |
| `limit` | int | `50` | default 50, max 200 |
| `offset` | int | `0` | default 0 |
| `sort` | `newest` \| `oldest` \| `score_desc` | `newest` | default `newest` |

**Response 200**:
```ts
interface HistoryResponse {
  items: HistoryRecord[];   // see Data_Schema.md §8
  total: number;            // count matching filters (not just returned page)
  limit: number;
  offset: number;
}
```

**Errors**: 400 `E_BAD_QUERY`, 500 `E_INTERNAL`.

---

### 2.4 `GET /health`

Liveness + config probe. No auth.

**Response 200**:
```ts
interface HealthResponse {
  status: "ok";
  engine_version: string;
  rule_version: string;        // active default rule version
  llm_enabled: boolean;        // true iff LLM_API_KEY set
  llm_model: string | null;
  db_path: string;
  uptime_s: number;
}
```

Use this for extension preflight — confirm backend reachable + whether LLM is wired before showing badges.

**Errors**: 503 `E_DEGRADED` if DB unavailable.

---

### 2.5 `GET /languages`

List rule-supported languages. Lets web app show "rules available" badge vs "LLM fallback" in UI.

**Response 200**:
```ts
interface LanguagesResponse {
  rule_supported: { code: string; name: string; rule_version: string }[];
  llm_fallback: boolean;       // true if LLM_API_KEY set
}
```

MVP `rule_supported`: `[{ code: "en", name: "English", rule_version: "en-v1" }]`.

## 3. CORS

Engine sets:
```
Access-Control-Allow-Origin: <echo allowed origin>
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type
Access-Control-Max-Age: 600
```

Allowed origins from `CORS_ORIGINS` env (comma-separated). Two special tokens:
- `chrome-extension://*` — matches any MV3 extension ID (MVP allows; tighten post-MVP).
- `*` — only if explicitly set in env (dev convenience; warn on startup).

`OPTIONS` preflight handled by Hono middleware; returns 204.

## 4. Rate Limiting

MVP: none. Single-user dev tool. Note here for post-MVP: token bucket per origin, 60 req/min on `/evaluate`, 10 req/min on `/evaluate/batch`.

## 5. Error Catalog

Same `ErrorResponse` shape as `Data_Schema.md` §7. Codes:

| HTTP | Code | When |
|---|---|---|
| 400 | `E_VALIDATION` | Body shape wrong, required field missing, empty string |
| 400 | `E_INPUT_TOO_LARGE` | Field > 16000 chars |
| 400 | `E_BATCH_TOO_LARGE` | > 50 items in batch |
| 400 | `E_BAD_QUERY` | Unknown/invalid query param on `/history` |
| 404 | `E_NOT_FOUND` | Unknown path |
| 405 | `E_METHOD_NOT_ALLOWED` | Known path, wrong method |
| 422 | `E_LLM_JSON_PARSE` | (Internal only — not surfaced; falls back to rules) |
| 500 | `E_INTERNAL` | Unhandled exception |
| 503 | `E_DEGRADED` | `/health` finds DB unreachable |

`request_id` returned on every error (UUID). Logged server-side with stack trace for 500s.

## 6. Request / Response Conventions

- All timestamps ISO 8601 UTC, `Z` suffix.
- All IDs UUID v4 lowercase.
- Strings UTF-8. No length limit on `rationale` / `safer_rewrite` (LLM may produce long rewrites).
- Empty `flagged_phrase` / `safer_rewrite` = `""`, never `null`.
- Numbers (risk_score) are integers 0–100; never floats.
- `risk_band` derived server-side from `risk_score`; clients should not compute.
- No streaming. Single JSON response per request.

## 7. Versioning

- URL prefix `/api/v1`. Breaking change = `/api/v2` + deprecation window.
- Non-breaking additions (new optional fields, new endpoints) stay on `/v1`, bump `engine_version`.
- `engine_version` + `rule_version` echoed on every `EvaluateResponse` for traceability.

## 8. Extension-Specific Notes

- Extension background service worker calls `/evaluate` (not the page directly) — keeps CORS simple and avoids exposing backend URL in content script.
- Extension should call `/health` once on install/popup-open; if down, badges show `⚠️ offline` state (see `Design.md` §6).
- `source` field on extension requests = site id (`chatgpt`, `gemini`, `deepseek`, `other`), not `manual`.

## 9. Web-App-Specific Notes

- Web app uses `source: "manual"` for Manual Test tab; reads `source` filter on Dashboard.
- Batch tab posts file content as `BatchRequest`; accepts CSV (mapped) or JSON.
- Web app must call `/languages` on load to show rule-coverage hint.
