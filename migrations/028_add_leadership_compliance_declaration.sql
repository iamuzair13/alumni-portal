ALTER TABLE IF EXISTS public.leadership_roles
  ADD COLUMN IF NOT EXISTS compliance_declaration TEXT;
