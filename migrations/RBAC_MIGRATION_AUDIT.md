# RBAC Migration Audit Report

## Executive Summary

This document audits the existing custom RBAC implementation and provides a migration path to a standard RBAC system.

**Current System**: Faculty/Department-based access control tightly coupled to business logic  
**Target System**: Industry-standard RBAC with roles, permissions, and resource scoping

---

## 1. Existing RBAC Components Audit

### 1.1 Database Tables (OLD RBAC)

#### `tbl_users` (Old User Table)
- **Location**: `schema.sql:341-352`
- **Purpose**: Stores staff/admin/viewer users
- **Key Fields**:
  - `userid` (PK)
  - `email` (unique)
  - `type` (enum: 'superadmin', 'admin', 'viewer', 'alumni', 'user')
  - `blocked` (boolean)
- **Usage**: Primary user authentication table
- **Dependencies**: Referenced by `user_access_assignments.userid`

#### `user_access_assignments` (Old Access Table)
- **Location**: `schema.sql:467-496`
- **Purpose**: Stores faculty/department/program access for admin/viewer users
- **Key Fields**:
  - `id` (PK)
  - `userid` (FK → `tbl_users.userid`)
  - `faculty_id`, `department_id`, `program_id` (ID-based, preferred)
  - `faculty_name`, `department_name`, `program_name` (name-based, fallback)
- **Indexes**: 7 indexes on ID and name fields
- **Constraints**: Unique on `(userid, faculty_name, department_name, program_name)`
- **Dependencies**: References `tbl_faculties`, `tbl_departments`, `tbl_programs`

#### `tbl_alumni` (Alumni Users)
- **Location**: `schema.sql:127-231`
- **Purpose**: Stores alumni user data
- **Note**: Alumni are NOT in `tbl_users`, they're separate
- **RBAC Fields**: `faculty`, `department`, `program` (FKs to organizational tables)

### 1.2 Backend Functions (OLD RBAC)

#### Core RBAC Functions
**File**: `src/lib/alumniProfile.ts`
- `isSuperAdminUser(user)` - Checks if user type is 'superadmin'
- `isAdminUser(user)` - Checks if user type is 'admin'
- `isViewerUser(user)` - Checks if user type is 'viewer' or 'user'
- `canModify(user)` - Returns true for admin or superadmin
- `canManageUsers(user)` - Returns true only for superadmin

**File**: `src/lib/userAccess.ts`
- `getUserAccessAssignments(userId)` - **DEPRECATED** - Fetches name-based assignments
- `buildAccessFilterSQL(session)` - Builds SQL WHERE clause for filtering alumni data
- `getUserIdFromSession(session)` - Extracts user ID from session

**File**: `src/lib/rbac.ts`
- `getUserAccessAssignmentsWithIds(userId)` - Fetches ID-based assignments
- `buildIdBasedAccessFilterSQL(session)` - ID-based access filtering
- `hasAllFacultiesAccess(userId)` - Checks if user has all faculties

### 1.3 API Routes Using Old RBAC

#### Direct Access Assignment Queries
- `src/app/api/users/create/route.ts` - Inserts into `user_access_assignments`
- `src/app/api/users/[userid]/route.ts` - Reads/writes `user_access_assignments`
- `src/app/api/users/current/access-assignments/route.ts` - Returns assignments

#### Access Filter Usage (50+ routes)
All routes using `buildAccessFilterSQL()`:
- `src/app/api/alumni/route.ts`
- `src/app/api/alumni/counts/route.ts`
- `src/app/api/alumni/export/route.ts`
- `src/app/api/alumni-cards/counts/route.ts`
- `src/app/api/alumni-cards/applicants/route.ts`
- `src/app/api/alumni/[sapid]/route.ts`
- `src/app/api/alumni/[sapid]/full-details/route.ts`
- `src/app/api/leadership/applications/route.ts`
- And 40+ more routes...

