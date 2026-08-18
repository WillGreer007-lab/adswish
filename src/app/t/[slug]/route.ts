import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { signTrackingJwt, sha256Hex } from "@/lib/tracking";
import { checkRateLimit, isJtiRevoked } from "@/lib/redis";
import { isTrackingActive } from "@/lib/tracking-links";

const HANDOFF_TTL_SECONDS = 24 * 60 * 60; // JWT handoff expires in 24h (blueprint §11).
const REDIRECT_LIMIT_PER_MINUTE = 100; // blueprint: 100 req/min per IP.

/**
 * Tracking redirect edge function (blueprint §11).
 * `adswish.com/t/{slug}` -> 302 to the business's destination URL with
 * `?adswish_ref=<signed JWT>` appended. Revoked or expired links return 410
 * Gone (never a redirect), so leaked links die cleanly.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const ipHash = await sha256Hex(ip);

  // DDoS guard before any DB work (blueprint: 100 req/min per IP).
  const rl = await checkRateLimit({
    key: `redirect:${ipHash}`,
    limit: REDIRECT_LIMIT_PER_MINUTE,
    windowSeconds: 60,
  });
  if (!rl.allowed) {
    return new NextResponse("Too many requests", {
      status: 429,
      headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
    });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data: link } = await supabase
    .from("tracking_links")
    .select("id, creator_id, campaign_id, deliverable_id, destination_url, jti, revoked_at")
    .eq("slug", slug)
    .maybeSingle();

  if (!link) {
    return new NextResponse("Gone", { status: 410 });
  }
  if (link.revoked_at) {
    return new NextResponse("Gone", { status: 410 });
  }

  // §12: a campaign paused with "all activity" (or cancelled/completed/draft)
  // has its tracking links disabled; "new applications" keeps them live.
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("status, pause_mode")
    .eq("id", link.campaign_id)
    .maybeSingle();
  if (!campaign || !isTrackingActive(campaign)) {
    return new NextResponse("Gone", { status: 410 });
  }

  // jti blocklist: Redis fast path, Postgres fallback (blueprint §11).
  if (link.jti) {
    const revokedFast = await isJtiRevoked(link.jti);
    if (revokedFast) {
      return new NextResponse("Gone", { status: 410 });
    }
    const { data: revoked } = await supabase
      .from("revoked_jtis")
      .select("jti")
      .eq("jti", link.jti)
      .maybeSingle();
    if (revoked) {
      return new NextResponse("Gone", { status: 410 });
    }
  }

  const ua = request.headers.get("user-agent") || "";
  const uaHash = await sha256Hex(ua);
  const jti = randomUUID();

  const token = await signTrackingJwt({
    linkId: link.id,
    creatorId: link.creator_id,
    campaignId: link.campaign_id,
    deliverableId: link.deliverable_id ?? null,
    ipHash,
    uaHash,
    jti,
    ttlSeconds: HANDOFF_TTL_SECONDS,
  });

  // Log the click (best-effort — a logging failure must not break the redirect).
  try {
    await supabase.from("clicks_log").insert({
      tracking_link_id: link.id,
      ip_hash: ipHash,
      user_agent: ua,
      jwt_fingerprint: jti,
    });
  } catch {
    // swallow: attribution redirect should still succeed
  }

  const destination = new URL(link.destination_url);
  destination.searchParams.set("adswish_ref", token);
  destination.searchParams.set("utm_source", "adswish");
  destination.searchParams.set("utm_campaign", link.campaign_id.slice(0, 8));

  return NextResponse.redirect(destination.toString(), 302);
}
