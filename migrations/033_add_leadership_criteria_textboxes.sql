-- Adds optional textbox responses per leadership criterion

ALTER TABLE IF EXISTS public.leadership_role_criteria
  ADD COLUMN IF NOT EXISTS has_textbox BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS textbox_label TEXT,
  ADD COLUMN IF NOT EXISTS is_textbox_required BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE IF EXISTS public.leadership_criteria_confirmations
  ADD COLUMN IF NOT EXISTS text_response TEXT;

-- Optional: keep textbox label concise
-- (No constraint added to avoid blocking existing data / deployments.)

