-- Performance optimization indexes for tbl_alumni table
-- These indexes will significantly speed up queries used in the alumni dashboard

-- Index on sapid (used for filtering and lookups)
CREATE INDEX IF NOT EXISTS idx_tbl_alumni_sapid ON public.tbl_alumni(sapid) WHERE sapid IS NOT NULL AND sapid != '';

-- Index on alumniid DESC (optimizes ORDER BY alumniid DESC)
CREATE INDEX IF NOT EXISTS idx_tbl_alumni_alumniid_desc ON public.tbl_alumni(alumniid DESC);

-- Index on verify status (used for filtering verified/unverified/under approval)
CREATE INDEX IF NOT EXISTS idx_tbl_alumni_verify ON public.tbl_alumni(verify) WHERE verify IS NOT NULL;

-- Index on lasttimelogin and logincount (used for active/inactive filtering)
CREATE INDEX IF NOT EXISTS idx_tbl_alumni_login ON public.tbl_alumni(lasttimelogin, logincount) 
  WHERE lasttimelogin IS NOT NULL OR logincount IS NOT NULL;

-- Composite index for common filter combinations
CREATE INDEX IF NOT EXISTS idx_tbl_alumni_verify_login ON public.tbl_alumni(verify, lasttimelogin, logincount);

-- Index on personalemail and officialemail (used for search)
CREATE INDEX IF NOT EXISTS idx_tbl_alumni_emails ON public.tbl_alumni(personalemail, officialemail) 
  WHERE personalemail IS NOT NULL OR officialemail IS NOT NULL;

-- Index on alumniname (used for search)
CREATE INDEX IF NOT EXISTS idx_tbl_alumni_name ON public.tbl_alumni(alumniname) 
  WHERE alumniname IS NOT NULL;

