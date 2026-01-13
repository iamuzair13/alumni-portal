# Migration: tbl_users → users Table

## Overview
This document tracks the migration from `tbl_users` to the new `users` table in the RBAC system.

## Schema Changes

### Old Table: `tbl_users`
- `userid` (integer, PK)
- `email` (text)
- `password` (text)
- `firstname` (varchar)
- `lastname` (varchar)
- `department` (varchar)
- `type` (varchar) - admin, superadmin, viewer
- `blocked` (boolean)
- `lastlogindatetime` (varchar)

### New Table: `users`
- `id` (bigint, PK) - replaces `userid`
- `email` (text, unique)
- `password_hash` (text) - new name for password
- `password` (text) - kept for compatibility
- `firstname` (varchar) - added via migration
- `lastname` (varchar) - added via migration
- `department` (varchar) - added via migration
- `type` (varchar) - legacy, use `user_roles` for new RBAC
- `blocked` (boolean) - added via migration
- `lastlogindatetime` (varchar) - added via migration
- `is_active` (boolean) - new, maps to `!blocked`
- `created_at` (timestamp)
- `updated_at` (timestamp)
- `legacy_userid` (integer, unique) - links to old `tbl_users.userid`
- `legacy_type` (text)

## Column Mapping

When querying `users` table, use these aliases to match old structure:
```sql
SELECT 
  id as userid,
  COALESCE(password, password_hash) as password,
  COALESCE(type, legacy_type) as type,
  COALESCE(blocked, NOT is_active) as blocked
FROM public.users
```

## Migration Steps

1. ✅ Run `migrations/010_add_missing_columns_to_users.sql` to add missing columns
2. ✅ Update `schema.sql` to reflect full users table structure
3. ✅ Update foreign key references in schema.sql
4. 🔄 Update `src/app/api/users/route.ts` - IN PROGRESS
5. ⏳ Update `src/app/api/users/[userid]/route.ts`
6. ⏳ Update `src/app/api/users/create/route.ts`
7. ⏳ Update `src/auth/credentials.ts`
8. ⏳ Update `src/lib/auth.ts`
9. ⏳ Update all other references

## Files Updated

- ✅ `schema.sql` - Updated users table structure and foreign keys
- ✅ `src/app/api/users/route.ts` - Updated GET and PUT routes
- ⏳ `src/app/api/users/[userid]/route.ts` - Needs update
- ⏳ `src/app/api/users/create/route.ts` - Needs update
- ⏳ `src/auth/credentials.ts` - Needs update
- ⏳ `src/lib/auth.ts` - Needs update

## Important Notes

1. **ID Mapping**: The new `users.id` is `bigint`, old `tbl_users.userid` is `integer`. Use `legacy_userid` to map between them.

2. **Password Field**: Both `password` and `password_hash` exist during migration. Use `COALESCE(password, password_hash)`.

3. **Type Field**: Role is stored in both `type` (legacy) and `user_roles` table (new RBAC). Use `COALESCE(type, legacy_type)` for queries.

4. **Blocked Field**: Maps to `is_active` as `blocked = !is_active`. Use `COALESCE(blocked, NOT is_active)`.

5. **Foreign Keys**: Update all foreign key references from `tbl_users(userid)` to `users(id)`.

## Testing Checklist

- [ ] User creation works
- [ ] User update works
- [ ] User deletion works
- [ ] User listing works
- [ ] Authentication works
- [ ] Session management works
- [ ] Foreign key constraints work
