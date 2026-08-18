/**
 * Pure helpers shared by the telemetry admin page and the CSV export route:
 * filter parsing, LIKE-wildcard sanitization, and CSV escaping. Kept pure so
 * they can be unit-tested without a database or request object.
 */

export type TelemetryKind = "analytics" | "error";

export interface TelemetryFilter {
  kind: TelemetryKind;
  /** Matches `event` (analytics) or `message` (error). */
  q: string;
  /** Matches `path`. */
  path: string;
  /** ISO datetime lower bound (inclusive). */
  from: string | null;
  /** ISO datetime upper bound (inclusive). */
  to: string | null;
}

type RawParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

/** Remove LIKE wildcards so user input can never broaden a match unexpectedly. */
export function sanitizeLike(value: string): string {
  return value.replace(/[%_\\]/g, "").trim();
}

/** Parse a date/datetime bound. Date-only values get end-of-day when `endOfDay`. */
export function parseBound(value: string, endOfDay: boolean): string | null {
  const v = value.trim();
  if (!v) return null;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(v);
  const parsed = new Date(dateOnly && endOfDay ? `${v}T23:59:59.999Z` : v);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function parseTelemetryFilter(raw: RawParams): TelemetryFilter {
  const kind: TelemetryKind = first(raw.kind) === "error" ? "error" : "analytics";
  return {
    kind,
    q: sanitizeLike(first(raw.q)).slice(0, 100),
    path: sanitizeLike(first(raw.path)).slice(0, 200),
    from: parseBound(first(raw.from), false),
    to: parseBound(first(raw.to), true),
  };
}

/** RFC-4180-style CSV field escaping. */
export function csvEscape(value: unknown): string {
  const s =
    value == null ? "" : typeof value === "string" ? value : JSON.stringify(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
