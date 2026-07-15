# Build Phases — Responsible Chatbot Guardrail Tester

This breaks the PRD into buildable phases, ordered so that you always have a **working demo at every checkpoint**, even if later phases run out of time. Each phase lists goal, tasks, and the "done" bar.

---

## Phase 0 — Setup & Dataset (Foundation)

**Goal:** Have your test data and repo skeleton ready before writing any logic.

**Tasks:**
- Set up repo structure: `/backend`, `/webapp`, `/extension`
- Build the synthetic dataset: 15–20 (prompt, response) pairs covering all 5 categories + safe/clean examples + 1 multilingual/code-mixed example + the password example from the brief
- Define the final JSON output schema (from PRD §6.1) and freeze it — everything downstream depends on this contract

**Done when:** Dataset file exists (`dataset.json`), schema is written down, repo skeleton exists.

---

## Phase 1 — Rule Engine (Core Backend v1)

**Goal:** Get deterministic, explainable detection working first — this is your safety net and fastest win.

**Tasks:**
- Language detection step (`langdetect`/`fastText`)
- Regex/keyword lists per category, per language (start with English only)
  - Confidential leakage: password/PII patterns
  - Unsafe content: keyword list
  - Bias: loaded-opinion question pattern detector (e.g. "greatest/best/smartest ___ !!!???")
- Wire up a basic API endpoint: `POST /evaluate` → runs rules only → returns schema output
- Test against your dataset — confirm it catches the obvious cases (password example, bias example)

**Done when:** API returns correct verdict for rule-catchable cases in your dataset.

---

## Phase 2 — LLM-as-Judge Layer

**Goal:** Add the nuance layer for cases rules can't catch (subtle bias, hallucination, unsupported claims, non-English).

**Tasks:**
- Write the LLM system prompt: strict JSON output, includes category list, scoring guidance, and the "consider cultural/linguistic context" instruction
- Wire LLM call into the pipeline: triggered when rules don't fire, or language isn't rule-supported
- Write merge logic: rules-first if confident, else LLM verdict, else combine if both fire
- Re-test full dataset — confirm hallucination/unsupported-claims/subtle-bias cases and the multilingual case now pass correctly

**Done when:** Full dataset passes through pipeline with correct verdicts, including the multilingual test case.

---

## Phase 3 — Web App (Developer Console)

**Goal:** Give the engine a usable interface for manual testing — your primary demo surface if the extension isn't ready in time.

**Tasks:**
- Manual Test tab: input prompt + response → call `/evaluate` → display result card (verdict, category, score, flagged phrase, safer rewrite)
- Batch Test tab: upload CSV/JSON → table of results
- Dashboard tab: history of past evaluations, filterable by category/verdict/source
- Basic styling — clean, not fancy; clarity over polish

**Done when:** You can demo the entire risk-category walkthrough using only the web app.

---

## Phase 4 — Chrome Extension

**Goal:** Passive detection on live AI chat sites — the differentiator feature.

**Tasks:**
- Manifest V3 skeleton, content script for one target site first (recommend ChatGPT — most stable DOM)
- Detect new assistant message rendered → extract (last user prompt, new response) → call backend `/evaluate`
- Inject badge next to response (✅/⚠️ + score), expandable to show category/flagged phrase/rewrite
- Test live on the target site with a few real prompts, including at least one that should trigger a flag

**Done when:** Extension shows a real-time badge on at least one live AI site during a test run.

---

## Phase 5 — Polish & Demo Prep

**Goal:** Make sure the demo is bulletproof, not just functional.

**Tasks:**
- Rehearse demo script: walk through all 5 risk categories + the multilingual edge case + a clean/safe example (to prove it's not over-flagging)
- Prepare fallback: if extension is flaky live, have a recorded screen capture as backup
- Write 1-slide "known limitations" summary (language scope, flag-not-block, DOM fragility) — shows maturity, not weakness
- Clean up README with setup instructions

**Done when:** You can run the full demo start to finish without live debugging.

---

## Suggested Priority If Time Runs Short

If you're short on time, cut in this order (last cut first):
1. Extension multi-site support (keep to 1 site only)
2. Batch test tab (manual test tab is enough)
3. Dashboard/history (nice-to-have, not core to the story)
4. LLM merge nuance (rules-only can still demo 3/5 categories credibly)

**Never cut:** the dataset quality, the password example, and the bias example — these are the brief's own reference points and judges will look for them specifically.
