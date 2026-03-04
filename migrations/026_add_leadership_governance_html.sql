ALTER TABLE IF EXISTS public.leadership_roles
  ADD COLUMN IF NOT EXISTS office_term_governance_html TEXT;
