import { useState } from "react";
import ManualTest from "./tabs/ManualTest.tsx";
import Dashboard from "./tabs/Dashboard.tsx";

type Tab = "manual" | "dashboard";

export default function App() {
  const [tab, setTab] = useState<Tab>("manual");

  const tabClass = (t: Tab) =>
    `pb-2 text-sm font-medium border-b-2 transition ${
      tab === t
        ? "text-emerald-400 border-emerald-500"
        : "text-gray-500 border-transparent hover:text-gray-300"
    }`;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="border-b border-gray-800 bg-gray-900/60 backdrop-blur">
        <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-emerald-400">GT</span>
            <h1 className="text-base font-semibold">Guardrail Tester</h1>
          </div>
          <div className="flex gap-6">
            <button className={tabClass("manual")} onClick={() => setTab("manual")}>Manual Test</button>
            <button className={tabClass("dashboard")} onClick={() => setTab("dashboard")}>Dashboard</button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        {tab === "manual" && <ManualTest />}
        {tab === "dashboard" && <Dashboard />}
      </main>
    </div>
  );
}
