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

// ERP API Client implementation (simplified for script use)
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
        // If JSON parsing fails, try to handle XML (simplified)
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

// Type for input JSON structure
type InputData = {
  ids?: string[];
  sapids?: string[];
  registrationnos?: string[];
  [key: string]: unknown;
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
 * Fetch ERP data for a given SAP ID or Registration Number
 */
async function fetchErpData(identifier: string, isSapId: boolean): Promise<ErpStudentData | null> {
  try {
    let response;
    if (isSapId) {
      response = await erpClient.fetchBySapId(identifier);
    } else {
      response = await erpClient.fetchByRegistrationNo(identifier);
    }

    if (!response.success || !response.data) {
      if (response.error === 'NOT_FOUND') {
        return null; // Record not found in ERP
      }
      throw new Error(response.error || 'Failed to fetch ERP data');
    }

    // Handle OData response format - the data might be nested in 'd' property
    let erpData = response.data as any;
    
    // If response has 'd' property (OData format), extract it
    if (erpData && typeof erpData === 'object' && 'd' in erpData) {
      erpData = erpData.d;
    }

    return erpData as ErpStudentData;
  } catch (error) {
    console.error(`  ❌ Error fetching ERP data for ${identifier}:`, error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * Update alumni record with ERP data
 */
async function updateAlumniRecord(
  identifier: string,
  isSapId: boolean,
  erpData: ErpStudentData
): Promise<{ updated: boolean; addressUpdated: boolean; cnicUpdated: boolean; fathernameUpdated: boolean }> {
  try {
    // Extract address, CNIC, and father name from ERP data
    const address = clean(erpData.Address);
    const cnic = clean(erpData.Cnic);
    const fathername = clean(erpData.Fname);

    // If all are null/empty, nothing to update
    if (!address && !cnic && !fathername) {
      return { updated: false, addressUpdated: false, cnicUpdated: false, fathernameUpdated: false };
    }

    // Find the alumni record
    let alumniRecord;
    if (isSapId) {
      const records = await sql`
        SELECT alumniid, address, cnicpassport, fathername, sapid, registrationno
        FROM public.tbl_alumni
        WHERE sapid = ${identifier}
        LIMIT 1
      `;
      alumniRecord = records[0];
    } else {
      const records = await sql`
        SELECT alumniid, address, cnicpassport, fathername, sapid, registrationno
        FROM public.tbl_alumni
        WHERE registrationno = ${identifier}
        LIMIT 1
      `;
      alumniRecord = records[0];
    }

    if (!alumniRecord) {
      throw new Error(`Alumni record not found for ${isSapId ? 'SAP ID' : 'Registration No'}: ${identifier}`);
    }

    // Check if address, cnicpassport, or fathername is null (only update if null)
    const needsAddressUpdate = !alumniRecord.address && !!address;
    const needsCnicUpdate = !alumniRecord.cnicpassport && !!cnic;
    const needsFathernameUpdate = !alumniRecord.fathername && !!fathername;

    if (!needsAddressUpdate && !needsCnicUpdate && !needsFathernameUpdate) {
      return { updated: false, addressUpdated: false, cnicUpdated: false, fathernameUpdated: false };
    }

    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (needsAddressUpdate) {
      updates.push(`address = $${paramIndex}`);
      values.push(address);
      paramIndex++;
    }

    if (needsCnicUpdate) {
      updates.push(`cnicpassport = $${paramIndex}`);
      values.push(cnic);
      paramIndex++;
    }

    if (needsFathernameUpdate) {
      updates.push(`fathername = $${paramIndex}`);
      values.push(fathername);
      paramIndex++;
    }

    // Add the WHERE clause parameter
    values.push(alumniRecord.alumniid);

    // Execute update
    const updateQuery = `
      UPDATE public.tbl_alumni
      SET ${updates.join(', ')}
      WHERE alumniid = $${paramIndex}
    `;

    await sql.unsafe(updateQuery, values);

    return {
      updated: true,
      addressUpdated: needsAddressUpdate,
      cnicUpdated: needsCnicUpdate,
      fathernameUpdated: needsFathernameUpdate,
    };
  } catch (error) {
    console.error(`  ❌ Error updating alumni record for ${identifier}:`, error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * Process a single ID
 */
async function processId(
  identifier: string,
  isSapId: boolean,
  index: number,
  total: number
): Promise<{ success: boolean; updated: boolean; error?: string }> {
  const idType = isSapId ? 'SAP ID' : 'Registration No';
  console.log(`\n[${index + 1}/${total}] Processing ${idType}: ${identifier}`);

  try {
    // Fetch ERP data
    console.log(`  📡 Fetching ERP data...`);
    const erpData = await fetchErpData(identifier, isSapId);

    if (!erpData) {
      console.log(`  ⚠️  Record not found in ERP system`);
      return { success: true, updated: false, error: 'NOT_FOUND' };
    }

    // Check if we have address, CNIC, or father name data
    const hasAddress = !!clean(erpData.Address);
    const hasCnic = !!clean(erpData.Cnic);
    const hasFathername = !!clean(erpData.Fname);

    if (!hasAddress && !hasCnic && !hasFathername) {
      console.log(`  ⚠️  ERP data does not contain address, CNIC, or father name`);
      return { success: true, updated: false, error: 'NO_DATA' };
    }

    const dataFields = [];
    if (hasAddress) dataFields.push('Address');
    if (hasCnic) dataFields.push('CNIC');
    if (hasFathername) dataFields.push('Father Name');
    console.log(`  ✅ ERP data fetched: ${dataFields.join(', ')}`);

    // Update database
    console.log(`  💾 Updating database...`);
    const result = await updateAlumniRecord(identifier, isSapId, erpData);

    if (result.updated) {
      const updates = [];
      if (result.addressUpdated) updates.push('address');
      if (result.cnicUpdated) updates.push('CNIC');
      if (result.fathernameUpdated) updates.push('father name');
      console.log(`  ✅ Updated: ${updates.join(', ')}`);
      return { success: true, updated: true };
    } else {
      console.log(`  ℹ️  No update needed (fields already populated)`);
      return { success: true, updated: false };
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`  ❌ Failed: ${errorMsg}`);
    return { success: false, updated: false, error: errorMsg };
  }
}

/**
 * Load and parse input JSON file
 */
function loadInputFile(filePath: string): string[] {
  try {
    // Resolve file path - handle relative paths from project root or scripts directory
    let resolvedPath = filePath;
    if (!path.isAbsolute(filePath)) {
      // Try relative to current working directory first
      if (fs.existsSync(filePath)) {
        resolvedPath = path.resolve(filePath);
      } else if (fs.existsSync(path.join(process.cwd(), filePath))) {
        resolvedPath = path.resolve(process.cwd(), filePath);
      } else if (fs.existsSync(path.join(process.cwd(), 'scripts', filePath))) {
        resolvedPath = path.resolve(process.cwd(), 'scripts', filePath);
      } else {
        throw new Error(`File not found: ${filePath}\nTried:\n  - ${filePath}\n  - ${path.join(process.cwd(), filePath)}\n  - ${path.join(process.cwd(), 'scripts', filePath)}`);
      }
    }

    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`File not found: ${resolvedPath}`);
    }

    const fileContent = fs.readFileSync(resolvedPath, 'utf-8');
    const data = JSON.parse(fileContent.trim()) as InputData;

    // Handle different JSON structures
    let ids: string[] = [];

    if (Array.isArray(data)) {
      // Check if it's an array of objects with sapid/registrationno properties
      if (data.length > 0 && typeof data[0] === 'object' && data[0] !== null) {
        // Array of objects: [{ "sapid": "123" }, { "sapid": "456" }] or [{ "registrationno": "REG123" }]
        ids = data
          .map((item: any) => {
            if (item.sapid) return String(item.sapid).trim();
            if (item.registrationno) return String(item.registrationno).trim();
            if (item.id) return String(item.id).trim();
            return null;
          })
          .filter((id: string | null): id is string => id !== null && id.length > 0);
      } else {
        // If it's a direct array of strings/numbers
        ids = data.map(id => String(id).trim()).filter(id => id.length > 0);
      }
    } else if (typeof data === 'object') {
      // If it's an object with arrays
      if (data.ids && Array.isArray(data.ids)) {
        ids = data.ids.map(id => String(id).trim()).filter(id => id.length > 0);
      } else if (data.sapids && Array.isArray(data.sapids)) {
        ids = data.sapids.map(id => String(id).trim()).filter(id => id.length > 0);
      } else if (data.registrationnos && Array.isArray(data.registrationnos)) {
        ids = data.registrationnos.map(id => String(id).trim()).filter(id => id.length > 0);
      } else {
        // Try to extract all string values from the object
        ids = Object.values(data)
          .map(id => String(id).trim())
          .filter(id => id.length > 0);
      }
    } else {
      throw new Error('Invalid JSON format. Expected an array or object with ids/sapids/registrationnos');
    }

    if (ids.length === 0) {
      throw new Error('No valid IDs found in JSON file');
    }

    return ids;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to load JSON file: ${String(error)}`);
  }
}

/**
 * Main function
 */
async function main() {
  const jsonFilePath = process.argv[2];
  const useSapId = process.argv[3] !== 'registrationno'; // Default to SAP ID unless specified

  if (!jsonFilePath) {
    console.error('❌ Please provide the JSON file path as an argument');
    console.error('\nUsage: npm run fetch-erp-update-alumni <json-file-path> [id-type]');
    console.error('\nParameters:');
    console.error('  json-file-path: Path to JSON file containing IDs');
    console.error('  id-type: "sapid" (default) or "registrationno"');
    console.error('\nJSON File Format Examples:');
    console.error('  ["70083082", "70083083", "70083084"]');
    console.error('  [{ "sapid": "70083082" }, { "sapid": "70083083" }]');
    console.error('  { "ids": ["70083082", "70083083"] }');
    console.error('  { "sapids": ["70083082", "70083083"] }');
    console.error('  { "registrationnos": ["REG123", "REG456"] }');
    console.error('\nExample:');
    console.error('  npm run fetch-erp-update-alumni ./scripts/sample-sapids.json');
    console.error('  npm run fetch-erp-update-alumni ./ids.json registrationno');
    console.error('  npm run fetch-erp-update-alumni sample-sapids.json');
    process.exit(1);
  }

  try {
    console.log('🚀 Starting ERP data fetch and update process...');
    console.log(`📁 JSON file: ${jsonFilePath}`);
    console.log(`🔍 ID type: ${useSapId ? 'SAP ID' : 'Registration Number'}\n`);

    // Load IDs from JSON file
    console.log('📋 Loading IDs from JSON file...');
    const ids = loadInputFile(jsonFilePath);
    console.log(`✅ Loaded ${ids.length} IDs\n`);

    // Process each ID
    let successCount = 0;
    let updatedCount = 0;
    let notFoundCount = 0;
    let noDataCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < ids.length; i++) {
      const result = await processId(ids[i], useSapId, i, ids.length);

      if (result.success) {
        successCount++;
        if (result.updated) {
          updatedCount++;
        } else if (result.error === 'NOT_FOUND') {
          notFoundCount++;
        } else if (result.error === 'NO_DATA') {
          noDataCount++;
        }
      } else {
        errorCount++;
        errors.push(`${ids[i]}: ${result.error || 'Unknown error'}`);
      }

      // Small delay between requests to avoid overwhelming the API
      if (i < ids.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 PROCESS SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Total successful: ${successCount}`);
    console.log(`   📝 Records updated: ${updatedCount}`);
    console.log(`   ⚠️  Not found in ERP: ${notFoundCount}`);
    console.log(`   ⚠️  No address/CNIC data: ${noDataCount}`);
    console.log(`❌ Total failed: ${errorCount}`);
    console.log(`📋 Total processed: ${ids.length}`);

    if (errors.length > 0) {
      console.log(`\n⚠️  ${errors.length} errors encountered:`);
      const errorSample = errors.slice(0, 10);
      errorSample.forEach((err, idx) => {
        console.log(`   ${idx + 1}. ${err}`);
      });
      if (errors.length > 10) {
        console.log(`   ... and ${errors.length - 10} more errors`);
      }
    }

    console.log('\n✅ Process completed!');
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

