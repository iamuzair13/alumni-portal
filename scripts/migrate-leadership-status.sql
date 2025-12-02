-- Migration script aligned with schema.sql
-- This enables pending/approved/rejected workflow for leadership applications
-- Note: chapter_leadership already has status, rejection_reason, updated_at, and alumniid in schema
-- This migration is mainly for tblalumniassociation

-- Add status column to tblalumniassociation table (if it doesn't exist)
-- Note: schema shows status as character varying, but we'll use TEXT for consistency
ALTER TABLE public.tblalumniassociation 
ADD COLUMN IF NOT EXISTS status CHARACTER VARYING DEFAULT 'pending';

-- Add alumni_id column to tblalumniassociation for pending applications
-- Note: schema already has alumni_id, but adding IF NOT EXISTS for safety
ALTER TABLE public.tblalumniassociation 
ADD COLUMN IF NOT EXISTS alumni_id INTEGER;

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_chapter_leadership_status 
ON public.chapter_leadership(status);

CREATE INDEX IF NOT EXISTS idx_chapter_leadership_alumniid 
ON public.chapter_leadership(alumniid);

CREATE INDEX IF NOT EXISTS idx_tblalumniassociation_status 
ON public.tblalumniassociation(status);

CREATE INDEX IF NOT EXISTS idx_tblalumniassociation_alumni_id 
ON public.tblalumniassociation(alumni_id);

-- Update existing records to 'approved' status (for backward compatibility)
-- Only update records that are already linked to tbl_alumni
UPDATE public.chapter_leadership cl
SET status = 'approved',
    alumniid = (SELECT alumniid FROM public.tbl_alumni WHERE chapter_leadership = cl.id LIMIT 1),
    updated_at = NOW()
WHERE (cl.status IS NULL OR cl.status = 'pending')
  AND cl.id IN (SELECT chapter_leadership FROM public.tbl_alumni WHERE chapter_leadership IS NOT NULL);

UPDATE public.tblalumniassociation 
SET status = 'approved',
    alumni_id = (SELECT alumniid FROM public.tbl_alumni WHERE association_job = tblalumniassociation.id LIMIT 1)
WHERE (status IS NULL OR status = 'pending')
  AND id IN (SELECT association_job FROM public.tbl_alumni WHERE association_job IS NOT NULL);

