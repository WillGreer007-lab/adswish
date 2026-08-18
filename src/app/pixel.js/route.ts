import { NextResponse, type NextRequest } from "next/server";

/**
 * Adswish tracking pixel (blueprint §11). Served from `adswish.com/pixel.js`
 * and executed in the *business's* page context so the attribution cookie is
 * first-party to the business's domain.
 *
 * - `adswish.init({ consent: true, attributionDays: 30 })` — consent-gated.
 *   Without explicit consent the pixel runs analytics-only (no cookie, no
 *   conversion attribution), per the blueprint's GDPR posture.
 * - `adswish.track({ orderId, amount })` — reports a conversion (S2S fallback:
 *   the business backend can also POST the stored `adswish_ref` token directly
 *   to /api/v1/webhooks/conversion).
 */
export function GET(request: NextRequest) {
  const script = `(function () {
  "use strict";
  var COOKIE = "_adswish";
  var HEARTBEAT_MS = 60 * 1000;

  // The pixel's own origin is the API origin (it is served from adswish.com),
  // so business sites don't need to hardcode anything.
  var apiBase = "";
  var businessId = "";
  try {
    var s = document.currentScript;
    if (s && s.src) {
      apiBase = new URL(s.src).origin;
      businessId = new URL(s.src).searchParams.get("id") || "";
    }
  } catch (e) { apiBase = "https://adswish.com"; }

  var consent = false;
  var attributionDays = 30;

  function getToken() {
    var m = document.cookie.match(new RegExp("(?:^|; )" + COOKIE + "=([^;]*)"));
    return m ? decodeURIComponent(m[1]) : "";
  }

  function captureToken() {
    // The redirect route appends ?adswish_ref=<JWT>. Capture it once.
    try {
      var p = new URLSearchParams(window.location.search);
      return p.get("adswish_ref") || "";
    } catch (e) { return ""; }
  }

  function dropCookie(token) {
    if (!consent || !token) return;
    var maxAge = attributionDays * 24 * 60 * 60;
    document.cookie = COOKIE + "=" + encodeURIComponent(token) +
      "; path=/; max-age=" + maxAge + "; samesite=lax";
  }

  function post(url, body) {
    try {
      return fetch(apiBase + url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        keepalive: true,
      });
    } catch (e) { return Promise.resolve(); }
  }

  function heartbeat() {
    post("/api/v1/pixel/ping", { business_id: businessId });
  }

  var w = window;
  w.adswish = w.adswish || {};

  w.adswish.init = function (opts) {
    opts = opts || {};
    if (opts.consent === true) consent = true;
    if (typeof opts.attributionDays === "number" && opts.attributionDays > 0) {
      attributionDays = opts.attributionDays;
    }
    if (opts.apiBase) apiBase = opts.apiBase;

    if (consent) dropCookie(getToken() || captureToken());
    else if (getToken()) {
      // Consent revoked after a previous drop: remove the cookie.
      document.cookie = COOKIE + "=; path=/; max-age=0; samesite=lax";
    }

    heartbeat();
    var t = setInterval(function () {
      if (!document.hidden) heartbeat();
    }, HEARTBEAT_MS);
    if (typeof t.unref === "function") { /* noop for node */ }
  };

  w.adswish.track = function (order) {
    order = order || {};
    var token = getToken() || captureToken();
    if (!consent || !token) {
      // Analytics-only / consent-blocked: nothing to attribute.
      return Promise.resolve({ attributed: false });
    }
    return post("/api/v1/webhooks/conversion", {
      token: token,
      orderId: String(order.orderId || ""),
      amount: Number(order.amount || 0),
      attribution_method: "cookie",
    }).then(function () { return { attributed: true }; });
  };
})();`;

  return new NextResponse(script, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=3600",
    },
  });
}
