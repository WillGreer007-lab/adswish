import { NextResponse } from "next/server";

/**
 * GET /api/internal/oauth/status
 *
 * Reports which social-connect providers are configured (i.e. their API keys /
 * OAuth credentials are present in the environment), so the UI can show a
 * "Connect" button instead of a dead end when a key is missing.
 *
 * No secrets are returned — only booleans.
 */
export async function GET() {
  return NextResponse.json({
    automation: {
      instagram: Boolean(process.env.INSTAGRAM_CLIENT_ID && process.env.INSTAGRAM_CLIENT_SECRET),
      tiktok: Boolean(process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET),
      youtube: Boolean(process.env.YOUTUBE_API_KEY),
    },
  });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
