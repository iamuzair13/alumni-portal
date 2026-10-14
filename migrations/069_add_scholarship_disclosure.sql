-- Add scholarship disclosure declaration text captured at application time.
ALTER TABLE alumni_scholarships
ADD COLUMN IF NOT EXISTS scholarship_disclosure text;

