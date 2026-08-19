// Adswish Tracker — background service worker.
// The service worker performs the network calls so they are not subject to the
// page's CORS origin. host_permissions ("<all_urls>") makes these fetches work
// cross-origin from the business's own site.

const DEFAULTS = { apiBase: "https://adswish-lake.vercel.app", businessId: "" };

async function getConfig() {
  const stored = await chrome.storage.sync.get(["apiBase", "businessId"]);
  return {
    apiBase: (stored.apiBase || DEFAULTS.apiBase).replace(/\/+$/, ""),
    businessId: stored.businessId || "",
  };
}

async function post(url, body) {
  const cfg = await getConfig();
  try {
    const res = await fetch(cfg.apiBase + url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return { ok: res.ok, status: res.status };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || !msg.type) return false;

  (async () => {
    if (msg.type === "heartbeat") {
      const cfg = await getConfig();
      if (!cfg.businessId) {
        sendResponse({ ok: false, error: "business_id is not configured — open the extension options" });
        return;
      }
      sendResponse(await post("/api/v1/pixel/ping", { business_id: cfg.businessId }));
    } else if (msg.type === "track") {
      const p = msg.payload || {};
      if (!p.token) {
        sendResponse({ ok: false, error: "no attribution token on this page" });
        return;
      }
      sendResponse(
        await post("/api/v1/webhooks/conversion", {
          token: p.token,
          orderId: String(p.orderId || ""),
          amount: Number(p.amount || 0),
          attribution_method: "cookie",
        }),
      );
    } else if (msg.type === "config") {
      sendResponse(await getConfig());
    } else {
      sendResponse({ ok: false, error: "unknown message type: " + msg.type });
    }
  })();

  return true; // keep the message channel open for the async sendResponse
});
