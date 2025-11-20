import type { AlumniFullDetails } from "@/app/queries/alumni-profile";

/**
 * Calculates the profile completion percentage based on filled fields
 * @param data - Alumni full details data
 * @returns Percentage (0-100)
 */
export function calculateProfileCompletion(data: AlumniFullDetails | null | undefined): number {
  if (!data) return 0;

  // Define all fields to check with their weights
  const fields: Array<{ key: keyof AlumniFullDetails; weight: number }> = [
    // Personal Information (30%)
    { key: "alumniname", weight: 5 },
    { key: "gender", weight: 2 },
    { key: "dateofbirth", weight: 2 },
    { key: "maritalstatus", weight: 2 },
    { key: "fathername", weight: 2 },
    { key: "cnicpassport", weight: 3 },
    { key: "image1", weight: 4 },
    
    // Contact Information (25%)
    { key: "contactno", weight: 5 },
    { key: "contactno1", weight: 2 },
    { key: "personalemail", weight: 4 },
    { key: "universityemail", weight: 3 },
    { key: "officialemail", weight: 2 },
    { key: "country", weight: 2 },
    { key: "province", weight: 2 },
    { key: "city", weight: 2 },
    { key: "address", weight: 3 },
    
    // Academic Information (25%)
    { key: "degreetitle", weight: 5 },
    { key: "facultyname", weight: 4 },
    { key: "campusname", weight: 3 },
    { key: "departmentname", weight: 4 },
    { key: "majorsubject", weight: 2 },
    { key: "yearofstarting", weight: 2 },
    { key: "yearofending", weight: 3 },
    { key: "cgpa", weight: 2 },
    
    // Employment Information (15%)
    { key: "employeed", weight: 3 },
    { key: "industry", weight: 2 },
    { key: "nameoforganization", weight: 3 },
    { key: "designation", weight: 3 },
    { key: "totalyearsofexpereince", weight: 2 },
    { key: "officialnumber", weight: 2 },
    
    // Additional Information (5%)
    { key: "aboutme", weight: 3 },
    { key: "cv", weight: 2 },
    
    // Social Media (optional, but counts)
    { key: "facebook", weight: 1 },
    { key: "instagram", weight: 1 },
    { key: "linkedin", weight: 1 },
    { key: "youtube", weight: 1 },
  ];

  let totalWeight = 0;
  let filledWeight = 0;

  fields.forEach(({ key, weight }) => {
    totalWeight += weight;
    const value = data[key];
    
    // Check if field is filled
    if (value !== null && value !== undefined && value !== "") {
      // For boolean values, they count as filled
      if (typeof value === "boolean") {
        filledWeight += weight;
      } else if (typeof value === "string" && value.trim() !== "") {
        filledWeight += weight;
      } else if (typeof value === "number" && !isNaN(value)) {
        filledWeight += weight;
      }
    }
  });

  // Calculate percentage
  const percentage = totalWeight > 0 ? Math.round((filledWeight / totalWeight) * 100) : 0;
  return Math.min(100, Math.max(0, percentage)); // Clamp between 0 and 100
}

