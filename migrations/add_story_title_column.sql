-- Migration: Add storytitle column to tblalumnistories table
-- This migration adds a title field to store custom story titles
-- Run this migration before deploying the updated code

-- Add the storytitle column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'tblalumnistories' 
        AND column_name = 'storytitle'
    ) THEN
        ALTER TABLE public.tblalumnistories 
        ADD COLUMN storytitle VARCHAR(200) NULL;
        
        -- Add a comment to document the column
        COMMENT ON COLUMN public.tblalumnistories.storytitle IS 'Custom title for the alumni success story. If NULL, the alumni name will be used as fallback.';
    END IF;
END $$;

-- Optional: Create an index for better query performance if needed
-- CREATE INDEX IF NOT EXISTS idx_tblalumnistories_storytitle ON public.tblalumnistories(storytitle);

