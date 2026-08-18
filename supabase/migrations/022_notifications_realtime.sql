-- ============================================
-- 022: Realtime unread badges — add notifications to the realtime publication.
-- The notification center subscribes to postgres_changes on `notifications`
-- (INSERT filtered by user_id), but the table was never added to the
-- supabase_realtime publication, so the badge only updated on page load.
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;
