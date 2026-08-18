import { describe, it, expect } from "vitest";
import {
  evaluateApply,
  nextApplicationStatus,
  buildDeliverableSlots,
  mapApplicationInsertError,
} from "@/lib/application-engine";

const campaign = {
  id: "c0ffee00-0000-4000-8000-000000000001",
  type: "fixed" as const,
  status: "active",
  deliverable_count: 3,
  deadline_days: 14,
};

const activeCreator = { tier: "mid" as const, account_status: "active", strikes: 0 };

const baseArgs = {
  profile: activeCreator,
  campaign,
  allowedCampaignTypes: ["fixed", "hybrid"] as Array<"fixed" | "affiliate" | "hybrid">,
  maxActiveCampaigns: 5,
  existingApplication: false,
  activeApplicationCount: 0,
  applicationsLast24h: 0,
  applyLimit: 20,
};

describe("evaluateApply guard chain", () => {
  it("allows a clean application", () => {
    expect(evaluateApply(baseArgs)).toEqual({ ok: true });
  });

  it("rejects a banned creator", () => {
    expect(evaluateApply({ ...baseArgs, profile: { ...activeCreator, strikes: 3 } })).toMatchObject({
      ok: false,
      status: 403,
    });
  });

  it("rejects an inactive campaign", () => {
    expect(evaluateApply({ ...baseArgs, campaign: { ...campaign, status: "draft" } })).toMatchObject({
      ok: false,
      status: 422,
    });
  });

  it("rejects a tier that cannot take the campaign type", () => {
    // micro tier is only allowed on fixed campaigns, so affiliate is rejected.
    expect(
      evaluateApply({
        ...baseArgs,
        profile: { ...activeCreator, tier: "micro" },
        campaign: { ...campaign, type: "affiliate" },
        allowedCampaignTypes: ["fixed"],
      }),
    ).toMatchObject({ ok: false, status: 422 });
  });

  it("enforces the 24h rate limit", () => {
    expect(
      evaluateApply({ ...baseArgs, applicationsLast24h: 20, applyLimit: 20 }),
    ).toMatchObject({ ok: false, status: 429 });
  });

  it("rejects a duplicate application", () => {
    expect(evaluateApply({ ...baseArgs, existingApplication: true })).toMatchObject({
      ok: false,
      status: 409,
    });
  });

  it("rejects when the creator is at max active campaigns", () => {
    expect(
      evaluateApply({ ...baseArgs, activeApplicationCount: 5, maxActiveCampaigns: 5 }),
    ).toMatchObject({ ok: false, status: 422 });
  });
});

describe("application state machine (two creators, independent tracks)", () => {
  const creatorA = "aaaaaaaa-0000-4000-8000-00000000000a";
  const creatorB = "bbbbbbbb-0000-4000-8000-00000000000b";

  it("stamps independent, deterministic deliverable slots per creator", () => {
    const slotsA = buildDeliverableSlots(campaign, creatorA);
    const slotsB = buildDeliverableSlots(campaign, creatorB);

    expect(slotsA).toHaveLength(3);
    expect(slotsB).toHaveLength(3);

    // Separate creators → separate tracks.
    expect(new Set(slotsA.map((s) => s.creator_id))).toEqual(new Set([creatorA]));
    expect(new Set(slotsB.map((s) => s.creator_id))).toEqual(new Set([creatorB]));

    // Hashtags are scoped per (campaign, creator, slot) so the two tracks don't collide.
    const hashtagsA = slotsA.map((s) => s.required_hashtag);
    const hashtagsB = slotsB.map((s) => s.required_hashtag);
    expect(new Set([...hashtagsA, ...hashtagsB]).size).toBe(6);
    expect(hashtagsA[0]).toContain(creatorA.slice(0, 4));
    expect(hashtagsB[0]).toContain(creatorB.slice(0, 4));
  });

  it("stamps per-slot deadlines when the business stored them (past ones fall back)", () => {
    const now = new Date("2026-08-18T00:00:00Z");
    const slots = buildDeliverableSlots(
      {
        id: campaign.id,
        deliverable_count: 3,
        deadline_days: 14,
        deliverable_deadlines: [
          "2026-08-20T00:00:00Z", // slot 1 — future
          "2026-08-25T00:00:00Z", // slot 2 — future
          "2026-08-18T00:00:00Z", // slot 3 — in the past → fall back
        ],
      },
      creatorA,
      now,
    );

    expect(slots[0].deadline_date).toBe("2026-08-20T00:00:00.000Z");
    expect(slots[1].deadline_date).toBe("2026-08-25T00:00:00.000Z");
    expect(slots[2].deadline_date).toBe("2026-09-01T00:00:00.000Z"); // now + 14 days
  });

  it("advances pending → accepted/rejected/withdrawn but blocks illegal transitions", () => {
    expect(nextApplicationStatus("pending", "accept")).toBe("accepted");
    expect(nextApplicationStatus("pending", "reject")).toBe("rejected");
    expect(nextApplicationStatus("pending", "withdraw")).toBe("withdrawn");
    // Once decided, no further transitions are allowed.
    expect(nextApplicationStatus("accepted", "withdraw")).toBeNull();
    expect(nextApplicationStatus("accepted", "accept")).toBeNull();
    expect(nextApplicationStatus("rejected", "accept")).toBeNull();
    expect(nextApplicationStatus("withdrawn", "accept")).toBeNull();
  });
});

describe("concurrent-apply race", () => {
  it("maps the UNIQUE(campaign_id, creator_id) violation to a 409", () => {
    // Two simultaneous applies both pass the guards (no existing application
    // yet); the second INSERT hits Postgres error 23505.
    expect(mapApplicationInsertError("23505")).toEqual({
      status: 409,
      error: "Already applied to this campaign",
    });
  });

  it("maps unknown insert errors to a 500", () => {
    expect(mapApplicationInsertError("23503")).toEqual({
      status: 500,
      error: "Failed to create application",
    });
  });
});
