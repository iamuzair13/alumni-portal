-- Collapse mistaken /images/images/... segments in tbl_events (safe to re-run).
UPDATE public.tbl_events
SET
  image1 = CASE
    WHEN image1 IS NULL OR btrim(image1) = '' THEN image1
    ELSE replace(replace(btrim(image1), '/images/images/', '/images/'), '/images/images/', '/images/')
  END,
  image2 = CASE
    WHEN image2 IS NULL OR btrim(image2) = '' THEN image2
    ELSE replace(replace(btrim(image2), '/images/images/', '/images/'), '/images/images/', '/images/')
  END,
  image3 = CASE
    WHEN image3 IS NULL OR btrim(image3) = '' THEN image3
    ELSE replace(replace(btrim(image3), '/images/images/', '/images/'), '/images/images/', '/images/')
  END,
  image4 = CASE
    WHEN image4 IS NULL OR btrim(image4) = '' THEN image4
    ELSE replace(replace(btrim(image4), '/images/images/', '/images/'), '/images/images/', '/images/')
  END,
  image5 = CASE
    WHEN image5 IS NULL OR btrim(image5) = '' THEN image5
    ELSE replace(replace(btrim(image5), '/images/images/', '/images/'), '/images/images/', '/images/')
  END
WHERE id IS NOT NULL;
