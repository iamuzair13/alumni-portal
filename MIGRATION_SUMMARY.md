# Migration Summary: tbl_users → users

## ✅ Completed Migrations

### 1. Schema Updates
- ✅ Updated `schema.sql` to include all columns in `users` table:
  - Added: `firstname`, `lastname`, `department`, `blocked`, `lastlogindatetime`, `password` (for compatibility)
- ✅ Updated foreign key references:
  - `leadership_form_settings.updated_by` → `users(id)`
  - `user_access_assignments.userid` → `users(id)`

### 2. API Routes Migrated
- ✅ `src/app/api/users/route.ts` - GET and PUT routes
- ✅ `src/app/api/users/[userid]/route.ts` - GET, PUT, DELETE routes
- ✅ `src/app/api/users/create/route.ts` - POST route

### 3. Authentication Migrated
- ✅ `src/auth/credentials.ts` - Login authentication
- ✅ `src/lib/auth.ts` - Session callbacks and user lookup

### 4. Helper Files Updated
- ✅ Comments updated in `src/lib/rbac-assignments.ts`
- ✅ Comments updated in `src/lib/rbac.ts`
- ✅ Comments updated in `src/lib/alumniProfile.ts`

## Column Mapping Strategy

All queries use column aliases to maintain compatibility:

```sql
SELECT 
  id as userid,                           -- Map new id to old userid
  COALESCE(password, password_hash) as password,  -- Support both fields
  COALESCE(type, legacy_type) as type,   -- Support both fields
  COALESCE(blocked, NOT is_active) as blocked  -- Map is_active to blocked
FROM public.users
WHERE id = ${id} OR legacy_userid = ${id}  -- Support both ID types
```

## Key Changes

1. **Table Name**: `tbl_users` → `users`
2. **Primary Key**: `userid` (integer) → `id` (bigint)
3. **Password Field**: `password` → `password_hash` (with `password` kept for compatibility)
4. **ID Lookup**: Always check both `id` and `legacy_userid` for backward compatibility

## Migration Scripts

Run these in order:
1. `migrations/010_add_missing_columns_to_users.sql` - Adds missing columns
2. Existing migration scripts (001-009) - RBAC setup

## Testing Required

- [ ] User creation returns correct userid
- [ ] User deletion removes from users table
- [ ] User update works correctly
- [ ] Authentication works with new table
- [ ] Session management works
- [ ] All foreign key constraints work

## Remaining References

The following files still have `tbl_users` in comments/documentation only (not in actual queries):
- `src/lib/rbac-standard.ts` - Comment only
- `src/lib/user-migration-helper.ts` - Helper file (not used yet)

These are safe and don't affect functionality.
