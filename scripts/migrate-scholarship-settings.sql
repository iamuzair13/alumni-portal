-- Migration script to add scholarship form settings table
-- This table stores enable/disable flags for the scholarship application form

CREATE TABLE IF NOT EXISTS public.scholarship_form_settings (
  id SERIAL PRIMARY KEY,
  form_type VARCHAR(50) NOT NULL UNIQUE,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL
) TABLESPACE pg_default;

INSERT INTO public.scholarship_form_settings (form_type, is_enabled)
VALUES ('scholarship_application', true)
ON CONFLICT (form_type) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_scholarship_form_settings_type
ON public.scholarship_form_settings(form_type);
