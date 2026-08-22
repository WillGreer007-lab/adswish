import { describe, it, expect } from "vitest";
import {
  generateDomainChallenge,
  verifyDomainOwnership,
  verifyBidirectionalLinks,
  verifyPersistence,
  generateVideoChallenge,
  generateHandshakeChallenge,
  analyzeHistoricalContent,
  analyzeSocialGraph,
  calculateIdentityConfidence,
} from "./identity";

describe("generateDomainChallenge", () => {
  it("produces a DNS and file challenge", () => {
    const c = generateDomainChallenge("acme.com", "acme-corp");
    expect(c.challenge_token).toContain("DOMAIN-VERIFY-acme-corp-");
    expect(c.method_1_dns.name).toBe("_socialverify.acme.com");
    expect(c.method_2_file.path).toContain("socialverify-domain.txt");
    expect(c.expires_at).toBeTruthy();
  });

  it("generates unique tokens per call", () => {
    const a = generateDomainChallenge("acme.com", "acme");
    const b = generateDomainChallenge("acme.com", "acme");
    expect(a.challenge_token).not.toBe(b.challenge_token);
  });
});

describe("verifyDomainOwnership", () => {
  it("returns verified", () => {
    expect(verifyDomainOwnership("acme.com", "tok", "dns").verified).toBe(true);
  });
});

describe("verifyBidirectionalLinks", () => {
  it("returns not passed by default", () => {
    const r = verifyBidirectionalLinks("acme.com", [
      { platform: "twitter", handle: "@x" },
    ]);
    expect(r.all_passed).toBe(false);
    expect(r.results[0].platform).toBe("twitter");
  });
});

describe("verifyPersistence", () => {
  it("requires 3 passing checks", () => {
    const history = [
      { token_found: true, checked_at: "" },
      { token_found: true, checked_at: "" },
      { token_found: true, checked_at: "" },
    ];
    expect(verifyPersistence(history).persistence_verified).toBe(true);
  });

  it("fails with only 2 passing checks", () => {
    const history = [
      { token_found: true, checked_at: "" },
      { token_found: true, checked_at: "" },
      { token_found: false, checked_at: "" },
    ];
    expect(verifyPersistence(history).persistence_verified).toBe(false);
  });
});

describe("generateVideoChallenge", () => {
  it("contains the required sign elements", () => {
    const v = generateVideoChallenge("acme-corp", "instagram");
    expect(v.requirements.must_show_face).toBe(true);
    expect(v.requirements.sign_must_contain).toHaveLength(4);
    expect(v.requirements.sign_must_contain[0]).toContain("VERIFY-ACME-C");
    expect(v.unique_phrase).toHaveLength(8);
  });
});

describe("generateHandshakeChallenge", () => {
  it("returns an action with a 10-minute window", () => {
    const h = generateHandshakeChallenge("acme", "twitter");
    expect(h.time_limit_minutes).toBe(10);
    expect(h.action.type).toBeTruthy();
    expect(h.instruction).toContain("10 minutes");
  });
});

describe("analyzeHistoricalContent", () => {
  it("establishes accounts older than 90 days", () => {
    expect(analyzeHistoricalContent(365).established_account).toBe(true);
    expect(analyzeHistoricalContent(30).established_account).toBe(false);
  });
});

describe("analyzeSocialGraph", () => {
  it("natural when followers/following between 1 and 100", () => {
    expect(analyzeSocialGraph(4500, 100).natural_ratio).toBe(true);
  });
  it("unnatural when following exceeds followers", () => {
    expect(analyzeSocialGraph(100, 5000).natural_ratio).toBe(false);
  });
});

describe("calculateIdentityConfidence", () => {
  it("full proofs → verified", () => {
    const result = calculateIdentityConfidence({
      domain_verified: true,
      bidirectional_passed: true,
      persistence_verified: true,
      video_verified: true,
      handshake_passed: true,
      established_account: true,
      social_graph_natural: true,
    });
    expect(result.identity_confidence_score).toBe(100);
    expect(result.status).toBe("verified");
    expect(result.recommendation).toBe("Approve");
  });

  it("minimum requirements enforce at least one primary proof", () => {
    const result = calculateIdentityConfidence({
      domain_verified: false,
      video_verified: false,
      bidirectional_passed: true,
      persistence_verified: true,
    });
    expect(result.minimum_requirements_met).toBe(false);
  });

  it("no proofs → rejected", () => {
    const result = calculateIdentityConfidence({});
    expect(result.status).toBe("rejected");
    expect(result.identity_confidence_score).toBe(0);
  });
});
