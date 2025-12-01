import postgres from "postgres";
import dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

// Load environment variables from .env files
dotenv.config({ path: '.env.local' });
dotenv.config();

// Get DATABASE_URL from command line argument, environment variable, or .env file
const databaseUrl = process.argv[2] || process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("❌ Error: DATABASE_URL is not set");
  console.error("");
  console.error("Usage options:");
  console.error("  1. Pass DATABASE_URL as argument:");
  console.error('     npm run fetch-faculties-departments -- "postgresql://user:password@host:port/database"');
  console.error("");
  console.error("  2. Set environment variable:");
  console.error('     $env:DATABASE_URL="postgresql://user:password@host:port/database"; npm run fetch-faculties-departments');
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

async function fetchFacultiesDepartmentsPrograms() {
  try {
    console.log("Fetching faculties, departments, and programs from tbl_alumni...");
    
    // Fetch all unique faculty-department-program combinations
    const result = await sql`
      SELECT DISTINCT 
        facultyname,
        departmentname,
        degreetitle,
        COUNT(*) as count
      FROM public.tbl_alumni
      WHERE facultyname IS NOT NULL 
        AND TRIM(facultyname) != ''
        AND departmentname IS NOT NULL 
        AND TRIM(departmentname) != ''
        AND degreetitle IS NOT NULL 
        AND TRIM(degreetitle) != ''
      GROUP BY facultyname, departmentname, degreetitle
      ORDER BY facultyname ASC, departmentname ASC, degreetitle ASC
    `;

    // Organize data hierarchically: Faculty -> Department -> Programs
    const facultyMap = new Map<string, Map<string, Array<{ program: string; count: number }>>>();

    for (const row of result as unknown as Array<{ facultyname: string; departmentname: string; degreetitle: string; count: number | string | bigint }>) {
      const faculty = row.facultyname.trim();
      const department = row.departmentname.trim();
      const program = row.degreetitle.trim();
      const count = Number(row.count || 0);

      if (!facultyMap.has(faculty)) {
        facultyMap.set(faculty, new Map());
      }

      const departmentMap = facultyMap.get(faculty)!;
      if (!departmentMap.has(department)) {
        departmentMap.set(department, []);
      }

      departmentMap.get(department)!.push({ program, count });
    }

    // Convert to array structure
    const faculties = Array.from(facultyMap.entries()).map(([faculty, departments]) => ({
      faculty,
      departments: Array.from(departments.entries()).map(([department, programs]) => ({
        department,
        programs: programs.sort((a, b) => a.program.localeCompare(b.program))
      })).sort((a, b) => a.department.localeCompare(b.department))
    })).sort((a, b) => a.faculty.localeCompare(b.faculty));

    // Also get standalone programs (those without faculty/department mapping)
    const standalonePrograms = await sql`
      SELECT DISTINCT 
        degreetitle,
        COUNT(*) as count
      FROM public.tbl_alumni
      WHERE degreetitle IS NOT NULL 
        AND TRIM(degreetitle) != ''
        AND (facultyname IS NULL OR TRIM(facultyname) = '' OR departmentname IS NULL OR TRIM(departmentname) = '')
      GROUP BY degreetitle
      ORDER BY degreetitle ASC
    `;

    const standalone = (standalonePrograms as unknown as Array<{ degreetitle: string; count: number | string | bigint }>).map(row => ({
      program: row.degreetitle.trim(),
      count: Number(row.count || 0)
    }));

    const totalFaculties = faculties.length;
    const totalDepartments = faculties.reduce((sum, f) => sum + f.departments.length, 0);
    const totalPrograms = faculties.reduce((sum, f) => 
      sum + f.departments.reduce((deptSum, d) => deptSum + d.programs.length, 0), 0
    ) + standalone.length;

    console.log(`\n✅ Found:`);
    console.log(`   Faculties: ${totalFaculties}`);
    console.log(`   Departments: ${totalDepartments}`);
    console.log(`   Programs: ${totalPrograms}`);
    console.log(`   Standalone programs: ${standalone.length}`);

    return {
      faculties,
      standalonePrograms: standalone,
      stats: {
        totalFaculties,
        totalDepartments,
        totalPrograms,
        standaloneCount: standalone.length
      }
    };
  } catch (error) {
    console.error("Error fetching data:", error);
    throw error;
  } finally {
    await sql.end();
  }
}

// Run the script
fetchFacultiesDepartmentsPrograms()
  .then((data) => {
    const outputPath = path.join(process.cwd(), 'mock-programs.json');
    const jsonData = JSON.stringify(data, null, 2);
    
    fs.writeFileSync(outputPath, jsonData, 'utf-8');
    console.log(`\n✅ Successfully saved to ${outputPath}`);
    console.log(`\nStructure:`);
    console.log(`   - ${data.stats.totalFaculties} faculties`);
    console.log(`   - ${data.stats.totalDepartments} departments`);
    console.log(`   - ${data.stats.totalPrograms} total programs`);
    console.log(`   - ${data.stats.standaloneCount} standalone programs`);
    process.exit(0);
  })
  .catch((error) => {
    console.error("Failed to fetch data:", error);
    process.exit(1);
  });

