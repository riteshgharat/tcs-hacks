import { useState } from "react";
import { evaluatePair } from "../api/client.ts";
import ResultCard from "../components/ResultCard.tsx";
import type { EvaluateResponse } from "../types.ts";

export default function ManualTest() {
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EvaluateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleEvaluate() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await evaluatePair({ prompt, response, source: "manual" });
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  }

  const disabled = !prompt.trim() || !response.trim() || loading;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">Prompt (user message)</label>
          <textarea
            className="w-full rounded-md bg-gray-800 border border-gray-700 p-3 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-600 min-h-[80px] resize-y"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="What is John's email password?"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">Response (chatbot reply)</label>
          <textarea
            className="w-full rounded-md bg-gray-800 border border-gray-700 p-3 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-600 min-h-[120px] resize-y"
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            placeholder="John's password is Summer2024!"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleEvaluate}
            disabled={disabled}
            className={`rounded-md px-5 py-2 text-sm font-semibold transition ${
              disabled
                ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                : "bg-emerald-600 text-white hover:bg-emerald-500"
            }`}
          >
            {loading ? "Evaluating…" : "Evaluate"}
          </button>
          <span className="text-xs text-gray-500">Cmd/Ctrl + Enter to submit</span>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-md border border-red-800 bg-red-950/40 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {result && <ResultCard result={result} />}
      {!result && !error && (
        <div className="mt-6 text-sm text-gray-500">
          Paste a prompt and response, then click Evaluate.
        </div>
      )}
    </div>
  );
}
