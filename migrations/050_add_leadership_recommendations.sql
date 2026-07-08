-- Migration: Add leadership_recommendations table for "Recommend For" workflow
-- This table tracks when an admin recommends an alternative leadership role to an applicant.

CREATE TABLE IF NOT EXISTS public.leadership_recommendations (
  id BIGSERIAL PRIMARY KEY,
  application_id INTEGER NOT NULL,
  application_type TEXT NOT NULL CHECK (application_type IN ('chapter','association')),
  original_role TEXT NOT NULL,
  recommended_role TEXT NOT NULL CHECK (recommended_role IN ('president','vice_president','coordinator')),
  chapter_or_association_name TEXT,
  recommended_by INTEGER REFERENCES public.users(id),
  alumni_response TEXT CHECK (alumni_response IN ('accepted','declined') OR alumni_response IS NULL),
  assigned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leadership_recommendations_app
  ON public.leadership_recommendations(application_type, application_id);

CREATE INDEX IF NOT EXISTS idx_leadership_recommendations_status
  ON public.leadership_recommendations(alumni_response, assigned);