### 1.4 Frontend Components Using Old RBAC

- `src/components/forms/UserForm.tsx` - User creation/editing with access assignments
- `src/components/users/AccessControlPicker.tsx` - UI for selecting faculties/departments/programs
- `src/app/(admin)/(others-pages)/setup/page.tsx` - User management page

### 1.5 Authentication Integration

**File**: `src/lib/auth.ts`
- JWT callback sets `userId` and `type` in session
- Session callback maps to `session.user.userId` and `session.user.type`
- Role checks use `session.user.type` string comparison

---

## 2. New RBAC Schema (Already Exists)

### 2.1 Standard RBAC Tables

The new schema already exists in `schema.sql:621-780`:

1. **`users`** - New user table (replaces `tbl_users` for RBAC)
2. **`roles`** - Role definitions
3. **`permissions`** - Permission definitions (action + resource)
4. **`user_roles`** - User-to-role assignments
5. **`role_permissions`** - Role-to-permission mappings
6. **`resources`** - Hierarchical resource tree (faculties/departments/programs)
7. **`user_resource_access`** - User-to-resource access with levels (read/write/admin)

### 2.2 Schema Gaps Identified

1. **Missing Sequences**: Need to ensure all sequences exist
2. **Missing Indexes**: Need performance indexes
3. **Missing Constraints**: Need validation constraints
4. **Missing Triggers**: Need `updated_at` triggers
5. **Missing Views**: Need helper views for queries

---

## 3. Migration Strategy

### Phase 1: Preparation (Non-Breaking)
- ✅ Audit complete
- Create enhanced new schema
- Add deprecation markers to old code
- Create migration scripts

### Phase 2: Data Migration (Critical)
- Migrate `tbl_users` → `users`
- Create roles from old `type` field
- Migrate `user_access_assignments` → `resources` + `user_resource_access`
- Preserve all existing access

### Phase 3: Backend Refactor
- Create new RBAC utilities
- Replace old checks gradually
- Maintain backward compatibility during transition

### Phase 4: Validation
- Run verification queries
- Test access scenarios
- Ensure no privilege escalation

### Phase 5: Cleanup (Final)
- Drop old tables (after verification)
- Remove deprecated code

---

## 4. Risk Assessment

### High Risk Areas
1. **Data Loss**: Migration must preserve all access assignments
2. **Privilege Escalation**: Missing RBAC data must deny access
3. **Downtime**: Migration should be zero-downtime
4. **Rollback**: Need ability to rollback if issues occur

### Mitigation
- Dual-write during transition
- Comprehensive validation queries
- Gradual rollout with feature flags
- Backup before migration

---

## 5. Files Requiring Changes

### Database
- `schema.sql` - Enhance new RBAC tables
- `migrations/` - Create migration scripts

### Backend Core
- `src/lib/rbac.ts` - New RBAC utilities
- `src/lib/userAccess.ts` - Deprecate, add new functions
- `src/lib/alumniProfile.ts` - Deprecate, add new checks
- `src/lib/auth.ts` - Update session handling

### API Routes (50+ files)
- All routes using `buildAccessFilterSQL()` need updates
- All routes using `isSuperAdminUser()` etc. need updates

### Frontend
- `src/components/forms/UserForm.tsx` - Update to new RBAC
- `src/components/users/AccessControlPicker.tsx` - Update UI

---

## 6. Success Criteria

✅ All users migrated to new `users` table  
✅ All roles created and assigned  
✅ All permissions defined  
✅ All resources created (faculties/departments/programs)  
✅ All access preserved exactly  
✅ No privilege escalation  
✅ No data loss  
✅ Backend uses new RBAC exclusively  
✅ Old tables can be safely dropped  

---

## Next Steps

1. Create enhanced new RBAC schema
2. Create data migration scripts
3. Create new RBAC utility functions
4. Create deprecation wrappers
5. Create validation queries
