-- Backfill tblalumnistories.achievements from story_criteria_responses.
--
-- Background: stories submitted via the dynamic-criteria flow store the
-- "Achievements" value in story_criteria_responses, while the legacy
-- achievements column on tblalumnistories stayed NULL. The list/external
-- APIs only read the column, so they returned null even though the value
-- existed in criteria responses (the detail page masked this via a
-- fallback to criteriaResponses). This one-time backfill copies the
-- matching criteria response into the column so every API returns the
-- value without any code changes.
--
-- Safe to re-run: only touches rows where achievements is NULL or empty.
UPDATE public.tblalumnistories AS s
SET achievements = r.response
FROM public.story_criteria_responses AS r
JOIN public.story_criteria AS c ON c.id = r.criterion_id
WHERE r.story_id = s.id
  AND LOWER(c.label) = 'achievements'
  AND (s.achievements IS NULL OR BTRIM(s.achievements) = '');
