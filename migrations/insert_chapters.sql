-- Insert chapters from AlumniChaptersForm into tblchapters
-- This script inserts national and international chapters

-- First, clear any existing chapters (optional - comment out if you want to keep existing data)
-- DELETE FROM public.tblchapters;

-- Insert National Chapters
INSERT INTO public.tblchapters (national_chapter, international_chapter, chapter_whatsapp)
VALUES
  ('Lahore & Surrounding Chapter', NULL, NULL),
  ('RGujranwala–Gujrat–Sialkot Chapter', NULL, NULL),
  ('Faisalabad Chapter', NULL, NULL),
  ('Sargodha–Khushab Chapter', NULL, NULL),
  ('Multan Chapter', NULL, NULL),
  ('Bahawalpur–Bahawalnagar Chapter', NULL, NULL),
  ('Sahiwal–Pakpattan Chapter', NULL, NULL),
  ('Southern Punjab Chapter', NULL, NULL),
  ('Islamabad–Rawalpindi Chapter', NULL, NULL),
  ('Peshawar & Northern KP Chapter', NULL, NULL),
  ('Kashmir Chapter', NULL, NULL),
  ('Sindh Chapter', NULL, NULL),
  ('Balochistan Chapter', NULL, NULL),
  ('Northern Pakistan Chapter', NULL, NULL);

-- Insert International Chapters
INSERT INTO public.tblchapters (national_chapter, international_chapter, chapter_whatsapp)
VALUES
  (NULL, 'KSA', NULL),
  (NULL, 'Kuwait', NULL),
  (NULL, 'UAE', NULL),
  (NULL, 'UK', NULL),
  (NULL, 'Bahrain', NULL),
  (NULL, 'Canada', NULL),
  (NULL, 'USA', NULL),
  (NULL, 'Qatar', NULL),
  (NULL, 'Germany & Austria', NULL);

-- Verify the inserts
SELECT 
  id,
  national_chapter,
  international_chapter,
  chapter_whatsapp
FROM public.tblchapters
ORDER BY 
  CASE WHEN national_chapter IS NOT NULL THEN 1 ELSE 2 END,
  COALESCE(national_chapter, international_chapter);


