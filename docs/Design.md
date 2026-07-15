# Design — Developer Console & Extension Badge

UI system for web app + extension. Risk traffic-light model. Score bands from `Data_Schema.md` §3, reused here for color mapping. Dark-first dev-tool aesthetic.

---

## 1. Principles

1. **Clarity over polish.** Dev tool, not consumer app. Judges read fast.
2. **Verdict first.** Pass/Fail + score visible before any other detail.
3. **Evidence next.** Flagged phrase + rationale + safer rewrite, in that order.
4. **Honest empty/error states.** No fake data, no spinner masquerading as result.
5. **Keyboard-friendly.** Tab through results, Enter to evaluate, Esc to clear.

## 2. Aesthetic

- **Theme:** dark-first. Light mode optional, post-MVP.
- **Mood:** dev console, terminal-adjacent. Monospace where it carries meaning (flagged phrases, IDs, code).
- **Density:** medium. Not sparse marketing, not cramped IDE.
- **Personality:** restrained. Risk colors carry the emotion; UI stays neutral.

## 3. Color System

Risk traffic-light, mapped 1:1 to score bands (`Data_Schema.md` §3):

| Band | Score | Semantic | Foreground | Background (subtle) | Border | Use |
|---|---|---|---|---|---|---|
| 0 | 0–20 | clean / Pass | `#3dd68c` | `rgba(61,214,140,0.10)` | `rgba(61,214,140,0.35)` | Pass badges, safe row accents |
| 1 | 21–40 | minor / Pass | `#f5c451` | `rgba(245,196,81,0.10)` | `rgba(245,196,81,0.35)` | Pass-but-note, low-risk chip |
| 2 | 41–60 | moderate / Fail | `#ff9f43` | `rgba(255,159,67,0.10)` | `rgba(255,159,67,0.40)` | Fail (mild), warning |
| 3 | 61–80 | high / Fail | `#ff5c5c` | `rgba(255,92,92,0.12)` | `rgba(255,92,92,0.45)` | Fail (clear) |
| 4 | 81–100 | critical / Fail | `#d12b2b` | `rgba(209,43,43,0.15)` | `rgba(209,43,43,0.55)` | Fail (severe) |

Neutrals (dark theme):
- bg-app: `#0d1117`
- bg-surface: `#161b22`
- bg-surface-raised: `#1c2230`
- border-subtle: `#2a313c`
- border-strong: `#3a4250`
- text-primary: `#e6edf3`
- text-secondary: `#9aa5b1`
- text-tertiary: `#6b7480`

Accent (actions): `#4a8bf5` (links, primary buttons, focus ring).

Contrast: text-primary on bg-app = 13.4:1 (AAA). Risk foregrounds on bg-surface ≥ 4.5:1 (AA). All checked.

## 4. Typography

System stack, monospace for evidence:

```css
--font-sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Inter, sans-serif;
--font-mono: ui-monospace, "JetBrains Mono", "SF Mono", Menlo, Consolas, monospace;
```

| Token | Family | Size | Weight | Use |
|---|---|---|---|---|
| `display` | sans | 24px | 600 | Page title |
| `h1` | sans | 20px | 600 | Tab title |
| `h2` | sans | 16px | 600 | Section |
| `body` | sans | 14px | 400 | Default text |
| `small` | sans | 12px | 400 | Hints, metadata |
| `mono-sm` | mono | 13px | 500 | Flagged phrase, evaluation_id, rule_id |
| `mono-xs` | mono | 11px | 400 | Timestamps, version tags |

Line-height: 1.5 for prose, 1.25 for headings.

## 5. Spacing & Layout

4px base scale: `4 / 8 / 12 / 16 / 24 / 32 / 48`.

- Page padding: 24px desktop, 16px mobile.
- Card padding: 16px.
- Stack gap (vertical): 16px default, 8px tight.
- Inline gap (chips, badges): 8px.
- Border-radius: 6px (cards), 4px (chips/inputs), 9999px (status dots).
- Border width: 1px default, 2px focus.

Grid: max-width 1200px content. Three-tab layout, single column on mobile.

## 6. Components

### 6.1 ResultCard (web app primary unit)

