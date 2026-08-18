-- ============================================
-- 021: Deliverable MP4 uploads (Phase 6).
-- Public bucket for deliverable videos (v1: direct MP4, max 50MB — enforced
-- in the upload route). A video_url column lets creators attach a video
-- alongside (or instead of) a submitted link URL.
-- ============================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('deliverable-videos', 'deliverable-videos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read deliverable videos" ON storage.objects;
CREATE POLICY "Public read deliverable videos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'deliverable-videos');

-- Authenticated users can upload into the bucket (RLS on storage.objects
-- scopes writes to their own folder — the upload route signs with the user
-- session, so the client key can write here).
DROP POLICY IF EXISTS "Authenticated upload deliverable videos" ON storage.objects;
CREATE POLICY "Authenticated upload deliverable videos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'deliverable-videos' AND auth.role() = 'authenticated');

ALTER TABLE public.deliverables
  ADD COLUMN IF NOT EXISTS video_url text;

CREATE INDEX IF NOT EXISTS idx_deliverables_video_url
  ON public.deliverables(video_url) WHERE video_url IS NOT NULL;
