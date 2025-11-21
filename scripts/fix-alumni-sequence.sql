-- Fix sequence for tbl_alumni.alumniid to prevent duplicate key errors
-- This resets the sequence to the max(alumniid) + 1 to avoid conflicts

SELECT setval(
  pg_get_serial_sequence('public.tbl_alumni', 'alumniid'),
  COALESCE((SELECT MAX(alumniid) FROM public.tbl_alumni), 0) + 1,
  false
);

