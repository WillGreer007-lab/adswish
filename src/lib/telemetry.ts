/**
 * Client-side telemetry tracker (browser only).
 *
 * Fire-and-forget capture for page views, funnel events, and crashes. Uses
 * `navigator.sendBeacon` (a Blob POST) so events survive navigation, with a
 * `fetch({ keepalive: true })` fallback. Never throws — telemetry must not
 * break the page.
 */

let currentUserId: string | null = null;
let listenersInstalled = false;

export function setTelemetryUserId(id: string | null): void {
  currentUserId = id;
}

function getSessionId(): string {
  try {
    let id = sessionStorage.getItem("adswish_session_id");
    if (!id) {
      id =
        typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem("adswish_session_id", id);
    }
    return id;
  } catch {
    return "unknown";
  }
}

function send(payload: Record<string, unknown>): void {
  const url = "/api/internal/telemetry";
  const json = JSON.stringify(payload);

  try {
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      const blob = new Blob([json], { type: "application/json" });
      if (navigator.sendBeacon(url, blob)) return;
    }
  } catch {
    // fall through to fetch
  }

  try {
    void fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: json,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // ignore
  }
}

function currentPath(): string {
  try {
    return window.location.pathname;
  } catch {
    return "";
  }
}

function currentReferrer(): string | null {
  try {
    return document.referrer || null;
  } catch {
    return null;
  }
}

function basePayload(): Record<string, unknown> {
  return {
    path: currentPath(),
    referrer: currentReferrer(),
    session_id: getSessionId(),
    user_id: currentUserId,
    user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
  };
}

export function track(event: string, properties?: Record<string, unknown>): void {
  try {
    send({ ...basePayload(), kind: "analytics", event, properties: properties ?? {} });
  } catch {
    // ignore
  }
}

export function trackPageView(path: string): void {
  track("page_view", { path });
}

export function captureError(error: unknown, source?: string): void {
  try {
    const err = error instanceof Error ? error : new Error(String(error));
    send({
      ...basePayload(),
      kind: "error",
      message: err.message || "Unknown error",
      stack: err.stack || null,
      source: source ?? "window.onerror",
      metadata: {},
    });
  } catch {
    // ignore
  }
}

export function installErrorListeners(): void {
  if (listenersInstalled || typeof window === "undefined") return;
  listenersInstalled = true;

  window.addEventListener("error", (e) => {
    const err = e.error ?? (e.message ? new Error(e.message) : new Error("Script error"));
    captureError(err, "window.onerror");
  });

  window.addEventListener("unhandledrejection", (e) => {
    captureError(e.reason ?? "Unhandled promise rejection", "unhandledrejection");
  });
}
