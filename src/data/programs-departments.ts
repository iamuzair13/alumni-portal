/**
 * Faculty, Department, and Programs Data Structure
 * 
 * This file contains the complete organizational structure for:
 * - Faculties
 * - Departments (organized by Faculty)
 * - Programs (organized by Faculty and Department)
 * 
 * Data is extracted from Programs-Departments.xlsx
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
  {
    name: "Faculty of Arts & Architecture",
    departments: [
      {
        name: "School of Architecture",
        programs: [
          { name: "BS Architecture" },
          { name: "MS Architecture" },
          { name: "PhD Architecture" },
        ],
      },
      {
        name: "School of Creative Arts",
        programs: [
          { name: "BS Creative Arts" },
          { name: "BA Creative Arts" },
          { name: "MA Creative Arts" },
        ],
      },
      {
        name: "School of Fashion & Textiles",
        programs: [
          { name: "BS Fashion & Textiles" },
          { name: "MS Fashion & Textiles" },
        ],
      },
    ],
  },
  {
    name: "Faculty of Engineering & Technology",
    departments: [
      {
        name: "Department of Electrical Engineering",
        programs: [
          { name: "BS Electrical Engineering" },
          { name: "MS Electrical Engineering" },
          { name: "PhD Electrical Engineering" },
        ],
      },
      {
        name: "Department of Mechanical Engineering",
        programs: [
          { name: "BS Mechanical Engineering" },
          { name: "MS Mechanical Engineering" },
          { name: "PhD Mechanical Engineering" },
        ],
      },
      {
        name: "Department of Civil Engineering",
        programs: [
          { name: "BS Civil Engineering" },
          { name: "MS Civil Engineering" },
          { name: "PhD Civil Engineering" },
        ],
      },
      {
        name: "Department of Computer Engineering",
        programs: [
          { name: "BS Computer Engineering" },
          { name: "MS Computer Engineering" },
          { name: "PhD Computer Engineering" },
        ],
      },
      {
        name: "Department of Technology",
        programs: [
          { name: "BS Technology" },
          { name: "MS Technology" },
        ],
      },
    ],
  },
  {
    name: "Faculty of Allied Health Sciences",
    departments: [
      {
        name: "University Institute of Radiological Sciences & Medical Imaging Technology",
        programs: [
          { name: "BS Radiological Sciences" },
          { name: "MS Radiological Sciences" },
        ],
      },
      {
        name: "University Institute of Physical Therapy",
        programs: [
          { name: "BS Physical Therapy" },
          { name: "DPT Physical Therapy" },
          { name: "MS Physical Therapy" },
        ],
      },
      {
        name: "Department of Sports Sciences and Physical Education",
        programs: [
          { name: "BS Sports Sciences" },
          { name: "MS Sports Sciences" },
        ],
      },
      {
        name: "University Institute of Diet & Nutritional Sciences",
        programs: [
          { name: "BS Diet & Nutritional Sciences" },
          { name: "MS Diet & Nutritional Sciences" },
        ],
      },
      {
        name: "University Institute of Food Science & Technology",
        programs: [
          { name: "BS Food Science & Technology" },
          { name: "MS Food Science & Technology" },
        ],
      },
      {
        name: "University Institute of Medical Lab Technology",
        programs: [
          { name: "BS Medical Lab Technology" },
          { name: "MS Medical Lab Technology" },
        ],
      },
      {
        name: "University Institute of Public Health",
        programs: [
          { name: "BS Public Health" },
          { name: "MPH Public Health" },
          { name: "MS Public Health" },
        ],
      },
      {
        name: "Department of Health Professional Technologies",
        programs: [
          { name: "BS Health Professional Technologies" },
        ],
      },
      {
        name: "Department of Optometry & Vision Sciences",
        programs: [
          { name: "BS Optometry" },
          { name: "MS Optometry" },
        ],
      },
      {
        name: "Department of Emerging Allied Health Technologies",
        programs: [
          { name: "BS Emerging Allied Health Technologies" },
        ],
      },
      {
        name: "Department of Rehabilitation Sciences",
        programs: [
          { name: "BS Rehabilitation Sciences" },
          { name: "MS Rehabilitation Sciences" },
        ],
      },
      {
        name: "Lahore School of Nursing",
        programs: [
          { name: "BS Nursing" },
          { name: "MS Nursing" },
        ],
      },
      {
        name: "Department of Audiology",
        programs: [
          { name: "BS Audiology" },
          { name: "MS Audiology" },
        ],
      },
    ],
  },
  {
    name: "Faculty of Information Technology",
    departments: [
      {
        name: "Department of Computer Science & Information Technology",
        programs: [
          { name: "BS Computer Science" },
          { name: "BS Information Technology" },
          { name: "MS Computer Science" },
          { name: "MS Information Technology" },
          { name: "PhD Computer Science" },
        ],
      },
      {
        name: "Department of Software Engineering",
        programs: [
          { name: "BS Software Engineering" },
          { name: "MS Software Engineering" },
          { name: "PhD Software Engineering" },
        ],
      },
      {
        name: "Department of Intelligent Systems",
        programs: [
          { name: "BS Intelligent Systems" },
          { name: "MS Intelligent Systems" },
          { name: "PhD Intelligent Systems" },
        ],
      },
    ],
  },
  {
    name: "Faculty of Management Sciences",
    departments: [
      {
        name: "Lahore Business School",
        programs: [
          { name: "BBA" },
          { name: "MBA" },
          { name: "EMBA" },
          { name: "MS Business Administration" },
          { name: "PhD Business Administration" },
        ],
      },
      {
        name: "Department of Economics",
        programs: [
          { name: "BS Economics" },
          { name: "MS Economics" },
          { name: "PhD Economics" },
        ],
      },
      {
        name: "Lahore School of Aviation",
        programs: [
          { name: "BS Aviation Management" },
          { name: "MS Aviation Management" },
        ],
      },
      {
        name: "Department of Information Management",
        programs: [
          { name: "BS Information Management" },
          { name: "MS Information Management" },
        ],
      },
    ],
  },
  {
    name: "Faculty of Social Sciences",
    departments: [
      {
        name: "Department of Islamic Studies",
        programs: [
          { name: "BA Islamic Studies" },
          { name: "MA Islamic Studies" },
          { name: "PhD Islamic Studies" },
        ],
      },
      {
        name: "Lahore School of Behavioural Sciences",
        programs: [
          { name: "BS Psychology" },
          { name: "MS Psychology" },
          { name: "PhD Psychology" },
        ],
      },
      {
        name: "School of Integrated Social Sciences",
        programs: [
          { name: "BS Integrated Social Sciences" },
          { name: "MS Integrated Social Sciences" },
        ],
      },
      {
        name: "Department of Education",
        programs: [
          { name: "B.Ed" },
          { name: "M.Ed" },
          { name: "MS Education" },
          { name: "PhD Education" },
        ],
      },
      {
        name: "Department of Sociology",
        programs: [
          { name: "BS Sociology" },
          { name: "MS Sociology" },
          { name: "PhD Sociology" },
        ],
      },
      {
        name: "Department of Criminology",
        programs: [
          { name: "BS Criminology" },
          { name: "MS Criminology" },
        ],
      },
    ],
  },
  {
    name: "Faculty of Medicine & Dentistry",
    departments: [
      {
        name: "University College of Medicine and Dentistry",
        programs: [
          { name: "MBBS" },
          { name: "BDS" },
          { name: "MD" },
          { name: "MS Medicine" },
          { name: "PhD Medicine" },
        ],
      },
      {
        name: "Institute of Postgraduate Medical Sciences",
        programs: [
          { name: "FCPS" },
          { name: "MRCP" },
          { name: "FRCS" },
        ],
      },
      {
        name: "University Institute of Health Professions Education and Research",
        programs: [
          { name: "MS Health Professions Education" },
          { name: "PhD Health Professions Education" },
        ],
      },
      {
        name: "Centre for Health Professionals Development & Lifelong Learning",
        programs: [
          { name: "Certificate Programs" },
          { name: "Diploma Programs" },
        ],
      },
      {
        name: "Dental Paramedical School",
        programs: [
          { name: "Diploma Dental Technology" },
          { name: "BS Dental Technology" },
        ],
      },
    ],
  },
  {
    name: "Faculty of Sciences",
    departments: [
      {
        name: "Department of Physics",
        programs: [
          { name: "BS Physics" },
          { name: "MS Physics" },
          { name: "PhD Physics" },
        ],
      },
      {
        name: "Department of Chemistry",
        programs: [
          { name: "BS Chemistry" },
          { name: "MS Chemistry" },
          { name: "PhD Chemistry" },
        ],
      },
      {
        name: "Department of Environmental Sciences",
        programs: [
          { name: "BS Environmental Sciences" },
          { name: "MS Environmental Sciences" },
          { name: "PhD Environmental Sciences" },
        ],
      },
      {
        name: "Department of Mathematics and Statistics",
        programs: [
          { name: "BS Mathematics" },
          { name: "BS Statistics" },
          { name: "MS Mathematics" },
          { name: "MS Statistics" },
          { name: "PhD Mathematics" },
          { name: "PhD Statistics" },
        ],
      },
      {
        name: "Institute of Molecular Biology & Biotechnology",
        programs: [
          { name: "BS Molecular Biology" },
          { name: "BS Biotechnology" },
          { name: "MS Molecular Biology" },
          { name: "MS Biotechnology" },
          { name: "PhD Molecular Biology" },
          { name: "PhD Biotechnology" },
        ],
      },
      {
        name: "School of Pain and Regenerative Medicine",
        programs: [
          { name: "MS Pain Medicine" },
          { name: "PhD Regenerative Medicine" },
        ],
      },
    ],
  },
  {
    name: "Faculty of Pharmacy",
    departments: [
      {
        name: "Department of Pharmacy",
        programs: [
          { name: "Pharm-D" },
          { name: "BS Pharmacy" },
          { name: "MS Pharmacy" },
          { name: "PhD Pharmacy" },
        ],
      },
    ],
  },
  {
    name: "Faculty of Law",
    departments: [
      {
        name: "M.A. Raoof College of Law",
        programs: [
          { name: "LLB" },
          { name: "LLM" },
          { name: "PhD Law" },
        ],
      },
    ],
  },
  {
    name: "Faculty of Languages & Literature",
    departments: [
      {
        name: "Department of English Language & Literature",
        programs: [
          { name: "BA English" },
          { name: "MA English" },
          { name: "MS English" },
          { name: "PhD English" },
        ],
      },
      {
        name: "Department of Urdu",
        programs: [
          { name: "BA Urdu" },
          { name: "MA Urdu" },
          { name: "PhD Urdu" },
        ],
      },
    ],
  },
  {
    name: "International Qualifications",
    departments: [
      {
        name: "Department of International Qualifications",
        programs: [
          { name: "International Programs" },
          { name: "Exchange Programs" },
        ],
      },
    ],
  },
  {
    name: "Centre for Microcredential-Based Skill Development",
    departments: [
      {
        name: "Microcredential-Based Skill Development Centre",
        programs: [
          { name: "Microcredential Programs" },
          { name: "Skill Development Certificates" },
        ],
      },
    ],
  },
];

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

