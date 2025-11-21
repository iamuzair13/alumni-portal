# Import Instructions for .xls File

## Your Excel File

Your alumni data file is located at: `public/database/tblalumni.xls`

This is an **.xls file** (Excel 97-2003 format), which is fully supported by the import script.

## Quick Start

### Option 1: Use the default file location

Simply run:

```bash
npm run import-alumni
```

This will automatically use `./public/database/tblalumni.xls` with default settings (batch size: 100).

### Option 2: Specify the file path explicitly

```bash
npm run import-alumni ./public/database/tblalumni.xls
```

### Option 3: Optimized for 27,000 records

For large imports like 27,000 records, use a larger batch size:

```bash
npm run import-alumni ./public/database/tblalumni.xls 250
```

This processes 250 records per batch, which is faster for large files.

## What the Script Does

1. ✅ Reads `.xls` format automatically (no conversion needed)
2. ✅ Processes records in batches (to avoid memory issues)
3. ✅ Skips duplicate records (based on email or SAP ID)
4. ✅ Shows progress for each batch
5. ✅ Provides detailed error messages for failed rows
6. ✅ Shows a summary at the end with success/failure counts

## Expected Behavior

The script will:
- Display available columns from your Excel file
- Process records in batches
- Show progress: `✅ Batch X complete: Y succeeded, Z failed, W skipped`
- Display a final summary with:
  - Total successful imports
  - Total failed imports
  - Total skipped (duplicates)
  - Success rate percentage

## Troubleshooting

### "Email is required"

Make sure your Excel file has a column with email addresses. The script looks for:
- `Email`, `email`
- `University Email`, `universityemail`
- `Personal Email`, `personalemail`
- `Alumni Email`, `alumniemail`

### Column names don't match

The script tries many variations of column names automatically. If columns still don't match:
1. Check the column names shown in the script output
2. Update the `mapRowToAlumni` function in `scripts/import-alumni-bulk.ts` if needed

### Too many errors

If many records fail:
1. Check a few error messages to see the pattern
2. Verify your Excel file format
3. Make sure required fields (like email) are present

## Next Steps

Once the import completes successfully, you can verify the data in your database:

```sql
SELECT COUNT(*) FROM public.tbl_alumni WHERE datasource = 'Excel Import';
```

This will show how many records were imported by this script.

