-- ================================================
-- Migration: Fix alumni_chapter foreign key constraint
-- Purpose: Add ON DELETE CASCADE to allow deletion of alumni records
-- ================================================

-- Drop the existing foreign key constraint
ALTER TABLE public.alumni_chapter
DROP CONSTRAINT IF EXISTS alumni_chapter_id_fkey;

-- Add the foreign key constraint with ON DELETE CASCADE
ALTER TABLE public.alumni_chapter
ADD CONSTRAINT alumni_chapter_id_fkey 
FOREIGN KEY (id) 
REFERENCES public.tbl_alumni(alumniid) 
ON DELETE CASCADE;

-- Verify the constraint was added
-- You can check this in Supabase by running:
-- SELECT conname, confdeltype 
-- FROM pg_constraint 
-- WHERE conname = 'alumni_chapter_id_fkey';
-- confdeltype 'c' means CASCADE

