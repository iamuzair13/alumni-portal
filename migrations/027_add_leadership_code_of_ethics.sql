ALTER TABLE IF EXISTS public.leadership_roles
  ADD COLUMN IF NOT EXISTS code_of_ethics TEXT;
