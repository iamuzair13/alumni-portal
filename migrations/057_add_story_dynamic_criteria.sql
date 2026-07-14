-- Dynamic success story criteria configuration and responses
-- Run manually against production/staging before deploying the app changes.

CREATE TABLE IF NOT EXISTS public.story_criteria (
  id BIGSERIAL PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT,
  is_required BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.story_criteria_responses (
  id BIGSERIAL PRIMARY KEY,
  story_id BIGINT NOT NULL REFERENCES public.tblalumnistories(id) ON DELETE CASCADE,
  criterion_id BIGINT NOT NULL REFERENCES public.story_criteria(id) ON DELETE CASCADE,
  response VARCHAR(250) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (story_id, criterion_id)
);

CREATE INDEX IF NOT EXISTS idx_story_criteria_active_sort ON public.story_criteria(is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_story_criteria_responses_story ON public.story_criteria_responses(story_id);

-- Seed default criteria matching the legacy hard-coded questions
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.story_criteria WHERE label = 'What does the story highlight? An innovative approach, exceptional achievement, or inspiring journey.') THEN
    INSERT INTO public.story_criteria (label, description, is_required, is_active, sort_order)
    VALUES ('What does the story highlight? An innovative approach, exceptional achievement, or inspiring journey.', 'Please explain.', true, true, 1);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.story_criteria WHERE label = 'Does your story inspire, motivate, or encourage others to take action? If yes, how?') THEN
    INSERT INTO public.story_criteria (label, description, is_required, is_active, sort_order)
    VALUES ('Does your story inspire, motivate, or encourage others to take action? If yes, how?', '', true, true, 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.story_criteria WHERE label = 'Does your story provide valuable lessons, practical knowledge, or a model that others can replicate?') THEN
    INSERT INTO public.story_criteria (label, description, is_required, is_active, sort_order)
    VALUES ('Does your story provide valuable lessons, practical knowledge, or a model that others can replicate?', 'Yes / No explanation', true, true, 3);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.story_criteria WHERE label = 'Achievements') THEN
    INSERT INTO public.story_criteria (label, description, is_required, is_active, sort_order)
    VALUES ('Achievements', '', true, true, 4);
  END IF;
END $$;
