-- Migration script to allow multiple stories per alumni
-- This script adds an id column and changes the primary key

-- Step 1: Add id column as serial (auto-incrementing)
ALTER TABLE public.tblalumnistories 
ADD COLUMN IF NOT EXISTS id SERIAL;

-- Step 2: Drop the existing primary key constraint
ALTER TABLE public.tblalumnistories 
DROP CONSTRAINT IF EXISTS tblalumnistories_pkey;

-- Step 3: Add the new primary key on id
ALTER TABLE public.tblalumnistories 
ADD CONSTRAINT tblalumnistories_pkey PRIMARY KEY (id);

-- Step 4: Add foreign key constraint on alumniid (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'tblalumnistories_alumniid_fkey'
  ) THEN
    ALTER TABLE public.tblalumnistories 
    ADD CONSTRAINT tblalumnistories_alumniid_fkey 
    FOREIGN KEY (alumniid) REFERENCES public.tbl_alumni(alumniid) ON DELETE CASCADE;
  END IF;
END $$;

-- Step 5: Create index on alumniid for faster queries
CREATE INDEX IF NOT EXISTS idx_tblalumnistories_alumniid 
ON public.tblalumnistories(alumniid);

-- Step 6: Create index on createdat for sorting
CREATE INDEX IF NOT EXISTS idx_tblalumnistories_createdat 
ON public.tblalumnistories(createdat DESC);

