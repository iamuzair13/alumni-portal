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

// Type for CSV row data (new format)
type CSVRow = {
  timestamp: string | null;
  sapIdOrRegNo: string;
  fullName: string | null;
  contactNo: string | null;
  graduationYear: string | null;
  degreeName: string | null;
  departmentName: string | null;
  facultyName: string | null;
  currentCity: string | null;
  jobTitle: string | null;
  employer: string | null;
  email: string | null;
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
 * Clean email and validate format
 */
function cleanEmail(value: any): string | null {
  const email = clean(value);
  if (!email) return null;
  const lowerEmail = email.toLowerCase();
  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(lowerEmail)) {
    console.warn(`  ⚠️  Invalid email format: ${email}`);
    return null;
  }
  return lowerEmail;
}

/**
 * Validate and truncate string to max length
 */
function validateLength(value: string | null, maxLength: number, fieldName: string): string | null {
  if (!value) return null;
  if (value.length > maxLength) {
    console.warn(`  ⚠️  ${fieldName} truncated from ${value.length} to ${maxLength} characters`);
    return value.substring(0, maxLength);
  }
  return value;
}

/**
 * Validate year
 */
function validateYear(yearStr: string | null): number | null {
  if (!yearStr) return null;
  const year = parseInt(yearStr.trim());
  if (isNaN(year) || year < 1900 || year > new Date().getFullYear() + 10) {
    return null;
  }
  return year;
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

    // Skip first line (header)
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line === '') continue; // Skip empty lines
      
      const values = parseCSVLine(line);
      
      // Column 3: SAP ID/Reg ID
      const sapIdOrRegNo = clean(values[3]);
      if (!sapIdOrRegNo) {
        console.warn(`  ⚠️  Row ${i + 1}: Skipping - no SAP ID/Reg ID found`);
        continue; // Skip rows without SAP ID/Registration number
      }

      // Handle cases where there might be multiple values separated by "/"
      const identifiers = sapIdOrRegNo
        .split(/[/,]/)
        .map(p => p.trim())
        .filter(p => p !== '' && p !== 'null' && p !== 'undefined');

      // Process each identifier (use first one if multiple)
      const identifier = identifiers[0];

      rows.push({
        timestamp: clean(values[0]),           // Column 0: Timestamp
        sapIdOrRegNo: identifier,              // Column 3: SAP ID/Reg ID
        fullName: clean(values[2]),            // Column 2: Full Name
        contactNo: clean(values[4]),           // Column 4: Contact Number
        graduationYear: clean(values[8]),      // Column 8: Graduation Year
        degreeName: clean(values[9]),          // Column 9: Degree Name
        departmentName: clean(values[10]),     // Column 10: Department Name
        facultyName: clean(values[11]),        // Column 11: Faculty Name
        currentCity: clean(values[12]),        // Column 12: Current City of Residence
        jobTitle: clean(values[14]),           // Column 14: Current Job Title
        employer: clean(values[15]),           // Column 15: Current Employer/Organization
        email: cleanEmail(values[16]),         // Column 16: Email
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
 * Check if alumni record exists (by SAP ID/Registration No or email)
 */
async function findAlumniRecord(identifier: string, isSapId: boolean, email?: string | null): Promise<number | null> {
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

    // If not found by ID, check by email (to avoid duplicates)
    if (result.length === 0 && email) {
      const emailResult = await sql`
        SELECT alumniid FROM public.tbl_alumni
        WHERE LOWER(alumniemail) = LOWER(${email})
        LIMIT 1
      `;
      if (emailResult.length > 0) {
        console.warn(`  ⚠️  Found existing record with same email: ${email}`);
        return emailResult[0].alumniid;
      }
    }

    return result.length > 0 ? result[0].alumniid : null;
  } catch (error) {
    console.error(`  ❌ Error finding alumni record:`, error instanceof Error ? error.message : String(error));
    return null;
  }
}

/**
 * Lookup faculty ID by name (safe lookup)
 */
async function lookupFacultyId(facultyName: string | null): Promise<number | null> {
  if (!facultyName) return null;
  try {
    const result = await sql`
      SELECT id FROM public.tbl_faculties
      WHERE LOWER(TRIM(name)) = LOWER(TRIM(${facultyName}))
      LIMIT 1
    `;
    return result.length > 0 ? result[0].id : null;
  } catch (error) {
    console.warn(`  ⚠️  Error looking up faculty "${facultyName}":`, error instanceof Error ? error.message : String(error));
    return null;
  }
}

/**
 * Lookup department ID by name (safe lookup)
 */
async function lookupDepartmentId(departmentName: string | null): Promise<number | null> {
  if (!departmentName) return null;
  try {
    const result = await sql`
      SELECT id FROM public.tbl_departments
      WHERE LOWER(TRIM(name)) = LOWER(TRIM(${departmentName}))
      LIMIT 1
    `;
    return result.length > 0 ? result[0].id : null;
  } catch (error) {
    console.warn(`  ⚠️  Error looking up department "${departmentName}":`, error instanceof Error ? error.message : String(error));
    return null;
  }
}

/**
 * Map CSV row and ERP data to database record (with validation)
 */
async function mapToAlumniRecord(csvRow: CSVRow, erpData: ErpStudentData | null): Promise<any> {
  const isSap = isSapId(csvRow.sapIdOrRegNo);
  
  // Generate email if not provided (required field)
  let alumniemail = csvRow.email;
  if (!alumniemail) {
    if (isSap) {
      alumniemail = `alumni_${csvRow.sapIdOrRegNo}@uol.edu.pk`;
    } else {
      alumniemail = `alumni_${csvRow.sapIdOrRegNo.replace(/\s+/g, '_')}@uol.edu.pk`;
    }
  }
  alumniemail = alumniemail.toLowerCase();

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

  // Parse graduation year
  const yearofending = validateYear(csvRow.graduationYear);

  // Lookup faculty and department IDs
  const facultyId = await lookupFacultyId(csvRow.facultyName);
  const departmentId = await lookupDepartmentId(csvRow.departmentName);

  // Validate and truncate fields to match database constraints
  const alumniname = validateLength(csvRow.fullName, 200, 'alumniname');
  const contactno = validateLength(csvRow.contactNo, 50, 'contactno');
  const degreetitle = validateLength(csvRow.degreeName || erpData?.DegrTitle || null, 300, 'degreetitle');
  const departmentname = validateLength(csvRow.departmentName || erpData?.DeptName || null, 300, 'departmentname');
  const facultyname = validateLength(csvRow.facultyName, 100, 'facultyname');
  const city = validateLength(csvRow.currentCity, 50, 'city');
  const designation = validateLength(csvRow.jobTitle, 100, 'designation');
  const nameoforganization = validateLength(csvRow.employer, 100, 'nameoforganization');
  const fathername = validateLength(erpData?.Fname || null, 200, 'fathername');
  const cnicpassport = validateLength(erpData?.Cnic || null, 50, 'cnicpassport');
  const address = validateLength(erpData?.Address || null, 250, 'address');

  return {
    alumniemail: alumniemail,
    password: null,
    todaydate: todaydate,
    registrationno: isSap ? null : validateLength(csvRow.sapIdOrRegNo, 20, 'registrationno'),
    sapid: isSap ? validateLength(csvRow.sapIdOrRegNo, 20, 'sapid') : null,
    alumniname: alumniname,
    gender: null,
    fathername: fathername,
    dateofbirth: null,
    maritalstatus: null,
    cnicpassport: cnicpassport,
    contactno: contactno,
    contactno1: null,
    contactno1show: null,
    personalemail: csvRow.email,
    personalemailshow: null,
    universityemail: null,
    country: null, // Not in new CSV format
    province: null,
    city: city,
    address: address,
    academicsession: null,
    degreetitle: degreetitle,
    cgpa: null,
    yearofstarting: null,
    yearofending: yearofending,
    facultyname: facultyname,
    campusname: null,
    departmentname: departmentname,
    majorsubject: null,
    industry: null, // Not in new CSV format
    employeed: null, // Not in new CSV format
    nameoforganization: nameoforganization,
    designation: designation,
    totalyearsofexpereince: null,
    officialemail: null,
    officialnumber: null,
    work_city: null, // Not in new CSV format
    supervisordesignation: null,
    work_country: null, // Not in new CSV format
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
    higher_education_institute_name: null, // Not in new CSV format
    degree_title: validateLength(csvRow.degreeName, 300, 'degree_title'),
    is_scholarship: null, // Not in new CSV format
    higher_education_program: null, // Not in new CSV format
    father_cnic: null,
    image2: null,
    association_id: null,
    association_job: null,
    chapter_leadership: null,
    organization_address: null,
    higher_education_intiture_number: null,
    higher_education_institute_email: null,
    higher_education_institute_country: null, // Not in new CSV format
    higher_education_institute_province: null,
    higher_education_institute_city: null, // Not in new CSV format
    about: null,
    reason_of_unemployment: null,
    category: null,
    faculty: facultyId,
    department: departmentId,
    program: null,
  };
}

/**
 * Insert or update alumni record
 */
async function upsertAlumniRecord(record: any, alumniid: number | null): Promise<{ success: boolean; updated: boolean }> {
  try {
    if (alumniid) {
      // Update existing record (only update non-null fields to preserve existing data)
      await sql`
        UPDATE public.tbl_alumni SET
          alumniemail = ${record.alumniemail},
          todaydate = ${record.todaydate},
          registrationno = COALESCE(${record.registrationno}, registrationno),
          sapid = COALESCE(${record.sapid}, sapid),
          alumniname = COALESCE(${record.alumniname}, alumniname),
          fathername = COALESCE(${record.fathername}, fathername),
          cnicpassport = COALESCE(${record.cnicpassport}, cnicpassport),
          contactno = COALESCE(${record.contactno}, contactno),
          personalemail = COALESCE(${record.personalemail}, personalemail),
          city = COALESCE(${record.city}, city),
          degreetitle = COALESCE(${record.degreetitle}, degreetitle),
          departmentname = COALESCE(${record.departmentname}, departmentname),
          facultyname = COALESCE(${record.facultyname}, facultyname),
          nameoforganization = COALESCE(${record.nameoforganization}, nameoforganization),
          designation = COALESCE(${record.designation}, designation),
          address = COALESCE(${record.address}, address),
          yearofending = COALESCE(${record.yearofending}, yearofending),
          degree_title = COALESCE(${record.degree_title}, degree_title),
          faculty = COALESCE(${record.faculty}, faculty),
          department = COALESCE(${record.department}, department),
          datasource = COALESCE(${record.datasource}, datasource),
          createddatetime = COALESCE(${record.createddatetime}, createddatetime)
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
    console.error('\nExpected CSV Format:');
    console.error('  Column 0: Timestamp');
    console.error('  Column 1: Score (ignored)');
    console.error('  Column 2: Full Name');
    console.error('  Column 3: SAP ID/Reg ID');
    console.error('  Column 4: Contact Number');
    console.error('  Column 5: Book your slots (ignored)');
    console.error('  Column 6: Are you interested in being a mentor/speaker... (ignored)');
    console.error('  Column 7: What type of sessions... (ignored)');
    console.error('  Column 8: Graduation Year');
    console.error('  Column 9: Degree Name');
    console.error('  Column 10: Department Name');
    console.error('  Column 11: Faculty Name');
    console.error('  Column 12: Current City of Residence');
    console.error('  Column 13: How would you like UOL... (ignored)');
    console.error('  Column 14: Current Job Title');
    console.error('  Column 15: Current Employer/Organization');
    console.error('  Column 16: Email');
    console.error('\nExample:');
    console.error('  npm run import-form-data-with-erp "scripts/alumni-form-responses.csv"');
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
        const existingId = await findAlumniRecord(csvRow.sapIdOrRegNo, isSap, csvRow.email);

        // Map to database record (async now due to lookups)
        console.log(`  🔍 Mapping data to database record...`);
        const record = await mapToAlumniRecord(csvRow, erpData);

        // Validate required fields before insertion
        if (!record.alumniemail) {
          throw new Error('Email is required but could not be generated');
        }

        // Check for duplicate email if inserting new record
        let recordIdToUse = existingId;
        if (!existingId) {
          const emailCheck = await sql`
            SELECT alumniid FROM public.tbl_alumni
            WHERE LOWER(alumniemail) = LOWER(${record.alumniemail})
            LIMIT 1
          `;
          if (emailCheck.length > 0) {
            console.warn(`  ⚠️  Email already exists for alumni ID ${emailCheck[0].alumniid}, updating that record instead`);
            recordIdToUse = emailCheck[0].alumniid;
          }
        }

        // Insert or update
        console.log(`  💾 ${recordIdToUse ? 'Updating' : 'Inserting'} record...`);
        const result = await upsertAlumniRecord(record, recordIdToUse);

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

