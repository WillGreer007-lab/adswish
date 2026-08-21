import { describe, it, expect } from "vitest";
import {
  generateDomainChallenge,
  verifyPersistence,
  generateVideoChallenge,
  generateHandshakeChallenge,
  analyzeHistoricalContent,
  analyzeSocialGraph,
  calculateIdentityConfidence,
} from "@/lib/identity-binding";

describe("generateDomainChallenge", () => {
  it("generates a challenge with DNS and file methods", () => {
    const challenge = generateDomainChallenge("example.com", "biz-123");
    expect(challenge.challenge_token).toContain("DOMAIN-VERIFY-biz-123");
    expect(challenge.method_1_dns.name).toBe("_socialverify.example.com");
    expect(challenge.method_1_dns.value).toBe(challenge.challenge_token);
    expect(challenge.method_2_file.path).toContain("example.com");
    expect(challenge.expires_at).toBeTruthy();
  });
});

describe("verifyPersistence", () => {
  it("passes when enough checks found", () => {
    const history = [
      { token_found: true, checked_at: "2026-08-20T00:00:00Z" },
      { token_found: true, checked_at: "2026-08-20T06:00:00Z" },
      { token_found: true, checked_at: "2026-08-20T12:00:00Z" },
    ];
    const result = verifyPersistence(history, 3);
    expect(result.persistence_verified).toBe(true);
    expect(result.passed_checks).toBe(3);
  });

  it("fails when not enough checks", () => {
    const history = [
      { token_found: true, checked_at: "2026-08-20T00:00:00Z" },
      { token_found: false, checked_at: "2026-08-20T06:00:00Z" },
    ];
    const result = verifyPersistence(history, 3);
    expect(result.persistence_verified).toBe(false);
    expect(result.passed_checks).toBe(1);
  });
});

describe("generateVideoChallenge", () => {
  it("generates a challenge with unique phrase", () => {
    const challenge = generateVideoChallenge("biz-456", "instagram");
    expect(challenge.challenge_id).toContain("VIDEO-biz-456-instagram");
    expect(challenge.unique_phrase).toMatch(/^[A-F0-9]{8}$/);
    expect(challenge.requirements.must_show_face).toBe(true);
    expect(challenge.requirements.sign_must_contain.some(s => s.startsWith("VERIFY-"))).toBe(true);
    expect(challenge.instruction).toContain("instagram");
  });
});

describe("generateHandshakeChallenge", () => {
  it("generates a challenge with time limit", () => {
    const challenge = generateHandshakeChallenge("biz-789", "twitter");
    expect(challenge.challenge_id).toContain("HANDSHAKE");
    expect(challenge.time_limit_minutes).toBe(10);
    expect(challenge.action.description).toBeTruthy();
    expect(challenge.expires_at).toBeTruthy();
  });
});

describe("analyzeHistoricalContent", () => {
  it("returns established for old accounts", () => {
    const result = analyzeHistoricalContent(365);
    expect(result.established_account).toBe(true);
  });

  it("returns not established for new accounts", () => {
    const result = analyzeHistoricalContent(30);
    expect(result.established_account).toBe(false);
  });
});

describe("analyzeSocialGraph", () => {
  it("returns natural for healthy ratio", () => {
    const result = analyzeSocialGraph(10000, 500);
    expect(result.natural_ratio).toBe(true);
  });

  it("returns not natural for extreme ratio", () => {
    const result = analyzeSocialGraph(10000, 0);
    expect(result.natural_ratio).toBe(false);
  });
});

describe("calculateIdentityConfidence", () => {
  it("returns verified with all proofs", () => {
    const result = calculateIdentityConfidence({
      domain_verified: true,
      bidirectional_passed: true,
      persistence_verified: true,
      video_verified: true,
      handshake_passed: true,
      established_account: true,
      social_graph_natural: true,
    });
    expect(result.status).toBe("verified");
    expect(result.identity_confidence_score).toBe(100);
    expect(result.minimum_requirements_met).toBe(true);
    expect(result.recommendation).toBe("Approve");
  });

  it("returns pending with partial proofs", () => {
    // Need score >= 50 for pending: bidirectional(20) + persistence(15) + handshake(15) + established(10) + social_graph(10) = 70
    const result = calculateIdentityConfidence({
      domain_verified: false,
      bidirectional_passed: true,
      persistence_verified: true,
      video_verified: false,
      handshake_passed: true,
      established_account: true,
      social_graph_natural: true,
    });
    expect(result.status).toBe("pending");
    expect(result.identity_confidence_score).toBeGreaterThan(0);
    expect(result.identity_confidence_score).toBeLessThan(100);
    expect(result.minimum_requirements_met).toBe(false);
  });

  it("returns rejected with no proofs", () => {
    const result = calculateIdentityConfidence({});
    expect(result.status).toBe("rejected");
    expect(result.identity_confidence_score).toBe(0);
    expect(result.minimum_requirements_met).toBe(false);
    expect(result.recommendation).toContain("Reject");
  });

  it("requires minimum: domain OR video + bidirectional + persistence", () => {
    // Has domain + persistence but no bidirectional → not met
    const result1 = calculateIdentityConfidence({
      domain_verified: true,
      persistence_verified: true,
    });
    expect(result1.minimum_requirements_met).toBe(false);

    // Has video + bidirectional + persistence → met
    const result2 = calculateIdentityConfidence({
      video_verified: true,
      bidirectional_passed: true,
      persistence_verified: true,
    });
    expect(result2.minimum_requirements_met).toBe(true);
  });
});
