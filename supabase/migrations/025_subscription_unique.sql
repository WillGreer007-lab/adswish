-- ============================================
-- 025: One subscription row per owner.
-- Enables upserts (plan selection, Stripe webhook) and prevents duplicate
-- subscription rows when a user completes checkout more than once.
-- ============================================

-- Dedupe any historical duplicates first (keep the latest row per owner).
DELETE FROM creator_subscriptions a
USING creator_subscriptions b
WHERE a.creator_id = b.creator_id AND a.id < b.id;

DELETE FROM business_subscriptions a
USING business_subscriptions b
WHERE a.business_id = b.business_id AND a.id < b.id;

CREATE UNIQUE INDEX IF NOT EXISTS uq_creator_subscriptions_owner
  ON creator_subscriptions(creator_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_business_subscriptions_owner
  ON business_subscriptions(business_id);
