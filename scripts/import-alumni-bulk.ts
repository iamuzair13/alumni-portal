import XLSX from 'xlsx';
import postgres from 'postgres';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set');
  console.error('Please set DATABASE_URL in your .env.local file');
  process.exit(1);
}

// Create database connection
const sql = postgres(process.env.DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

// Helper function to clean and sanitize values
function clean(value: any): string | null {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  return str === '' ? null : str;
}

// Helper function to clean email
function cleanEmail(value: any): string | null {
  const email = clean(value);
  if (!email) return null;
  return email.toLowerCase();
}

// Helper function to convert date
function cleanDate(value: any): string | null {
  if (!value) return null;
  // Handle Excel date serial numbers
  if (typeof value === 'number') {
    try {
      const excelEpoch = new Date(1899, 11, 30);
      const date = new Date(excelEpoch.getTime() + value * 86400000);
      return date.toISOString().split('T')[0];
    } catch {
      return null;
    }
  }
  // Handle string dates
  if (typeof value === 'string') {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  }
  return clean(value);
}

// Helper function to clean number
function cleanNumber(value: any): number | null {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return isNaN(num) ? null : num;
}

// Helper function to clean boolean
function cleanBoolean(value: any): boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return value;
  const str = String(value).toLowerCase().trim();
  if (str === 'true' || str === '1' || str === 'yes') return true;
  if (str === 'false' || str === '0' || str === 'no') return false;
  return null;
}

// Map Excel columns to database fields - Excel columns match DB schema exactly
function getColumnValue(row: any, columnName: string | string[]): any {
  // If columnName is an array, try each one until we find a match
  if (Array.isArray(columnName)) {
    for (const col of columnName) {
      const value = row[col];
      if (value !== undefined && value !== null && value !== '') {
        return value;
      }
    }
    return null;
  }
  // Direct column access since Excel columns match schema exactly
  const value = row[columnName];
  if (value === undefined || value === null || value === '') {
    return null;
  }
  return value;
}

// Helper function to generate a default email if none is found
function generateDefaultEmail(row: any, rowIndex: number): string {
  const sapid = clean(getColumnValue(row, ['SAP ID', 'sapid', 'SAP_ID', 'SAPID', 'Sap ID']));
  const registrationno = clean(getColumnValue(row, ['Registration No', 'registrationno', 'Registration Number', 'Reg No', 'regno']));
  const name = clean(getColumnValue(row, ['Name', 'alumniname', 'Full Name', 'Student Name']));
  
  // Try to create email from available data
  if (sapid) {
    return `alumni_${sapid}@uol.edu.pk`;
  }
  if (registrationno) {
    return `alumni_${registrationno.replace(/\s+/g, '_')}@uol.edu.pk`;
  }
  if (name) {
    const namePart = name.toLowerCase().replace(/\s+/g, '_').substring(0, 20);
    return `alumni_${namePart}_${rowIndex}@uol.edu.pk`;
  }
  
  // Fallback: use row index
  return `alumni_import_${rowIndex}@uol.edu.pk`;
}

