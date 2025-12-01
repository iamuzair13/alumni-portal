import postgres from "postgres";
import dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

// Load environment variables from .env files (tries .env.local first, then .env)
dotenv.config({ path: '.env.local' });
dotenv.config();

// Get DATABASE_URL from command line argument, environment variable, or .env file
const databaseUrl = process.argv[2] || process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("❌ Error: DATABASE_URL is not set");
  console.error("");
  console.error("Usage options:");
  console.error("  1. Pass DATABASE_URL as argument:");
  console.error('     npm run fetch-programs -- "postgresql://user:password@host:port/database"');
  console.error("");
  console.error("  2. Set environment variable:");
  console.error('     $env:DATABASE_URL="postgresql://user:password@host:port/database"; npm run fetch-programs');
  console.error("");
  console.error("  3. Create .env.local file with:");
  console.error('     DATABASE_URL="postgresql://user:password@host:port/database"');
  process.exit(1);
}

// Create database connection
const sql = postgres(databaseUrl, {
  max: 1,
  idle_timeout: 20,
  connect_timeout: 10,
});

async function fetchAllPrograms() {
  try {
    console.log("Fetching all programs from tbl_alumni...");
    
    const result = await sql`
      SELECT DISTINCT 
        degreetitle,
        COUNT(*) as count
      FROM public.tbl_alumni
      WHERE degreetitle IS NOT NULL 
        AND TRIM(degreetitle) != ''
      GROUP BY degreetitle
      ORDER BY degreetitle ASC
    `;

    const programs = result.map((row: any) => ({
      program: row.degreetitle,
      count: Number(row.count || 0)
    }));

    console.log(`Found ${programs.length} unique programs`);
    
    return programs;
  } catch (error) {
    console.error("Error fetching programs:", error);
    throw error;
  } finally {
    await sql.end();
  }
}

// Run the script
fetchAllPrograms()
  .then((programs) => {
    const outputPath = path.join(process.cwd(), 'mock-programs.json');
    const jsonData = JSON.stringify(programs, null, 2);
    
    fs.writeFileSync(outputPath, jsonData, 'utf-8');
    console.log(`\n✅ Successfully saved ${programs.length} programs to ${outputPath}`);
    console.log(`\nTotal alumni records: ${programs.reduce((sum, p) => sum + p.count, 0)}`);
    process.exit(0);
  })
  .catch((error) => {
    console.error("Failed to fetch programs:", error);
    process.exit(1);
  });

