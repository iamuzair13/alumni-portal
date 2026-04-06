-- =============================================================================
-- Migrate stored file URLs from legacy upload paths to /images/...
-- =============================================================================
-- Run this in PostgreSQL (psql, pgAdmin, Neon SQL editor, etc.) AFTER you have
-- copied files on disk, e.g.:
--   npm run migrate-copy-uploads-to-images
--
-- This script only updates TEXT/VARCHAR columns; it does not copy files.
-- It is safe to re-run: rows already using /images/ are skipped by the WHERE clause.
--
-- Patterns replaced (in order):
--   /api/uploads/images/  ->  /images/
--   /uploads/leadership/  ->  /images/
-- =============================================================================

BEGIN;

-- Normalize one URL (inline: apply both replacements)
-- Leadership: chapter applications
UPDATE public.chapter_leadership
SET
  cv_file_url = REPLACE(REPLACE(cv_file_url, '/api/uploads/images/', '/images/'), '/uploads/leadership/', '/images/'),
  additional_file1_url = REPLACE(REPLACE(additional_file1_url, '/api/uploads/images/', '/images/'), '/uploads/leadership/', '/images/'),
  additional_file2_url = REPLACE(REPLACE(additional_file2_url, '/api/uploads/images/', '/images/'), '/uploads/leadership/', '/images/')
WHERE
  cv_file_url LIKE '%/api/uploads/images/%' OR cv_file_url LIKE '%/uploads/leadership/%'
  OR additional_file1_url LIKE '%/api/uploads/images/%' OR additional_file1_url LIKE '%/uploads/leadership/%'
  OR additional_file2_url LIKE '%/api/uploads/images/%' OR additional_file2_url LIKE '%/uploads/leadership/%';

-- Leadership: association applications
UPDATE public.tblalumniassociation
SET
  cv_file_url = REPLACE(REPLACE(cv_file_url, '/api/uploads/images/', '/images/'), '/uploads/leadership/', '/images/'),
  additional_file1_url = REPLACE(REPLACE(additional_file1_url, '/api/uploads/images/', '/images/'), '/uploads/leadership/', '/images/'),
  additional_file2_url = REPLACE(REPLACE(additional_file2_url, '/api/uploads/images/', '/images/'), '/uploads/leadership/', '/images/')
WHERE
  cv_file_url LIKE '%/api/uploads/images/%' OR cv_file_url LIKE '%/uploads/leadership/%'
  OR additional_file1_url LIKE '%/api/uploads/images/%' OR additional_file1_url LIKE '%/uploads/leadership/%'
  OR additional_file2_url LIKE '%/api/uploads/images/%' OR additional_file2_url LIKE '%/uploads/leadership/%';

-- Alumni profile photos (usually bare filename; update if a full legacy path was stored)
UPDATE public.tbl_alumni
SET
  image1 = REPLACE(REPLACE(image1, '/api/uploads/images/', '/images/'), '/uploads/leadership/', '/images/'),
  image2 = REPLACE(REPLACE(image2, '/api/uploads/images/', '/images/'), '/uploads/leadership/', '/images/')
WHERE
  image1 LIKE '%/api/uploads/images/%' OR image1 LIKE '%/uploads/leadership/%'
  OR image2 LIKE '%/api/uploads/images/%' OR image2 LIKE '%/uploads/leadership/%';

-- Staff user avatar (usually bare filename)
UPDATE public.users
SET
  user_image = REPLACE(REPLACE(user_image, '/api/uploads/images/', '/images/'), '/uploads/leadership/', '/images/')
WHERE
  user_image LIKE '%/api/uploads/images/%' OR user_image LIKE '%/uploads/leadership/%';

-- Newsletters cover image URL
UPDATE public.newsletters
SET
  image = REPLACE(REPLACE(image, '/api/uploads/images/', '/images/'), '/uploads/leadership/', '/images/')
WHERE
  image LIKE '%/api/uploads/images/%' OR image LIKE '%/uploads/leadership/%';

-- Alumni stories
UPDATE public.tblalumnistories
SET
  story_image = REPLACE(REPLACE(story_image, '/api/uploads/images/', '/images/'), '/uploads/leadership/', '/images/')
WHERE
  story_image LIKE '%/api/uploads/images/%' OR story_image LIKE '%/uploads/leadership/%';

-- Distinguished alumni (image is typically filename only)
UPDATE public.distinguished_alumni
SET
  image = REPLACE(REPLACE(image, '/api/uploads/images/', '/images/'), '/uploads/leadership/', '/images/')
WHERE
  image LIKE '%/api/uploads/images/%' OR image LIKE '%/uploads/leadership/%';

-- Events (image1–image5 are usually filenames; included for completeness)
UPDATE public.tbl_events
SET
  image1 = REPLACE(REPLACE(image1, '/api/uploads/images/', '/images/'), '/uploads/leadership/', '/images/'),
  image2 = REPLACE(REPLACE(image2, '/api/uploads/images/', '/images/'), '/uploads/leadership/', '/images/'),
  image3 = REPLACE(REPLACE(image3, '/api/uploads/images/', '/images/'), '/uploads/leadership/', '/images/'),
  image4 = REPLACE(REPLACE(image4, '/api/uploads/images/', '/images/'), '/uploads/leadership/', '/images/'),
  image5 = REPLACE(REPLACE(image5, '/api/uploads/images/', '/images/'), '/uploads/leadership/', '/images/')
WHERE
  image1 LIKE '%/api/uploads/images/%' OR image1 LIKE '%/uploads/leadership/%'
  OR image2 LIKE '%/api/uploads/images/%' OR image2 LIKE '%/uploads/leadership/%'
  OR image3 LIKE '%/api/uploads/images/%' OR image3 LIKE '%/uploads/leadership/%'
  OR image4 LIKE '%/api/uploads/images/%' OR image4 LIKE '%/uploads/leadership/%'
  OR image5 LIKE '%/api/uploads/images/%' OR image5 LIKE '%/uploads/leadership/%';

COMMIT;

-- If anything looks wrong after review, re-run from a backup or use:
-- ROLLBACK;  -- only if you have not yet executed COMMIT above; remove COMMIT and use ROLLBACK to test in one session.
