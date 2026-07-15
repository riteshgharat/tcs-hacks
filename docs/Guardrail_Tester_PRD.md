# Product Requirements Document (PRD)
## Responsible Chatbot Guardrail Tester
**Event:** TCS Tech Day @ Vidyavardhini College of Engineering, Vasai
**Theme:** Responsible Enterprise AI
**Version:** 1.0 (MVP)

---

## 1. Overview

The **Responsible Chatbot Guardrail Tester** is a developer-facing tool that evaluates chatbot responses (from any AI website — ChatGPT, Gemini, DeepSeek, or in-house/censor-AI bots) against a set of responsible-AI guardrails. It classifies risk, scores severity, highlights the offending phrase, and suggests a safer rewritten response — helping developers catch unsafe, biased, confidential, hallucinated, or unsupported outputs **before they reach end users**.

The system has three parts:
1. **Guardrail Engine (Backend)** — the evaluation brain
2. **Chrome Extension** — reads live conversations on AI websites and sends them to the engine
3. **Web App (Developer Console)** — manual testing, batch testing, dashboards, and history

---

## 2. Problem Statement

Chatbots can produce responses that are unsafe, biased, leak confidential data, make unsupported claims, or hallucinate facts. Developers currently have no lightweight, plug-and-play way to test a chatbot's real-world outputs against basic responsible-AI rules before shipping or during QA. This tool closes that gap with an evaluator that works both on manually pasted text and on live conversations happening on third-party AI chat websites.

---

## 3. Goals & Non-Goals

**Goals**
- Detect risk category + severity score for any (prompt, response) pair
- Support both rule-based detection (fast, explainable) and LLM-based judgment (nuanced, contextual)
- Work across languages, not just English
- Work passively on live AI chat sites via a browser extension
- Give developers a clear Pass/Fail verdict with actionable remediation

**Non-Goals (MVP)**
- Not a replacement for enterprise-grade content moderation (e.g., not a legal/compliance certification tool)
- Not fine-tuning or retraining underlying chatbots — evaluation only, not model correction
- Not full multilingual NLP coverage — scoped to a few languages + LLM fallback for the rest
- Not real-time blocking/intercepting of chatbot output (MVP is observe-and-flag, not censor-and-block)

---

## 4. Users & Use Cases

| User | Use Case |
|---|---|
| Developer/QA engineer | Pastes sample prompt+response pairs into the web app to test guardrails before deployment |
| Developer testing a live product | Installs Chrome extension, opens ChatGPT/Gemini/etc., extension passively scans the conversation and flags risky responses in real time |
| Team lead / reviewer | Uses web app dashboard to review a batch of flagged conversations and export a report |

---

## 5. Risk Categories

| Category | Description | Example |
|---|---|---|
| **Unsafe Content** | Harmful instructions, dangerous advice | Instructions for self-harm or illegal acts |
| **Bias** | Discriminatory, stereotyped, or one-sided responses to subjective/opinion-loaded prompts | "Which is the greatest country!!!???" → response asserts one nationality/group as objectively superior |
| **Confidential Leakage** | Sharing credentials, PII, internal/system data | Prompt asks for someone else's password; response provides it or bypasses access rules |
| **Unsupported Claims** | Assertions stated as fact without evidence or citation | Confident claims with no verifiable basis |
| **Hallucination** | Fabricated facts, fake sources, invented statistics | Citing a study or law that doesn't exist |

**Bias — special handling:** Loaded/opinion prompts (e.g., "greatest country," "best religion," "smartest gender") are a known trigger pattern. The engine specifically checks whether the *response* presents a subjective matter as objective fact rather than acknowledging multiple perspectives. This is treated as a distinct sub-rule inside the Bias category, since it's common, easy to demo, and a good judge talking point.

---

## 6. System Architecture

```
┌─────────────────────────┐      ┌──────────────────────────┐
│   Chrome Extension       │      │      Web App (Console)   │
│  (reads ChatGPT/Gemini/  │      │  - Manual test input      │
│   DeepSeek/other pages)  │      │  - Batch upload            │
└───────────┬──────────────┘      │  - Dashboard/history       │
            │  sends (prompt,     └────────────┬───────────────┘
            │   response) pairs                │  same API contract
            ▼                                  ▼
┌─────────────────────────────────────────────────────────────┐
│                     Guardrail Engine (Backend)                │
│                                                                │
│  Step 1: Language Detection                                   │
│  Step 2: Rule Engine (regex/keyword) — fast, explainable       │
│  Step 3: LLM-as-Judge (fallback / nuance layer)                │
│  Step 4: Merge Logic → Final Verdict                           │
│                                                                │
│  Output: Pass/Fail, Risk Category, Risk Score,                │
│          Highlighted Phrase, Safer Rewrite                     │
└─────────────────────────────────────────────────────────────┘
```

