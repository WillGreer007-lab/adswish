import { randomBytes } from "node:crypto";

/**
 * SocialVerify — identity binding (anti-impersonation).
 *
 * Seven proof methods, weighted into a composite confidence score (out of 125):
 *   1. Domain ownership (30)      — DNS TXT or /.well-known file
 *   2. Bi-directional links (20)  — social bio ↔ domain
 *   3. Token persistence (15)     — token stays in bio 24h
 *   4. Video proof (25)           — face + sign + date + phrase
 *   5. Two-way handshake (15)     — 10-minute action challenge
 *   6. Historical content (10)    — established account analysis
 *   7. Social graph (10)          — follower/following ratio
 */

// ============================================================
// 1. Domain ownership
// ============================================================

export interface DomainChallenge {
  challenge_token: string;
  method_1_dns: { name: string; value: string; instruction: string };
  method_2_file: { path: string; content: string; instruction: string };
  expires_at: string;
}

export function generateDomainChallenge(domain: string, businessId: string): DomainChallenge {
  const token = `DOMAIN-VERIFY-${businessId}-${randomBytes(8).toString("hex")}`;
  const expires = new Date(Date.now() + 24 * 3600 * 1000).toISOString();

  return {
    challenge_token: token,
    method_1_dns: {
      name: `_socialverify.${domain}`,
      value: token,
      instruction: `Add DNS TXT record: _socialverify.${domain} = ${token}`,
    },
    method_2_file: {
      path: `https://${domain}/.well-known/socialverify-domain.txt`,
      content: token,
      instruction: `Upload file to https://${domain}/.well-known/socialverify-domain.txt containing: ${token}`,
    },
    expires_at: expires,
  };
}

export function verifyDomainOwnership(
  domain: string,
  challengeToken: string,
  method: "dns" | "file" = "dns",
): { verified: boolean; method: string; domain: string; token_found: boolean } {
  // Production implementation resolves the DNS TXT record or fetches the
  // /.well-known file and compares the token. Stubbed for the spec — returns
  // verified=true so the scoring pipeline is exercisable.
  return { verified: true, method, domain, token_found: true };
}

// ============================================================
// 2. Bi-directional links
// ============================================================

export interface BidirectionalResult {
  platform: string;
  bio_links_to_domain: boolean;
  domain_links_to_social: boolean;
  bidirectional_passed: boolean;
}

export function verifyBidirectionalLinks(
  _domain: string,
  accounts: Array<{ platform: string; handle: string }>,
): { all_passed: boolean; results: BidirectionalResult[]; trust_score: number } {
  // Production implementation scrapes each social bio for the domain link and
  // the domain homepage for the social link. Stubbed: not passed by default.
  const results: BidirectionalResult[] = accounts.map((a) => ({
    platform: a.platform,
    bio_links_to_domain: false,
    domain_links_to_social: false,
    bidirectional_passed: false,
  }));
  const allPassed = results.every((r) => r.bidirectional_passed);
  return { all_passed: allPassed, results, trust_score: allPassed ? 100 : 50 };
}

// ============================================================
// 3. Token persistence
// ============================================================

export interface PersistenceCheck {
  token_found: boolean;
  checked_at: string;
}

export function verifyPersistence(
  checkHistory: PersistenceCheck[],
  required: number = 3,
): { persistence_verified: boolean; passed_checks: number; required_checks: number } {
  const passed = checkHistory.filter((c) => c.token_found).length;
  return { persistence_verified: passed >= required, passed_checks: passed, required_checks: required };
}

// ============================================================
// 4. Video proof
// ============================================================

export interface VideoChallenge {
  challenge_id: string;
  requirements: {
    must_show_face: boolean;
    must_hold_sign: boolean;
    sign_must_contain: string[];
    must_show_app_open: boolean;
    max_length_seconds: number;
    min_length_seconds: number;
  };
  unique_phrase: string;
  expires_at: string;
  instruction: string;
}

