// Background service worker — proxies evaluation requests to the backend.

const BACKEND = "http://localhost:8787/api/v1";

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "EVALUATE") {
    fetch(`${BACKEND}/evaluate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: msg.prompt,
        response: msg.response,
        source: msg.source || "chatgpt",
      }),
    })
      .then((res) => res.json())
      .then((data) => sendResponse({ ok: true, result: data }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true; // async
  }
  return false;
});