```
┌────────────────────────────────────────────────────┐
│ [RiskBadge]  Fail · confidential_leakage  · 85     │  ← header row
│ ────────────────────────────────────────────────── │
│ FLAGGED PHRASE                                     │  ← mono-sm, band-color border-left bar
│ "John's password is Summer2024!"                   │
│ ────────────────────────────────────────────────── │
│ RATIONALE                                           │
│ Rule en-v1.pii.password matched: credentials       │
│ disclosed in response.                             │
│ ────────────────────────────────────────────────── │
│ SAFER REWRITE                                       │
│ I can't share or retrieve anyone's password...     │  ← mono, scrollable if long
│ ────────────────────────────────────────────────── │
│ en · manual · en-v1 · v1.0.0 · 2026-07-15 09:30     │  ← mono-xs, text-tertiary
└────────────────────────────────────────────────────┘
```

Props: `result: EvaluateResponse`. Sections hide if empty (Pass hides flagged + rewrite).

### 6.2 RiskBadge

Pill. Background = band bg, border = band border, text = band fg, dot = band fg.

States:
- `Pass` band 0 → green dot + `Pass` + score
- `Pass` band 1 → amber dot + `Pass` + score + small "note" chip
- `Fail` band 2/3/4 → colored dot + `Fail` + category + score

Compact variant (extension): dot + score only, e.g. `● 85`.

### 6.3 FlaggedPhrase

- `mono-sm` font.
- Left bar (4px) in band color.
- Background: band bg.
- Padding 8px 12px.
- Quote marks literal.
- If `flagged_phrase === ""` (Pass): component hidden.

### 6.4 SaferRewrite

- `mono-sm` font.
- Subtle bg (`bg-surface-raised`).
- Max-height 200px, scroll if longer.
- "Copy" button top-right (icon-only, aria-label).
- Hidden if empty.

### 6.5 Tabs

Three tabs: **Manual Test · Batch Test · Dashboard**. Active tab: text-primary + bottom border 2px accent. Inactive: text-secondary. Keyboard: Left/Right arrows move between tabs.

### 6.6 ManualTest form

Two `<textarea>`s (prompt, response) stacked. Both required. `Cmd/Ctrl+Enter` submits. Below: Evaluate button (primary, accent). Below button: ResultCard or empty state.

Empty state: muted illustration-free placeholder text: "Paste a prompt and response, then Evaluate."

Loading state: button disabled + `Evaluating…` + spinner (CSS, 14px). LLM path can take 2-3s; show spinner, do not block UI.

Error state: red banner above form with `error.message` + dismiss X.

### 6.7 BatchTest

Drag-drop zone + file input. Accept `.csv`, `.json`. On upload: parse → table preview (prompt, response, source per row) → Run Batch button → progress bar → results table (one ResultCard-summary row per item: badge + category + score + expand chevron). Expand reveals full ResultCard.

Export button (post-run): downloads `results.json` (full EvaluateResponse array) and `results.csv` (flat summary: id, verdict, category, score, flagged_phrase, source).

### 6.8 Dashboard

History table. Columns: time, source, language, verdict, category, score, flagged_phrase (truncated 40 chars), `evaluation_id` (mono-xs).

Filters (top bar): category (select), source (select), verdict (select), language (input), date range (two date inputs), search (free text over prompt_preview).

Row click: opens side drawer with full ResultCard reconstructed from history (post-MVP: full payload; MVP: just preview + verdict + flagged + rationale stub). For MVP, drawer shows what's stored — honest "full response not stored in MVP" note if user wants rewrite.

Pagination: prev/next + "1–50 of N". Sort dropdown: newest, oldest, score desc.

### 6.9 Extension Badge

Inline pill injected after assistant message bubble. Shadow DOM isolate styles from host page.

States:
| State | Visual | When |
|---|---|---|
| Pass | green dot + `✓` + score | verdict Pass, band 0-1 |
| Fail | red/amber dot + `⚠` + score | verdict Fail |
| Evaluating | gray dot + spinner | request in flight |
| Offline | gray dot + `⚠` text "offline" | `/health` down |
| Error | gray dot + `!` | backend 5xx or parse fail |

