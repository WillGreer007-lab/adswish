import { NextResponse } from "next/server";

/**
 * Public endpoints (conversion webhook + pixel heartbeat) are called from the
 * business's own domain, not from the Adswish UI, so they must answer CORS.
 * These endpoints never read session cookies — attribution arrives in the POST
 * body — so a wildcard origin is safe.
 */
export const PUBLIC_CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function corsJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: PUBLIC_CORS_HEADERS });
}

export function corsOptions() {
  return new NextResponse(null, { status: 204, headers: PUBLIC_CORS_HEADERS });
}
