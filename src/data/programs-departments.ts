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

type ProgramCountEntry = { program: string; count?: number };

/**
 * Supported JSON shapes:
 * - v1 (old): { faculties: [{ faculty, departments: [{ department, programs: [{program, count}]}]}], standalonePrograms, stats }
 * - v2 (new): [{ faculty, departments: [{ department, programs: [string] }]}]
 */
type ProgramDataV1 = {
  faculties: Array<{
    faculty: string;
    departments: Array<{
      department: string;
      programs: Array<ProgramCountEntry>;
    }>;
  }>;
  standalonePrograms?: Array<ProgramCountEntry>;
  stats?: {
    totalFaculties: number;
    totalDepartments: number;
    totalPrograms: number;
    standaloneCount: number;
  };
};

type NormalizedProgramData = Required<Pick<ProgramDataV1, "faculties">> &
  Required<Pick<ProgramDataV1, "standalonePrograms">> &
  Required<Pick<ProgramDataV1, "stats">>;

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function normalizeProgramEntry(p: unknown): ProgramCountEntry | null {
  if (typeof p === "string") {
    const s = p.trim();
    return s ? { program: s, count: 0 } : null;
  }
  if (isRecord(p) && typeof p.program === "string") {
    const s = p.program.trim();
    if (!s) return null;
    const count = typeof p.count === "number" ? p.count : 0;
    return { program: s, count };
  }
  return null;
}

function normalizeProgramsData(raw: unknown): NormalizedProgramData {
  // v2 array shape
  if (Array.isArray(raw)) {
    const faculties = raw
      .filter((f): f is { faculty: string; departments: Array<{ department: string; programs: string[] }> } => {
        return (
          isRecord(f) &&
          typeof f.faculty === "string" &&
          Array.isArray(f.departments)
        );
      })
      .map((f) => ({
        faculty: f.faculty,
        departments: (f.departments ?? [])
          .filter((d): d is { department: string; programs: string[] } => {
            return isRecord(d) && typeof d.department === "string" && Array.isArray(d.programs);
          })
          .map((d) => ({
            department: d.department,
            programs: (d.programs ?? [])
              .map((p) => normalizeProgramEntry(p))
              .filter((x): x is ProgramCountEntry => !!x),
          })),
      }));

    const totalFaculties = faculties.length;
    const totalDepartments = faculties.reduce((acc, f) => acc + f.departments.length, 0);
    const totalPrograms = faculties.reduce(
      (acc, f) => acc + f.departments.reduce((a, d) => a + d.programs.length, 0),
      0
    );

    return {
      faculties,
      standalonePrograms: [],
      stats: {
        totalFaculties,
        totalDepartments,
        totalPrograms,
        standaloneCount: 0,
      },
    };
  }

  // v1 object shape
  if (isRecord(raw) && Array.isArray(raw.faculties)) {
    const v1 = raw as ProgramDataV1;
    const faculties = (v1.faculties ?? []).map((f) => ({
      faculty: String(f.faculty ?? ""),
      departments: (f.departments ?? []).map((d) => ({
        department: String(d.department ?? ""),
        programs: (d.programs ?? [])
          .map((p) => normalizeProgramEntry(p))
          .filter((x): x is ProgramCountEntry => !!x),
      })),
    }));
    const standalonePrograms = (v1.standalonePrograms ?? [])
      .map((p) => normalizeProgramEntry(p))
      .filter((x): x is ProgramCountEntry => !!x);

    const totalFaculties = faculties.length;
    const totalDepartments = faculties.reduce((acc, f) => acc + f.departments.length, 0);
    const totalPrograms = faculties.reduce(
      (acc, f) => acc + f.departments.reduce((a, d) => a + d.programs.length, 0),
      0
    );

    return {
      faculties,
      standalonePrograms,
      stats: v1.stats ?? {
        totalFaculties,
        totalDepartments,
        totalPrograms: totalPrograms + standalonePrograms.length,
        standaloneCount: standalonePrograms.length,
      },
    };
  }

  // fallback empty
  return {
    faculties: [],
    standalonePrograms: [],
    stats: { totalFaculties: 0, totalDepartments: 0, totalPrograms: 0, standaloneCount: 0 },
  };
}

const normalized = normalizeProgramsData(programsData as unknown);

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
export const facultyDepartmentPrograms: Faculty[] = normalized.faculties.map((facultyData) => ({
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
  return normalized.faculties.map((f) => f.faculty).sort();
}

export function getDepartmentsByFaculty(facultyName: string): string[] {
  if (!facultyName || !facultyName.trim()) return [];
  
  const normalizedSearch = facultyName.toLowerCase().trim();
  const faculty = normalized.faculties.find(
    (f) => f.faculty.toLowerCase().trim() === normalizedSearch
  );
  if (!faculty) return [];
  
  // Map all departments and deduplicate (in case of duplicates in JSON)
  const departmentsSet = new Set<string>();
  faculty.departments.forEach((d) => {
    if (d.department && d.department.trim()) {
      departmentsSet.add(d.department.trim());
    }
  });
  
  return Array.from(departmentsSet).sort();
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
  
  const faculty = normalized.faculties.find(
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
  const faculty = normalized.faculties.find(
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
  normalized.faculties.forEach((faculty) => {
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
  normalized.faculties.forEach((faculty) => {
    faculty.departments.forEach((department) => {
      department.programs.forEach((program) => {
        programsSet.add(program.program);
      });
    });
  });
  
  // Add standalone programs
  normalized.standalonePrograms.forEach((prog) => {
    programsSet.add(prog.program);
  });
  
  return Array.from(programsSet).sort();
}

// Get faculty for a given department (useful for validation)
export function getFacultyByDepartment(departmentName: string): string | null {
  for (const faculty of normalized.faculties) {
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
  for (const faculty of normalized.faculties) {
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
  const standalone = normalized.standalonePrograms.find(
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
  const faculty = normalized.faculties.find(
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
