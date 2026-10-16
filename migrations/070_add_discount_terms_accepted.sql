-- Add flag recording that the applicant accepted the scholarship discount terms
-- (semester applicability / CGPA continuation / no fee adjustment for previous semesters).
-- NULL means the application predates this declaration.
ALTER TABLE alumni_scholarships
ADD COLUMN IF NOT EXISTS discount_terms_accepted boolean;
