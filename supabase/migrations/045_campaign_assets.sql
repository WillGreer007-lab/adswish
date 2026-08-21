-- 045: Campaign asset upload (business-owned preview image/video).
-- A public bucket holds campaign preview assets; the campaigns table gains
-- `asset_url` so a business can attach a visual to a campaign. Writes are
-- brokered through the service-role upload route (owner-scoped), so the
-- storage INSERT policy only needs to allow the service role.

INSERT INTO storage.buckets (id, name, public)
VALUES ('campaign-assets', 'campaign-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Public read (the marketplace + campaign pages render these images).
DROP POLICY IF EXISTS "Public read campaign assets" ON storage.objects;
CREATE POLICY "Public read campaign assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'campaign-assets');

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS asset_url text;

CREATE INDEX IF NOT EXISTS idx_campaigns_asset_url
  ON public.campaigns(asset_url) WHERE asset_url IS NOT NULL;
