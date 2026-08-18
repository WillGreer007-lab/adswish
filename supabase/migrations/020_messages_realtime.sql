-- ============================================
-- 020: Realtime chat — add messages to the realtime publication.
-- Supabase only streams postgres_changes for tables in the
-- supabase_realtime publication. Without this, the campaign chat UI's
-- .subscribe() never receives anything and falls back to polling.
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
END $$;
