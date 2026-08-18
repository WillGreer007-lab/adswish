import { randomBytes, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

const SLUG_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"; // no 0/O/1/I/l

/**
 * Opaque 8-char alphanumeric slug (blueprint §11). Uses a crypto-random source
 * and an unambiguous alphabet so links are hard to guess and easy to read.
 */
export function generateTrackingSlug(length = 8): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += SLUG_ALPHABET[bytes[i] % SLUG_ALPHABET.length];
  }
  return out;
}

export type CampaignTrackingState = {
  status: string;
  pause_mode: string | null;
};

/**
 * Whether a campaign's tracking links should resolve. §12: pausing "new
 * applications" keeps existing creators' links live; "all activity" disables
 * them; budget-paused campaigns keep existing creators going too.
 */
export function isTrackingActive(campaign: CampaignTrackingState): boolean {
  if (campaign.status === "active" || campaign.status === "paused_budget") {
    return true;
  }
  if (campaign.status === "paused") {
    return campaign.pause_mode === "new_applications";
  }
  return false; // draft / cancelled / completed / paused-all-activity
}

export interface TrackingLinkInput {
  deliverableId: string | null;
  creatorId: string;
  campaignId: string;
  destinationUrl: string;
}

export interface CreatedTrackingLink {
  id: string;
  slug: string;
  jti: string;
}

/**
 * Create the tracking link for an approved slot. Retries on the (vanishingly
 * rare) slug collision. Returns null when the insert fails so the caller can
 * still approve without blocking on link creation.
 */
export async function createTrackingLink(
  input: TrackingLinkInput,
  supabase: SupabaseClient,
): Promise<CreatedTrackingLink | null> {
  const jti = randomUUID();
  for (let attempt = 0; attempt < 3; attempt++) {
    const slug = generateTrackingSlug();
    const { data, error } = await supabase
      .from("tracking_links")
      .insert({
        deliverable_id: input.deliverableId,
        creator_id: input.creatorId,
        campaign_id: input.campaignId,
        slug,
        destination_url: input.destinationUrl,
        jti,
      })
      .select("id, slug, jti")
      .single();

    if (!error && data) {
      return { id: data.id, slug: data.slug, jti: data.jti };
    }
    // 23505 = slug unique collision → retry with a fresh slug.
    if (error?.code !== "23505") {
      return null;
    }
  }
  return null;
}
