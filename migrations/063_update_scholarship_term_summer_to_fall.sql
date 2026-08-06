-- Migration: Update existing scholarship application_term values from 'Summer' to 'Fall'
-- The scholarship application form term dropdown has been changed from Summer/Spring to Fall/Spring.
-- This migration updates any existing records that have 'Summer' as the application_term to 'Fall'
-- so that historical data remains consistent with the new terminology.

BEGIN;

UPDATE public.alumni_scholarships
SET application_term = 'Fall'
WHERE application_term = 'Summer';

COMMIT;
