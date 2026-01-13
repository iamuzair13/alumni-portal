# RBAC Migration Guide

## Overview

This guide provides step-by-step instructions for migrating from the old custom RBAC system to the new industry-standard RBAC system.

**Old System**: Faculty/department-based access control (`tbl_users`, `user_access_assignments`)  
**New System**: Standard RBAC with roles, permissions, and resources (`users`, `roles`, `permissions`, `resources`, `user_resource_access`)

---

## Prerequisites

- ✅ PostgreSQL 12+ (works on Supabase and pgAdmin4)
- ✅ Full database backup
- ✅ Access to production database
- ✅ Understanding of current RBAC implementation
- ✅ Testing environment available

---

## Migration Steps

### Phase 1: Preparation (Non-Breaking)

#### Step 1.1: Review Audit Report
Read `migrations/RBAC_MIGRATION_AUDIT.md` to understand:
- Current RBAC components
- Files that will be affected
- Migration strategy

#### Step 1.2: Backup Database
```bash
# Create full backup
pg_dump -h localhost -U postgres -d alumni_portal > backup_before_rbac_migration.sql

# Or in pgAdmin4:
# Right-click database → Backup → Custom → Dump Options: All
```

#### Step 1.3: Test in Development
1. Run migrations on development database
2. Verify all queries pass
3. Test application functionality

---

### Phase 2: Schema Creation (Non-Breaking)

#### Step 2.1: Create New RBAC Schema
Execute in pgAdmin4 Query Tool:

```sql
-- Run migration 001
\i migrations/001_create_standard_rbac_schema.sql
```

**Expected Output:**
- ✅ All 7 RBAC tables created successfully
- No errors

**Verify:**
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('users', 'roles', 'permissions', 'user_roles', 'role_permissions', 'resources', 'user_resource_access')
ORDER BY table_name;
-- Should return 7 rows
```

#### Step 2.2: Seed Initial Data
Execute:

```sql
-- Run migration 002
\i migrations/002_seed_standard_rbac_data.sql
```

**Expected Output:**
- ✅ RBAC Data Seeded: Roles: 4, Permissions: ~20, Resources: (varies)

**Verify:**
```sql
SELECT name FROM public.roles ORDER BY name;
-- Should show: admin, alumni, superadmin, viewer

SELECT COUNT(*) FROM public.permissions;
-- Should show ~20 permissions

SELECT type, COUNT(*) FROM public.resources GROUP BY type;
-- Should show faculties, departments, programs
```

---

### Phase 3: Data Migration (Critical)

#### Step 3.1: Migrate Users and Access
Execute:

```sql
-- Run migration 003
\i migrations/003_migrate_users_to_rbac.sql
```

**Expected Output:**
- Migration verification results showing:
  - Old users vs New users
  - Old assignments vs New assignments
  - Users without roles: 0
  - No orphaned records

**Verify:**
```sql
-- Check user migration
SELECT 
    (SELECT COUNT(*) FROM public.tbl_users WHERE type NOT IN ('alumni', '')) as old_count,
    (SELECT COUNT(*) FROM public.users) as new_count;

-- Check role assignments
SELECT r.name, COUNT(*) as user_count
FROM public.user_roles ur
INNER JOIN public.roles r ON ur.role_id = r.id
GROUP BY r.name;
```

#### Step 3.2: Run Validation Queries
Execute:

```sql
-- Run migration 004
\i migrations/004_validation_queries.sql
```

**Review all results:**
- ✅ All checks should show "PASS"
- ⚠️ Any "FAIL" or "WARNING" needs investigation

**Key Checks:**
1. Users Migration Check: ✅ PASS
2. Access Assignments Comparison: ✅ PASS (80%+ migrated)
3. Resource Migration: ✅ PASS
4. Data Integrity: ✅ PASS (0 orphaned records)

---

### Phase 4: Backend Integration

#### Step 4.1: Update Code to Use New RBAC

**Old Code:**
```typescript
import { isSuperAdminUser } from "@/lib/alumniProfile";
import { buildAccessFilterSQL } from "@/lib/userAccess";

if (isSuperAdminUser(session?.user)) { ... }
const filter = await buildAccessFilterSQL(session);
```

**New Code:**
```typescript
import { 
  getUserIdFromSession, 
  isSuperAdmin, 
  hasPermission,
  buildResourceAccessFilterSQL 
} from "@/lib/rbac-standard";

const userId = await getUserIdFromSession(session);
if (await isSuperAdmin(userId)) { ... }
const filter = await buildResourceAccessFilterSQL(userId);
```

#### Step 4.2: Gradual Migration Strategy

1. **Add new functions** alongside old ones (non-breaking)
2. **Update one route at a time** to use new RBAC
3. **Test each route** thoroughly
4. **Monitor for errors** in production
5. **Complete migration** once all routes updated

#### Step 4.3: Update Session Handling

Update `src/lib/auth.ts` to also populate new user ID:

```typescript
// In jwt callback
if (userFromDb) {
  token.userId = userFromDb.userid; // Old
  token.newUserId = userFromDb.new_id; // New (if mapping exists)
}

