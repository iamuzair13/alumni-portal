# Alumni Data Import Script

This script allows you to import alumni data from Excel files into the PostgreSQL database.

## Prerequisites

1. **Database Connection**: Make sure you have `DATABASE_URL` set in your `.env.local` file
2. **Excel File**: Prepare your Excel file with alumni data

## Installation

Dependencies are already installed. If you need to reinstall:

```bash
npm install
```

## Excel File Format

**Supported Formats**: `.xls` (Excel 97-2003) and `.xlsx` (Excel 2007+)

The script expects an Excel file with columns that can match the following field names (case-insensitive, with variations):

### Required Fields:
- **Email**: Must be one of:
  - `University Email`, `universityemail`, `Email`, `email`, `Personal Email`, `personalemail`, `Alumni Email`, `alumniemail`

### Common Field Mappings:

| Database Field | Excel Column Variations |
|----------------|------------------------|
| **Name** | `Name`, `alumniname`, `Full Name`, `Student Name`, `Alumni Name` |
| **SAP ID** | `SAP ID`, `sapid`, `SAP_ID`, `SAPID` |
| **Registration No** | `Registration No`, `registrationno`, `Registration Number`, `Reg No` |
| **Phone** | `Contact No`, `contactno`, `Phone`, `Mobile`, `Phone Number` |
| **Faculty** | `Faculty`, `facultyname`, `Faculty Name`, `School` |
| **Department** | `Department`, `departmentname`, `Department Name`, `Dept` |
| **Program** | `Program`, `Degree Title`, `degreetitle`, `Degree`, `Program Name`, `Course` |
| **Year of Passing** | `Year of Passing`, `Year of Ending`, `yearofending`, `Passing Year`, `Graduation Year` |
| **Campus** | `Campus`, `campusname`, `Campus Name`, `Location` |

The script will try multiple column name variations automatically.

## Usage

### Basic Usage

```bash
npm run import-alumni <path-to-excel-file>
```

### Advanced Usage

```bash
npm run import-alumni <excel-file-path> [batch-size] [skip-duplicates] [sheet-index]
```

### Parameters:

1. **excel-file-path** (required): Path to your Excel file
   - Example: `./public/database/alumni-data.xlsx`
   - Example: `C:/Users/YourName/Documents/alumni.xlsx`

2. **batch-size** (optional, default: 100): Number of records to process per batch
   - Smaller batches = slower but safer
   - Larger batches = faster but more memory usage
   - Recommended: 100-500 for large imports

3. **skip-duplicates** (optional, default: true): Whether to skip duplicate records
   - `true`: Skip records with existing email or SAP ID
   - `false`: Will fail on duplicates

4. **sheet-index** (optional, default: 0): Which sheet to read (0 = first sheet)

### Examples:

```bash
# Import from default location with default settings
npm run import-alumni ./public/database/alumni-data.xlsx

# Import with batch size of 200
npm run import-alumni ./public/database/alumni-data.xlsx 200

# Import without skipping duplicates
npm run import-alumni ./public/database/alumni-data.xlsx 100 false

# Import from second sheet (index 1)
npm run import-alumni ./public/database/alumni-data.xlsx 100 true 1

# Import 27,000 records efficiently
npm run import-alumni ./public/database/alumni-27000.xlsx 250 true 0
```

## Features

✅ **Batch Processing**: Processes records in batches to avoid memory issues  
✅ **Duplicate Detection**: Automatically skips records with existing email or SAP ID  
✅ **Error Handling**: Continues processing even if some rows fail  
✅ **Progress Tracking**: Shows real-time progress for each batch  
✅ **Flexible Column Mapping**: Tries multiple column name variations  
✅ **Transaction Safety**: Each batch is wrapped in a transaction  
✅ **Detailed Reporting**: Shows summary of successes, failures, and skipped records  

## Output

The script provides:

1. **Progress Updates**: Real-time progress for each batch
2. **Error Messages**: Specific errors for failed rows
3. **Summary Report**: Final statistics including:
   - Total successful imports
   - Total failed imports
   - Total skipped (duplicates)
   - Success rate percentage

## Troubleshooting

### Error: "DATABASE_URL environment variable is not set"

**Solution**: Make sure you have `.env.local` file with:
```
DATABASE_URL=postgresql://username:password@host:port/database
```

### Error: "Email is required"

**Solution**: Make sure your Excel file has a column with email addresses. The script looks for:
- `University Email`
- `Email`
- `Personal Email`
- `Alumni Email`
- Or any variation of these

### Error: "File not found"

**Solution**: Check that the file path is correct. Use absolute path or relative path from project root.

### Too many errors

**Solution**: 
1. Check your Excel file format
2. Verify column names match expected variations
3. Check for missing required fields (email)
4. Review the error messages to see what's failing

### Slow performance

**Solution**: 
- Increase batch size (try 200-500)
- Make sure your database connection is stable
- Check network latency if database is remote

## Safety Features

- **Duplicate Prevention**: Automatically skips records with existing email or SAP ID
- **Transaction Rollback**: If a batch fails, that batch is rolled back
- **No Data Loss**: Failed batches don't affect successful batches
- **Validation**: Validates email format before insertion

## Notes

- The script automatically sets `datasource` to `'Excel Import'` for all imported records
- The script sets `verify` to `'No'` for all imported records (can be updated manually later)
- Empty cells are treated as `NULL` values
- Dates are automatically converted from Excel format to SQL date format

