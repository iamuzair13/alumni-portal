-- Repair out-of-sync serial sequence (causes: duplicate key violates unique constraint "tbl_events_pkey")
-- Run once on the database if admin event creation fails with that error.
SELECT setval(
  pg_get_serial_sequence('public.tbl_events', 'id')::regclass,
  COALESCE((SELECT MAX(id) FROM public.tbl_events), 0),
  true
);
