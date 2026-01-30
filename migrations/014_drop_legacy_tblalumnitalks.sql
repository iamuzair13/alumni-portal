-- Drop legacy table used by the old Alumni Talks flow.
-- Safe to run after verifying all application code has moved to public.alumni_talk_sessions.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tblalumnitalks'
  ) THEN
    DROP TABLE public.tblalumnitalks;
  END IF;
END $$;
