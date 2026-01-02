import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

// Interface definitions
interface Program {
  abbreviation: string;
  name: string;
}

interface Department {
  name: string;
  code: string;
  programs: Program[];
}

interface Faculty {
  name: string;
  departments: Department[];
}

// Read the Excel file
const excelPath = path.join(process.cwd(), 'src', 'PGM Master Data (1).xlsx');
const workbook = XLSX.readFile(excelPath);

// Get the first sheet
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

// Convert to JSON (array of arrays)
const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null }) as any[][];

console.log('Total rows:', data.length);

// Skip header row (index 0)
const rows = data.slice(1);

// Data structure to hold hierarchical data
const facultiesMap = new Map<string, Faculty>();

// Process each row
rows.forEach((row) => {
  if (!row || row.length < 5) return;

  const programAbbr = String(row[0] || '').trim();
  const programName = String(row[1] || '').trim();
  const deptCode = String(row[2] || '').trim();
  const deptName = String(row[3] || '').trim();
  const facultyName = String(row[4] || '').trim();

  // Skip rows with missing essential data
  if (!facultyName || !deptName || !deptCode || !programAbbr) {
    return;
  }

  // Get or create faculty
  let faculty = facultiesMap.get(facultyName);
  if (!faculty) {
    faculty = {
      name: facultyName,
      departments: []
    };
    facultiesMap.set(facultyName, faculty);
  }

  // Find or create department
  let department = faculty.departments.find(d => d.name === deptName && d.code === deptCode);
  if (!department) {
    department = {
      name: deptName,
      code: deptCode,
      programs: []
    };
    faculty.departments.push(department);
  }

  // Add program if it doesn't exist
  const programExists = department.programs.some(p => p.abbreviation === programAbbr);
  if (!programExists) {
    department.programs.push({
      abbreviation: programAbbr,
      name: programName
    });
  }
});

// Convert map to array for easier processing
const faculties = Array.from(facultiesMap.values());

console.log('\n📊 Data Structure Summary:');
console.log(`Total Faculties: ${faculties.length}`);
faculties.forEach((faculty, idx) => {
  const totalPrograms = faculty.departments.reduce((sum, dept) => sum + dept.programs.length, 0);
  console.log(`  ${idx + 1}. ${faculty.name}: ${faculty.departments.length} departments, ${totalPrograms} programs`);
});

// Generate CSV content
function generateCSV(): string {
  const lines: string[] = [];
  
  // CSV Header
  lines.push('Faculty,Department Code,Department,Program Abbreviation,Program Name');
  
  // For each faculty
  faculties.forEach((faculty) => {
    // For each department in this faculty
    faculty.departments.forEach((department) => {
      // For each program in this department
      department.programs.forEach((program) => {
        // Escape commas and quotes in CSV values
        const escapeCSV = (value: string): string => {
          if (value.includes(',') || value.includes('"') || value.includes('\n')) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        };
        
        lines.push([
          escapeCSV(faculty.name),
          escapeCSV(department.code),
          escapeCSV(department.name),
          escapeCSV(program.abbreviation),
          escapeCSV(program.name)
        ].join(','));
      });
    });
  });
  
  return lines.join('\n');
}

// Write CSV file
const csvContent = generateCSV();
const outputPath = path.join(process.cwd(), 'src', 'PGM_Master_Data_Structured.csv');
fs.writeFileSync(outputPath, csvContent, 'utf-8');

console.log(`\n✅ Successfully created structured CSV file!`);
console.log(`Output: ${outputPath}`);

// Also create a more detailed summary file
const summaryLines: string[] = [];
summaryLines.push('=== FACULTY, DEPARTMENT, AND PROGRAM STRUCTURE ===\n');

faculties.forEach((faculty, fIdx) => {
  summaryLines.push(`\n${fIdx + 1}. FACULTY: ${faculty.name}`);
  summaryLines.push(`   Total Departments: ${faculty.departments.length}`);
  summaryLines.push(`   Total Programs: ${faculty.departments.reduce((sum, dept) => sum + dept.programs.length, 0)}`);
  
  faculty.departments.forEach((dept, dIdx) => {
    summaryLines.push(`\n   ${fIdx + 1}.${dIdx + 1}. DEPARTMENT: ${dept.name} (Code: ${dept.code})`);
    summaryLines.push(`      Programs: ${dept.programs.length}`);
    
    dept.programs.forEach((prog, pIdx) => {
      summaryLines.push(`      ${fIdx + 1}.${dIdx + 1}.${pIdx + 1}. ${prog.abbreviation} - ${prog.name}`);
    });
  });
});

const summaryPath = path.join(process.cwd(), 'src', 'PGM_Master_Data_Summary.txt');
fs.writeFileSync(summaryPath, summaryLines.join('\n'), 'utf-8');
console.log(`Summary: ${summaryPath}`);

// Print final statistics
console.log('\n📈 Final Statistics:');
console.log(`   Faculties: ${faculties.length}`);
console.log(`   Departments: ${faculties.reduce((sum, f) => sum + f.departments.length, 0)}`);
console.log(`   Programs: ${faculties.reduce((sum, f) => sum + f.departments.reduce((s, d) => s + d.programs.length, 0), 0)}`);
