-- Migration script to add leadership form settings table
-- This table stores enable/disable flags for leadership application forms

CREATE TABLE IF NOT EXISTS public.leadership_form_settings (
  id SERIAL PRIMARY KEY,
  form_type VARCHAR(50) NOT NULL UNIQUE, -- 'chapter_leadership' or 'association_leadership'
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_by INTEGER REFERENCES public.tbl_users(userid) ON DELETE SET NULL
) TABLESPACE pg_default;

-- Insert default settings (both enabled by default)
INSERT INTO public.leadership_form_settings (form_type, is_enabled)
VALUES 
  ('chapter_leadership', true),
  ('association_leadership', true)
ON CONFLICT (form_type) DO NOTHING;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_leadership_form_settings_type 
ON public.leadership_form_settings(form_type);

