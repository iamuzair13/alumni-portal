/**
 * Program name normalization and matching utilities
 * Uses the hierarchical structure from mock-programs.json to improve matching
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
};

const programs = programsData as ProgramData;

/**
 * Normalize program name for comparison
 * - Convert to lowercase
 * - Remove extra whitespace
 * - Remove common prefixes/suffixes that don't affect meaning
 * - Handle common abbreviations
 */
export function normalizeProgramName(programName: string): string {
  if (!programName || typeof programName !== "string") return "";
  
  let normalized = programName.trim().toLowerCase();
  
  // Remove common punctuation that doesn't affect meaning
  normalized = normalized.replace(/[()]/g, "");
  
  // Normalize common abbreviations and variations
  const replacements: Array<[RegExp, string]> = [
    [/bachelor\s+of\s+science/gi, "bs"],
    [/bachelor\s+of\s+arts/gi, "ba"],
    [/bachelor\s+of/gi, "bachelor"],
    [/master\s+of\s+science/gi, "ms"],
    [/master\s+of\s+philosophy/gi, "mphil"],
    [/master\s+of/gi, "master"],
    [/doctor\s+of\s+philosophy/gi, "phd"],
    [/doctor\s+of/gi, "doctor"],
    [/\s+/g, " "], // Normalize multiple spaces to single space
    [/^\s+|\s+$/g, ""], // Trim
  ];
  
  for (const [pattern, replacement] of replacements) {
    normalized = normalized.replace(pattern, replacement);
  }
  
  return normalized.trim();
}

/**
 * Extract key words from program name (removes common stop words)
 */
export function extractProgramKeywords(programName: string): string[] {
  const normalized = normalizeProgramName(programName);
  const stopWords = new Set([
    "in", "of", "and", "the", "a", "an", "for", "with", "to", "from", "by"
  ]);
  
  return normalized
    .split(/\s+/)
    .filter(word => word.length > 1 && !stopWords.has(word))
    .filter((word, index, arr) => arr.indexOf(word) === index); // Remove duplicates
}

/**
 * Calculate similarity between two program names (0-1)
 * Uses keyword overlap and string similarity
 */
export function calculateProgramSimilarity(program1: string, program2: string): number {
  const norm1 = normalizeProgramName(program1);
  const norm2 = normalizeProgramName(program2);
  
  // Exact match after normalization
  if (norm1 === norm2) return 1.0;
  
  // Check if one contains the other (high similarity)
  if (norm1.includes(norm2) || norm2.includes(norm1)) {
    const longer = norm1.length > norm2.length ? norm1 : norm2;
    const shorter = norm1.length > norm2.length ? norm2 : norm1;
    return shorter.length / longer.length;
  }
  
  // Keyword-based similarity
  const keywords1 = extractProgramKeywords(program1);
  const keywords2 = extractProgramKeywords(program2);
  
  if (keywords1.length === 0 || keywords2.length === 0) return 0;
  
  const intersection = keywords1.filter(k => keywords2.includes(k));
  const union = new Set([...keywords1, ...keywords2]);
  
  // Jaccard similarity
  return intersection.length / union.size;
}

/**
 * Find matching programs from the database structure
 * Returns array of matching program names with their similarity scores
 */
export function findMatchingPrograms(
  searchProgram: string,
  faculty?: string | null,
  department?: string | null,
  minSimilarity: number = 0.6
): Array<{ program: string; similarity: number; faculty: string; department: string }> {
  const matches: Array<{ program: string; similarity: number; faculty: string; department: string }> = [];
  
  // Search through faculties and departments
  for (const facultyData of programs.faculties) {
    // If faculty is specified, only search in that faculty
    if (faculty) {
      const normalizedFaculty = normalizeProgramName(facultyData.faculty);
      const normalizedSearchFaculty = normalizeProgramName(faculty);
      if (normalizedFaculty !== normalizedSearchFaculty && 
          !normalizedFaculty.includes(normalizedSearchFaculty) &&
          !normalizedSearchFaculty.includes(normalizedFaculty)) {
        continue;
      }
    }
    
    for (const deptData of facultyData.departments) {
      // If department is specified, only search in that department
      if (department) {
        const normalizedDept = normalizeProgramName(deptData.department);
        const normalizedSearchDept = normalizeProgramName(department);
        if (normalizedDept !== normalizedSearchDept &&
            !normalizedDept.includes(normalizedSearchDept) &&
            !normalizedSearchDept.includes(normalizedDept)) {
          continue;
        }
      }
      
      for (const programData of deptData.programs) {
        const similarity = calculateProgramSimilarity(searchProgram, programData.program);
        if (similarity >= minSimilarity) {
          matches.push({
            program: programData.program,
            similarity,
            faculty: facultyData.faculty,
            department: deptData.department
          });
        }
      }
    }
  }
  
  // Also search standalone programs
  for (const programData of programs.standalonePrograms) {
    const similarity = calculateProgramSimilarity(searchProgram, programData.program);
    if (similarity >= minSimilarity) {
      matches.push({
        program: programData.program,
        similarity,
        faculty: "",
        department: ""
      });
    }
  }
  
  // Sort by similarity (highest first)
  return matches.sort((a, b) => b.similarity - a.similarity);
}

/**
 * Get the best matching program name from database
 * Returns the most similar program name found, or null if no good match
 */
export function getBestMatchingProgram(
  searchProgram: string,
  faculty?: string | null,
  department?: string | null,
  minSimilarity: number = 0.7
): string | null {
  const matches = findMatchingPrograms(searchProgram, faculty, department, minSimilarity);
  return matches.length > 0 ? matches[0].program : null;
}

/**
 * Build SQL pattern for program matching
 * Creates a pattern that matches variations of the program name
 */
export function buildProgramMatchPattern(programName: string): string {
  const keywords = extractProgramKeywords(programName);
  
  if (keywords.length === 0) {
    // Fallback: use normalized program name
    const normalized = normalizeProgramName(programName);
    return `%${normalized.replace(/\s+/g, "%")}%`;
  }
  
  // Create pattern with all keywords (order doesn't matter)
  return `%${keywords.join("%")}%`;
}

/**
 * Check if a program exists in the database structure
 */
export function programExists(
  programName: string,
  faculty?: string | null,
  department?: string | null
): boolean {
  const matches = findMatchingPrograms(programName, faculty, department, 0.95);
  return matches.length > 0;
}

