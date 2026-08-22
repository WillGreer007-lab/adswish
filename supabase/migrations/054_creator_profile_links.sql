-- 054: Creator profile links (Website, Twitter/X, Twitch).
--
-- The connected-channels follower counts already come from
-- `creator_social_accounts` (auto-synced). This adds the self-described link
-- fields that aren't auto-synced: a personal website and Twitter/X + Twitch
-- profile URLs, shown on the public creator profile and editable in Settings.

ALTER TABLE public.creator_profiles
  ADD COLUMN IF NOT EXISTS website_url text,
  ADD COLUMN IF NOT EXISTS twitter_url text,
  ADD COLUMN IF NOT EXISTS twitch_url text;

COMMENT ON COLUMN public.creator_profiles.website_url IS 'Creator-supplied personal/business website URL (public profile).';
COMMENT ON COLUMN public.creator_profiles.twitter_url IS 'Creator-supplied Twitter/X profile URL (public profile).';
COMMENT ON COLUMN public.creator_profiles.twitch_url IS 'Creator-supplied Twitch channel URL (public profile).';
