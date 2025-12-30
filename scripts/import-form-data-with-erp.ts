import postgres from 'postgres';
import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set');
  console.error('Please set DATABASE_URL in your .env.local file');
  process.exit(1);
}

if (!process.env.ERP_API_URL || !process.env.ERP_USERNAME || !process.env.ERP_PASSWORD) {
  console.error('❌ ERP configuration is missing');
  console.error('Please set ERP_API_URL, ERP_USERNAME, and ERP_PASSWORD in your .env.local file');
  process.exit(1);
}

// Create database connection
const sql = postgres(process.env.DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

// ERP API Client implementation
type ErpConfig = {
  apiUrl: string;
  username: string;
  password: string;
  timeout?: number;
};

type ErpApiResponse<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
};

class ErpApiClient {
  private config: ErpConfig;
  private authToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor() {
    this.config = {
      apiUrl: process.env.ERP_API_URL || '',
      username: process.env.ERP_USERNAME || '',
      password: process.env.ERP_PASSWORD || '',
      timeout: parseInt(process.env.ERP_API_TIMEOUT || '30000', 10),
    };
  }

  private async authenticate(): Promise<string> {
    if (this.authToken && Date.now() < this.tokenExpiry) {
      return this.authToken;
    }

    const credentials = Buffer.from(`${this.config.username}:${this.config.password}`).toString('base64');
    this.authToken = credentials;
    this.tokenExpiry = Date.now() + 3600000; // 1 hour
    return this.authToken;
  }

  private async request<T = unknown>(endpoint: string): Promise<ErpApiResponse<T>> {
    try {
      const token = await this.authenticate();
      const baseUrl = this.config.apiUrl.trim();
      const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
      
      let url: string;
      if (endpoint.startsWith('http')) {
        url = endpoint;
      } else if (endpoint.startsWith("studentSet(")) {
        url = `${normalizedBaseUrl}${endpoint}`;
      } else if (endpoint.startsWith("/")) {
        url = `${normalizedBaseUrl}${endpoint.slice(1)}`;
      } else {
        url = `${normalizedBaseUrl}${endpoint}`;
      }

      const response = await fetch(url, {
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json, application/xml, text/xml, application/atom+xml",
          "Authorization": `Basic ${token}`,
        },
        signal: AbortSignal.timeout(this.config.timeout || 30000),
      });

      if (!response.ok) {
        if (response.status === 404) {
          return {
            success: false,
            error: "NOT_FOUND",
            message: "No record found in ERP system",
          };
        }
        
        const errorText = await response.text().catch(() => "");
        const lowerErrorText = errorText.toLowerCase();
        if (lowerErrorText.includes("not found") || 
            lowerErrorText.includes("does not exist") || 
            lowerErrorText.includes("no record")) {
          return {
            success: false,
            error: "NOT_FOUND",
            message: "No record found in ERP system",
          };
        }
        
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
          message: errorText,
        };
      }

      const responseText = await response.text();
      let resultData: T;

      try {
        resultData = JSON.parse(responseText) as T;
        
        if (resultData && typeof resultData === 'object' && 'd' in resultData) {
          resultData = (resultData as any).d as T;
        }
      } catch {
        resultData = responseText as T;
      }

