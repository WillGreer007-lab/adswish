-- ============================================
-- 028: Connections (friends) + campaign invites.
-- User-to-user friend requests work across both roles (creator ↔ business).
-- Campaign invites let a business ask a specific creator to apply.
-- ============================================

CREATE TABLE IF NOT EXISTS public.connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(requester_id, addressee_id)
);

CREATE TABLE IF NOT EXISTS public.campaign_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.business_profiles(user_id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES public.creator_profiles(user_id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, creator_id)
);

ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "connections read own" ON public.connections;
CREATE POLICY "connections read own"
  ON public.connections FOR SELECT
  USING (auth.uid() IN (requester_id, addressee_id));

DROP POLICY IF EXISTS "connections insert own" ON public.connections;
CREATE POLICY "connections insert own"
  ON public.connections FOR INSERT
  WITH CHECK (requester_id = auth.uid() AND addressee_id <> auth.uid());

DROP POLICY IF EXISTS "connections update own" ON public.connections;
CREATE POLICY "connections update own"
  ON public.connections FOR UPDATE
  USING (addressee_id = auth.uid())
  WITH CHECK (addressee_id = auth.uid());

DROP POLICY IF EXISTS "campaign_invites read own" ON public.campaign_invites;
CREATE POLICY "campaign_invites read own"
  ON public.campaign_invites FOR SELECT
  USING (business_id = auth.uid() OR creator_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_connections_addressee
  ON public.connections(addressee_id, status);

CREATE INDEX IF NOT EXISTS idx_campaign_invites_creator
  ON public.campaign_invites(creator_id, status);