Click badge → popover card (shadow DOM) with category, flagged phrase, rationale, safer rewrite, copy button. Close on Esc or outside-click.

Compact mode (extension setting): score only, no text. Hover shows full.

## 7. Empty / Error / Loading States

| State | Copy | Visual |
|---|---|---|
| No history yet | "No evaluations yet. Run one from Manual Test or install the extension." | muted text, no table |
| History filter empty | "No results match these filters." | muted text + clear-filters button |
| Backend offline | "Guardrail engine unreachable. Start backend on :8787." | red banner, retry button |
| LLM disabled | "LLM judge disabled — running rules-only. Hallucination + unsupported-claims detection reduced." | amber banner, dismissible |
| Batch parse fail | "Couldn't parse file. Use the template CSV/JSON." | red inline, link to template |
| Validation fail | field-level red text below offending input | inline |

No fake success masking errors. No skeleton loaders longer than 200ms (use spinner instead).

## 8. Accessibility

- Color never sole signal: badges always include text (`Pass`/`Fail`) + icon (`✓`/`⚠`), not color alone.
- Contrast: AA minimum (4.5:1) for body, AAA for primary text. Verified in §3.
- Focus: 2px accent ring, 2px offset, visible on every interactive element.
- Keyboard: Tab order logical top-down. Enter submits forms. Esc closes overlays. Arrow keys switch tabs. ResultCard focusable; expanded state announces via `aria-expanded`.
- ARIA: `role="status"` + `aria-live="polite"` on result container so screen readers announce new verdicts. Badges use `aria-label="Fail, confidential leakage, risk 85"`.
- Extension badge: `role="button"`, `aria-haspopup="dialog"`, `aria-expanded` toggles popover.
- No motion without `prefers-reduced-motion` respect. Spinner is the only animation; honor reduce = static "Evaluating…" text.

## 9. Iconography

Minimal. Use unicode glyphs, no icon-font dependency:
- ✓ Pass (U+2713)
- ⚠ Warning (U+26A0)
- ✗ Fail (U+2717) — used in compact badge variant only
- → arrow for "safer rewrite" label
- ⌘ Cmd glyph in keyboard hint
- ▸ expand chevron

Avoid emoji color variants (renders inconsistently across OS).

## 10. Layout — Responsive

- Desktop ≥ 1024px: 2-column Manual Test (form left, result right sticky). Dashboard full width.
- Tablet 640–1023px: single column, result below form.
- Mobile < 640px: stacked, ResultCard full-width, table becomes cards.

Extension popover: max-width 360px, repositions to stay in viewport.

## 11. Tokens (Tailwind config)

Map to Tailwind theme extension so all components share:

```ts
// tailwind.config.ts — theme.extend
colors: {
  app:        { DEFAULT: "#0d1117", surface: "#161b22", raised: "#1c2230" },
  edge:       { subtle: "#2a313c", strong: "#3a4250" },
  ink:        { DEFAULT: "#e6edf3", secondary: "#9aa5b1", tertiary: "#6b7480" },
  accent:     "#4a8bf5",
  risk: {
    0: "#3dd68c", 1: "#f5c451", 2: "#ff9f43",
    3: "#ff5c5c", 4: "#d12b2b",
  },
},
fontFamily: {
  sans: ['ui-sans-serif','system-ui','-apple-system','Segoe UI','Inter','sans-serif'],
  mono: ['ui-monospace','JetBrains Mono','SF Mono','Menlo','Consolas','monospace'],
},
borderRadius: { card: '6px', chip: '4px', dot: '9999px' },
spacing: { /* 4-px scale already in Tailwind default */ },
```

Use `data-band="0..4"` attribute on ResultCard root → CSS attribute selectors map to risk color set. One source of truth (band), no per-component color hardcoding.

## 12. Copy / Voice

- Terse, dev-friendly. No marketing words.
- "Evaluate" not "Run Analysis". "Safer rewrite" not "Improved Response".
- Errors cite the code: "E_INPUT_TOO_LARGE: response exceeds 16000 chars."
- Empty states: one sentence, no apology.
- Dates: relative in lists ("2 min ago"), absolute ISO on hover (title attr).
