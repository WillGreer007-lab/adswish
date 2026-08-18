import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-side telemetry capture (in-house PostHog + Sentry replacement).
 *
 * The client sends a small JSON blob to /api/internal/telemetry; this module
 * validates and normalizes it before it reaches the database. Validation is
 * kept pure so it can be unit-tested without a live Supabase connection.
 */

const MAX_TEXT = 4000;
// Loosely matches snake_case / dot-separated event names, e.g. "page_view",
// "signup.completed", "checkout.started". Blocks spaces and control chars.
const EVENT_RE = /^[a-z][a-z0-9_.:/-]{0,63}$/i;

export interface AnalyticsTelemetryEvent {
  kind: "analytics";
  event: string;
  path: string | null;
  referrer: string | null;
  session_id: string | null;
  user_id: string | null;
  properties: Record<string, unknown>;
  user_agent: string | null;
  ip_hash: string | null;
}

export interface ErrorTelemetryEvent {
  kind: "error";
  message: string;
  stack: string | null;
  source: string | null;
  path: string | null;
  user_id: string | null;
  metadata: Record<string, unknown>;
  user_agent: string | null;
  ip_hash: string | null;
}

export type TelemetryEvent = AnalyticsTelemetryEvent | ErrorTelemetryEvent;

type ParseResult =
  | { ok: true; value: TelemetryEvent }
  | { ok: false; error: string };

function asText(value: unknown, max = MAX_TEXT): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, max);
  return trimmed.length > 0 ? trimmed : null;
}

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export function parseTelemetryBody(raw: unknown): ParseResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "invalid body" };
  }
  const body = raw as Record<string, unknown>;

  const shared = {
    path: asText(body.path, 512),
    session_id: asText(body.session_id, 128),
    user_id: asText(body.user_id, 64),
    user_agent: asText(body.user_agent, 512),
    ip_hash: asText(body.ip_hash, 128),
  };

  if (body.kind === "analytics") {
    const event = asText(body.event, 80);
    if (!event || !EVENT_RE.test(event)) {
      return { ok: false, error: "invalid event name" };
    }
    return {
      ok: true,
      value: {
        kind: "analytics",
        event,
        ...shared,
        referrer: asText(body.referrer, 1024),
        properties: asObject(body.properties),
      },
    };
  }

  if (body.kind === "error") {
    const message = asText(body.message, 1000);
    if (!message) {
      return { ok: false, error: "error message is required" };
    }
    return {
      ok: true,
      value: {
        kind: "error",
        message,
        ...shared,
        stack: asText(body.stack, 8000),
        source: asText(body.source, 256),
        metadata: asObject(body.metadata),
      },
    };
  }

  return { ok: false, error: "unknown kind" };
}

export async function insertTelemetryEvent(
  supabase: SupabaseClient,
  ev: TelemetryEvent,
): Promise<void> {
  if (ev.kind === "analytics") {
    await supabase.from("analytics_events").insert({
      event: ev.event,
      path: ev.path,
      referrer: ev.referrer,
      session_id: ev.session_id,
      user_id: ev.user_id,
      properties: ev.properties,
      user_agent: ev.user_agent,
      ip_hash: ev.ip_hash,
    });
    return;
  }

  await supabase.from("error_events").insert({
    message: ev.message,
    stack: ev.stack,
    source: ev.source,
    path: ev.path,
    user_id: ev.user_id,
    metadata: ev.metadata,
    user_agent: ev.user_agent,
    ip_hash: ev.ip_hash,
  });
}