function mapRowToAlumni(row: any, rowIndex: number = 0): {
  alumniemail: string;
  password: string | null;
  todaydate: Date;
  registrationno: string | null;
  sapid: string | null;
  alumniname: string | null;
  gender: string | null;
  fathername: string | null;
  dateofbirth: string | null;
  maritalstatus: string | null;
  cnicpassport: string | null;
  contactno: string | null;
  contactno1: string | null;
  contactno1show: boolean | null;
  personalemail: string | null;
  personalemailshow: boolean | null;
  universityemail: string | null;
  country: string | null;
  province: string | null;
  city: string | null;
  address: string | null;
  academicsession: string | null;
  degreetitle: string | null;
  cgpa: number | null;
  yearofstarting: number | null;
  yearofending: number | null;
  facultyname: string | null;
  campusname: string | null;
  departmentname: string | null;
  majorsubject: string | null;
  industry: string | null;
  employeed: string | null;
  nameoforganization: string | null;
  designation: string | null;
  totalyearsofexpereince: string | null;
  officialemail: string | null;
  officialnumber: string | null;
  image1: string | null;
  cv: string | null;
  aboutme: string | null;
  lasttimelogin: string | null;
  logincount: number | null;
  verify: string | null;
  emailsendcount: number | null;
  emailsendstatus: string | null;
  createddatetime: string | null;
  facebook: string | null;
  instagram: string | null;
  youtube: string | null;
  linkedin: string | null;
  datasource: string | null;
  alumnistatus: string | null;
  degree_title: string | null;
  higher_education_institute_name: string | null;
  higher_education_program: string | null;
  is_scholarship: string | null;
} {
  // Excel columns match database schema exactly - use direct column mapping
  // Handle alumniemail (required field)
  let alumniemail = cleanEmail(getColumnValue(row, 'alumniemail'));
  if (!alumniemail) {
    // Try personalemail or universityemail
    alumniemail = cleanEmail(getColumnValue(row, 'personalemail')) || 
                  cleanEmail(getColumnValue(row, 'universityemail'));
  }
  // Generate default if still no email
  if (!alumniemail) {
    const sapid = clean(getColumnValue(row, 'sapid'));
    const regno = clean(getColumnValue(row, 'registrationno'));
    if (sapid) {
      alumniemail = `alumni_${sapid}@uol.edu.pk`;
    } else if (regno) {
      alumniemail = `alumni_${regno.replace(/\s+/g, '_')}@uol.edu.pk`;
    } else {
      alumniemail = `alumni_import_${rowIndex}@uol.edu.pk`;
    }
  }

  // Handle boolean values (0/1 from Excel need conversion)
  const handleBoolean = (value: any): boolean | null => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'boolean') return value;
    if (value === 0 || value === '0' || value === false || String(value).toLowerCase() === 'false') return false;
    if (value === 1 || value === '1' || value === true || String(value).toLowerCase() === 'true') return true;
    return null;
  };

  // Handle date/timestamp
  const handleDate = (value: any): Date | null => {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value === 'string') {
      const d = new Date(value);
      return isNaN(d.getTime()) ? null : d;
    }
    if (typeof value === 'number') {
      // Excel serial date
      const excelEpoch = new Date(1899, 11, 30);
      return new Date(excelEpoch.getTime() + value * 86400000);
    }
    return null;
  };

  // Map all fields directly from Excel columns (which match DB schema)
  return {
    alumniemail,
    password: clean(getColumnValue(row, 'password')),
    todaydate: handleDate(getColumnValue(row, 'todaydate')) || new Date(),
    registrationno: clean(getColumnValue(row, 'registrationno')),
    sapid: clean(getColumnValue(row, 'sapid')),
    alumniname: clean(getColumnValue(row, 'alumniname')),
    gender: clean(getColumnValue(row, 'gender')),
    fathername: clean(getColumnValue(row, 'fathername')),
    dateofbirth: cleanDate(getColumnValue(row, 'dateofbirth')),
    maritalstatus: clean(getColumnValue(row, 'maritalstatus')),
    cnicpassport: clean(getColumnValue(row, 'cnicpassport')),
    contactno: clean(getColumnValue(row, 'contactno')),
    contactno1: clean(getColumnValue(row, 'contactno1')),
    contactno1show: handleBoolean(getColumnValue(row, 'contactno1show')),
    personalemail: cleanEmail(getColumnValue(row, 'personalemail')),
    personalemailshow: handleBoolean(getColumnValue(row, 'personalemailshow')),
    universityemail: cleanEmail(getColumnValue(row, 'universityemail')),
    country: clean(getColumnValue(row, 'country')),
    province: clean(getColumnValue(row, 'province')),
    city: clean(getColumnValue(row, 'city')),
    address: clean(getColumnValue(row, 'address')),
    academicsession: clean(getColumnValue(row, 'academicsession')),
    degreetitle: clean(getColumnValue(row, 'degreetitle')),
    cgpa: cleanNumber(getColumnValue(row, 'cgpa')),
    yearofstarting: cleanNumber(getColumnValue(row, 'yearofstarting')),
    yearofending: cleanNumber(getColumnValue(row, 'yearofending')),
    facultyname: clean(getColumnValue(row, 'facultyname')),
    campusname: clean(getColumnValue(row, 'campusname')),
    departmentname: clean(getColumnValue(row, 'departmentname')),
    majorsubject: clean(getColumnValue(row, 'majorsubject')),
    industry: clean(getColumnValue(row, 'industry')),
    employeed: clean(getColumnValue(row, 'employeed')) || null,
    nameoforganization: clean(getColumnValue(row, 'nameoforganization')),
    designation: clean(getColumnValue(row, 'designation')),
    totalyearsofexpereince: clean(getColumnValue(row, 'totalyearsofexpereince')),
    officialemail: cleanEmail(getColumnValue(row, 'officialemail')),
    officialnumber: clean(getColumnValue(row, 'officialnumber')),
    image1: clean(getColumnValue(row, 'image1')),
    cv: clean(getColumnValue(row, 'cv')),
    aboutme: clean(getColumnValue(row, 'aboutme')),
    lasttimelogin: clean(getColumnValue(row, 'lasttimelogin')),
    logincount: cleanNumber(getColumnValue(row, 'logincount')),
    verify: clean(getColumnValue(row, 'verify')) || 'No',
    emailsendcount: cleanNumber(getColumnValue(row, 'emailsendcount')),
    emailsendstatus: clean(getColumnValue(row, 'emailsendstatus')),
    createddatetime: clean(getColumnValue(row, 'createddatetime')) || new Date().toISOString(),
    facebook: clean(getColumnValue(row, 'facebook')),
    instagram: clean(getColumnValue(row, 'instagram')),
    youtube: clean(getColumnValue(row, 'youtube')),
    linkedin: clean(getColumnValue(row, 'linkedin')),
    datasource: clean(getColumnValue(row, 'datasource')) || 'Excel Import',
    alumnistatus: clean(getColumnValue(row, 'alumnistatus')),
    degree_title: clean(getColumnValue(row, 'degree_title')),
    higher_education_institute_name: clean(getColumnValue(row, 'higher_education_institute_name')),
    higher_education_program: clean(getColumnValue(row, 'higher_education_program')),
    is_scholarship: clean(getColumnValue(row, 'is_scholarship')),
  };
}

