import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

// Read the Excel file
const excelPath = path.join(process.cwd(), 'public', 'database', 'Programs-Departments.xlsx');
const workbook = XLSX.readFile(excelPath);

// Get the first sheet
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

// Convert to JSON
const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });

console.log('Total rows:', data.length);
console.log('First few rows:');
console.log(data.slice(0, 5));

// Process the data to extract hierarchical structure
interface FacultyData {
  name: string;
  departments: {
    name: string;
    programs: string[];
  }[];
}

const faculties: Map<string, FacultyData> = new Map();

// Structure: Column 1 = Faculty (null when continuing same faculty), Column 2 = Department, Column 3 = Programs (newline-separated)
let currentFaculty = '';

// Skip header row (index 0)
for (let i = 1; i < data.length; i++) {
  const row = data[i] as any[];
  if (!row || row.length === 0) continue;

  // Get raw column values (preserving nulls)
  const col1 = row[0] !== null && row[0] !== undefined ? String(row[0]).trim() : '';
  const col2 = row[1] !== null && row[1] !== undefined ? String(row[1]).trim() : '';
  const col3 = row[2] !== null && row[2] !== undefined ? String(row[2]).trim() : '';

  // Skip rows without department (col2)
  if (!col2) continue;

  // If col1 has a value, it's a new faculty
  if (col1) {
    currentFaculty = col1;
    // Normalize faculty name (remove extra spaces)
    currentFaculty = currentFaculty.replace(/\s+/g, ' ').trim();
    
    if (!faculties.has(currentFaculty)) {
      faculties.set(currentFaculty, {
        name: currentFaculty,
        departments: []
      });
    }
  }

  // If no current faculty, skip this row
  if (!currentFaculty) continue;

  // Get the faculty object
  const faculty = faculties.get(currentFaculty)!;
  
  // Normalize department name
  const departmentName = col2.replace(/\s+/g, ' ').trim();
  
  // Find or create department
  let department = faculty.departments.find(d => d.name === departmentName);
  if (!department) {
    department = {
      name: departmentName,
      programs: []
    };
    faculty.departments.push(department);
  }

  // Parse programs from col3 (split by newlines)
  if (col3) {
    // Split by \r\n, \n, or \r
    const programs = col3
      .split(/\r\n|\n|\r/)
      .map(p => p.trim())
      .filter(p => p.length > 0);
    
    // Add each program (avoid duplicates)
    programs.forEach(program => {
      const normalizedProgram = program.replace(/\s+/g, ' ').trim();
      if (normalizedProgram && !department.programs.includes(normalizedProgram)) {
        department.programs.push(normalizedProgram);
      }
    });
  }
}

// Convert to the expected format
const facultyArray: FacultyData[] = Array.from(faculties.values());

console.log('\n\nExtracted Structure:');
console.log('Number of Faculties:', facultyArray.length);
facultyArray.forEach((faculty, idx) => {
  console.log(`\n${idx + 1}. ${faculty.name}`);
  console.log(`   Departments: ${faculty.departments.length}`);
  faculty.departments.forEach((dept, deptIdx) => {
    console.log(`   ${deptIdx + 1}. ${dept.name} (${dept.programs.length} programs)`);
    if (dept.programs.length > 0 && dept.programs.length <= 5) {
      dept.programs.forEach((prog, progIdx) => {
        console.log(`      ${progIdx + 1}. ${prog}`);
      });
    } else if (dept.programs.length > 5) {
      console.log(`      (showing first 3 of ${dept.programs.length})`);
      dept.programs.slice(0, 3).forEach((prog, progIdx) => {
        console.log(`      ${progIdx + 1}. ${prog}`);
      });
    }
  });
});

// Generate TypeScript code
const generateTypeScript = (faculties: FacultyData[]): string => {
  let code = `/**
 * Faculty, Department, and Programs Data Structure
 * 
 * This file contains the complete organizational structure for:
 * - Faculties
 * - Departments (organized by Faculty)
 * - Programs (organized by Faculty and Department)
 * 
 * Data is extracted from Programs-Departments.xlsx
 * Last updated: ${new Date().toISOString()}
 */

export type Program = {
  name: string;
  code?: string;
};

export type Department = {
  name: string;
  programs: Program[];
};

export type Faculty = {
  name: string;
  departments: Department[];
};

// Complete structure: Faculty -> Department -> Programs
export const facultyDepartmentPrograms: Faculty[] = [
`;

  faculties.forEach((faculty, fIdx) => {
    code += `  {\n    name: ${JSON.stringify(faculty.name)},\n    departments: [\n`;
    faculty.departments.forEach((dept, dIdx) => {
      code += `      {\n        name: ${JSON.stringify(dept.name)},\n        programs: [\n`;
      dept.programs.forEach((prog) => {
        code += `          { name: ${JSON.stringify(prog)} },\n`;
      });
      code += `        ],\n      }${dIdx < faculty.departments.length - 1 ? ',' : ''}\n`;
    });
    code += `    ],\n  }${fIdx < faculties.length - 1 ? ',' : ''}\n`;
  });

  code += `];

// Helper functions to get data
export function getFaculties(): string[] {
  return facultyDepartmentPrograms.map((f) => f.name);
}

export function getDepartmentsByFaculty(facultyName: string): string[] {
  const faculty = facultyDepartmentPrograms.find((f) => f.name === facultyName);
  return faculty ? faculty.departments.map((d) => d.name) : [];
}

export function getProgramsByFacultyAndDepartment(
  facultyName: string,
  departmentName: string
): string[] {
  const faculty = facultyDepartmentPrograms.find((f) => f.name === facultyName);
  if (!faculty) return [];
  
  const department = faculty.departments.find((d) => d.name === departmentName);
  return department ? department.programs.map((p) => p.name) : [];
}

// Export all programs as a flat list (for backward compatibility)
export function getAllPrograms(): string[] {
  const programs: string[] = [];
  facultyDepartmentPrograms.forEach((faculty) => {
    faculty.departments.forEach((department) => {
      department.programs.forEach((program) => {
        if (!programs.includes(program.name)) {
          programs.push(program.name);
        }
      });
    });
  });
  return programs.sort();
}
`;

  return code;
};

const tsCode = generateTypeScript(facultyArray);

// Write to file
const outputPath = path.join(process.cwd(), 'src', 'data', 'programs-departments.ts');
fs.writeFileSync(outputPath, tsCode, 'utf-8');

console.log('\n\n✅ Successfully generated programs-departments.ts');
console.log(`Output: ${outputPath}`);
console.log(`\nTotal Faculties: ${facultyArray.length}`);
console.log(`Total Departments: ${facultyArray.reduce((sum, f) => sum + f.departments.length, 0)}`);
console.log(`Total Programs: ${facultyArray.reduce((sum, f) => sum + f.departments.reduce((s, d) => s + d.programs.length, 0), 0)}`);
