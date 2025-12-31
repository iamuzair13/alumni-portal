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

// Create database connection
const sql = postgres(process.env.DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

/**
 * Parse CSV file and extract SAP IDs/Registration numbers
 */
function parseCSV(filePath: string): string[] {
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

    // The SAP ID/Registration column is the second column (index 1)
    // Based on the CSV structure: Timestamp, SAP ID/ Registration no., Full Name, ...
    const sapIdColumnIndex = 1;

    // Extract SAP IDs/Registration numbers from data rows
    // Skip first 2 lines (header spans 2 lines due to newline in "Full Name")
    const identifiers: string[] = [];
    for (let i = 2; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line === '') continue; // Skip empty lines
      
      const values = parseCSVLine(line);
      if (values.length > sapIdColumnIndex) {
        const identifier = values[sapIdColumnIndex]?.trim();
        if (identifier && identifier !== '' && identifier !== 'null' && identifier !== 'undefined') {
          // Handle cases where there might be multiple values separated by "/" or spaces
          // Example: "70096420/ DMLS02183008" should be split
          const parts = identifier
            .split(/[/,]/)
            .map(p => p.trim())
            .filter(p => p !== '' && p !== 'null' && p !== 'undefined');
          identifiers.push(...parts);
        }
      }
    }

    // Remove duplicates and filter out empty values
    const uniqueIdentifiers = Array.from(new Set(identifiers.filter(id => id && id.length > 0)));

    return uniqueIdentifiers;
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
 * Count matching alumni records by SAP ID or Registration Number
 */
async function countMatchedAlumni(identifiers: string[]): Promise<number> {
  if (identifiers.length === 0) {
    return 0;
  }

  try {
    // Query to find matches - check both sapid and registrationno columns
    // Format array as PostgreSQL array literal and escape properly
    const escapedIdentifiers = identifiers.map(id => {
      // Escape single quotes and wrap in quotes
      const escaped = id.replace(/'/g, "''");
      return `'${escaped}'`;
    });
    const arrayLiteral = `ARRAY[${escapedIdentifiers.join(', ')}]::text[]`;
    
    const query = `
      SELECT COUNT(DISTINCT alumniid) as count
      FROM public.tbl_alumni
      WHERE sapid = ANY(${arrayLiteral})
         OR registrationno = ANY(${arrayLiteral})
    `;
    
    const result = await sql.unsafe(query);

    const count = result[0]?.count || 0;
    return typeof count === 'string' ? parseInt(count, 10) : Number(count);
  } catch (error) {
    console.error('❌ Error querying database:', error instanceof Error ? error.message : String(error));
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
    console.error('\nUsage: npm run count-matched-alumni <csv-file-path>');
    console.error('\nExample:');
    console.error('  npm run count-matched-alumni "scripts/UOL Alumni Portal Registration Form (Responses) - Form Responses 1.csv"');
    process.exit(1);
  }

  try {
    // Parse CSV and extract identifiers
    const identifiers = parseCSV(csvFilePath);
    
    if (identifiers.length === 0) {
      console.log('0');
      return;
    }

    // Count matches
    const matchedCount = await countMatchedAlumni(identifiers);

    // Output only the number
    console.log(matchedCount.toString());
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    await sql.end();
  }
}

// Run the script
main();