// Batch insert function - overwrites existing records
async function insertBatch(records: any[], batchNumber: number, overwrite: boolean = true): Promise<{ success: number; failed: number; updated: number; errors: string[] }> {
  let success = 0;
  let failed = 0;
  let updated = 0;
  const errors: string[] = [];

  // Use transaction for each batch
  try {
    await sql.begin(async (tx) => {
      for (const record of records) {
        try {
          if (overwrite) {
            // Check if record exists - if yes, update it; if no, insert
            const existing = await tx`
              SELECT alumniid FROM public.tbl_alumni 
              WHERE alumniemail = ${record.alumniemail ?? null} 
                 OR (${record.sapid ?? null} IS NOT NULL AND sapid = ${record.sapid ?? null})
              LIMIT 1
            `;

            if (existing.length > 0) {
              // Update existing record
              await tx`
                UPDATE public.tbl_alumni SET
                  password = ${record.password ?? null},
                  todaydate = ${record.todaydate ?? new Date()},
                  registrationno = ${record.registrationno ?? null},
                  sapid = ${record.sapid ?? null},
                  alumniname = ${record.alumniname ?? null},
                  gender = ${record.gender ?? null},
                  fathername = ${record.fathername ?? null},
                  dateofbirth = ${record.dateofbirth ?? null},
                  maritalstatus = ${record.maritalstatus ?? null},
                  cnicpassport = ${record.cnicpassport ?? null},
                  contactno = ${record.contactno ?? null},
                  contactno1 = ${record.contactno1 ?? null},
                  contactno1show = ${record.contactno1show ?? null},
                  personalemail = ${record.personalemail ?? null},
                  personalemailshow = ${record.personalemailshow ?? null},
                  universityemail = ${record.universityemail ?? null},
                  country = ${record.country ?? null},
                  province = ${record.province ?? null},
                  city = ${record.city ?? null},
                  address = ${record.address ?? null},
                  academicsession = ${record.academicsession ?? null},
                  degreetitle = ${record.degreetitle ?? null},
                  cgpa = ${record.cgpa ?? null},
                  yearofstarting = ${record.yearofstarting ?? null},
                  yearofending = ${record.yearofending ?? null},
                  facultyname = ${record.facultyname ?? null},
                  campusname = ${record.campusname ?? null},
                  departmentname = ${record.departmentname ?? null},
                  majorsubject = ${record.majorsubject ?? null},
                  industry = ${record.industry ?? null},
                  employeed = ${record.employeed ?? null},
                  nameoforganization = ${record.nameoforganization ?? null},
                  designation = ${record.designation ?? null},
                  totalyearsofexpereince = ${record.totalyearsofexpereince ?? null},
                  officialemail = ${record.officialemail ?? null},
                  officialnumber = ${record.officialnumber ?? null},
                  image1 = ${record.image1 ?? null},
                  cv = ${record.cv ?? null},
                  aboutme = ${record.aboutme ?? null},
                  lasttimelogin = ${record.lasttimelogin ?? null},
                  logincount = ${record.logincount ?? null},
                  verify = ${record.verify ?? null},
                  emailsendcount = ${record.emailsendcount ?? null},
                  emailsendstatus = ${record.emailsendstatus ?? null},
                  createddatetime = ${record.createddatetime ?? null},
                  facebook = ${record.facebook ?? null},
                  instagram = ${record.instagram ?? null},
                  youtube = ${record.youtube ?? null},
                  linkedin = ${record.linkedin ?? null},
                  datasource = ${record.datasource ?? null},
                  alumnistatus = ${record.alumnistatus ?? null},
                  degree_title = ${record.degree_title ?? null},
                  higher_education_institute_name = ${record.higher_education_institute_name ?? null},
                  higher_education_program = ${record.higher_education_program ?? null},
                  is_scholarship = ${record.is_scholarship ?? null}
                WHERE alumniemail = ${record.alumniemail ?? null} 
                   OR (${record.sapid ?? null} IS NOT NULL AND sapid = ${record.sapid ?? null})
              `;
              updated++;
              success++;
              continue;
            }
          } else {
            // Skip duplicates if overwrite is false
            const existing = await tx`
              SELECT alumniid FROM public.tbl_alumni 
              WHERE alumniemail = ${record.alumniemail ?? null} 
                 OR (${record.sapid ?? null} IS NOT NULL AND sapid = ${record.sapid ?? null})
              LIMIT 1
            `;

            if (existing.length > 0) {
              continue; // Skip duplicate
            }
          }

          // Insert record - ensure all values are explicitly typed (no undefined)
          await tx`
            INSERT INTO public.tbl_alumni (
              alumniemail, password, todaydate, registrationno, sapid, alumniname,
              gender, fathername, dateofbirth, maritalstatus, cnicpassport,
              contactno, contactno1, contactno1show, personalemail, personalemailshow,
              universityemail, country, province, city, address, academicsession,
              degreetitle, cgpa, yearofstarting, yearofending, facultyname, campusname,
              departmentname, majorsubject, industry, employeed, nameoforganization,
              designation, totalyearsofexpereince, officialemail, officialnumber,
              image1, cv, aboutme, lasttimelogin, logincount, verify, emailsendcount,
              emailsendstatus, createddatetime, facebook, instagram, youtube, linkedin,
              datasource, alumnistatus, degree_title, higher_education_institute_name,
              higher_education_program, is_scholarship
            ) VALUES (
              ${record.alumniemail ?? null}, ${record.password ?? null}, ${record.todaydate ?? new Date()}, ${record.registrationno ?? null},
              ${record.sapid ?? null}, ${record.alumniname ?? null}, ${record.gender ?? null}, ${record.fathername ?? null},
              ${record.dateofbirth ?? null}, ${record.maritalstatus ?? null}, ${record.cnicpassport ?? null},
              ${record.contactno ?? null}, ${record.contactno1 ?? null}, ${record.contactno1show ?? null},
              ${record.personalemail ?? null}, ${record.personalemailshow ?? null}, ${record.universityemail ?? null},
              ${record.country ?? null}, ${record.province ?? null}, ${record.city ?? null}, ${record.address ?? null},
              ${record.academicsession ?? null}, ${record.degreetitle ?? null}, ${record.cgpa ?? null},
              ${record.yearofstarting ?? null}, ${record.yearofending ?? null}, ${record.facultyname ?? null},
              ${record.campusname ?? null}, ${record.departmentname ?? null}, ${record.majorsubject ?? null},
              ${record.industry ?? null}, ${record.employeed ?? null}, ${record.nameoforganization ?? null},
              ${record.designation ?? null}, ${record.totalyearsofexpereince ?? null}, ${record.officialemail ?? null},
              ${record.officialnumber ?? null}, ${record.image1 ?? null},
              ${record.cv ?? null}, ${record.aboutme ?? null}, ${record.lasttimelogin ?? null}, ${record.logincount ?? null},
              ${record.verify ?? null}, ${record.emailsendcount ?? null}, ${record.emailsendstatus ?? null},
              ${record.createddatetime ?? null}, ${record.facebook ?? null}, ${record.instagram ?? null},
              ${record.youtube ?? null}, ${record.linkedin ?? null}, ${record.datasource ?? null}, ${record.alumnistatus ?? null},
              ${record.degree_title ?? null}, ${record.higher_education_institute_name ?? null},
              ${record.higher_education_program ?? null}, ${record.is_scholarship ?? null}
            )
          `;
          success++;
        } catch (error: any) {
          failed++;
          const errorMsg = `Row ${record.alumniemail || record.sapid || 'unknown'}: ${error.message}`;
          errors.push(errorMsg);
        }
      }
    });
  } catch (error: any) {
    console.error(`  ❌ Batch ${batchNumber} transaction failed: ${error.message}`);
    failed += records.length;
  }

  return { success, failed, updated, errors };
}

