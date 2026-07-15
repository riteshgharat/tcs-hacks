# backend — Guardrail Engine

Bun + Hono. Evaluates (prompt, response) pairs against responsible-AI guardrails.
Rules-first (fast, explainable), LLM-as-judge fallback (nuance). OpenAI-compatible LLM
— works with OpenAI, Vultr, OpenRouter, or local llama-server.

Docs in `../docs/`: `Architecture.md`, `Data_Schema.md` (frozen contract), `API_Contract.md`,
`Rule_Engine.md`, `LLM_System_Inst.md`.

## Setup

```bash
bun install
cp .env.example .env       # then edit LLM_API_KEY (leave empty to run rules-only)
```

## Run

```bash
bun run dev                 # watch mode, serves http://localhost:8787
bun run start              # one-shot
```

## Test / typecheck

```bash
bun test                   # 38 tests over dataset (rules + pipeline)
bun run typecheck          # tsc --noEmit
```

Tests run in rules-only degraded mode by default (no `LLM_API_KEY`).
Set `LLM_API_KEY` to exercise the full pipeline against the dataset.

## API

All under `/api/v1` (see `docs/API_Contract.md`):

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/v1/evaluate` | Evaluate one (prompt, response) pair |
| POST | `/api/v1/evaluate/batch` | Evaluate up to 50 pairs |
| GET  | `/api/v1/history` | Paginated, filterable history |
| GET  | `/api/v1/health` | Liveness + config probe |
| GET  | `/api/v1/languages` | Rule-supported languages + LLM fallback flag |

Request/response shapes: `docs/Data_Schema.md`.

## Layout

```
src/
  index.ts              Hono app, CORS, route wiring
  config.ts             env load + defaults
  routes/               evaluate, batch, history, health, types
  engine/
    schema.ts           TS types mirroring Data_Schema.md (single source)
    lang.ts             franc + tinyld → ISO 639-1
    rules/              en-v1.ts (source of truth), index.ts registry, types.ts
    llm.prompts.ts      system prompt + few-shots (verbatim from LLM_System_Inst.md)
    llm.ts              OpenAI-compatible client + retry + parse
    merge.ts            rule + LLM merge logic
    pipeline.ts         orchestrate: detect → rules → LLM → merge → store
  db/sqlite.ts          bun:sqlite + history insert/query
  lib/                  validate (zod), id (uuid)
rules-data/en-v1.json  read-only JSON mirror of rules (for docs/admin UI)
dataset.json           17 synthetic test pairs (docs/Dataset_Spec.md)
tests/                  bun:test — rules + pipeline
```

## Degraded mode

If `LLM_API_KEY` is empty, the engine skips the LLM judge entirely. Rules still
catch: password/credential leakage, unsafe keywords, bias loaded-opinion (Stage A+B).
LLM-only categories (subtle bias, hallucination, unsupported claims, multilingual)
are reduced — documented limitation, see `docs/Rule_Engine.md` §3.
