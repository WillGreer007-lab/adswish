// Isolated-world content script. Bridges the MAIN-world `window.adswish` API
// (content-main.js) to the background service worker, answers popup queries, and
// auto-detects order confirmations when the URL pattern + amount selector are set.

function getToken() {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("adswish_ref");
    if (fromUrl) return fromUrl;
  } catch {
    /* ignore */
  }
  const m = document.cookie.match(/(?:^|; )_adswish=([^;]*)/);
  return m ? decodeURIComponent(m[1]) : "";
}

// Forward page-world messages to the background worker.
window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  const data = event.data;
  if (!data || data.source !== "adswish-extension" || !data.type) return;
  chrome.runtime.sendMessage({ type: data.type, payload: data.payload }).catch(() => {});
});

// Popup → this tab: report the captured token for the current page.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg) return false;
  if (msg.type === "getToken") {
    sendResponse({ token: getToken(), url: window.location.href });
  }
  return false;
});

// ---------------------------------------------------------------------------
// Auto-detect conversions (optional). When the current URL matches the
// configured confirmation pattern, poll for the amount element and fire a
// conversion once it appears.
// ---------------------------------------------------------------------------
let autoDetectStarted = false;
let firedForUrl = null;

function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return h.toString(36);
}

function startAutoDetect() {
  if (autoDetectStarted) return;
  autoDetectStarted = true;

  chrome.storage.sync.get(["confirmUrlPattern", "amountSelector"], (cfg) => {
    const pattern = (cfg.confirmUrlPattern || "").trim();
    const selector = (cfg.amountSelector || "").trim();
    if (!pattern || !selector) return;

    // Re-check on a timer so single-page checkouts that pushState into the
    // confirmation route are still caught.
    setInterval(() => {
      if (firedForUrl === window.location.href) return;
      if (!window.location.href.includes(pattern)) return;

      const el = document.querySelector(selector);
      if (!el) return;
      const amount = parseFloat((el.textContent || "").replace(/[^0-9.]/g, ""));
      if (!amount || amount <= 0) return;

      const token = getToken();
      if (!token) return;

      // A stable orderId (derived from the confirmation URL) keeps refreshes
      // idempotent — the server dedupes on order_id.
      const orderId = "ext:" + hash(window.location.href.replace(/[?&]adswish_ref=[^&]*/, ""));

      chrome.runtime.sendMessage({
        type: "track",
        payload: { token, orderId, amount },
      }).catch(() => {});

      firedForUrl = window.location.href;
    }, 2500);
  });
}

startAutoDetect();