// Main import function
async function importAlumniFromExcel(filePath: string, batchSize: number = 100, overwrite: boolean = true, sheetIndex: number = 0, truncateTable: boolean = false) {
  console.log('📊 Starting Excel import...');
  console.log(`📁 File: ${filePath}`);
  console.log(`📦 Batch size: ${batchSize}`);
  console.log(`🔄 Overwrite existing records: ${overwrite ? 'Yes' : 'No'}`);
  console.log(`🗑️  Truncate table first: ${truncateTable ? 'Yes' : 'No'}`);
  console.log(`📋 Sheet index: ${sheetIndex}\n`);

  try {
    // Truncate table if requested (delete all existing data)
    if (truncateTable) {
      console.log('🗑️  Truncating table (deleting all existing data)...');
      await sql`TRUNCATE TABLE public.tbl_alumni RESTART IDENTITY CASCADE`;
      console.log('✅ Table truncated successfully\n');
    }
  } catch (error: any) {
    console.error('❌ Failed to truncate table:', error.message);
    throw error;
  }

  try {
    // Check if file exists
    const fs = await import('fs');
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    // Check file extension
    const fileExtension = path.extname(filePath).toLowerCase();
    if (!['.xls', '.xlsx'].includes(fileExtension)) {
      console.warn(`⚠️  Warning: File extension is ${fileExtension}. Expected .xls or .xlsx`);
      console.warn('   The script will attempt to read it anyway...\n');
    }

    // Read Excel file (supports both .xls and .xlsx formats)
    // XLSX library automatically detects the format
    const workbook = XLSX.readFile(filePath, { 
      cellDates: true,
      dateNF: 'yyyy-mm-dd', // Date format
    });
    
    if (workbook.SheetNames.length === 0) {
      throw new Error('Excel file has no sheets');
    }

    const sheetName = workbook.SheetNames[sheetIndex];
    console.log(`📄 Using sheet: "${sheetName}" (${sheetIndex + 1}/${workbook.SheetNames.length})`);
    
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON with header row
    const data = XLSX.utils.sheet_to_json(worksheet, { 
      raw: false, // Convert dates to strings
      defval: null, // Default value for empty cells
    });

    if (data.length === 0) {
      throw new Error('Excel sheet is empty');
    }

    // Log column names for debugging
    if (data.length > 0) {
      console.log('\n📋 Available columns in Excel:');
      const firstRow = data[0] as any;
      const columns = Object.keys(firstRow);
      console.log(`   ${columns.slice(0, 10).join(', ')}${columns.length > 10 ? '...' : ''}`);
      console.log(`   Total columns: ${columns.length}\n`);
    }

    console.log(`📋 Total rows found: ${data.length}`);

    // Process in batches
    const batches: any[][] = [];
    for (let i = 0; i < data.length; i += batchSize) {
      batches.push(data.slice(i, i + batchSize));
    }

    console.log(`🔄 Processing ${batches.length} batches...\n`);

    let totalSuccess = 0;
    let totalFailed = 0;
    let totalUpdated = 0;
    const allErrors: string[] = [];

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const startTime = Date.now();
      console.log(`📦 Processing batch ${i + 1}/${batches.length} (${batch.length} records)...`);

      // Map rows to alumni records
      const alumniRecords: any[] = [];
      const batchErrors: string[] = [];
      
      for (let j = 0; j < batch.length; j++) {
        const row = batch[j];
        const rowIndex = i * batchSize + j + 2; // +2 because Excel rows are 1-indexed and have header
        
        try {
          // Map row to alumni record - no required fields, all optional
          const record = mapRowToAlumni(row, rowIndex);
          alumniRecords.push(record);
        } catch (error: any) {
          // Even if mapping fails, log but don't fail the entire import
          batchErrors.push(`Row ${rowIndex}: ${error.message}`);
          totalFailed++;
          // Continue processing other rows
        }
      }

      // Log mapping errors
      if (batchErrors.length > 0) {
        console.log(`  ⚠️  ${batchErrors.length} rows failed mapping:`);
        batchErrors.slice(0, 5).forEach(err => console.log(`     ${err}`));
        if (batchErrors.length > 5) {
          console.log(`     ... and ${batchErrors.length - 5} more`);
        }
        allErrors.push(...batchErrors);
      }

      // Insert batch
      if (alumniRecords.length > 0) {
        const result = await insertBatch(alumniRecords, i + 1, overwrite);
        totalSuccess += result.success;
        totalFailed += result.failed;
        totalUpdated += result.updated;
        allErrors.push(...result.errors);
        
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
        const inserted = result.success - result.updated;
        console.log(`  ✅ Batch ${i + 1} complete: ${inserted} inserted, ${result.updated} updated, ${result.failed} failed (${elapsed}s)\n`);
      } else {
        console.log(`  ⚠️  Batch ${i + 1} skipped: no valid records\n`);
      }

      // Small delay between batches to avoid overwhelming the database
      if (i < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 IMPORT SUMMARY');
    console.log('='.repeat(60));
    const totalInserted = totalSuccess - totalUpdated;
    console.log(`✅ Total successful: ${totalSuccess}`);
    console.log(`   📝 Inserted: ${totalInserted}`);
    console.log(`   🔄 Updated: ${totalUpdated}`);
    console.log(`❌ Total failed: ${totalFailed}`);
    console.log(`📋 Total processed: ${data.length}`);
    if (data.length > 0) {
      const successRate = ((totalSuccess / data.length) * 100).toFixed(2);
      console.log(`📈 Success rate: ${successRate}%`);
    }

    if (allErrors.length > 0) {
      console.log(`\n⚠️  ${allErrors.length} errors encountered:`);
      const errorSample = allErrors.slice(0, 10);
      errorSample.forEach((err, idx) => {
        console.log(`   ${idx + 1}. ${err}`);
      });
      if (allErrors.length > 10) {
        console.log(`   ... and ${allErrors.length - 10} more errors`);
      }
    }

    return { success: totalSuccess, failed: totalFailed, updated: totalUpdated, total: data.length };

  } catch (error: any) {
    console.error('\n❌ Import failed:', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
    throw error;
  }
}

// Main execution
async function main() {
  const excelFilePath = process.argv[2] || './public/database/tblalumni.xls';
  const batchSize = parseInt(process.argv[3] || '100', 10);
  const overwrite = process.argv[4] !== 'false'; // Default: overwrite existing records
  const truncateTable = process.argv[5] === 'true' || process.argv[5] === 'truncate'; // Truncate table first
  const sheetIndex = parseInt(process.argv[6] || (process.argv[5] && !truncateTable ? process.argv[5] : '0'), 10);

  if (!excelFilePath) {
    console.error('❌ Please provide the Excel file path as an argument');
    console.error('\nUsage: npm run import-alumni <excel-file-path> [batch-size] [overwrite] [truncate] [sheet-index]');
    console.error('\nSupported formats: .xls, .xlsx');
    console.error('\nParameters:');
    console.error('  batch-size: Number of records per batch (default: 100)');
    console.error('  overwrite: Overwrite existing records (default: true)');
    console.error('  truncate: Truncate table before import - deletes ALL existing data (default: false)');
    console.error('  sheet-index: Which sheet to read (default: 0)');
    console.error('\nExamples:');
    console.error('  npm run import-alumni ./public/database/tblalumni.xls');
    console.error('  npm run import-alumni ./public/database/tblalumni.xls 250');
    console.error('  npm run import-alumni ./public/database/tblalumni.xls 250 true');
    console.error('  npm run import-alumni ./public/database/tblalumni.xls 250 true truncate  # Deletes all data first');
    process.exit(1);
  }

  try {
    await importAlumniFromExcel(excelFilePath, batchSize, overwrite, sheetIndex, truncateTable);
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  } finally {
    await sql.end();
    console.log('\n✅ Import process completed!');
  }
}

// Run the import
main();