      return {
        success: true,
        data: resultData,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async fetchBySapId(sapId: string): Promise<ErpApiResponse> {
    return this.request(`studentSet('${sapId.trim()}')`);
  }

  async fetchByRegistrationNo(registrationNo: string): Promise<ErpApiResponse> {
    return this.request(`studentSet('${registrationNo.trim()}')`);
  }
}

// Initialize ERP client
const erpClient = new ErpApiClient();

// Type for ERP response data
type ErpStudentData = {
  SapNo?: string;
  Cnic?: string;
  Address?: string;
  Name?: string;
  Fname?: string; // Father name
  Mobile?: string;
  DegrTitle?: string;
  DeptName?: string;
  Doc?: string;
  Mrno?: string;
  Nationality?: string;
  Regligion?: string;
  [key: string]: unknown;
};

// Type for CSV row data
type CSVRow = {
  timestamp: string | null;
  sapIdOrRegNo: string;
  fullName: string | null;
  cnic: string | null;
  contactNo: string | null;
  activeEmail: string | null;
  homeCity: string | null;
  homeCountry: string | null;
  employmentStatus: string | null;
  organizationName: string | null;
  designation: string | null;
  sector: string | null;
  workCountry: string | null;
  workCity: string | null;
  instituteName: string | null;
  programName: string | null;
  funding: string | null;
  universityCity: string | null;
  universityCountry: string | null;
  rowNumber: number;
};

/**
 * Clean and validate a value
 */
function clean(value: any): string | null {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  return str === '' ? null : str;
}

/**
 * Clean email
 */
function cleanEmail(value: any): string | null {
  const email = clean(value);
  if (!email) return null;
  return email.toLowerCase();
}

/**
 * Determine if identifier is SAP ID or Registration Number
 */
function isSapId(identifier: string): boolean {
  return /^\d/.test(identifier.trim());
}

/**
 * Parse CSV file and extract data
 */
function parseCSV(filePath: string): CSVRow[] {
  try {
    // Resolve file path
    let resolvedPath = filePath;
    if (!path.isAbsolute(filePath)) {
      if (fs.existsSync(filePath)) {
        resolvedPath = path.resolve(filePath);
      } else if (fs.existsSync(path.join(process.cwd(), filePath))) {
        resolvedPath = path.resolve(process.cwd(), filePath);
      } else if (fs.existsSync(path.join(process.cwd(), 'scripts', filePath))) {
        resolvedPath = path.resolve(process.cwd(), 'scripts', filePath);
      } else {
        throw new Error(`File not found: ${filePath}`);
      }
    }

    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`File not found: ${resolvedPath}`);
    }

    const fileContent = fs.readFileSync(resolvedPath, 'utf-8');
    const lines = fileContent.split('\n');

    if (lines.length < 3) {
      throw new Error('CSV file must have at least a header and one data row');
    }

    const rows: CSVRow[] = [];

    // Skip first 2 lines (header spans 2 lines due to newline in "Full Name")
    for (let i = 2; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line === '') continue; // Skip empty lines
      
      const values = parseCSVLine(line);
      
      const sapIdOrRegNo = clean(values[1]); // Column 1: SAP ID/ Registration no.
      if (!sapIdOrRegNo) continue; // Skip rows without SAP ID/Registration number

      // Handle cases where there might be multiple values separated by "/"
      const identifiers = sapIdOrRegNo
        .split(/[/,]/)
        .map(p => p.trim())
        .filter(p => p !== '' && p !== 'null' && p !== 'undefined');

      // Process each identifier (use first one if multiple)
      const identifier = identifiers[0];

