/**
 * Faculty, Department, and Programs Data Structure
 * 
 * This file loads the complete organizational structure from mock-programs.json
 * Structure: Faculty -> Department -> Programs
 * 
 * Data is extracted from the database and stored in mock-programs.json
 * Last updated: Based on actual database structure
 */

import programsData from "../../mock-programs.json";

type ProgramData = {
  faculties: Array<{
    faculty: string;
    departments: Array<{
      department: string;
      programs: Array<{
        program: string;
        count: number;
      }>;
    }>;
  }>;
  standalonePrograms: Array<{
    program: string;
    count: number;
  }>;
  stats: {
    totalFaculties: number;
    totalDepartments: number;
    totalPrograms: number;
    standaloneCount: number;
  };
};

const data = programsData as ProgramData;

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

// Convert mock-programs.json structure to the expected format
export const facultyDepartmentPrograms: Faculty[] = data.faculties.map((facultyData) => ({
  name: facultyData.faculty,
  departments: facultyData.departments.map((deptData) => ({
    name: deptData.department,
    programs: deptData.programs.map((progData) => ({
      name: progData.program,
    })),
  })),
}));

// Helper functions to get data
export function getFaculties(): string[] {
  return data.faculties.map((f) => f.faculty).sort();
}

export function getDepartmentsByFaculty(facultyName: string): string[] {
  if (!facultyName || !facultyName.trim()) return [];
  
  const normalizedSearch = facultyName.toLowerCase().trim();
  const faculty = data.faculties.find(
    (f) => f.faculty.toLowerCase().trim() === normalizedSearch
  );
  if (!faculty) return [];
  
  return faculty.departments.map((d) => d.department).sort();
}

export function getProgramsByFacultyAndDepartment(
  facultyName: string,
  departmentName: string
): string[] {
  if (!facultyName || !facultyName.trim() || !departmentName || !departmentName.trim()) {
    return [];
  }
  
  const normalizedFaculty = facultyName.toLowerCase().trim();
  const normalizedDept = departmentName.toLowerCase().trim();
  
  const faculty = data.faculties.find(
    (f) => f.faculty.toLowerCase().trim() === normalizedFaculty
  );
  if (!faculty) return [];
  
  const department = faculty.departments.find(
    (d) => d.department.toLowerCase().trim() === normalizedDept
  );
  if (!department) return [];
  
  return department.programs.map((p) => p.program).sort();
}

// Get all programs for a faculty (across all departments)
export function getProgramsByFaculty(facultyName: string): string[] {
  const faculty = data.faculties.find(
    (f) => f.faculty.toLowerCase().trim() === facultyName.toLowerCase().trim()
  );
  if (!faculty) return [];
  
  const programsSet = new Set<string>();
  faculty.departments.forEach((dept) => {
    dept.programs.forEach((prog) => {
      programsSet.add(prog.program);
    });
  });
  
  return Array.from(programsSet).sort();
}

// Get all departments (across all faculties)
export function getAllDepartments(): string[] {
  const departmentsSet = new Set<string>();
  data.faculties.forEach((faculty) => {
    faculty.departments.forEach((dept) => {
      departmentsSet.add(dept.department);
    });
  });
  return Array.from(departmentsSet).sort();
}

// Export all programs as a flat list (for backward compatibility)
export function getAllPrograms(): string[] {
  const programsSet = new Set<string>();
  
  // Add programs from faculties
  data.faculties.forEach((faculty) => {
    faculty.departments.forEach((department) => {
      department.programs.forEach((program) => {
        programsSet.add(program.program);
      });
    });
  });
  
  // Add standalone programs
  data.standalonePrograms.forEach((prog) => {
    programsSet.add(prog.program);
  });
  
  return Array.from(programsSet).sort();
}

// Get faculty for a given department (useful for validation)
export function getFacultyByDepartment(departmentName: string): string | null {
  for (const faculty of data.faculties) {
    const dept = faculty.departments.find(
      (d) => d.department.toLowerCase().trim() === departmentName.toLowerCase().trim()
    );
    if (dept) {
      return faculty.faculty;
    }
  }
  return null;
}

// Get faculty and department for a given program (useful for validation)
export function getFacultyAndDepartmentByProgram(programName: string): {
  faculty: string | null;
  department: string | null;
} {
  for (const faculty of data.faculties) {
    for (const department of faculty.departments) {
      const program = department.programs.find(
        (p) => p.program.toLowerCase().trim() === programName.toLowerCase().trim()
      );
      if (program) {
        return {
          faculty: faculty.faculty,
          department: department.department,
        };
      }
    }
  }
  
  // Check standalone programs (they don't have faculty/department)
  const standalone = data.standalonePrograms.find(
    (p) => p.program.toLowerCase().trim() === programName.toLowerCase().trim()
  );
  if (standalone) {
    return { faculty: null, department: null };
  }
  
  return { faculty: null, department: null };
}

// Validate that a program belongs to a specific faculty and department
export function validateProgramAssignment(
  facultyName: string,
  departmentName: string,
  programName: string
): boolean {
  const faculty = data.faculties.find(
    (f) => f.faculty.toLowerCase().trim() === facultyName.toLowerCase().trim()
  );
  if (!faculty) return false;
  
  const department = faculty.departments.find(
    (d) => d.department.toLowerCase().trim() === departmentName.toLowerCase().trim()
  );
  if (!department) return false;
  
  return department.programs.some(
    (p) => p.program.toLowerCase().trim() === programName.toLowerCase().trim()
  );
}
