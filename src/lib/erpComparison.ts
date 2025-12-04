/**
 * Utility functions to compare ERP data with local database data
 */

type AlumniRecord = {
  sapid?: string | null;
  registrationno?: string | null;
  alumniname?: string | null;
  personalemail?: string | null;
  officialemail?: string | null;
  universityemail?: string | null;
  facultyname?: string | null;
  departmentname?: string | null;
  degreetitle?: string | null;
  yearofending?: number | null;
  yearofstarting?: number | null;
  cgpa?: number | null;
  campusname?: string | null;
  [key: string]: unknown;
};

type ComparisonResult = {
  sapid: string;
  registrationno?: string | null;
  status: "match" | "mismatch" | "missing_in_local" | "missing_in_erp";
  differences: Array<{
    field: string;
    localValue: unknown;
    erpValue: unknown;
  }>;
  localRecord?: AlumniRecord;
  erpRecord?: AlumniRecord;
};

/**
 * Normalize values for comparison (handle null, undefined, empty strings, case differences)
 */
function normalizeValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value).trim().toLowerCase();
  return str;
}

/**
 * Map ERP field names to local database field names
 * Adjust this based on your ERP's field structure
 */
function mapErpFieldToLocal(erpField: string): string {
  const fieldMap: Record<string, string> = {
    // Add mappings based on your ERP's field names
    "student_name": "alumniname",
    "name": "alumniname",
    "email": "personalemail",
    "personal_email": "personalemail",
    "official_email": "officialemail",
    "university_email": "universityemail",
    "faculty": "facultyname",
    "faculty_name": "facultyname",
    "department": "departmentname",
    "department_name": "departmentname",
    "program": "degreetitle",
    "degree_title": "degreetitle",
    "program_name": "degreetitle",
    "graduation_year": "yearofending",
    "year_of_ending": "yearofending",
    "passing_year": "yearofending",
    "start_year": "yearofstarting",
    "year_of_starting": "yearofstarting",
    "campus": "campusname",
    "campus_name": "campusname",
    "gpa": "cgpa",
    "cgpa": "cgpa",
  };

  return fieldMap[erpField.toLowerCase()] || erpField.toLowerCase();
}

/**
 * Normalize ERP record to match local database structure
 */
function normalizeErpRecord(erpRecord: Record<string, unknown>): AlumniRecord {
  const normalized: AlumniRecord = {};

  for (const [erpField, value] of Object.entries(erpRecord)) {
    const localField = mapErpFieldToLocal(erpField);
    normalized[localField] = value as unknown;
  }

  // Ensure SAP ID and registration number are preserved
  if (erpRecord.sapid) normalized.sapid = String(erpRecord.sapid);
  if (erpRecord.registrationno || erpRecord.registration_no || erpRecord.registration) {
    normalized.registrationno = String(erpRecord.registrationno || erpRecord.registration_no || erpRecord.registration);
  }

  return normalized;
}

/**
 * Compare two alumni records and identify differences
 */
export function compareAlumniRecords(
  local: AlumniRecord,
  erp: AlumniRecord,
  fieldsToCompare: string[] = [
    "alumniname",
    "personalemail",
    "officialemail",
    "universityemail",
    "facultyname",
    "departmentname",
    "degreetitle",
    "yearofending",
    "yearofstarting",
    "cgpa",
    "campusname",
  ]
): ComparisonResult {
  const differences: ComparisonResult["differences"] = [];
  const localSapId = String(local.sapid || "").trim();
  const erpSapId = String(erp.sapid || "").trim();

  // Normalize ERP record
  const normalizedErp = normalizeErpRecord(erp as Record<string, unknown>);

  // Compare specified fields
  for (const field of fieldsToCompare) {
    const localValue = normalizeValue(local[field]);
    const erpValue = normalizeValue(normalizedErp[field]);

    if (localValue !== erpValue) {
      differences.push({
        field,
        localValue: local[field] ?? null,
        erpValue: normalizedErp[field] ?? null,
      });
    }
  }

  return {
    sapid: localSapId || erpSapId,
    registrationno: local.registrationno || normalizedErp.registrationno || null,
    status: differences.length > 0 ? "mismatch" : "match",
    differences,
    localRecord: local,
    erpRecord: normalizedErp,
  };
}

/**
 * Compare ERP data with local database records
 */
export async function compareErpWithLocal(
  erpRecords: AlumniRecord[],
  localRecords: AlumniRecord[]
): Promise<ComparisonResult[]> {
  const results: ComparisonResult[] = [];
  const localMap = new Map<string, AlumniRecord>();

  // Index local records by SAP ID and registration number
  for (const record of localRecords) {
    const sapId = String(record.sapid || "").trim();
    const regNo = String(record.registrationno || "").trim();
    
    if (sapId) localMap.set(`sap:${sapId.toLowerCase()}`, record);
    if (regNo) localMap.set(`reg:${regNo.toLowerCase()}`, record);
  }

  // Compare ERP records with local records
  for (const erpRecord of erpRecords) {
    const normalizedErp = normalizeErpRecord(erpRecord as Record<string, unknown>);
    const erpSapId = String(normalizedErp.sapid || "").trim();
    const erpRegNo = String(normalizedErp.registrationno || "").trim();
    
    const localRecord = 
      (erpSapId && localMap.get(`sap:${erpSapId.toLowerCase()}`)) ||
      (erpRegNo && localMap.get(`reg:${erpRegNo.toLowerCase()}`)) ||
      null;

    if (localRecord) {
      // Record exists in both - compare
      results.push(compareAlumniRecords(localRecord, normalizedErp));
    } else {
      // Record exists in ERP but not in local
      results.push({
        sapid: erpSapId || erpRegNo || "unknown",
        registrationno: erpRegNo || null,
        status: "missing_in_local",
        differences: [],
        erpRecord: normalizedErp,
      });
    }
  }

  // Find records that exist in local but not in ERP
  const erpSapIds = new Set(
    erpRecords
      .map(r => normalizeErpRecord(r as Record<string, unknown>))
      .map(r => String(r.sapid || "").trim().toLowerCase())
      .filter(Boolean)
  );
  const erpRegNos = new Set(
    erpRecords
      .map(r => normalizeErpRecord(r as Record<string, unknown>))
      .map(r => String(r.registrationno || "").trim().toLowerCase())
      .filter(Boolean)
  );

  for (const localRecord of localRecords) {
    const localSapId = String(localRecord.sapid || "").trim().toLowerCase();
    const localRegNo = String(localRecord.registrationno || "").trim().toLowerCase();
    
    const existsInErp = 
      (localSapId && erpSapIds.has(localSapId)) ||
      (localRegNo && erpRegNos.has(localRegNo));

    if (!existsInErp) {
      results.push({
        sapid: String(localRecord.sapid || "").trim() || String(localRecord.registrationno || "").trim() || "unknown",
        registrationno: localRecord.registrationno || null,
        status: "missing_in_erp",
        differences: [],
        localRecord,
      });
    }
  }

  return results;
}

