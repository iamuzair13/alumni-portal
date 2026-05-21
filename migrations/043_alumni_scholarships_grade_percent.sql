-- Optional marks percentage entered on scholarship application (Educational Record).
ALTER TABLE public.alumni_scholarships
  ADD COLUMN IF NOT EXISTS grade_percent text COLLATE pg_catalog."default";

COMMENT ON COLUMN public.alumni_scholarships.grade_percent IS
  'Optional Grade(%) entered by applicant on scholarship form; displayed with profile CGPA as CGPA/Grade.';
