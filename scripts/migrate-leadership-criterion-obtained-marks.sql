-- Decimal obtained marks (0 .. criterion_score), up to 4 decimal places.
ALTER TABLE public.leadership_criteria_confirmations
  ADD COLUMN IF NOT EXISTS obtained_marks NUMERIC(12, 4);

-- Upgrade from INTEGER if an older migration already ran
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns col
    WHERE col.table_schema = 'public'
      AND col.table_name = 'leadership_criteria_confirmations'
      AND col.column_name = 'obtained_marks'
      AND col.data_type = 'integer'
  ) THEN
    ALTER TABLE public.leadership_criteria_confirmations
      ALTER COLUMN obtained_marks TYPE NUMERIC(12, 4)
      USING obtained_marks::numeric;
  END IF;
END $$;

ALTER TABLE public.leadership_criteria_confirmations
  DROP CONSTRAINT IF EXISTS leadership_criteria_confirmations_obtained_marks_chk;

ALTER TABLE public.leadership_criteria_confirmations
  ADD CONSTRAINT leadership_criteria_confirmations_obtained_marks_chk
  CHECK (obtained_marks IS NULL OR obtained_marks >= 0);
