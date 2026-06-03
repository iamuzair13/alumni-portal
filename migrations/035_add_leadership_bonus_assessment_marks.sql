ALTER TABLE IF EXISTS public.chapter_leadership
  ADD COLUMN IF NOT EXISTS strategy_assessment_marks NUMERIC(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS achievement_assessment_marks NUMERIC(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bonus_marks NUMERIC(5,2) NOT NULL DEFAULT 0;

ALTER TABLE IF EXISTS public.tblalumniassociation
  ADD COLUMN IF NOT EXISTS strategy_assessment_marks NUMERIC(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS achievement_assessment_marks NUMERIC(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bonus_marks NUMERIC(5,2) NOT NULL DEFAULT 0;

UPDATE public.chapter_leadership
SET
  strategy_assessment_marks = COALESCE(strategy_assessment_marks, 0),
  achievement_assessment_marks = COALESCE(achievement_assessment_marks, 0),
  bonus_marks = COALESCE(strategy_assessment_marks, 0) + COALESCE(achievement_assessment_marks, 0)
WHERE strategy_assessment_marks IS NULL
   OR achievement_assessment_marks IS NULL
   OR bonus_marks IS NULL;

UPDATE public.tblalumniassociation
SET
  strategy_assessment_marks = COALESCE(strategy_assessment_marks, 0),
  achievement_assessment_marks = COALESCE(achievement_assessment_marks, 0),
  bonus_marks = COALESCE(strategy_assessment_marks, 0) + COALESCE(achievement_assessment_marks, 0)
WHERE strategy_assessment_marks IS NULL
   OR achievement_assessment_marks IS NULL
   OR bonus_marks IS NULL;
