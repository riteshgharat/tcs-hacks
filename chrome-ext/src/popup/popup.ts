import type { ExtMessage, ExtResponse, ExtensionSettings } from "../api";
import { DEFAULT_SETTINGS } from "../api";

const backendUrlInput = document.getElementById("backendUrl") as HTMLInputElement;
const compactModeInput = document.getElementById("compactMode") as HTMLInputElement;
const showRewriteInput = document.getElementById("showSaferRewrite") as HTMLInputElement;
const saveBtn = document.getElementById("saveBtn") as HTMLButtonElement;
const healthBtn = document.getElementById("healthBtn") as HTMLButtonElement;
const healthDot = document.getElementById("healthDot") as HTMLSpanElement;
const healthText = document.getElementById("healthText") as HTMLSpanElement;
const healthDetail = document.getElementById("healthDetail") as HTMLDivElement;
const saveStatus = document.getElementById("saveStatus") as HTMLDivElement;

async function loadSettings(): Promise<ExtensionSettings> {
  const stored = await chrome.storage.local.get([
    "backendUrl",
    "compactMode",
    "enabledSites",
    "showSaferRewrite",
  ]);
  return {
    backendUrl:
      typeof stored.backendUrl === "string" && stored.backendUrl.trim()
        ? stored.backendUrl.trim()
        : DEFAULT_SETTINGS.backendUrl,
    compactMode: Boolean(stored.compactMode ?? DEFAULT_SETTINGS.compactMode),
    enabledSites: Array.isArray(stored.enabledSites)
      ? (stored.enabledSites as string[])
      : DEFAULT_SETTINGS.enabledSites,
    showSaferRewrite:
      stored.showSaferRewrite !== undefined
        ? Boolean(stored.showSaferRewrite)
        : DEFAULT_SETTINGS.showSaferRewrite,
  };
}

async function saveSettings(partial: Partial<ExtensionSettings>): Promise<void> {
  await chrome.storage.local.set(partial);
}

function setHealthUI(
  state: "ok" | "bad" | "warn" | "pending",
  text: string,
  detail = "",
): void {
  healthDot.className = "dot" + (state === "pending" ? "" : ` ${state === "ok" ? "ok" : state === "warn" ? "warn" : "bad"}`);
  healthText.textContent = text;
  healthDetail.textContent = detail;
}

async function checkHealth(): Promise<void> {
  setHealthUI("pending", "Checking…");
  try {
    const res = (await chrome.runtime.sendMessage({
      type: "HEALTH",
    } satisfies ExtMessage)) as ExtResponse;

    if (res?.type === "HEALTH") {
      const h = res.health;
      const llm = h.llm_enabled
        ? `LLM on (${h.llm_model ?? "configured"})`
        : "LLM disabled — rules-only";
      setHealthUI(
        h.llm_enabled ? "ok" : "warn",
        `Online · ${h.engine_version}`,
        `${llm} · rules ${h.rule_version} · uptime ${Math.round(h.uptime_s)}s`,
      );
      return;
    }

    if (res?.type === "EVAL_ERROR") {
      setHealthUI("bad", "Offline", `${res.code}: ${res.message}`);
      return;
    }

    setHealthUI("bad", "Offline", "Unexpected response from service worker");
  } catch (e) {
    setHealthUI(
      "bad",
      "Offline",
      e instanceof Error ? e.message : String(e),
    );
  }
}

function flashSave(msg: string): void {
  saveStatus.hidden = false;
  saveStatus.textContent = msg;
  setTimeout(() => {
    saveStatus.hidden = true;
  }, 2000);
}

async function init(): Promise<void> {
  const settings = await loadSettings();
  backendUrlInput.value = settings.backendUrl;
  compactModeInput.checked = settings.compactMode;
  showRewriteInput.checked = settings.showSaferRewrite;

  saveBtn.addEventListener("click", async () => {
    const url = backendUrlInput.value.trim().replace(/\/$/, "") || DEFAULT_SETTINGS.backendUrl;
    backendUrlInput.value = url;
    await saveSettings({
      backendUrl: url,
      compactMode: compactModeInput.checked,
      showSaferRewrite: showRewriteInput.checked,
      enabledSites: DEFAULT_SETTINGS.enabledSites,
    });
    flashSave("Saved");
    await checkHealth();
  });

  compactModeInput.addEventListener("change", async () => {
    await saveSettings({ compactMode: compactModeInput.checked });
  });

  showRewriteInput.addEventListener("change", async () => {
    await saveSettings({ showSaferRewrite: showRewriteInput.checked });
  });

  healthBtn.addEventListener("click", () => {
    void checkHealth();
  });

  await checkHealth();
}

void init();
