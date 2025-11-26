-- Migration: Set initial Super Admin
-- This script sets uzair.shafqat@spmo.uol.edu.pk as the first Super Admin
-- Only run this once. If a Super Admin already exists, this will update the existing one.

-- First, check if there's already a Super Admin
-- If there is, update it to admin (to allow this migration to run)
DO $$
DECLARE
  existing_super_admin_id INTEGER;
BEGIN
  -- Find existing Super Admin (if any)
  SELECT userid INTO existing_super_admin_id
  FROM public.tbl_users
  WHERE LOWER(TRIM(type)) = 'superadmin'
  LIMIT 1;

  -- If there's an existing Super Admin that's not the target user, change it to admin
  IF existing_super_admin_id IS NOT NULL THEN
    UPDATE public.tbl_users
    SET type = 'admin'
    WHERE userid = existing_super_admin_id
      AND LOWER(TRIM(email)) != 'uzair.shafqat@spmo.uol.edu.pk';
  END IF;

  -- Set the target user as Super Admin
  UPDATE public.tbl_users
  SET type = 'superadmin'
  WHERE LOWER(TRIM(email)) = 'uzair.shafqat@spmo.uol.edu.pk';

  -- If the user doesn't exist, this will do nothing (no error)
  -- You may need to create the user first if it doesn't exist
END $$;

-- Verify the result
SELECT 
  userid,
  email,
  firstname,
  lastname,
  type,
  blocked
FROM public.tbl_users
WHERE LOWER(TRIM(email)) = 'uzair.shafqat@spmo.uol.edu.pk';

