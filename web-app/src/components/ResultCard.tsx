import type { EvaluateResponse } from "../types.ts";

function badgeClasses(band: number): string {
  switch (band) {
    case 0:
      return "bg-emerald-900/40 text-emerald-400 border-emerald-700";
    case 1:
      return "bg-amber-900/40 text-amber-400 border-amber-700";
    case 2:
      return "bg-orange-900/40 text-orange-400 border-orange-700";
    case 3:
      return "bg-red-900/40 text-red-400 border-red-700";
    case 4:
      return "bg-red-950/60 text-red-300 border-red-600";
    default:
      return "bg-gray-800 text-gray-300 border-gray-700";
  }
}

export default function ResultCard({ result }: { result: EvaluateResponse }) {
  const pass = result.verdict === "Pass";
  return (
    <div className="mt-6 rounded-lg border border-gray-700 bg-gray-800 p-4">
      <div className="flex items-center gap-3 mb-3">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold ${badgeClasses(
            result.risk_band
          )}`}
        >
          <span>{pass ? "✓" : "⚠"}</span>
          {result.verdict} · {result.risk_category !== "none" ? result.risk_category : "clean"}
          · {result.risk_score}
        </span>
      </div>

      {!pass && result.flagged_phrase && (
        <div className="mb-3 rounded border-l-4 border-red-500 bg-red-950/20 p-3">
          <div className="text-xs uppercase tracking-wide text-red-400 mb-1">Flagged phrase</div>
          <code className="text-sm text-red-200 font-mono">"{result.flagged_phrase}"</code>
        </div>
      )}

      <div className="mb-3">
        <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Rationale</div>
        <p className="text-sm text-gray-300">{result.rationale}</p>
      </div>

      {!pass && result.safer_rewrite && (
        <div className="rounded bg-gray-900/60 p-3 border border-gray-700">
          <div className="text-xs uppercase tracking-wide text-emerald-400 mb-1">Safer rewrite</div>
          <p className="text-sm text-gray-200 font-mono">{result.safer_rewrite}</p>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-gray-500 font-mono">
        <span>lang: {result.detected_language}</span>
        <span>rule: {result.rule_version}</span>
        <span>engine: {result.engine_version}</span>
        <span>id: {result.evaluation_id.slice(0, 8)}</span>
        {result.llm_judge && <span>llm: {result.llm_judge.model} ({result.llm_judge.latency_ms}ms)</span>}
      </div>
    </div>
  );
}
