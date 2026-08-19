-- 031: Manual follower proof review + account administration.
-- Screenshots are stored privately and exposed only through short-lived signed URLs.

ALTER TABLE public.manual_follower_verifications
  ADD COLUMN IF NOT EXISTS storage_path text,
  ADD COLUMN IF NOT EXISTS handle text,
  ADD COLUMN IF NOT EXISTS claimed_follower_count bigint,
  ADD COLUMN IF NOT EXISTS review_notes text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.manual_follower_verifications
  DROP CONSTRAINT IF EXISTS manual_follower_verifications_platform_check;

ALTER TABLE public.manual_follower_verifications
  ADD CONSTRAINT manual_follower_verifications_platform_check
  CHECK (platform IN ('tiktok', 'instagram', 'youtube'));

CREATE UNIQUE INDEX IF NOT EXISTS manual_follower_verifications_creator_platform_key
  ON public.manual_follower_verifications (creator_id, platform);

DROP TRIGGER IF EXISTS set_updated_at_manual_follower_verifications
  ON public.manual_follower_verifications;

CREATE TRIGGER set_updated_at_manual_follower_verifications
  BEFORE UPDATE ON public.manual_follower_verifications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP POLICY IF EXISTS "Creators can CRUD own manual verifications"
  ON public.manual_follower_verifications;

CREATE POLICY "Creators can read own manual verifications"
  ON public.manual_follower_verifications FOR SELECT
  USING (auth.uid() = creator_id);

CREATE POLICY "Creators can create own manual verifications"
  ON public.manual_follower_verifications FOR INSERT
  WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Creators can update own manual verifications"
  ON public.manual_follower_verifications FOR UPDATE
  USING (auth.uid() = creator_id)
  WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Creators can delete own manual verifications"
  ON public.manual_follower_verifications FOR DELETE
  USING (auth.uid() = creator_id);

INSERT INTO storage.buckets (id, name, public)
VALUES ('creator-verification', 'creator-verification', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "Creators can upload own verification screenshots" ON storage.objects;
CREATE POLICY "Creators can upload own verification screenshots"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'creator-verification'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Creators can read own verification screenshots" ON storage.objects;
CREATE POLICY "Creators can read own verification screenshots"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'creator-verification'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Creators can delete own verification screenshots" ON storage.objects;
CREATE POLICY "Creators can delete own verification screenshots"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'creator-verification'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

ALTER TABLE public.admin_audit_logs
  DROP CONSTRAINT IF EXISTS admin_audit_logs_action_type_check;

ALTER TABLE public.admin_audit_logs
  ADD CONSTRAINT admin_audit_logs_action_type_check
  CHECK (action_type IN (
    'force_release',
    'refund',
    'ban_user',
    'unban_user',
    'suspend_user',
    'unsuspend_user',
    'resolve_dispute',
    'manual_strike',
    'override_rating',
    'approve_follower_verification',
    'reject_follower_verification'
  ));