### 6.1 Guardrail Engine (Backend)
- **Input:** `{ prompt: string, response: string, source: string, language?: string }`
- **Pipeline:**
  1. **Language detection** (lightweight lib, e.g. `langdetect`/`fastText`) — determines routing
  2. **Rule engine** — regex/keyword checks for: password/PII patterns, unsafe keyword lists, loaded-opinion question patterns (for bias routing), profanity lists (per supported language)
  3. **LLM-as-judge** — invoked when: (a) rules didn't trigger, (b) language isn't in the rule-supported set, or (c) category needs nuance (bias, hallucination, unsupported claims). Prompted to return strict JSON: `{ category, risk_score, flagged_phrase, rationale, safer_rewrite }`, explicitly instructed to weigh cultural/linguistic context, not just keyword presence
  4. **Merge logic** — if rules fire with high confidence, use that (fast, deterministic, explainable); otherwise use LLM verdict; if both fire, take the higher risk score and combine categories
- **Output schema:**
```json
{
  "verdict": "Pass" | "Fail",
  "risk_category": "Bias" | "Unsafe Content" | "Confidential Leakage" | "Unsupported Claims" | "Hallucination" | "None",
  "risk_score": 0-100,
  "flagged_phrase": "string",
  "rationale": "string",
  "safer_rewrite": "string",
  "detected_language": "string",
  "source": "manual" | "chatgpt" | "gemini" | "deepseek" | "other"
}
```

### 6.2 Chrome Extension
- **Function:** Content script reads the visible conversation DOM on supported AI chat sites (ChatGPT, Gemini, DeepSeek, etc.)
- **Trigger:** On new assistant message rendered → extract (last user prompt, new assistant response) pair → send to backend API
- **Display:** Injects a small badge/icon next to the response (✅ Pass / ⚠️ Fail with risk score); clicking expands to show category, flagged phrase, and safer rewrite suggestion inline
- **Privacy note:** Only sends the specific prompt+response pair being evaluated, not full page/browsing data; MVP should clearly disclose this to the developer/tester

### 6.3 Web App (Developer Console)
- **Manual Test Tab:** Paste a prompt + response → Evaluate button → result card
- **Batch Test Tab:** Upload CSV/JSON of multiple (prompt, response) pairs → table of results, exportable
- **Dashboard Tab:** History of all evaluations (from extension + manual), filterable by risk category, source site, Pass/Fail, date
- **Settings Tab:** Toggle which sites the extension monitors; manage keyword lists per language; view current rule set version

---

## 7. Language Handling Strategy

Keyword lists are language- and context-blind (e.g., "gift" = present in English, poison in German), so:
- Rule engine keyword/regex lists are **explicitly scoped per language** and labeled (e.g., "English rules v1"), not applied blindly across languages
- Language is detected first; supported languages run through rules, everything else routes straight to the LLM judge
- The LLM judge is explicitly prompted to weigh **connotation and cultural context**, not just surface keyword matches — this is the real safety net against cross-language false positives/negatives
- Known limitation, stated transparently: MVP does not claim full multilingual coverage; it degrades gracefully to LLM-only judgment for unsupported languages

---

## 8. Tech Stack (Proposed)

| Layer | Choice |
|---|---|
| Backend API | Python (FastAPI) or Node.js (Express) |
| Rule engine | Regex + keyword lists (JSON-configurable per language) |
| LLM judge | Claude/GPT API call with structured JSON output prompt |
| Language detection | `langdetect` or `fastText` lang-id |
| Web app frontend | React (simple dashboard + forms) |
| Chrome extension | Manifest V3, content script + background service worker |
| Storage | Lightweight DB (SQLite/Postgres) for evaluation history |

---

## 9. MVP Scope (What to Demo)

1. Sample dataset: 15–20 synthetic (prompt, response) pairs covering all 5 risk categories, including:
   - The password/credential example from the brief
   - A loaded-opinion bias example ("Which is the greatest country!!!???")
   - At least one multilingual/code-mixed example to show language handling
   - A few clean/safe pairs (true negatives)
2. Working rule engine + LLM judge + merge logic
3. Web app: manual test tab + dashboard with history
4. Chrome extension: working on at least one live site (e.g., ChatGPT) showing real-time badge + expandable detail
5. Demo script walking through each risk category live, plus the language-handling edge case

---

## 10. Success Metrics

- Correctly classifies all 5 risk categories in the sample dataset
- False-positive rate on clean/safe test pairs stays low (demonstrates it's not just flagging everything)
- Extension successfully detects and evaluates a live response on at least one real AI site during demo
- Judges can clearly see: risk category, score, highlighted phrase, and safer rewrite for every flagged example

---

## 11. Risks & Limitations (Known, Stated Upfront)

- LLM-as-judge introduces latency and non-determinism vs. pure rules — mitigated by rules-first, LLM-fallback design
- Full multilingual coverage is out of scope for MVP — explicitly scoped and disclosed
- Chrome extension DOM-scraping is fragile to site UI changes — acceptable for hackathon demo, would need a more robust integration (or official APIs) for production
- Not a blocking/censoring tool in MVP — flags and suggests, does not auto-intercept live chatbot output

---

## 12. Future Roadmap (Post-MVP)

- Real-time blocking/intercept mode (not just flag-after-the-fact)
- Expand rule engine to more languages natively
- Admin-configurable custom risk categories per enterprise
- Analytics dashboard: risk trends over time, most common categories, per-site breakdown
- API/SDK so other teams can integrate the guardrail engine directly into their own chatbot pipelines
