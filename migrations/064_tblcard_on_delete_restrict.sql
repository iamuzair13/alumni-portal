-- Ensure tblcard records are never automatically deleted (e.g. via ON DELETE CASCADE).
-- Cards must only be removed via the manual DELETE API endpoint, which logs the action.
--
-- This migration:
-- 1. Cleans up 24 orphaned cards (alumniid references that no longer exist in tbl_alumni)
-- 2. Adds an explicit FOREIGN KEY with ON DELETE RESTRICT on tblcard.alumniid
--
-- With ON DELETE RESTRICT, if an admin tries to delete an alumni who still has a card,
-- the DB will reject it, forcing the admin to manually delete the card first
-- (which is logged in activity logs).

-- Step 1: Delete orphaned cards (alumni record no longer exists)
DELETE FROM public.tblcard
WHERE alumniid NOT IN (SELECT alumniid FROM public.tbl_alumni);

-- Step 2: Drop any existing FK constraint on tblcard.alumniid (if one exists)
ALTER TABLE public.tblcard
  DROP CONSTRAINT IF EXISTS tblcard_alumniid_fkey;

-- Step 3: Add the FK with ON DELETE RESTRICT — prevents alumni deletion while a card exists
ALTER TABLE public.tblcard
  ADD CONSTRAINT tblcard_alumniid_fkey
  FOREIGN KEY (alumniid) REFERENCES public.tbl_alumni(alumniid)
  ON DELETE RESTRICT;
