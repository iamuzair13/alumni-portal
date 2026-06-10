# Setting Initial Super Admin

This guide explains how to set `uzair.shafqat@spmo.uol.edu.pk` as the initial Super Admin.

## Prerequisites

- The user with email `uzair.shafqat@spmo.uol.edu.pk` must already exist in the `tbl_users` table
- You need your database connection string (DATABASE_URL)

## Option 1: Using npm script (Recommended)

### Method A: Pass DATABASE_URL as argument

```powershell
npm run set-super-admin -- "postgresql://user:password@host:port/database"
```

### Method B: Set environment variable in PowerShell

```powershell
$env:DATABASE_URL="postgresql://user:password@host:port/database"
npm run set-super-admin
```

### Method C: Create .env.local file

1. Create a file named `.env.local` in the project root
2. Add your DATABASE_URL:
   ```
   DATABASE_URL=postgresql://user:password@host:port/database
   ```
3. Run the script:
   ```powershell
   npm run set-super-admin
   ```

## Option 2: Run SQL directly

If you have `psql` installed:

```powershell
psql "postgresql://user:password@host:port/database" -f migrations/set_initial_super_admin.sql
```

Or using a database GUI tool (pgAdmin, DBeaver, etc.):
1. Open the SQL file: `migrations/set_initial_super_admin.sql`
2. Connect to your database
3. Execute the script

## Verification

After running the migration, verify it worked:

```sql
SELECT userid, email, firstname, lastname, type, blocked
FROM public.tbl_users
WHERE LOWER(TRIM(email)) = 'uzair.shafqat@spmo.uol.edu.pk';
```

The `type` column should show `superadmin`.

## Notes

- Only one Super Admin can exist at a time
- If a Super Admin already exists, the script will change it to `admin` before setting the new one
- If the user doesn't exist, the script will warn you and exit

## Emergency Super Admin Password Reset

If a Super Admin is locked out, use the CLI reset tool (updates `public.users` with scrypt hashing):

```powershell
npm run reset-super-admin-password -- "postgresql://user:password@host:port/database"
```

Or with `DATABASE_URL` in `.env.local`:

```powershell
npm run reset-super-admin-password
```

Staff users can also use **Forgot Password** on the sign-in page with their registered admin email for self-service recovery.

