-- ============================================
-- 024: Profile picture / logo uploads.
-- Public bucket for creator profile pictures and business logos.
-- ============================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-images', 'profile-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read profile images" ON storage.objects;
CREATE POLICY "Public read profile images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'profile-images');

-- Authenticated users can upload into the bucket. The upload route signs with
-- the user session and scopes writes to their own `user_id/` folder.
DROP POLICY IF EXISTS "Authenticated upload profile images" ON storage.objects;
CREATE POLICY "Authenticated upload profile images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'profile-images' AND auth.role() = 'authenticated');
