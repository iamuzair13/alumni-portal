-- 077_leadership_recommendations_role_check.sql
-- Expand leadership_recommendations.recommended_role CHECK to include the 5
-- leadership positions added in 076. original_role is unconstrained TEXT and
-- needs no change.

ALTER TABLE public.leadership_recommendations
  DROP CONSTRAINT IF EXISTS leadership_recommendations_recommended_role_check;

ALTER TABLE public.leadership_recommendations
  ADD CONSTRAINT leadership_recommendations_recommended_role_check
  CHECK (recommended_role IN (
    'president',
    'vice_president',
    'coordinator',
    'secretary_general',
    'vice_president_regional_affairs',
    'vice_president_administrative_affairs',
    'coordinator_regional_affairs',
    'coordinator_administrative_affairs'
  ));
