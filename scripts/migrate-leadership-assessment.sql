-- Migration: add Assessment phase fields to leadership application workflow
-- This enables statuses: pending -> assessed -> approved / rejected

-- Chapter leadership (public.chapter_leadership)
ALTER TABLE public.chapter_leadership
ADD COLUMN IF NOT EXISTS assessment_remarks TEXT,
ADD COLUMN IF NOT EXISTS assessed_by INTEGER,
ADD COLUMN IF NOT EXISTS assessed_at TIMESTAMPTZ;

-- Optional: clear/reuse existing rejection_reason for unapproval remarks (already exists for chapters)

-- Association leadership (public.tblalumniassociation)
ALTER TABLE public.tblalumniassociation
ADD COLUMN IF NOT EXISTS assessment_remarks TEXT,
ADD COLUMN IF NOT EXISTS assessed_by INTEGER,
ADD COLUMN IF NOT EXISTS assessed_at TIMESTAMP WITHOUT TIME ZONE,
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Indexes for faster filtering
CREATE INDEX IF NOT EXISTS idx_chapter_leadership_status_assessed
  ON public.chapter_leadership(status);

CREATE INDEX IF NOT EXISTS idx_tblalumniassociation_status_assessed
  ON public.tblalumniassociation(status);

