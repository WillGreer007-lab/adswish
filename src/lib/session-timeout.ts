export type SessionTimeoutMinutes = 1 | 5 | 10 | 30 | "never";

const KEY = "adswish.session.timeout";
export const DEFAULT_SESSION_TIMEOUT: SessionTimeoutMinutes = 1;

export const SESSION_TIMEOUT_OPTIONS: { value: SessionTimeoutMinutes; label: string; hint?: string }[] = [
  { value: 1, label: "1 minute", hint: "Default" },
  { value: 5, label: "5 minutes" },
  { value: 10, label: "10 minutes" },
  { value: 30, label: "30 minutes" },
  { value: "never", label: "Never", hint: "Not recommended" },
];

export function readSessionTimeout(): SessionTimeoutMinutes {
  if (typeof window === "undefined") return DEFAULT_SESSION_TIMEOUT;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === "never") return "never";
    const n = Number(raw);
    return n === 1 || n === 5 || n === 10 || n === 30 ? n : DEFAULT_SESSION_TIMEOUT;
  } catch {
    return DEFAULT_SESSION_TIMEOUT;
  }
}

export function saveSessionTimeout(value: SessionTimeoutMinutes): void {
  try {
    localStorage.setItem(KEY, String(value));
  } catch {
    /* storage unavailable — fall back to the default on next load */
  }
}

/** Milliseconds before auto-logout, or null for "never". */
export function timeoutToMs(value: SessionTimeoutMinutes): number | null {
  if (value === "never") return null;
  return value * 60 * 1000;
}