      rows.push({
        timestamp: clean(values[0]), // Column 0: Timestamp
        sapIdOrRegNo: identifier,
        fullName: clean(values[2]), // Column 2: Full Name
        cnic: clean(values[3]), // Column 3: CNIC
        contactNo: clean(values[4]), // Column 4: Contact no.
        activeEmail: cleanEmail(values[5]), // Column 5: Active email
        homeCity: clean(values[6]), // Column 6: Home City
        homeCountry: clean(values[7]), // Column 7: Home Country
        employmentStatus: clean(values[8]), // Column 8: Employment Status
        organizationName: clean(values[9]), // Column 9: Organization Name
        designation: clean(values[10]), // Column 10: Designation
        sector: clean(values[11]), // Column 11: Sector
        workCountry: clean(values[12]), // Column 12: Work Country
        workCity: clean(values[13]), // Column 13: Work City
        instituteName: clean(values[14]), // Column 14: Institute Name
        programName: clean(values[15]), // Column 15: Program Name
        funding: clean(values[16]), // Column 16: Funding
        universityCity: clean(values[17]), // Column 17: University City
        universityCountry: clean(values[18]), // Column 18: University Country
        rowNumber: i + 1,
      });
    }

    return rows;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to parse CSV file: ${String(error)}`);
  }
}

/**
 * Parse a CSV line handling quoted values and commas
 */
function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current);
  return values;
}

/**
 * Fetch ERP data for a given SAP ID or Registration Number
 */
async function fetchErpData(identifier: string): Promise<ErpStudentData | null> {
  try {
    const isSap = isSapId(identifier);
    let response;
    
    if (isSap) {
      response = await erpClient.fetchBySapId(identifier);
    } else {
      response = await erpClient.fetchByRegistrationNo(identifier);
    }

    if (!response.success || !response.data) {
      return null;
    }

    let erpData = response.data as any;
    if (erpData && typeof erpData === 'object' && 'd' in erpData) {
      erpData = erpData.d;
    }

    return erpData as ErpStudentData;
  } catch (error) {
    console.error(`  ❌ Error fetching ERP data:`, error instanceof Error ? error.message : String(error));
    return null;
  }
}

/**
 * Check if alumni record exists
 */
async function findAlumniRecord(identifier: string, isSapId: boolean): Promise<number | null> {
  try {
    let result;
    if (isSapId) {
      result = await sql`
        SELECT alumniid FROM public.tbl_alumni
        WHERE sapid = ${identifier}
        LIMIT 1
      `;
    } else {
      result = await sql`
        SELECT alumniid FROM public.tbl_alumni
        WHERE registrationno = ${identifier}
        LIMIT 1
      `;
    }

    return result.length > 0 ? result[0].alumniid : null;
  } catch (error) {
    console.error(`  ❌ Error finding alumni record:`, error instanceof Error ? error.message : String(error));
    return null;
  }
}

/**
 * Map CSV row and ERP data to database record
 */
function mapToAlumniRecord(csvRow: CSVRow, erpData: ErpStudentData | null): any {
  const isSap = isSapId(csvRow.sapIdOrRegNo);
  
  // Generate email if not provided
  let alumniemail = csvRow.activeEmail;
  if (!alumniemail) {
    if (isSap) {
      alumniemail = `alumni_${csvRow.sapIdOrRegNo}@uol.edu.pk`;
    } else {
      alumniemail = `alumni_${csvRow.sapIdOrRegNo.replace(/\s+/g, '_')}@uol.edu.pk`;
    }
  }

  // Parse timestamp
  let todaydate: Date | null = null;
  if (csvRow.timestamp) {
    try {
      todaydate = new Date(csvRow.timestamp);
      if (isNaN(todaydate.getTime())) {
        todaydate = new Date();
      }
    } catch {
      todaydate = new Date();
    }
  } else {
    todaydate = new Date();
  }

  // Map employment status
  let employeed: string | null = null;
  if (csvRow.employmentStatus) {
    const status = csvRow.employmentStatus.toLowerCase();
    if (status.includes('employed')) {
      employeed = 'Yes';
    } else if (status.includes('unemployed')) {
      employeed = 'No';
    } else if (status.includes('self')) {
      employeed = 'Self';
    } else {
      employeed = csvRow.employmentStatus;
    }
  }

  // Map funding to is_scholarship
  let is_scholarship: string | null = null;
  if (csvRow.funding) {
    const funding = csvRow.funding.toLowerCase();
    if (funding.includes('scholarship')) {
      is_scholarship = 'Yes';
    } else if (funding.includes('self')) {
      is_scholarship = 'No';
    } else {
      is_scholarship = csvRow.funding;
    }
  }

  return {
    alumniemail: alumniemail.toLowerCase(),
    password: null,
    todaydate: todaydate,
    registrationno: isSap ? null : csvRow.sapIdOrRegNo,
    sapid: isSap ? csvRow.sapIdOrRegNo : null,
    alumniname: csvRow.fullName,
    gender: null,
    fathername: erpData?.Fname || null, // From ERP
    dateofbirth: null,
    maritalstatus: null,
    cnicpassport: csvRow.cnic,
    contactno: csvRow.contactNo,
    contactno1: null,
    contactno1show: null,
    personalemail: csvRow.activeEmail,
    personalemailshow: null,
    universityemail: null,
    country: csvRow.homeCountry,
    province: null,
    city: csvRow.homeCity,
    address: null,
    academicsession: null,
    degreetitle: erpData?.DegrTitle || null, // From ERP
    cgpa: null,
    yearofstarting: null,
    yearofending: null,
    facultyname: null,
    campusname: null,
    departmentname: erpData?.DeptName || null, // From ERP
    majorsubject: null,
    industry: csvRow.sector,
    employeed: employeed,
    nameoforganization: csvRow.organizationName,
    designation: csvRow.designation,
    totalyearsofexpereince: null,
    officialemail: null,
    officialnumber: null,
    work_city: csvRow.workCity,
    supervisordesignation: null,
    work_country: csvRow.workCountry,
    supervisornumber: null,
    image1: null,
    cv: null,
    aboutme: null,
    lasttimelogin: null,
    logincount: null,
    verify: 'No',
    emailsendcount: null,
    emailsendstatus: null,
    createddatetime: todaydate?.toISOString() || new Date().toISOString(),
    facebook: null,
    instagram: null,
    youtube: null,
    linkedin: null,
    datasource: 'Form Import',
    alumnistatus: null,
    higher_education_institute_name: csvRow.instituteName,
    degree_title: csvRow.programName, // Program Name from form
    is_scholarship: is_scholarship,
    higher_education_program: csvRow.programName,
    father_cnic: null,
    image2: null,
    association_id: null,
    association_job: null,
    chapter_leadership: null,
    organization_address: null,
    higher_education_intiture_number: null,
    higher_education_institute_email: null,
    higher_education_institute_country: csvRow.universityCountry,
    higher_education_institute_province: null,
    higher_education_institute_city: csvRow.universityCity,
    about: null,
    reason_of_unemployment: null,
    category: null,
    faculty: null,
    department: null,
    program: null,
  };
}

/**
 * Insert or update alumni record
 */
async function upsertAlumniRecord(record: any, alumniid: number | null): Promise<{ success: boolean; updated: boolean }> {
  try {
    if (alumniid) {
      // Update existing record
      await sql`
        UPDATE public.tbl_alumni SET
          alumniemail = ${record.alumniemail},
          todaydate = ${record.todaydate},
          registrationno = ${record.registrationno},
          sapid = ${record.sapid},
          alumniname = ${record.alumniname},
          fathername = ${record.fathername},
          cnicpassport = ${record.cnicpassport},
          contactno = ${record.contactno},
          personalemail = ${record.personalemail},
          country = ${record.country},
          city = ${record.city},
          degreetitle = ${record.degreetitle},
          departmentname = ${record.departmentname},
          industry = ${record.industry},
          employeed = ${record.employeed},
          nameoforganization = ${record.nameoforganization},
          designation = ${record.designation},
          work_city = ${record.work_city},
          work_country = ${record.work_country},
          datasource = ${record.datasource},
          higher_education_institute_name = ${record.higher_education_institute_name},
          degree_title = ${record.degree_title},
          is_scholarship = ${record.is_scholarship},
          higher_education_program = ${record.higher_education_program},
          higher_education_institute_country = ${record.higher_education_institute_country},
          higher_education_institute_city = ${record.higher_education_institute_city},
          createddatetime = ${record.createddatetime}
        WHERE alumniid = ${alumniid}
      `;
      return { success: true, updated: true };
    } else {
      // Insert new record
      await sql`
        INSERT INTO public.tbl_alumni (
          alumniemail, password, todaydate, registrationno, sapid, alumniname,
          gender, fathername, dateofbirth, maritalstatus, cnicpassport,
          contactno, contactno1, contactno1show, personalemail, personalemailshow,
          universityemail, country, province, city, address, academicsession,
          degreetitle, cgpa, yearofstarting, yearofending, facultyname, campusname,
          departmentname, majorsubject, industry, employeed, nameoforganization,
          designation, totalyearsofexpereince, officialemail, officialnumber,
          work_city, supervisordesignation, work_country, supervisornumber,
          image1, cv, aboutme, lasttimelogin, logincount, verify, emailsendcount,
          emailsendstatus, createddatetime, facebook, instagram, youtube, linkedin,
          datasource, alumnistatus, higher_education_institute_name, degree_title,
          is_scholarship, higher_education_program, father_cnic, image2,
          association_id, association_job, chapter_leadership, organization_address,
          higher_education_intiture_number, higher_education_institute_email,
          higher_education_institute_country, higher_education_institute_province,
          higher_education_institute_city, about, reason_of_unemployment, category,
          faculty, department, program
        ) VALUES (
          ${record.alumniemail}, ${record.password}, ${record.todaydate}, ${record.registrationno},
          ${record.sapid}, ${record.alumniname}, ${record.gender}, ${record.fathername},
          ${record.dateofbirth}, ${record.maritalstatus}, ${record.cnicpassport},
          ${record.contactno}, ${record.contactno1}, ${record.contactno1show},
          ${record.personalemail}, ${record.personalemailshow}, ${record.universityemail},
          ${record.country}, ${record.province}, ${record.city}, ${record.address},
          ${record.academicsession}, ${record.degreetitle}, ${record.cgpa},
          ${record.yearofstarting}, ${record.yearofending}, ${record.facultyname},
          ${record.campusname}, ${record.departmentname}, ${record.majorsubject},
          ${record.industry}, ${record.employeed}, ${record.nameoforganization},
          ${record.designation}, ${record.totalyearsofexpereince}, ${record.officialemail},
          ${record.officialnumber}, ${record.work_city}, ${record.supervisordesignation},
          ${record.work_country}, ${record.supervisornumber}, ${record.image1},
          ${record.cv}, ${record.aboutme}, ${record.lasttimelogin}, ${record.logincount},
          ${record.verify}, ${record.emailsendcount}, ${record.emailsendstatus},
          ${record.createddatetime}, ${record.facebook}, ${record.instagram},
          ${record.youtube}, ${record.linkedin}, ${record.datasource}, ${record.alumnistatus},
          ${record.higher_education_institute_name}, ${record.degree_title},
          ${record.is_scholarship}, ${record.higher_education_program}, ${record.father_cnic},
          ${record.image2}, ${record.association_id}, ${record.association_job},
          ${record.chapter_leadership}, ${record.organization_address},
          ${record.higher_education_intiture_number}, ${record.higher_education_institute_email},
          ${record.higher_education_institute_country}, ${record.higher_education_institute_province},
          ${record.higher_education_institute_city}, ${record.about},
          ${record.reason_of_unemployment}, ${record.category}, ${record.faculty},
          ${record.department}, ${record.program}
        )
      `;
      return { success: true, updated: false };
    }
  } catch (error) {
    console.error(`  ❌ Error upserting record:`, error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * Main function
 */
async function main() {
  const csvFilePath = process.argv[2];

  if (!csvFilePath) {
    console.error('❌ Please provide the CSV file path as an argument');
    console.error('\nUsage: npm run import-form-data-with-erp <csv-file-path>');
    console.error('\nExample:');
    console.error('  npm run import-form-data-with-erp "scripts/UOL Alumni Portal Registration Form (Responses) - Form Responses 1.csv"');
    process.exit(1);
  }

  try {
    console.log('🚀 Starting form data import with ERP enrichment...');
    console.log(`📁 CSV file: ${csvFilePath}\n`);

    // Parse CSV
    console.log('📋 Parsing CSV file...');
    const csvRows = parseCSV(csvFilePath);
    console.log(`✅ Found ${csvRows.length} records\n`);

    if (csvRows.length === 0) {
      console.log('⚠️  No records to process');
      return;
    }

    // Process each row
    let processed = 0;
    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const csvRow of csvRows) {
      processed++;
      console.log(`[${processed}/${csvRows.length}] Processing: ${csvRow.sapIdOrRegNo} (${csvRow.fullName || 'N/A'})`);

      try {
        // Fetch ERP data
        console.log(`  📡 Fetching ERP data...`);
        const erpData = await fetchErpData(csvRow.sapIdOrRegNo);

        if (!erpData) {
          console.log(`  ⚠️  Not found in ERP - skipping (will use form data only)`);
          // Still process but without ERP data
        } else {
          console.log(`  ✅ ERP data fetched: Name="${erpData.Name}", Dept="${erpData.DeptName}", Degree="${erpData.DegrTitle}"`);
        }

        // Check if record exists
        const isSap = isSapId(csvRow.sapIdOrRegNo);
        const existingId = await findAlumniRecord(csvRow.sapIdOrRegNo, isSap);

        // Map to database record
        const record = mapToAlumniRecord(csvRow, erpData);

        // Insert or update
        console.log(`  💾 ${existingId ? 'Updating' : 'Inserting'} record...`);
        const result = await upsertAlumniRecord(record, existingId);

        if (result.success) {
          if (result.updated) {
            updated++;
            console.log(`  ✅ Record updated successfully`);
          } else {
            inserted++;
            console.log(`  ✅ Record inserted successfully`);
          }
        }

        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        errors++;
        console.error(`  ❌ Error processing record:`, error instanceof Error ? error.message : String(error));
      }
    }

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 IMPORT SUMMARY');
    console.log('='.repeat(80));
    console.log(`📋 Total records processed: ${csvRows.length}`);
    console.log(`✅ Inserted: ${inserted}`);
    console.log(`🔄 Updated: ${updated}`);
    console.log(`⏭️  Skipped: ${skipped}`);
    console.log(`❌ Errors: ${errors}`);
    console.log('\n✅ Import completed!');
  } catch (error) {
    console.error('\n❌ Fatal error:', error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error('\nStack trace:', error.stack);
    }
    process.exit(1);
  } finally {
    await sql.end();
  }
}

// Run the script
main();