// In session callback
session.user.userId = token.userId; // Old (keep for compatibility)
session.user.newUserId = token.newUserId; // New
```

---

### Phase 5: Testing

#### Step 5.1: Functional Tests

Test each role:

**Superadmin:**
- ✅ Can access all data
- ✅ Can manage users
- ✅ Can perform all actions

**Admin:**
- ✅ Can access assigned resources
- ✅ Can modify data
- ❌ Cannot manage users

**Viewer:**
- ✅ Can read assigned resources
- ❌ Cannot modify data
- ❌ Cannot manage users

#### Step 5.2: Access Control Tests

**Test Case 1: Admin in Own Department**
```sql
-- User should see only their department's alumni
SELECT COUNT(*) FROM tbl_alumni a
WHERE /* access filter applied */
-- Should match expected count
```

**Test Case 2: Admin Denied in Other Department**
- Try accessing alumni from unassigned department
- Should return empty or 403

**Test Case 3: Viewer Read-Only**
- Try to update alumni record
- Should fail with 403

#### Step 5.3: Performance Tests

- Compare query performance (old vs new)
- Check index usage
- Monitor slow queries

---

### Phase 6: Production Deployment

#### Step 6.1: Pre-Deployment Checklist

- [ ] All migrations tested in dev
- [ ] All validation queries pass
- [ ] Code updated to use new RBAC
- [ ] Functional tests pass
- [ ] Performance acceptable
- [ ] Rollback plan ready
- [ ] Team notified

#### Step 6.2: Deployment Steps

1. **Maintenance Window** (if possible)
2. **Run migrations** in order (001 → 002 → 003)
3. **Run validation** (004)
4. **Deploy code** with new RBAC
5. **Monitor** for errors
6. **Verify** access control working

#### Step 6.3: Rollback Plan

If issues occur:

1. **Immediate**: Revert code deployment
2. **Database**: Restore from backup
3. **Investigate**: Review logs and errors
4. **Fix**: Address issues before retry

---

### Phase 7: Cleanup (Final - After Verification)

#### Step 7.1: Verification Period

Wait **2-4 weeks** after production deployment to ensure:
- No access control issues
- No performance degradation
- No user complaints
- All features working

#### Step 7.2: Cleanup Old Tables

**Only after full verification:**

```sql
-- Run migration 005 (carefully!)
\i migrations/005_cleanup_old_rbac.sql
```

This will:
1. Rename old tables (reversible)
2. Drop indexes
3. Remove constraints
4. Optionally drop tables

**⚠️ WARNING**: This is destructive. Only run after:
- ✅ 2-4 weeks of stable operation
- ✅ Full backup available
- ✅ Team approval

---

## Troubleshooting

### Issue: Users Not Migrated

**Symptom**: `new_user_count < old_user_count`

**Solution**:
```sql
-- Check for users that failed to migrate
SELECT tu.* 
FROM public.tbl_users tu
LEFT JOIN public.users u ON tu.email = u.email
WHERE u.id IS NULL
  AND LOWER(TRIM(COALESCE(tu.type, ''))) NOT IN ('alumni', '');

-- Manually migrate if needed
```

### Issue: Access Assignments Missing

**Symptom**: Users can't access data they should

**Solution**:
```sql
-- Check user's resource access
SELECT * FROM vw_user_resource_access_detail
WHERE user_email = 'user@example.com';

-- Compare with old assignments
SELECT * FROM public.user_access_assignments_deprecated
WHERE userid = (SELECT userid FROM public.tbl_users WHERE email = 'user@example.com');
```

### Issue: Performance Degradation

**Symptom**: Queries slower after migration

**Solution**:
1. Check index usage: `EXPLAIN ANALYZE` on slow queries
2. Verify indexes exist: Check `migrations/001_create_standard_rbac_schema.sql`
3. Add missing indexes if needed

### Issue: Permission Denied Errors

**Symptom**: Users getting 403 when they should have access

**Solution**:
1. Check user's roles: `SELECT * FROM vw_user_roles_summary WHERE email = 'user@example.com'`
2. Check user's permissions: Use `getUserPermissions()` function
3. Check resource access: Use `getUserResourceAccess()` function
4. Verify role permissions: Check `vw_role_permissions_detail`

---

## Migration Checklist

### Pre-Migration
- [ ] Read audit report
- [ ] Backup database
- [ ] Test in development
- [ ] Review code changes needed

### Migration
- [ ] Run 001_create_standard_rbac_schema.sql
- [ ] Run 002_seed_standard_rbac_data.sql
- [ ] Run 003_migrate_users_to_rbac.sql
- [ ] Run 004_validation_queries.sql
- [ ] Verify all checks pass

### Post-Migration
- [ ] Update backend code
- [ ] Test functionality
- [ ] Deploy to production
- [ ] Monitor for issues
- [ ] Document any issues

### Cleanup (After 2-4 weeks)
- [ ] Verify stable operation
- [ ] Run 005_cleanup_old_rbac.sql
- [ ] Remove deprecated code
- [ ] Update documentation

---

## Support

For issues or questions:
1. Review `migrations/RBAC_MIGRATION_AUDIT.md`
2. Check validation queries output
3. Review application logs
4. Consult database administrator

---

## Appendix: Quick Reference

### New RBAC Functions

```typescript
// Get user ID
const userId = await getUserIdFromSession(session);

// Check role
const isSuper = await isSuperAdmin(userId);
const isAdmin = await isAdmin(userId);
const isViewer = await isViewer(userId);

// Check permission
const canWrite = await hasPermission(userId, 'write', 'alumni');

// Check resource access
const hasAccess = await hasResourceAccess(userId, resourceId, 'write');

// Build filter
const filter = await buildResourceAccessFilterSQL(userId);
```

### Old vs New Mapping

| Old | New |
|-----|-----|
| `tbl_users.type = 'superadmin'` | `hasRole(userId, 'superadmin')` |
| `user_access_assignments` | `user_resource_access` |
| `buildAccessFilterSQL()` | `buildResourceAccessFilterSQL()` |
| `isSuperAdminUser()` | `isSuperAdmin()` |
| `getUserAccessAssignments()` | `getUserResourceAccess()` |

---

**Last Updated**: [Date]  
**Version**: 1.0  
**Status**: Ready for Migration
