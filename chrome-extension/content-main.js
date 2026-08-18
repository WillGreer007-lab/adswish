// MAIN-world content script. Runs in the business page's own JS context so the
// business's existing code can call `window.adswish.init(...)` / `track(...)`
// exactly like the /pixel.js script — but with no site code required.
(function () {
  "use strict";
  if (window.__adswishExtLoaded) return;
  window.__adswishExtLoaded = true;

  var COOKIE = "_adswish";
  var consent = true; // installing the extension is the opt-in; pixel.js defaults to false
  var attributionDays = 30;
  var heartbeatTimer = null;

  function getToken() {
    var m = document.cookie.match(new RegExp("(?:^|; )" + COOKIE + "=([^;]*)"));
    return m ? decodeURIComponent(m[1]) : "";
  }

  function captureToken() {
    try {
      return new URLSearchParams(window.location.search).get("adswish_ref") || "";
    } catch (e) {
      return "";
    }
  }

  function dropCookie(token) {
    if (!consent || !token) return;
    var maxAge = attributionDays * 24 * 60 * 60;
    document.cookie =
      COOKIE + "=" + encodeURIComponent(token) +
      "; path=/; max-age=" + maxAge + "; samesite=lax";
  }

  function post(type, payload) {
    try {
      window.postMessage({ source: "adswish-extension", type: type, payload: payload || {} }, "*");
    } catch (e) {
      /* ignore */
    }
  }

  function heartbeat() {
    post("heartbeat", {});
  }

  var w = window;
  w.adswish = w.adswish || {};

  w.adswish.init = function (opts) {
    opts = opts || {};
    if (opts.consent === false) consent = false;
    if (typeof opts.attributionDays === "number" && opts.attributionDays > 0) {
      attributionDays = opts.attributionDays;
    }

    if (consent) dropCookie(getToken() || captureToken());
    else if (getToken()) {
      document.cookie = COOKIE + "=; path=/; max-age=0; samesite=lax";
    }

    heartbeat();
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(function () {
      if (!document.hidden) heartbeat();
    }, 60 * 1000);
  };

  w.adswish.track = function (order) {
    order = order || {};
    var token = getToken() || captureToken();
    if (!token) {
      return Promise.resolve({ attributed: false, reason: "no attribution token" });
    }
    post("track", {
      token: token,
      orderId: String(order.orderId || ""),
      amount: Number(order.amount || 0),
    });
    return Promise.resolve({ attributed: true });
  };

  // Auto-capture on arrival from an Adswish redirect (/t/{slug}).
  var initial = captureToken();
  if (initial) dropCookie(initial);

  // Keep the pixel alive while a tracked page is open (mirrors /pixel.js).
  if (initial) {
    heartbeat();
    heartbeatTimer = setInterval(function () {
      if (!document.hidden) heartbeat();
    }, 60 * 1000);
  }
})();
