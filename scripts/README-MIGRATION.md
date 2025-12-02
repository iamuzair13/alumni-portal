# Alumni Stories Multiple Stories Migration

This migration script allows alumni to submit multiple stories instead of being limited to one story per alumni.

## What This Migration Does

1. Adds an `id` column (auto-incrementing) to `tblalumnistories` table
2. Changes the primary key from `alumniid` to `id`
3. Keeps `alumniid` as a foreign key to `tbl_alumni`
4. Creates indexes for better query performance

## How to Run the Migration

### Option 1: Using psql

```bash
psql -U your_username -d your_database -f scripts/migrate-alumni-stories-multiple.sql
```

### Option 2: Using pgAdmin

1. Open pgAdmin
2. Connect to your database
3. Right-click on your database → Query Tool
4. Open the file `scripts/migrate-alumni-stories-multiple.sql`
5. Execute the script

### Option 3: Using a Database Client

Copy and paste the contents of `scripts/migrate-alumni-stories-multiple.sql` into your database client and execute it.

## Important Notes

- **Backup your database** before running this migration
- The migration is **idempotent** - it can be run multiple times safely
- Existing stories will be preserved
- After migration, each story will have a unique `id` instead of using `alumniid` as the primary key
- Alumni can now submit unlimited stories

## What Changed in the Code

1. **POST endpoint**: Now always inserts new stories (removed `ON CONFLICT`)
2. **GET endpoint**: Returns all stories, using `id` for story identification
3. **GET [id] endpoint**: Uses story `id` instead of `alumniid`
4. **PUT endpoint**: Added to update existing stories by story `id`
5. **DELETE endpoint**: Uses story `id` instead of `alumniid`
6. **Display pages**: Updated to use story `id` for navigation

## Verification

After running the migration, verify it worked by:

```sql
-- Check if id column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'tblalumnistories' AND column_name = 'id';

-- Check primary key
SELECT constraint_name, constraint_type 
FROM information_schema.table_constraints 
WHERE table_name = 'tblalumnistories' AND constraint_type = 'PRIMARY KEY';

-- Test inserting multiple stories for the same alumni
INSERT INTO public.tblalumnistories (alumniid, alumnistories, storytitle, createdat)
VALUES (1, 'Story 1', 'Title 1', NOW());

INSERT INTO public.tblalumnistories (alumniid, alumnistories, storytitle, createdat)
VALUES (1, 'Story 2', 'Title 2', NOW());

-- Should return 2 rows
SELECT id, alumniid, storytitle FROM public.tblalumnistories WHERE alumniid = 1;
```

