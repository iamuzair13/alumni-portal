/**
 * University Structure Constants
 * Defines faculties, departments, and their relationships
 */

export const DEPARTMENTS_BY_FACULTY: Record<string, string[]> = {
  "Faculty of Arts & Architecture": [
    "School of Architecture",
    "School of Creative Arts",
    "School of Fashion & Textiles",
  ],
  "Faculty of Engineering & Technology": [
    "Department of Electrical Engineering",
    "Department of Mechanical Engineering",
    "Department of Civil Engineering",
    "Department of Computer Engineering",
    "Department of Technology",
  ],
  "Faculty of Allied Health Sciences": [
    "University Institute of Radiological Sciences & Medical Imaging Technology",
    "University Institute of Physical Therapy",
    "Department of Sports Sciences and Physical Education",
    "University Institute of Diet & Nutritional Sciences",
    "University Institute of Food Science & Technology",
    "University Institute of Medical Lab Technology",
    "University Institute of Public Health",
    "Department of Health Professional Technologies",
    "Department of Optometry & Vision Sciences",
    "Department of Emerging Allied Health Technologies",
    "Department of Rehabilitation Sciences",
    "Lahore School of Nursing",
    "Department of Audiology",
  ],
  "Faculty of Information Technology": [
    "Department of Computer Science & Information Technology",
    "Department of Software Engineering",
    "Department of Intelligent Systems",
  ],
  "Faculty of Management Sciences": [
    "Lahore Business School",
    "Department of Economics",
    "Lahore School of Aviation",
    "Department of Information Management",
  ],
  "Faculty of Social Sciences": [
    "Department of Islamic Studies",
    "Lahore School of Behavioural Sciences",
    "School of Integrated Social Sciences",
    "Department of Education",
    "Department of Sociology",
    "Department of Criminology",
  ],
  "Faculty of Medicine & Dentistry": [
    "University College of Medicine and Dentistry",
    "Institute of Postgraduate Medical Sciences",
    "University Institute of Health Professions Education and Research",
    "Centre for Health Professionals Development & Lifelong Learning",
    "Dental Paramedical School",
  ],
  "Faculty of Sciences": [
    "Department of Physics",
    "Department of Chemistry",
    "Department of Environmental Sciences",
    "Department of Mathematics and Statistics",
    "Institute of Molecular Biology & Biotechnology",
    "School of Pain and Regenerative Medicine",
  ],
  "Faculty of Pharmacy": [
    "Department of Pharmacy",
  ],
  "Faculty of Law": [
    "M.A. Raoof College of Law",
  ],
  "Faculty of Languages & Literature": [
    "Department of English Language & Literature",
    "Department of Urdu",
  ],
  "International Qualifications": [
    "Department of International Qualifications",
  ],
  "Centre for Microcredential-Based Skill Development": [
    "Microcredential-Based Skill Development Centre",
  ],
};

export const FACULTIES = Object.keys(DEPARTMENTS_BY_FACULTY).sort();

export function getDepartmentsByFaculty(faculty: string): string[] {
  return DEPARTMENTS_BY_FACULTY[faculty] || [];
}

export function getAllDepartments(): string[] {
  return Object.values(DEPARTMENTS_BY_FACULTY).flat().sort();
}

