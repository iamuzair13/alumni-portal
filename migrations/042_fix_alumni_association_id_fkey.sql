-- association_id must reference tbl_faculties.id (not tbl_associations).
-- Run entire file as table owner (postgres / superuser), with the app paused.
-- Run in ONE session; do not run steps in separate tabs.

BEGIN;

-- 1) Drop existing FK
ALTER TABLE public.tbl_alumni
  DROP CONSTRAINT IF EXISTS tbl_alumni_association_id_fkey;

-- 2) Clear every association_id
UPDATE public.tbl_alumni
SET association_id = NULL
WHERE association_id IS NOT NULL;

-- 3) Pre-flight (both must be 0 before ADD CONSTRAINT)
SELECT COUNT(*) AS non_null_association_id
FROM public.tbl_alumni
WHERE association_id IS NOT NULL;

SELECT COUNT(*) AS orphan_association_id
FROM public.tbl_alumni a
WHERE a.association_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.tbl_faculties f WHERE f.id = a.association_id
  );

-- If either count above is > 0, run ROLLBACK and fix before continuing.

-- 4) Add FK (validates all rows in this transaction)
ALTER TABLE public.tbl_alumni
  ADD CONSTRAINT tbl_alumni_association_id_fkey
  FOREIGN KEY (association_id)
  REFERENCES public.tbl_faculties (id)
  ON DELETE NO ACTION
  ON UPDATE NO ACTION;

COMMIT;

-- 5) After COMMIT succeeds: optional backfill
UPDATE public.tbl_alumni a
SET association_id = a.faculty
WHERE a.association_id IS NULL
  AND a.faculty IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.tbl_faculties f WHERE f.id = a.faculty
  );
