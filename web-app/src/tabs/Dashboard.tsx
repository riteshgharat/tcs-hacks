import { useState, useEffect } from "react";
import { fetchHistory } from "../api/client.ts";
import type { HistoryRecord } from "../types.ts";

function badgeDot(band: number) {
  const colors = [
    "bg-emerald-500",
    "bg-amber-500",
    "bg-orange-500",
    "bg-red-500",
    "bg-red-700",
  ];
  return <span className={`inline-block h-2 w-2 rounded-full ${colors[band] ?? "bg-gray-500"}`} />;
}

export default function Dashboard() {
  const [rows, setRows] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetchHistory(50)
      .then((data) => {
        if (!mounted) return;
        setRows(data.items);
        setError(null);
      })
      .catch((e) => {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : "Load failed");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-gray-400">History</h2>
        <button
          onClick={() => window.location.reload()}
          className="text-xs text-emerald-400 hover:text-emerald-300"
        >
          Refresh
        </button>
      </div>

      {loading && <div className="text-sm text-gray-500">Loading…</div>}
      {error && <div className="text-sm text-red-400">{error}</div>}

      {!loading && !error && rows.length === 0 && (
        <div className="text-sm text-gray-500">No evaluations yet.</div>
      )}

      {!loading && rows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-gray-700">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-800 text-gray-400 text-xs uppercase">
              <tr>
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Verdict</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Score</th>
                <th className="px-3 py-2">Lang</th>
                <th className="px-3 py-2">Prompt preview</th>
                <th className="px-3 py-2">Flagged</th>
                <th className="px-3 py-2">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700 bg-gray-900/50">
              {rows.map((r, i) => (
                <tr key={r.evaluation_id} className="hover:bg-gray-800/50">
                  <td className="px-3 py-2 text-gray-500">{i + 1}</td>
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-1.5">
                      {badgeDot(r.risk_band)}
                      <span className={r.verdict === "Fail" ? "text-red-400 font-medium" : "text-emerald-400"}>
                        {r.verdict}
                      </span>
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-300">{r.risk_category}</td>
                  <td className="px-3 py-2 text-gray-300">{r.risk_score}</td>
                  <td className="px-3 py-2 text-gray-400">{r.detected_language}</td>
                  <td className="px-3 py-2 text-gray-400 max-w-xs truncate" title={r.prompt_preview}>
                    {r.prompt_preview}
                  </td>
                  <td className="px-3 py-2 text-gray-400 max-w-[200px] truncate" title={r.flagged_phrase}>
                    {r.flagged_phrase || "—"}
                  </td>
                  <td className="px-3 py-2 text-gray-500 text-xs whitespace-nowrap">
                    {new Date(r.created_at).toLocaleTimeString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
