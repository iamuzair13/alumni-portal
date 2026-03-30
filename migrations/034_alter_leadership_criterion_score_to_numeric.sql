-- Change leadership criterion_score to support decimals (e.g., 7.2)
ALTER TABLE IF EXISTS public.leadership_role_criteria
  ALTER COLUMN criterion_score TYPE NUMERIC(10,2)
  USING (CASE WHEN criterion_score IS NULL THEN NULL ELSE criterion_score::numeric END);

-- Keep existing constraint semantics (>= 1), now applied to numeric
-- Note: constraint already exists in some environments; this is a no-op if present.
