import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,
  name: "Guardrail Tester",
  version: "1.0.0",
  description:
    "Passively evaluates chatbot responses against responsible-AI guardrails.",
  permissions: ["storage", "activeTab"],
  host_permissions: [
    "https://chatgpt.com/*",
    "https://chat.openai.com/*",
    "http://localhost/*",
    "http://127.0.0.1/*",
  ],
  background: {
    service_worker: "src/background/sw.ts",
    type: "module",
  },
  content_scripts: [
    {
      matches: ["https://chatgpt.com/*", "https://chat.openai.com/*"],
      js: ["src/content/inject.ts"],
      run_at: "document_idle",
    },
  ],
  action: {
    default_popup: "src/popup/popup.html",
    default_title: "Guardrail Tester",
  },
  icons: {
    "16": "icons/16.png",
    "48": "icons/48.png",
    "128": "icons/128.png",
  },
});
