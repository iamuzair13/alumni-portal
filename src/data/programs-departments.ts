/**
 * Faculty, Department, and Programs Data Structure
 * 
 * This file contains the complete organizational structure for:
 * - Faculties
 * - Departments (organized by Faculty)
 * - Programs (organized by Faculty and Department)
 * 
 * Data is extracted from Programs-Departments.xlsx
 * Last updated: 2025-11-25T05:52:43.923Z
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
    name: "Faculty of Alllied health sciences",
    departments: [
      {
        name: "University Institute of Radiological Sciences & Medical Imaging Technology",
        programs: [
          { name: "BS Radiography and Imaging Technology" },
          { name: "BS Medical Ultrasound Technology" },
          { name: "MS Diagnostic Ultrasound" },
          { name: "MS Medical Imaging Technology" },
          { name: "PhD Diagnostic Ultrasound" },
          { name: "PhD Medical Imaging Technology" },
        ],
      },
      {
        name: "University Institute of Physical Therapy",
        programs: [
          { name: "Doctor of Physical Therapy" },
          { name: "MS Physical Therapy Neurology" },
          { name: "MPhil Physical Therapy Musculo Skeleton" },
          { name: "MS Physical Therapy Sports" },
          { name: "MS Physical Therapy paediatric" },
          { name: "MS Physical Therapy Geriatric" },
          { name: "MS Physical Therapy Cardiopulmonary" },
          { name: "MS Physical Therapy Women's Health" },
          { name: "PhD Physical Therapy" },
        ],
      },
      {
        name: "Department of Sports Sciences and Physical Education",
        programs: [
          { name: "BS Sport Sciences and Physical education" },
          { name: "MPhil Sport Sciences" },
          { name: "PhD Sport Sciences" },
        ],
      },
      {
        name: "University Institute of Diet & Nutritional Sciences",
        programs: [
          { name: "BS Human Nutrition and Dietetics" },
          { name: "MPhil Human Nutrition and Dietetics" },
          { name: "PhD Human Nutrition and Dietetics" },
        ],
      },
      {
        name: "University Institute of Food Science & Technology",
        programs: [
          { name: "BS Food Science and Technology" },
          { name: "BS Meat Technology" },
          { name: "BS Food Safety and Quality Management" },
          { name: "BS Dairy Technology" },
          { name: "MS Food Science and Technology" },
          { name: "PhD Food Science and Technology" },
        ],
      },
      {
        name: "University Institute of Medical Lab Technology",
        programs: [
          { name: "BS Medical Laboratory and Technology" },
          { name: "BS Blood Banking Technology" },
          { name: "MPhil Immunology and Molecular Pathology" },
          { name: "MPhil Virology and Molecular Pathology" },
          { name: "PhD Immunology and Molecular Pathology" },
          { name: "PhD Virology and Molecular Pathology" },
        ],
      },
      {
        name: "University Institute of Public Health",
        programs: [
          { name: "Bachelor of Science Pubic Health" },
          { name: "Bachelor of Science Biostatistics" },
          { name: "Master of Public Health" },
          { name: "Master of Philosophy Public Health" },
          { name: "PhD Public Health" },
          { name: "Post Graduate Diploma in Maternal and Child Health" },
          { name: "Post Graduate Diploma in Occupational Health and Safety" },
        ],
      },
      {
        name: "Department of Health Professional Technologies",
        programs: [
          { name: "BS Surgical Technology" },
          { name: "BS Respiratory Therapy" },
          { name: "BS Operation Theatre Technology" },
          { name: "BS Emergency and Intensive care technology" },
          { name: "BS Anesthesia Technology" },
        ],
      },
      {
        name: "Department of Optometry & Vision Sciences",
        programs: [
          { name: "BS Vision Sciences" },
        ],
      },
      {
        name: "Department of Emerging Allied Health Technologies",
        programs: [
          { name: "BS Cardiac Perfusion Technology" },
          { name: "BS Renal Dialysis Technology" },
          { name: "BS Cardiovascular Technology" },
          { name: "BS Dermatology Technology" },
          { name: "BS Neurophysiology Technology" },
          { name: "BS Endoscopic Technology" },
        ],
      },
      {
        name: "Department of Rehabilitation Sciences",
        programs: [
          { name: "BS Speech and Language Pathology" },
          { name: "BS Rehabilitation Sciences" },
          { name: "BS Occupational Therapy" },
          { name: "BS Orthotics and Prosthetics" },
          { name: "MS Speech Language Pathology and Hearing Sciences" },
          { name: "Post Graduate Diploma Clinical Speech language Pathology (Dysphagia)" },
          { name: "Post Graduate Diploma Clinical Speech language Pathology (Aphasia)" },
          { name: "Post Graduate Diploma Clinical Speech language Pathology (ASD)" },
        ],
      },
      {
        name: "Lahore School of Nursing",
        programs: [
          { name: "BS Nursing" },
          { name: "BS Nursing (Post RN)" },
          { name: "MS Nursing" },
        ],
      },
      {
        name: "Department of Audiology",
        programs: [
          { name: "BS Audiology" },
        ],
      }
    ],
  },
  {
    name: "FIT",
    departments: [
      {
        name: "Department of Computer Science & Information Technology",
        programs: [
          { name: "BS Computer Science" },
          { name: "BS in Data Science" },
          { name: "BS in Cyber Crime" },
          { name: "MS Computer Science" },
          { name: "MS in Data Science" },
          { name: "PhD Computer Science" },
        ],
      },
      {
        name: "Department of Software Engineering",
        programs: [
          { name: "BS Software Engineering" },
          { name: "BS Artificial Intelligence" },
          { name: "MS Software Engineering" },
          { name: "PhD Software Engineering" },
        ],
      },
      {
        name: "Department of Intelligent Systems",
        programs: [
          { name: "BS Robotics and AI" },
          { name: "BS Embedded System" },
          { name: "Associate degree program Digital Chip Design" },
        ],
      }
    ],
  },
  {
    name: "Faculty of Arts and Architecture",
    departments: [
      {
        name: "School of Architecture",
        programs: [
          { name: "BS Architecture" },
          { name: "BS Interior Design" },
          { name: "MS Architecture" },
          { name: "MS Interior Design" },
        ],
      },
      {
        name: "School of Creative Arts",
        programs: [
          { name: "Bachelor of Fine Arts Visual Arts" },
          { name: "BS Visual Communication Design" },
          { name: "BS Animation & VFX" },
          { name: "BS Game Design" },
          { name: "BS Film & TV" },
          { name: "BS Media & Mass Communication" },
          { name: "MPhil Media and Mass Communication (Research Track)" },
          { name: "MPhil Media and Mass Communication (Professional Track)" },
          { name: "PhD Media and Mass Communication" },
        ],
      },
      {
        name: "School of Fashion & Textiles",
        programs: [
          { name: "BS Fashion Design" },
          { name: "BS Fashion and Styling programmes" },
        ],
      }
    ],
  },
  {
    name: "Faculty of language and literature",
    departments: [
      {
        name: "Department of English Language & Literature",
        programs: [
          { name: "BS English language and literature" },
          { name: "MPhil English Literature" },
          { name: "MPhil Applied Linguistics" },
          { name: "PhD English (literature Stream)" },
        ],
      },
      {
        name: "Department of Urdu",
        programs: [
          { name: "BS urdu" },
          { name: "MPhil urdu" },
        ],
      }
    ],
  },
  {
    name: "Faculty of Mangement sciences",
    departments: [
      {
        name: "Lahore Business School",
        programs: [
          { name: "Bachelor of Science in Financial Technology (FinTech)" },
          { name: "Bachelor of Science in Digital Marketing" },
          { name: "Bachelor of Science in Human Resource Management" },
          { name: "Bachelor of Science in Supply Chain Management with Artificial Intelligence" },
          { name: "Bachelor of Sciences in Business Analytics" },
          { name: "Bachelor of Business Administration (BBA)" },
          { name: "MSC in Applied Artificial Intelligence and Data Analytics" },
          { name: "Master of Business Administration (MBA)" },
          { name: "Executive Master of Business Administration (EMBA)" },
          { name: "MS in Digital Marketing" },
          { name: "MS in Management" },
          { name: "MS in Supply Chain Management" },
          { name: "MS in Project Management" },
          { name: "MS in Strategic Human Resource Analytics" },
          { name: "PhD Management Science" },
        ],
      },
      {
        name: "Department of Economics",
        programs: [
          { name: "BS Economics with Finance" },
          { name: "BS Economics with Data Analytics" },
          { name: "MPhil Applied Economics" },
          { name: "PhD Economics" },
        ],
      },
      {
        name: "Lahore School of Aviation",
        programs: [
          { name: "BS in Aviation Management" },
          { name: "BS Aircraft Maintenance and Technology" },
        ],
      },
      {
        name: "Department of Information Management",
        programs: [
          { name: "MS Information Management" },
        ],
      }
    ],
  },
  {
    name: "Faculty of Social Sciences",
    departments: [
      {
        name: "Department of Islamic Studies",
        programs: [
          { name: "BS Islamic Studies" },
          { name: "BS Islamic Studies with Specialization in Quranic Sciences" },
          { name: "MPhil Islamic Studies" },
          { name: "PhD Islamic Studies" },
        ],
      },
      {
        name: "Lahore School of Behavioral Sciences",
        programs: [
          { name: "BS Psychology" },
          { name: "BS Clinical Psychology" },
          { name: "MS Clinical Psychology" },
          { name: "M.Phil Applied Psychology" },
          { name: "PhD Psychology" },
        ],
      },
      {
        name: "School of Integrated Sciences",
        programs: [
          { name: "BS social Sciences" },
          { name: "MPhil Political Sciences" },
          { name: "MPhil Intelligence and securtiy Studies" },
          { name: "PhD International Relations" },
        ],
      },
      {
        name: "Department of Education",
        programs: [
          { name: "BS Education" },
          { name: "BS Education (1.5 years)" },
          { name: "BS Special Education" },
          { name: "MPhil Education" },
          { name: "PhD Education" },
        ],
      },
      {
        name: "Department of Sociology",
        programs: [
          { name: "BS Sociology" },
        ],
      },
      {
        name: "Department of Crimonology",
        programs: [
          { name: "BS Criminology and Criminal Justice System" },
        ],
      }
    ],
  },
  {
    name: "Faculty of medicine and Dentistry",
    departments: [
      {
        name: "University College of Medicine and Dentistry",
        programs: [
          { name: "Bachelor of Medicine & Bachelor of Surgery (MBBS)" },
          { name: "Bachelor of Dental Surgery (BDS)" },
          { name: "MPhil Biochemistry" },
          { name: "MPhil Microbiology" },
          { name: "MPhil Pharmacology" },
          { name: "MPhil Physiology" },
          { name: "Master of Public Health (MPH)" },
          { name: "Master of Dental Surgery (MDS)" },
          { name: "Master of Science in Medical Education (MME)" },
          { name: "Doctor of Philosophy in Biochemistry" },
          { name: "Doctor of Philosophy in Microbiology" },
          { name: "Doctor of Philosophy in Pharmacology" },
          { name: "Doctor of Philosophy in Physiology" },
          { name: "Doctor of Philosophy in Public Health" },
        ],
      },
      {
        name: "Institute of Postgraduate Medical Sciences",
        programs: [
          { name: "Bachelor of Medicine & Bachelor of Surgery (MBBS)" },
          { name: "Bachelor of Dental Surgery (BDS)" },
          { name: "MPhil Biochemistry" },
          { name: "MPhil Microbiology" },
          { name: "MPhil Pharmacology" },
          { name: "MPhil Physiology" },
          { name: "Master of Public Health (MPH)" },
          { name: "Master of Dental Surgery (MDS)" },
          { name: "Master of Science in Medical Education (MME)" },
          { name: "Doctor of Philosophy in Biochemistry" },
          { name: "Doctor of Philosophy in Microbiology" },
          { name: "Doctor of Philosophy in Pharmacology" },
          { name: "Doctor of Philosophy in Physiology" },
          { name: "Doctor of Philosophy in Public Health" },
        ],
      }
    ],
  },
  {
    name: "Faculty of Sciences",
    departments: [
      {
        name: "Department of Physics",
        programs: [
          { name: "Bachelor of Science in Physics" },
          { name: "Bachelor of Science in Engineering Physics" },
          { name: "Bachelor of Science in Medical Physics" },
          { name: "Master of Science in Physics" },
          { name: "Master of Philosophy in Physics" },
          { name: "Doctor of Philosophy in Physics" },
        ],
      },
      {
        name: "Department of Chemistry",
        programs: [
          { name: "Bachelor of Science in Chemistry" },
          { name: "Master of Philosophy in Chemistry" },
          { name: "M.Sc Chemistry ( 2 Years )" },
          { name: "Doctor of Philosophy in Chemistry" },
          { name: "BS in Applied Chemistry" },
        ],
      },
      {
        name: "Department of Environmental Sciences",
        programs: [
          { name: "Bachelor of Science Environmental Sciences" },
          { name: "Master of Philosophy in Environmental Sciences" },
          { name: "Doctor of Philosophy in Environmental Sciences" },
        ],
      },
      {
        name: "Department of Mathematics and Statistics",
        programs: [
          { name: "Bachelor of Science (Hons) in Mathematics" },
          { name: "BS in Computational Finance" },
          { name: "BS in Mathematics for data science" },
          { name: "Master of Philosophy in Mathematics" },
          { name: "PhD Mathematics" },
        ],
      },
      {
        name: "Institute of Molecular Biology & Biotechnology",
        programs: [
          { name: "Bachelor of Science in Biotechnology" },
          { name: "Bachelor of Science in Zoology" },
          { name: "Bachelor of Science in Microbiology and Biotechnology" },
          { name: "Master of Philosophy in Microbiology" },
          { name: "Master of Philosophy in Biochemistry" },
          { name: "Master of Philosophy in Botany" },
          { name: "Master of Philosophy in Physiology" },
          { name: "Master of Philosphy in Forensic Sciences" },
          { name: "Bachelor of Science in Molecular Biology" },
          { name: "Master of Philosophy in Biotechnology" },
          { name: "Doctor of Philosophy in Physiology" },
          { name: "Doctor of Philosophy Microbiology" },
          { name: "Master of Philosophy in Molecular Biology" },
          { name: "Doctor of Philosophy in Zoology" },
          { name: "M.Phil in Zoology" },
          { name: "Doctor of Philosophy in Biochemistry" },
          { name: "Bachelor of Science in Botany" },
          { name: "Bachelor of Science in Bioinformatics" },
          { name: "Doctor of Philosophy in Biotechnology" },
          { name: "Doctor of Philosophy in Botany" },
          { name: "Bachelor of Science in Industrial Biochemistry" },
          { name: "Master of Philosophy in Bioinformatics" },
          { name: "Doctor of Philosophy in Molecular Biology" },
          { name: "Bachelor of Science in Forensic Sciences" },
          { name: "Doctor of Philosophy in Forensic Science" },
          { name: "Bachelor of Science in Biochemistry and Biotechnology" },
          { name: "Bachelor of Science in Molecular Biology and Biotechnology" },
          { name: "MS Clinical Microbiology" },
          { name: "Bachelor of Science in Industrial Biotechnology" },
          { name: "Bachelor of Science in Clinical Biochemistry" },
        ],
      },
      {
        name: "School of Pain and Regenerative Medicine",
        programs: [
          { name: "Bachelor of Science in Regenerative Sciences" },
        ],
      }
    ],
  },
  {
    name: "Faculty of Pharmacy",
    departments: [
      {
        name: "Department of Pharmacy",
        programs: [
          { name: "Doctor of Pharmacy" },
          { name: "BS in Pharmacology & Toxicology" },
          { name: "MPhil Pharmacology" },
          { name: "MPhil Pharmaceutics" },
          { name: "MPhil Clinical Pharmacy" },
          { name: "MPhil Pharmacognosy" },
          { name: "MPhil Pharmaceutical Biotechnology" },
          { name: "MPhil Pharmaceutical Technology" },
          { name: "MPhil Pharmacy Practice" },
          { name: "PhD Pharmaceutics Chemistry" },
          { name: "PhD Pharmacology" },
          { name: "PhD Pharmaceutics" },
          { name: "PhD Pharmacognosy" },
          { name: "PhD Pharmacy Practice" },
          { name: "Training Program - Foreign Licensing Exam Training for pharmacists" },
        ],
      }
    ],
  },
  {
    name: "Faculty of Law",
    departments: [
      {
        name: "M.A. Raoof College of Law",
        programs: [
          { name: "Bachelor of Law" },
        ],
      }
    ],
  },
  {
    name: "Faculty of Engineering & Technology",
    departments: [
      {
        name: "Department of Electrical Engineering",
        programs: [
        ],
      },
      {
        name: "Department of Mechanical Engineering",
        programs: [
        ],
      },
      {
        name: "Department of Civil Engineering",
        programs: [
        ],
      },
      {
        name: "Department of Computer Engineering",
        programs: [
          { name: "BS Computer Engineering" },
          { name: "MS Computer Engineering" },
        ],
      },
      {
        name: "Department of Technology",
        programs: [
          { name: "BS in Mechanical Technology" },
          { name: "BS in Civil Engineering Technology" },
          { name: "BS in Electrical Engineering Technology" },
          { name: "BS in Mechanical Engineering Technology" },
          { name: "BS in Civil Technology" },
          { name: "BS in Information Engineering Technology" },
          { name: "BS in Electrical Technology" },
          { name: "BS in Architectural Engineering Technology" },
          { name: "BS in Agriculture Engineering Technology" },
          { name: "MS in Mechanical Engineering Technology" },
        ],
      }
    ],
  }
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
