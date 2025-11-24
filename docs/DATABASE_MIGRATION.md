# Database Migration Guide

## Fix Alumni Chapter Foreign Key Constraint

### Problem
When trying to delete an alumni record from `tbl_alumni`, you may encounter this error:
```
Unable to delete row as it is currently referenced by a foreign key constraint from the table `alumni_chapter`
```

This happens because the `alumni_chapter` table has a foreign key reference to `tbl_alumni` without an `ON DELETE` behavior specified.

### Solution

Run the following SQL in your Supabase SQL Editor:

```sql
-- Drop the existing foreign key constraint
ALTER TABLE public.alumni_chapter
DROP CONSTRAINT IF EXISTS alumni_chapter_id_fkey;

-- Add the foreign key constraint with ON DELETE CASCADE
ALTER TABLE public.alumni_chapter
ADD CONSTRAINT alumni_chapter_id_fkey 
FOREIGN KEY (id) 
REFERENCES public.tbl_alumni(alumniid) 
ON DELETE CASCADE;
```

### What This Does

- **ON DELETE CASCADE**: When an alumni record is deleted from `tbl_alumni`, all related records in `alumni_chapter` will be automatically deleted as well.

### Alternative Options

If you prefer different behavior, you can use:

- **ON DELETE SET NULL**: Sets the foreign key to NULL (requires the column to be nullable)
- **ON DELETE SET DEFAULT**: Sets the foreign key to its default value
- **ON DELETE RESTRICT**: Prevents deletion if related records exist (current behavior)

### Verification

After running the migration, verify the constraint:

```sql
SELECT 
    conname AS constraint_name,
    CASE confdeltype
        WHEN 'c' THEN 'CASCADE'
        WHEN 'n' THEN 'NO ACTION'
        WHEN 'r' THEN 'RESTRICT'
        WHEN 'a' THEN 'NO ACTION'
        WHEN 's' THEN 'SET NULL'
        WHEN 'd' THEN 'SET DEFAULT'
    END AS delete_action
FROM pg_constraint
WHERE conname = 'alumni_chapter_id_fkey';
```

The `delete_action` should show `CASCADE`.

### Notes

- This migration is safe to run on existing data
- It will not delete any existing records
- Future deletions of alumni records will automatically cascade to `alumni_chapter` records

