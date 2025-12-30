import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

if (!process.env.ERP_API_URL || !process.env.ERP_USERNAME || !process.env.ERP_PASSWORD) {
  console.error('❌ ERP configuration is missing');
  console.error('Please set ERP_API_URL, ERP_USERNAME, and ERP_PASSWORD in your .env.local file');
  process.exit(1);
}

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
        
        // Handle OData response format with 'd' property
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
  sapIdOrRegNo: string;
  fullName: string | null;
  cnic: string | null;
  programName: string | null; // Degree
  rowNumber: number;
};

/**
 * Clean and normalize a value for comparison
 */
function clean(value: any): string | null {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  return str === '' ? null : str;
}

/**
 * Normalize strings for comparison (lowercase, remove extra spaces)
 */
function normalizeForComparison(value: string | null): string | null {
  if (!value) return null;
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Compare two values (case-insensitive, ignoring extra spaces)
 */
function compareValues(csvValue: string | null, erpValue: string | null): { match: boolean; csvValue: string | null; erpValue: string | null } {
  const csvNorm = normalizeForComparison(csvValue);
  const erpNorm = normalizeForComparison(erpValue);
  
  if (!csvNorm && !erpNorm) {
    return { match: true, csvValue: csvValue, erpValue: erpValue };
  }
  if (!csvNorm || !erpNorm) {
    return { match: false, csvValue: csvValue, erpValue: erpValue };
  }
  
  return { match: csvNorm === erpNorm, csvValue: csvValue, erpValue: erpValue };
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

    // Column indices:
    // 0: Timestamp
    // 1: SAP ID/ Registration no.
    // 2: Full Name
    // 3: CNIC
    // 14: Program Name (Degree)
    const sapIdColumnIndex = 1;
    const fullNameColumnIndex = 2;
    const cnicColumnIndex = 3;
    const programNameColumnIndex = 14;

    const rows: CSVRow[] = [];

    // Skip first 2 lines (header spans 2 lines due to newline in "Full Name")
    for (let i = 2; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line === '') continue; // Skip empty lines
      
      const values = parseCSVLine(line);
      
      const sapIdOrRegNo = clean(values[sapIdColumnIndex]);
      if (!sapIdOrRegNo) continue; // Skip rows without SAP ID/Registration number

      // Handle cases where there might be multiple values separated by "/"
      const identifiers = sapIdOrRegNo
        .split(/[/,]/)
        .map(p => p.trim())
        .filter(p => p !== '' && p !== 'null' && p !== 'undefined');

      // Process each identifier (in case of multiple like "70096420/ DMLS02183008")
      for (const identifier of identifiers) {
        rows.push({
          sapIdOrRegNo: identifier,
          fullName: clean(values[fullNameColumnIndex]),
          cnic: clean(values[cnicColumnIndex]),
          programName: clean(values[programNameColumnIndex]),
          rowNumber: i + 1, // Excel row number (1-indexed)
        });
      }
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
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // End of field
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  // Add the last field
  values.push(current);

  return values;
}

/**
 * Determine if identifier is SAP ID or Registration Number
 */
function isSapId(identifier: string): boolean {
  // SAP IDs typically start with numbers (like 70095953, 70067091)
  // Registration numbers typically start with letters (like MSC02173057, BSEES01181003)
  return /^\d/.test(identifier.trim());
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

    // Handle OData response format - the data might be nested in 'd' property
    let erpData = response.data as any;
    
    if (erpData && typeof erpData === 'object' && 'd' in erpData) {
      erpData = erpData.d;
    }

    return erpData as ErpStudentData;
  } catch (error) {
    console.error(`  ❌ Error fetching ERP data for ${identifier}:`, error instanceof Error ? error.message : String(error));
    return null;
  }
}

/**
 * Compare CSV row with ERP data
 */
function compareRowWithErp(csvRow: CSVRow, erpData: ErpStudentData): {
  identifier: string;
  nameMatch: { match: boolean; csvValue: string | null; erpValue: string | null };
  cnicMatch: { match: boolean; csvValue: string | null; erpValue: string | null };
  fatherNameMatch: { match: boolean; csvValue: string | null; erpValue: string | null };
  departmentMatch: { match: boolean; csvValue: string | null; erpValue: string | null };
  degreeMatch: { match: boolean; csvValue: string | null; erpValue: string | null };
  rowNumber: number;
} {
  return {
    identifier: csvRow.sapIdOrRegNo,
    nameMatch: compareValues(csvRow.fullName, erpData.Name),
    cnicMatch: compareValues(csvRow.cnic, erpData.Cnic),
    fatherNameMatch: { match: true, csvValue: null, erpValue: erpData.Fname || null }, // CSV doesn't have father name
    departmentMatch: { match: true, csvValue: null, erpValue: erpData.DeptName || null }, // CSV doesn't have department
    degreeMatch: compareValues(csvRow.programName, erpData.DegrTitle),
    rowNumber: csvRow.rowNumber,
  };
}

/**
 * Main function
 */
