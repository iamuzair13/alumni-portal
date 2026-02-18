-- Leadership role criteria tables

CREATE TABLE IF NOT EXISTS public.leadership_roles (
  id BIGSERIAL PRIMARY KEY,
  leadership_type TEXT NOT NULL CHECK (leadership_type IN ('chapter','association')),
  role_name TEXT NOT NULL CHECK (role_name IN ('president','vice_president','coordinator')),
  role_description TEXT,
  UNIQUE (leadership_type, role_name)
);

CREATE TABLE IF NOT EXISTS public.leadership_role_criteria (
  id BIGSERIAL PRIMARY KEY,
  role_id BIGINT NOT NULL REFERENCES public.leadership_roles(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  description TEXT,
  is_mandatory BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leadership_role_criteria_role_id ON public.leadership_role_criteria(role_id);

CREATE TABLE IF NOT EXISTS public.leadership_criteria_confirmations (
  id BIGSERIAL PRIMARY KEY,
  leadership_type TEXT NOT NULL CHECK (leadership_type IN ('chapter','association')),
  chapter_application_id BIGINT REFERENCES public.chapter_leadership(id) ON DELETE CASCADE,
  association_application_id INTEGER REFERENCES public.tblalumniassociation(id) ON DELETE CASCADE,
  criterion_id BIGINT NOT NULL REFERENCES public.leadership_role_criteria(id) ON DELETE CASCADE,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('alumni','admin')),
  confirmed BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (chapter_application_id, criterion_id, actor_type),
  UNIQUE (association_application_id, criterion_id, actor_type)
);

CREATE INDEX IF NOT EXISTS idx_leadership_criteria_confirmations_chapter_app ON public.leadership_criteria_confirmations(chapter_application_id);
CREATE INDEX IF NOT EXISTS idx_leadership_criteria_confirmations_assoc_app ON public.leadership_criteria_confirmations(association_application_id);

INSERT INTO public.leadership_roles (leadership_type, role_name)
VALUES
  ('chapter','president'),
  ('chapter','vice_president'),
  ('chapter','coordinator'),
  ('association','president'),
  ('association','vice_president'),
  ('association','coordinator')
ON CONFLICT (leadership_type, role_name) DO NOTHING;

ALTER TABLE IF EXISTS public.leadership_roles
  ADD COLUMN IF NOT EXISTS role_description TEXT;

UPDATE public.leadership_roles
SET role_description = CASE
  WHEN leadership_type = 'chapter' AND role_name = 'president' THEN 'Lead the chapter, organize events, coordinate with the Alumni Office, and represent the chapter in official matters.'
  WHEN leadership_type = 'chapter' AND role_name = 'vice_president' THEN 'Support the Chapter President and assist in coordinating chapter events and activities.'
  WHEN leadership_type = 'chapter' AND role_name = 'coordinator' THEN 'Help coordinate logistics, communication, and execution of chapter activities in collaboration with the Alumni Office.'
  WHEN leadership_type = 'association' AND role_name = 'president' THEN 'Lead the association, suggest alumni engagement events, bring alumni together, and coordinate with the university management.'
  WHEN leadership_type = 'association' AND role_name = 'vice_president' THEN 'Support the President and assist in planning and executing events in collaboration with the Alumni Office.'
  WHEN leadership_type = 'association' AND role_name = 'coordinator' THEN 'Support arrangements and coordination for association activities and events, collaborating with the Alumni Office team for smooth execution.'
  ELSE role_description
END
WHERE role_description IS NULL OR role_description = '';
