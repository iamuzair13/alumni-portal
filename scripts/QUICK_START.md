# Quick Start Guide - Import Alumni Data

## Step 1: Prepare Your Excel File

Place your Excel file with 27,000 alumni records in a location accessible from the project.

**Supported formats**: `.xls` (Excel 97-2003) and `.xlsx` (Excel 2007+)

**Recommended location**: `public/database/alumni-data.xls` or `public/database/alumni-data.xlsx`

Make sure your Excel file has:
- A column with **email addresses** (required - can be named: Email, University Email, Personal Email, etc.)
- Headers in the first row
- All alumni data in rows below

## Step 2: Set Database Connection

Make sure your `.env.local` file has:

```env
DATABASE_URL=postgresql://username:password@host:port/database
```

## Step 3: Run the Import

### For 27,000 records, use this command:

```bash
npm run import-alumni ./public/database/alumni-data.xls 250
```

Or if your file is `.xlsx`:

```bash
npm run import-alumni ./public/database/alumni-data.xlsx 250
```

This will:
- Process 250 records per batch (optimized for large imports)
- Skip duplicate records automatically
- Show progress for each batch
- Provide a summary at the end

### If your file is in a different location:

```bash
npm run import-alumni "C:/path/to/your/file.xlsx" 250
```

## Step 4: Monitor Progress

The script will show:
- ✅ Successfully imported records
- ❌ Failed records (with error messages)
- ⏭️ Skipped records (duplicates)
- 📊 Final summary with statistics

## Expected Output

```
📊 Starting Excel import...
📁 File: ./public/database/alumni-data.xls
📦 Batch size: 250
🔄 Skip duplicates: Yes

📋 Total rows found: 27000
🔄 Processing 108 batches...

📦 Processing batch 1/108 (250 records)...
  ✅ Batch 1 complete: 250 succeeded, 0 failed, 0 skipped (2.3s)

...

📊 IMPORT SUMMARY
============================================================
✅ Total successful: 26850
❌ Total failed: 120
⏭️ Total skipped: 30
📋 Total processed: 27000
📈 Success rate: 99.44%

✅ Import process completed!
```

## Troubleshooting

### "File not found"
- Check the file path is correct
- Use absolute path if needed

### "Email is required"
- Make sure your Excel has an email column
- Check the column name matches one of: Email, University Email, Personal Email, etc.

### Many failures
- Check Excel file format
- Review error messages to see what's wrong
- Verify column names match expected variations

## Need Help?

Check `scripts/README.md` for detailed documentation.