async function main() {
  const csvFilePath = process.argv[2];

  if (!csvFilePath) {
    console.error('❌ Please provide the CSV file path as an argument');
    console.error('\nUsage: npm run compare-csv-erp <csv-file-path>');
    console.error('\nExample:');
    console.error('  npm run compare-csv-erp "scripts/UOL Alumni Portal Registration Form (Responses) - Form Responses 1.csv"');
    process.exit(1);
  }

  try {
    console.log('📊 Starting CSV vs ERP comparison...');
    console.log(`📁 CSV file: ${csvFilePath}\n`);

    // Parse CSV
    console.log('📋 Parsing CSV file...');
    const csvRows = parseCSV(csvFilePath);
    console.log(`✅ Found ${csvRows.length} records with SAP ID/Registration numbers\n`);

    if (csvRows.length === 0) {
      console.log('⚠️  No records to process');
      return;
    }

    // Process each row
    const results: Array<ReturnType<typeof compareRowWithErp> & { erpFound: boolean }> = [];
    let processed = 0;
    let erpFound = 0;
    let erpNotFound = 0;

    for (const csvRow of csvRows) {
      processed++;
      console.log(`[${processed}/${csvRows.length}] Processing: ${csvRow.sapIdOrRegNo}`);

      // Fetch ERP data
      const erpData = await fetchErpData(csvRow.sapIdOrRegNo);

      if (!erpData) {
        console.log(`  ⚠️  Not found in ERP`);
        results.push({
          identifier: csvRow.sapIdOrRegNo,
          nameMatch: { match: false, csvValue: csvRow.fullName, erpValue: null },
          cnicMatch: { match: false, csvValue: csvRow.cnic, erpValue: null },
          fatherNameMatch: { match: false, csvValue: null, erpValue: null },
          departmentMatch: { match: false, csvValue: null, erpValue: null },
          degreeMatch: { match: false, csvValue: csvRow.programName, erpValue: null },
          rowNumber: csvRow.rowNumber,
          erpFound: false,
        });
        erpNotFound++;
        continue;
      }

      erpFound++;

      // Compare
      const comparison = compareRowWithErp(csvRow, erpData);
      results.push({ ...comparison, erpFound: true });

      // Show mismatches
      const mismatches: string[] = [];
      if (!comparison.nameMatch.match) mismatches.push('Name');
      if (!comparison.cnicMatch.match) mismatches.push('CNIC');
      if (!comparison.degreeMatch.match) mismatches.push('Degree');
      
      if (mismatches.length > 0) {
        console.log(`  ⚠️  Mismatches: ${mismatches.join(', ')}`);
      } else {
        console.log(`  ✅ All fields match`);
      }

      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 COMPARISON SUMMARY');
    console.log('='.repeat(80));
    console.log(`📋 Total records processed: ${csvRows.length}`);
    console.log(`✅ Found in ERP: ${erpFound}`);
    console.log(`❌ Not found in ERP: ${erpNotFound}\n`);

    // Count matches/mismatches
    const nameMatches = results.filter(r => r.nameMatch.match && r.erpFound).length;
    const nameMismatches = results.filter(r => !r.nameMatch.match && r.erpFound).length;
    const cnicMatches = results.filter(r => r.cnicMatch.match && r.erpFound).length;
    const cnicMismatches = results.filter(r => !r.cnicMatch.match && r.erpFound).length;
    const degreeMatches = results.filter(r => r.degreeMatch.match && r.erpFound).length;
    const degreeMismatches = results.filter(r => !r.degreeMatch.match && r.erpFound).length;

    console.log('📊 Field Comparison (for records found in ERP):');
    console.log(`  Name:     ${nameMatches} match, ${nameMismatches} mismatch`);
    console.log(`  CNIC:     ${cnicMatches} match, ${cnicMismatches} mismatch`);
    console.log(`  Degree:   ${degreeMatches} match, ${degreeMismatches} mismatch\n`);

    // Show detailed mismatches
    const detailedMismatches = results.filter(r => 
      r.erpFound && (!r.nameMatch.match || !r.cnicMatch.match || !r.degreeMatch.match)
    );

    if (detailedMismatches.length > 0) {
      console.log('⚠️  DETAILED MISMATCHES:');
      console.log('='.repeat(80));
      
      for (const mismatch of detailedMismatches.slice(0, 20)) { // Show first 20
        console.log(`\n📌 ${mismatch.identifier} (Row ${mismatch.rowNumber}):`);
        if (!mismatch.nameMatch.match) {
          console.log(`   Name:     CSV="${mismatch.nameMatch.csvValue}" | ERP="${mismatch.nameMatch.erpValue}"`);
        }
        if (!mismatch.cnicMatch.match) {
          console.log(`   CNIC:     CSV="${mismatch.cnicMatch.csvValue}" | ERP="${mismatch.cnicMatch.erpValue}"`);
        }
        if (!mismatch.degreeMatch.match) {
          console.log(`   Degree:   CSV="${mismatch.degreeMatch.csvValue}" | ERP="${mismatch.degreeMatch.erpValue}"`);
        }
        console.log(`   Department (ERP): ${mismatch.departmentMatch.erpValue || 'N/A'}`);
        console.log(`   Father Name (ERP): ${mismatch.fatherNameMatch.erpValue || 'N/A'}`);
      }

      if (detailedMismatches.length > 20) {
        console.log(`\n... and ${detailedMismatches.length - 20} more mismatches`);
      }
    }

    console.log('\n✅ Comparison completed!');
  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error('\nStack trace:', error.stack);
    }
    process.exit(1);
  }
}

// Run the script
main();