export function generateVideoChallenge(businessId: string, platform: string): VideoChallenge {
  const dateStr = new Date().toISOString().slice(0, 10);
  const phrase = randomBytes(4).toString("hex").toUpperCase();
  const shortId = businessId.slice(0, 6).toUpperCase();

  return {
    challenge_id: `VIDEO-${businessId}-${platform}-${Math.floor(Date.now() / 1000)}`,
    requirements: {
      must_show_face: true,
      must_hold_sign: true,
      sign_must_contain: [`VERIFY-${shortId}`, `Date: ${dateStr}`, `Phrase: ${phrase}`, `Platform: ${platform}`],
      must_show_app_open: true,
      max_length_seconds: 30,
      min_length_seconds: 5,
    },
    unique_phrase: phrase,
    expires_at: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
    instruction: `Record a 10-30s video holding a sign: 'VERIFY ${shortId} ${dateStr} ${phrase} ${platform.toUpperCase()}'. Show your face, the sign, and your phone with ${platform} open.`,
  };
}

// ============================================================
// 5. Two-way handshake
// ============================================================

export interface HandshakeChallenge {
  challenge_id: string;
  action: { type: string; description: string; verification: string };
  time_limit_minutes: number;
  instruction: string;
  expires_at: string;
}

const HANDSHAKE_ACTIONS = [
  {
    type: "profile_picture_pattern",
    description: "Change your profile picture to this generated pattern for 1 hour",
    verification: "Scrape public profile and match pattern",
  },
  {
    type: "bio_emoji_suffix",
    description: "Add the emoji 🔐 to the end of your bio",
    verification: "Scrape bio for emoji at end",
  },
  {
    type: "temporary_story_post",
    description: `Post a story/tweet containing: 'SocialVerify check ${randomBytes(4).toString("hex").toUpperCase()}'`,
    verification: "Check public posts within 10-minute window",
  },
];

export function generateHandshakeChallenge(businessId: string, platform: string): HandshakeChallenge {
  const action = HANDSHAKE_ACTIONS[Math.floor(Math.random() * HANDSHAKE_ACTIONS.length)];
  return {
    challenge_id: `HANDSHAKE-${businessId}-${platform}-${Math.floor(Date.now() / 1000)}`,
    action,
    time_limit_minutes: 10,
    instruction: `You have 10 minutes to: ${action.description}`,
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  };
}

// ============================================================
// 6. Historical content fingerprint
// ============================================================

export function analyzeHistoricalContent(
  accountAgeDays: number,
): { established_account: boolean; method: string } {
  return { established_account: accountAgeDays > 90, method: "historical_content_fingerprint" };
}

// ============================================================
// 7. Social graph analysis
// ============================================================

export function analyzeSocialGraph(
  followers: number,
  following: number,
): { natural_ratio: boolean; method: string } {
  const ratio = following > 0 ? followers / following : 0;
  return { natural_ratio: ratio > 1 && ratio < 100, method: "social_graph_analysis" };
}

// ============================================================
// Composite identity confidence
// ============================================================

export interface IdentityProofs {
  domain_verified?: boolean;
  bidirectional_passed?: boolean;
  persistence_verified?: boolean;
  video_verified?: boolean;
  handshake_passed?: boolean;
  established_account?: boolean;
  social_graph_natural?: boolean;
}

export interface IdentityConfidence {
  identity_confidence_score: number;
  minimum_requirements_met: boolean;
  status: "verified" | "pending" | "rejected";
  breakdown: Record<string, number>;
  recommendation: string;
}

export function calculateIdentityConfidence(proofs: IdentityProofs): IdentityConfidence {
  const scores = {
    domain_ownership: proofs.domain_verified ? 30 : 0,
    bidirectional_links: proofs.bidirectional_passed ? 20 : 0,
    token_persistence: proofs.persistence_verified ? 15 : 0,
    video_proof: proofs.video_verified ? 25 : 0,
    handshake: proofs.handshake_passed ? 15 : 0,
    historical_content: proofs.established_account ? 10 : 0,
    social_graph: proofs.social_graph_natural ? 10 : 0,
  };

  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  const confidence = Math.round((total / 125) * 1000) / 10;

  const minimumMet =
    (scores.domain_ownership > 0 || scores.video_proof > 0) &&
    scores.bidirectional_links > 0 &&
    scores.token_persistence > 0;

  let status: "verified" | "pending" | "rejected";
  if (confidence >= 70 && minimumMet) status = "verified";
  else if (confidence >= 50) status = "pending";
  else status = "rejected";

  const recommendation =
    confidence >= 70 && minimumMet
      ? "Approve"
      : confidence >= 50
        ? "Request additional proof"
        : "Reject — likely impersonator";

  return {
    identity_confidence_score: confidence,
    minimum_requirements_met: minimumMet,
    status,
    breakdown: scores,
    recommendation,
  };
}
