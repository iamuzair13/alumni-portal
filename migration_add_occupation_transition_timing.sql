-- Add occupation transition timing questionnaire answer to alumni records
ALTER TABLE IF EXISTS public.tbl_alumni
  ADD COLUMN IF NOT EXISTS occupation_transition_timing TEXT;

