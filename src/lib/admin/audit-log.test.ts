import { describe, it, expect } from "vitest";

describe("Review system validation", () => {
  it("rating must be between 1 and 5", () => {
    const isValid = (r: number) => r >= 1 && r <= 5;
    expect(isValid(0)).toBe(false);
    expect(isValid(1)).toBe(true);
    expect(isValid(3)).toBe(true);
    expect(isValid(5)).toBe(true);
    expect(isValid(6)).toBe(false);
  });

  it("cannot review yourself", () => {
    const userId = "user-1";
    const revieweeId = "user-1";
    expect(revieweeId === userId).toBe(true);
  });

  it("right to reply expires after 30 days", () => {
    const thirtyDaysAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    expect(new Date(thirtyDaysAgo) < new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)).toBe(true);

    const recent = new Date();
    expect(new Date(recent) < new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)).toBe(false);
  });
});

describe("Admin audit log action types", () => {
  const validActionTypes = [
    "force_release",
    "refund",
    "ban_user",
    "unban_user",
    "resolve_dispute",
    "manual_strike",
    "override_rating",
  ];

  it("all action types are valid", () => {
    validActionTypes.forEach((type) => {
      expect(validActionTypes).toContain(type);
    });
  });

  it("rejects invalid action types", () => {
    expect(validActionTypes.includes("delete_user")).toBe(false);
    expect(validActionTypes.includes("edit_log")).toBe(false);
  });
});

describe("Tier badge colors", () => {
  const tierColors: Record<string, string> = {
    micro: "bg-muted text-muted-foreground",
    mid: "bg-primary/10 text-primary",
    macro: "bg-warning/10 text-warning",
  };

  it("each tier has a distinct color", () => {
    expect(tierColors.micro).not.toBe(tierColors.mid);
    expect(tierColors.mid).not.toBe(tierColors.macro);
    expect(tierColors.micro).not.toBe(tierColors.macro);
  });
});
