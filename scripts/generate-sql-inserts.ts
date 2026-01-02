import * as fs from 'fs';
import * as path from 'path';

// Read the CSV file
const csvPath = path.join(process.cwd(), 'src', 'PGM_Master_Data_Structured.csv');
const csvContent = fs.readFileSync(csvPath, 'utf-8');
const lines = csvContent.split('\n').filter(line => line.trim());

// Skip header
const dataLines = lines.slice(1);

// Parse CSV data - handles quoted values with commas
interface RowData {
  faculty: string;
  deptCode: string;
  department: string;
  progAbbr: string;
  program: string;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

const rows: RowData[] = [];
dataLines.forEach(line => {
  const parts = parseCSVLine(line);
  if (parts.length >= 5) {
    rows.push({
      faculty: parts[0],
      deptCode: parts[1],
      department: parts[2],
      progAbbr: parts[3],
      program: parts[4]
    });
  }
});

// Get unique faculties
const faculties = [...new Set(rows.map(r => r.faculty))].sort();

// Get unique departments (by faculty + name only, since constraint is on faculty_id + department_name)
// Keep the first department_code encountered for each (faculty, department_name) pair
const departmentsMap = new Map<string, { faculty: string; code: string; name: string }>();
rows.forEach(row => {
  // Use faculty + department_name as key (matches the unique constraint)
  const key = `${row.faculty}|${row.department}`;
  if (!departmentsMap.has(key)) {
    departmentsMap.set(key, {
      faculty: row.faculty,
      code: row.deptCode,
      name: row.department
    });
  }
});
const departments = Array.from(departmentsMap.values());

// Generate SQL
const sqlLines: string[] = [];

sqlLines.push('-- =====================================================');
sqlLines.push('-- SQL Script to Insert Faculties, Departments, and Programs');
sqlLines.push('-- Generated from PGM_Master_Data_Structured.csv');
sqlLines.push(`-- Generated on: ${new Date().toISOString()}`);
sqlLines.push('-- =====================================================\n');

// Escape SQL strings (replace single quotes with double single quotes)
const escapeSQL = (str: string): string => {
  if (!str) return '';
  return str.replace(/'/g, "''");
};

// STEP 1: Insert Faculties
sqlLines.push('-- STEP 1: Insert Faculties');
sqlLines.push('INSERT INTO public.tbl_faculties (faculty_name)');
sqlLines.push('VALUES');
sqlLines.push(faculties.map((f, idx) => {
  const escaped = escapeSQL(f);
  return `  ('${escaped}')${idx < faculties.length - 1 ? ',' : ''}`;
}).join('\n'));
sqlLines.push('ON CONFLICT DO NOTHING;\n\n');

// STEP 2: Insert Departments
sqlLines.push('-- STEP 2: Insert Departments with their Faculty IDs');
sqlLines.push('WITH faculty_ids AS (');
sqlLines.push('  SELECT id, faculty_name FROM public.tbl_faculties');
sqlLines.push(')');
sqlLines.push('INSERT INTO public.tbl_departments (department_name, faculty_id, department_code)');
sqlLines.push('SELECT DISTINCT');
sqlLines.push('  dept.department_name,');
sqlLines.push('  f.id as faculty_id,');
sqlLines.push('  dept.department_code');
sqlLines.push('FROM (VALUES');
sqlLines.push(departments.map((d, idx) => {
  const facultyEscaped = escapeSQL(d.faculty);
  const codeEscaped = escapeSQL(d.code);
  const nameEscaped = escapeSQL(d.name);
  return `    ('${facultyEscaped}', '${codeEscaped}', '${nameEscaped}')${idx < departments.length - 1 ? ',' : ''}`;
}).join('\n'));
sqlLines.push(') AS dept(faculty_name, department_code, department_name)');
sqlLines.push('INNER JOIN faculty_ids f ON f.faculty_name = dept.faculty_name');
sqlLines.push('ON CONFLICT ON CONSTRAINT uniq_department_faculty DO NOTHING;\n\n');

// STEP 3: Insert Programs
sqlLines.push('-- STEP 3: Insert Programs with their Department IDs');
sqlLines.push('WITH department_ids AS (');
sqlLines.push('  SELECT d.id, d.department_name, d.department_code, f.faculty_name');
sqlLines.push('  FROM public.tbl_departments d');
sqlLines.push('  INNER JOIN public.tbl_faculties f ON f.id = d.faculty_id');
sqlLines.push(')');
sqlLines.push('INSERT INTO public.tbl_programs (program_name, department_id, program_abv)');
sqlLines.push('SELECT');
sqlLines.push('  prog.program_name,');
sqlLines.push('  d.id as department_id,');
sqlLines.push('  prog.program_abv');
sqlLines.push('FROM (VALUES');
sqlLines.push(rows.map((r, idx) => {
  const facultyEscaped = escapeSQL(r.faculty);
  const codeEscaped = escapeSQL(r.deptCode);
  const deptEscaped = escapeSQL(r.department);
  const progEscaped = escapeSQL(r.program);
  const abbrEscaped = escapeSQL(r.progAbbr);
  return `    ('${facultyEscaped}', '${codeEscaped}', '${deptEscaped}', '${progEscaped}', '${abbrEscaped}')${idx < rows.length - 1 ? ',' : ''}`;
}).join('\n'));
sqlLines.push(') AS prog(faculty_name, department_code, department_name, program_name, program_abv)');
sqlLines.push('INNER JOIN department_ids d ON d.faculty_name = prog.faculty_name');
sqlLines.push('  AND d.department_name = prog.department_name');
sqlLines.push('ON CONFLICT (department_id, program_name) DO NOTHING;');

// Write SQL file
const sqlContent = sqlLines.join('\n');
const sqlPath = path.join(process.cwd(), 'src', 'insert_faculties_departments_programs.sql');
fs.writeFileSync(sqlPath, sqlContent, 'utf-8');

console.log(`\n✅ Successfully generated SQL file!`);
console.log(`Output: ${sqlPath}`);
console.log(`\nStatistics:`);
console.log(`  Faculties: ${faculties.length}`);
console.log(`  Departments: ${departments.length}`);
console.log(`  Programs: ${rows.length}`);

