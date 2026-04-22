-- Store event image paths as /images/<filename> (same URL shape as https://portal-alumni.uol.edu.pk/images/...)
-- Migrates bare filenames, /api/uploads/images/..., full portal URLs, and legacy paths to /images/<basename>.

UPDATE public.tbl_events
SET
  image1 = CASE
    WHEN image1 IS NULL OR btrim(image1) = '' THEN image1
    WHEN btrim(image1) ILIKE '/images/%' THEN btrim(image1)
    ELSE '/images/' || regexp_replace(btrim(image1), '^.*[/\\]', '')
  END,
  image2 = CASE
    WHEN image2 IS NULL OR btrim(image2) = '' THEN image2
    WHEN btrim(image2) ILIKE '/images/%' THEN btrim(image2)
    ELSE '/images/' || regexp_replace(btrim(image2), '^.*[/\\]', '')
  END,
  image3 = CASE
    WHEN image3 IS NULL OR btrim(image3) = '' THEN image3
    WHEN btrim(image3) ILIKE '/images/%' THEN btrim(image3)
    ELSE '/images/' || regexp_replace(btrim(image3), '^.*[/\\]', '')
  END,
  image4 = CASE
    WHEN image4 IS NULL OR btrim(image4) = '' THEN image4
    WHEN btrim(image4) ILIKE '/images/%' THEN btrim(image4)
    ELSE '/images/' || regexp_replace(btrim(image4), '^.*[/\\]', '')
  END,
  image5 = CASE
    WHEN image5 IS NULL OR btrim(image5) = '' THEN image5
    WHEN btrim(image5) ILIKE '/images/%' THEN btrim(image5)
    ELSE '/images/' || regexp_replace(btrim(image5), '^.*[/\\]', '')
  END
WHERE id IS NOT NULL;

-- Production (PM2 + nginx) checklist:
-- 1) Files stay on disk under the same directory Next uses (UPLOADS_IMAGES_DIR or <PROJECT_ROOT>/public/images).
--    No file "move" is required unless you previously saved uploads outside that folder.
-- 2) Apply nginx snippet deploy/nginx-event-images-to-nextjs.conf.example so /images/event-* reaches Node
--    (otherwise nginx may try static /images/ and return 404).
-- 3) pm2 reload your process after deploy + migration.
