-- Per-tier grade type on scholarship discount tiers (Setup → Scholarships).
-- Tiers may now express CGPA (0–4) or Percentage (0–100) ranges.
-- Safe to run multiple times.

ALTER TABLE public.scholarship_cgpa_discount_tiers
    ALTER COLUMN cgpa_min TYPE numeric(5, 2),
    ALTER COLUMN cgpa_max TYPE numeric(5, 2),
    ADD COLUMN IF NOT EXISTS grade_type text NOT NULL DEFAULT 'cgpa';

ALTER TABLE public.scholarship_cgpa_discount_tiers
    DROP CONSTRAINT IF EXISTS scholarship_cgpa_tiers_grade_type_chk;
ALTER TABLE public.scholarship_cgpa_discount_tiers
    ADD CONSTRAINT scholarship_cgpa_tiers_grade_type_chk
    CHECK (grade_type IN ('cgpa', 'percentage'));

ALTER TABLE public.scholarship_cgpa_discount_tiers
    DROP CONSTRAINT IF EXISTS scholarship_cgpa_tiers_bounds_chk;
ALTER TABLE public.scholarship_cgpa_discount_tiers
    ADD CONSTRAINT scholarship_cgpa_tiers_bounds_chk CHECK (
        cgpa_min >= 0 AND cgpa_min <= cgpa_max AND (
            (grade_type = 'cgpa' AND cgpa_max <= 4) OR
            (grade_type = 'percentage' AND cgpa_max <= 100)
        )
    );
