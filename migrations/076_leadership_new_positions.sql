-- 076_leadership_new_positions.sql
-- Adds 5 new leadership positions to public.leadership_roles for both
-- chapter and association leadership types:
--   secretary_general, vice_president_regional_affairs,
--   vice_president_administrative_affairs, coordinator_regional_affairs,
--   coordinator_administrative_affairs
--
-- 1) Expand the role_name CHECK constraint, 2) seed the 10 new role rows.
-- Role descriptions / governance / criteria are intentionally left NULL/empty;
-- admins configure them per role in Setup > Leadership Criteria.

ALTER TABLE public.leadership_roles
  DROP CONSTRAINT IF EXISTS leadership_roles_role_name_check;

ALTER TABLE public.leadership_roles
  ADD CONSTRAINT leadership_roles_role_name_check
  CHECK (role_name IN (
    'president',
    'vice_president',
    'coordinator',
    'secretary_general',
    'vice_president_regional_affairs',
    'vice_president_administrative_affairs',
    'coordinator_regional_affairs',
    'coordinator_administrative_affairs'
  ));

INSERT INTO public.leadership_roles (leadership_type, role_name)
VALUES
  ('chapter', 'secretary_general'),
  ('chapter', 'vice_president_regional_affairs'),
  ('chapter', 'vice_president_administrative_affairs'),
  ('chapter', 'coordinator_regional_affairs'),
  ('chapter', 'coordinator_administrative_affairs'),
  ('association', 'secretary_general'),
  ('association', 'vice_president_regional_affairs'),
  ('association', 'vice_president_administrative_affairs'),
  ('association', 'coordinator_regional_affairs'),
  ('association', 'coordinator_administrative_affairs')
ON CONFLICT (leadership_type, role_name) DO NOTHING;
