import "server-only";

import * as XLSX from "xlsx";
import { sql } from "@/lib/dbconnect";

// ─── Types ───────────────────────────────────────────────────────────────────

export type ImportableColumnType =
  | "text"
  | "number"
  | "date"
  | "boolean"
  | "email"
  | "phone"
  | "year"
  | "fk_faculty"
  | "fk_department"
  | "fk_program"
  | "file_ref";

export type ImportableColumn = {
  /** The actual column name in tbl_alumni */
  dbColumn: string;
  /** Human-readable label for the UI */
  label: string;
  /** Data type for validation */
  type: ImportableColumnType;
  /** Whether this field is required for insert */
  required: boolean;
  /** Max string length (for varchar columns) */
  maxLength?: number;
  /** Aliases for auto-matching (lowercase, normalized) */
  aliases: string[];
  /** Group for UI organization */
  group: "Identity" | "Contact" | "Academic" | "Professional" | "Social" | "File";
  /** Description shown in UI tooltip */
  description?: string;
};

export type ParsedFileResult = {
  fileName: string;
  sheetName: string;
  headers: string[];
  totalRows: number;
  sampleRows: Array<Record<string, string>>;
  headerIssues: Array<{ header: string; issue: string }>;
  allRows: Array<Record<string, unknown>>;
};

export type MappingRequest = {
  mapping: Record<string, string>; // header -> dbColumn | "__skip__"
  rows: Array<Record<string, unknown>>;
  fileName: string;
};

export type ValidationError = {
  rowNumber: number;
  sapid: string;
  name: string;
  field: string;
  message: string;
  originalValue: string;
};

export type ValidationSummary = {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  newRows: number;
  errors: ValidationError[];
  duplicates: Array<{ rowNumber: number; sapid: string; name: string; reason: string }>;
  validRecords: Array<Record<string, unknown> & { _rowNumber: number; _sapid: string; _isNew: boolean }>;
};

export type ImportResult = {
  totalRows: number;
  inserted: number;
  skipped: number;
  failed: number;
  errors: Array<{ rowNumber: number; sapid: string; message: string }>;
  durationMs: number;
};

// ─── Column Definitions ──────────────────────────────────────────────────────
// Derived from the actual tbl_alumni schema.
// System/auto-managed fields are excluded: alumniid, todaydate, lasttimelogin,
// logincount, emailsendcount, emailsendstatus, createddatetime, updated_at,
// change_approval, password, verify (admin-managed), profile_updated.

export const IMPORTABLE_COLUMNS: ImportableColumn[] = [
  // ─── Identity ───
  {
    dbColumn: "sapid",
    label: "SAP ID",
    type: "text",
    required: true,
    maxLength: 20,
    aliases: ["sap id", "sap", "sapid", "sap code", "employee id", "student id"],
    group: "Identity",
    description: "Unique identifier for the alumni record (required)",
  },
  {
    dbColumn: "registrationno",
    label: "Registration No",
    type: "text",
    required: false,
    maxLength: 20,
    aliases: ["registration no", "registration number", "reg no", "reg number", "registrationno"],
    group: "Identity",
  },
  {
    dbColumn: "alumniname",
    label: "Alumni Name",
    type: "text",
    required: true,
    maxLength: 200,
    aliases: ["name", "alumni name", "full name", "student name", "alumniname"],
    group: "Identity",
    description: "Full name of the alumni (required)",
  },
  {
    dbColumn: "gender",
    label: "Gender",
    type: "text",
    required: false,
    maxLength: 50,
    aliases: ["gender", "sex"],
    group: "Identity",
  },
  {
    dbColumn: "fathername",
    label: "Father Name",
    type: "text",
    required: false,
    maxLength: 200,
    aliases: ["father name", "father's name", "fathername"],
    group: "Identity",
  },
  {
    dbColumn: "dateofbirth",
    label: "Date of Birth",
    type: "date",
    required: false,
    maxLength: 50,
    aliases: ["date of birth", "dob", "birthday", "dateofbirth"],
    group: "Identity",
  },
  {
    dbColumn: "maritalstatus",
    label: "Marital Status",
    type: "text",
    required: false,
    maxLength: 50,
    aliases: ["marital status", "maritalstatus"],
    group: "Identity",
  },
  {
    dbColumn: "cnicpassport",
    label: "CNIC / Passport",
    type: "text",
    required: false,
    maxLength: 50,
    aliases: ["cnic", "passport", "cnic/passport", "cnicpassport", "id card"],
    group: "Identity",
  },

  // ─── Contact ───
  {
    dbColumn: "alumniemail",
    label: "Alumni Email",
    type: "email",
    required: false,
    maxLength: 150,
    aliases: ["alumni email", "alumniemail", "primary email"],
    group: "Contact",
    description: "Alumni account email (optional)",
  },
  {
    dbColumn: "personalemail",
    label: "Personal Email",
    type: "email",
    required: true,
    maxLength: 100,
    aliases: ["personal email", "personalemail", "personal email address", "email", "email address"],
    group: "Contact",
    description: "Personal email of the alumni (required)",
  },
  {
    dbColumn: "universityemail",
    label: "University Email",
    type: "email",
    required: false,
    maxLength: 100,
    aliases: ["university email", "universityemail", "uni email", "campus email"],
    group: "Contact",
  },
  {
    dbColumn: "officialemail",
    label: "Official Email",
    type: "email",
    required: false,
    maxLength: 100,
    aliases: ["official email", "officialemail", "work email", "office email"],
    group: "Contact",
  },
  {
    dbColumn: "contactno",
    label: "Contact No",
    type: "phone",
    required: false,
    maxLength: 50,
    aliases: ["contact no", "contact number", "mobile", "phone", "phone no", "contactno"],
    group: "Contact",
  },
  {
    dbColumn: "contactno1",
    label: "Alternate Contact No",
    type: "phone",
    required: false,
    maxLength: 50,
    aliases: ["contact no 2", "alternate contact", "alternate phone", "phone 2", "contactno1"],
    group: "Contact",
  },
  {
    dbColumn: "country",
    label: "Country",
    type: "text",
    required: false,
    maxLength: 50,
    aliases: ["country", "current country"],
    group: "Contact",
  },
  {
    dbColumn: "province",
    label: "Province",
    type: "text",
    required: false,
    maxLength: 50,
    aliases: ["province", "state"],
    group: "Contact",
  },
  {
    dbColumn: "city",
    label: "City",
    type: "text",
    required: false,
    maxLength: 50,
    aliases: ["city", "current city", "town"],
    group: "Contact",
  },
  {
    dbColumn: "address",
    label: "Address",
    type: "text",
    required: false,
    maxLength: 250,
    aliases: ["address", "street address", "home address"],
    group: "Contact",
  },

  // ─── Academic ───
  {
    dbColumn: "academicsession",
    label: "Academic Session",
    type: "text",
    required: false,
    maxLength: 50,
    aliases: ["academic session", "session", "academicsession"],
    group: "Academic",
  },
  {
    dbColumn: "cgpa",
    label: "CGPA",
    type: "number",
    required: false,
    aliases: ["cgpa", "gpa", "grade point average"],
    group: "Academic",
  },
  {
    dbColumn: "yearofstarting",
    label: "Year of Starting",
    type: "year",
    required: false,
    aliases: ["year of starting", "start year", "starting year", "yearofstarting"],
    group: "Academic",
  },
  {
    dbColumn: "yearofending",
    label: "Year of Ending",
    type: "year",
    required: false,
    aliases: ["year of ending", "graduation year", "passing year", "end year", "yearofending", "year"],
    group: "Academic",
  },
  {
    dbColumn: "campusname",
    label: "Campus Name",
    type: "text",
    required: false,
    maxLength: 100,
    aliases: ["campus", "campus name", "campusname"],
    group: "Academic",
  },
  {
    dbColumn: "majorsubject",
    label: "Major Subject",
    type: "text",
    required: false,
    maxLength: 100,
    aliases: ["major", "major subject", "majorsubject", "specialization"],
    group: "Academic",
  },
  {
    dbColumn: "faculty",
    label: "Faculty (FK)",
    type: "fk_faculty",
    required: false,
    aliases: ["faculty id", "faculty fk", "faculty_id"],
    group: "Academic",
    description: "Resolves faculty name to tbl_faculties.id",
  },
  {
    dbColumn: "department",
    label: "Department (FK)",
    type: "fk_department",
    required: false,
    aliases: ["department id", "department fk", "department_id"],
    group: "Academic",
    description: "Resolves department name to tbl_departments.id",
  },
  {
    dbColumn: "program",
    label: "Program (FK)",
    type: "fk_program",
    required: false,
    aliases: ["program id", "program fk", "program_id"],
    group: "Academic",
    description: "Resolves program name to tbl_programs.id",
  },

  // ─── Professional ───
  {
    dbColumn: "industry",
    label: "Industry",
    type: "text",
    required: false,
    aliases: ["industry", "sector"],
    group: "Professional",
  },
  {
    dbColumn: "employeed",
    label: "Employment Status",
    type: "text",
    required: false,
    aliases: ["employment status", "employed", "employeed", "occupation status"],
    group: "Professional",
  },
  {
    dbColumn: "nameoforganization",
    label: "Organization",
    type: "text",
    required: false,
    maxLength: 100,
    aliases: ["organization", "company", "company name", "nameoforganization", "employer"],
    group: "Professional",
  },
  {
    dbColumn: "designation",
    label: "Designation",
    type: "text",
    required: false,
    maxLength: 100,
    aliases: ["designation", "job title", "title", "position", "role"],
    group: "Professional",
  },
  {
    dbColumn: "totalyearsofexpereince",
    label: "Total Years of Experience",
    type: "text",
    required: false,
    maxLength: 10,
    aliases: ["experience", "years of experience", "total years", "totalyearsofexpereince"],
    group: "Professional",
  },
  {
    dbColumn: "officialnumber",
    label: "Official Number",
    type: "phone",
    required: false,
    maxLength: 50,
    aliases: ["official number", "office number", "officialnumber", "work phone"],
    group: "Professional",
  },
  {
    dbColumn: "work_city",
    label: "Work City",
    type: "text",
    required: false,
    aliases: ["work city", "office city", "work_city"],
    group: "Professional",
  },
  {
    dbColumn: "work_country",
    label: "Work Country",
    type: "text",
    required: false,
    aliases: ["work country", "office country", "work_country"],
    group: "Professional",
  },
  {
    dbColumn: "occupation_transition_timing",
    label: "Occupation Transition Timing",
    type: "text",
    required: false,
    aliases: ["transition timing", "occupation transition timing"],
    group: "Professional",
  },
  {
    dbColumn: "supervisordesignation",
    label: "Supervisor Designation",
    type: "text",
    required: false,
    maxLength: 100,
    aliases: ["supervisor designation", "supervisordesignation"],
    group: "Professional",
  },
  {
    dbColumn: "supervisornumber",
    label: "Supervisor Number",
    type: "phone",
    required: false,
    maxLength: 50,
    aliases: ["supervisor number", "supervisornumber"],
    group: "Professional",
  },
  {
    dbColumn: "aboutme",
    label: "About Me",
    type: "text",
    required: false,
    aliases: ["about me", "aboutme", "bio", "about", "summary"],
    group: "Professional",
  },

  // ─── Social ───
  {
    dbColumn: "facebook",
    label: "Facebook",
    type: "text",
    required: false,
    maxLength: 300,
    aliases: ["facebook", "fb", "facebook link"],
    group: "Social",
  },
  {
    dbColumn: "instagram",
    label: "Instagram",
    type: "text",
    required: false,
    maxLength: 300,
    aliases: ["instagram", "ig", "instagram link"],
    group: "Social",
  },
  {
    dbColumn: "youtube",
    label: "YouTube",
    type: "text",
    required: false,
    maxLength: 300,
    aliases: ["youtube", "yt", "youtube link"],
    group: "Social",
  },
  {
    dbColumn: "linkedin",
    label: "LinkedIn",
    type: "text",
    required: false,
    maxLength: 300,
    aliases: ["linkedin", "li", "linkedin link"],
    group: "Social",
  },
  {
    dbColumn: "datasource",
    label: "Data Source",
    type: "text",
    required: false,
    maxLength: 50,
    aliases: ["datasource", "data source", "source"],
    group: "Social",
  },

  // ─── File References ───
  {
    dbColumn: "image1",
    label: "Profile Image",
    type: "file_ref",
    required: false,
    maxLength: 200,
    aliases: ["profile image", "image", "photo", "picture", "image1", "profile picture", "profile photo"],
    group: "File",
    description: "Filename or path to profile image (stored in public/images/)",
  },
  {
    dbColumn: "image2",
    label: "Secondary Image",
    type: "file_ref",
    required: false,
    aliases: ["image2", "secondary image", "additional image"],
    group: "File",
  },
  {
    dbColumn: "cv",
    label: "CV / Resume",
    type: "file_ref",
    required: false,
    maxLength: 200,
    aliases: ["cv", "resume", "curriculum vitae"],
    group: "File",
    description: "Filename or path to CV document (stored in public/images/)",
  },
];

// ─── Allowed columns set (for validation against client-provided mappings) ───

export const ALLOWED_DB_COLUMNS = new Set(IMPORTABLE_COLUMNS.map((c) => c.dbColumn));

export const COLUMN_BY_DB: Record<string, ImportableColumn> = Object.fromEntries(
  IMPORTABLE_COLUMNS.map((c) => [c.dbColumn, c])
);

// ─── Utilities ───────────────────────────────────────────────────────────────

export function normalizeHeader(input: unknown): string {
  return String(input ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\u0000-\u001f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function suggestTargetForHeader(header: string): string | "__skip__" {
  const normalized = normalizeHeader(header);
  if (!normalized) return "__skip__";
  const match = IMPORTABLE_COLUMNS.find((col) =>
    col.aliases.some((alias) => normalizeHeader(alias) === normalized)
  );
  return match?.dbColumn ?? "__skip__";
}

export function buildMappingSuggestions(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  for (const header of headers) {
    mapping[header] = suggestTargetForHeader(header);
  }
  return mapping;
}

function cleanValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function extractYear(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") {
    if (value > 20000 && value < 60000) {
      try {
        const excelEpoch = new Date(1899, 11, 30);
        const date = new Date(excelEpoch.getTime() + value * 86400000);
        return date.getFullYear();
      } catch {
        return null;
      }
    }
    if (value >= 1950 && value <= 2100) return Math.floor(value);
    return null;
  }
  if (typeof value === "string") {
    const s = value.trim();
    const asNum = Number(s);
    if (!isNaN(asNum) && asNum >= 1950 && asNum <= 2100) return Math.floor(asNum);
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.getFullYear();
    const m = s.match(/\b(19|20)\d{2}\b/);
    if (m) return Number(m[0]);
  }
  return null;
}

// ─── File Parsing ────────────────────────────────────────────────────────────

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
const MAX_ROWS = 50000;
const MAX_SAMPLE_ROWS = 10;

export function parseUploadedFile(
  buffer: Buffer,
  fileName: string,
  fileExtension: string
): ParsedFileResult {
  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error(`File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`);
  }

  let workbook: XLSX.WorkBook;

  if (fileExtension === "csv") {
    const text = buffer.toString("utf-8");
    workbook = XLSX.read(text, { type: "string" });
  } else {
    workbook = XLSX.read(buffer, { type: "buffer" });
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("No worksheet found in the uploaded file");
  }

  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: true,
  });

  if (rawRows.length === 0) {
    return {
      fileName,
      sheetName,
      headers: [],
      totalRows: 0,
      sampleRows: [],
      headerIssues: [],
      allRows: [],
    };
  }

  if (rawRows.length > MAX_ROWS) {
    throw new Error(`File contains ${rawRows.length} rows, exceeding the ${MAX_ROWS} row limit`);
  }

  // Extract headers from the first row keys
  const headers = Object.keys(rawRows[0]);

  // Detect header issues: empty or duplicate headers
  const headerIssues: Array<{ header: string; issue: string }> = [];
  const seenHeaders = new Map<string, number>();

  for (let i = 0; i < headers.length; i++) {
    const header = headers[i];
    const trimmed = header.trim();

    if (!trimmed) {
      headerIssues.push({ header: `(column ${i + 1})`, issue: "Empty header" });
      continue;
    }

    const normalized = normalizeHeader(trimmed);
    if (seenHeaders.has(normalized)) {
      headerIssues.push({
        header: trimmed,
        issue: `Duplicate header (also at column ${seenHeaders.get(normalized)! + 1})`,
      });
    } else {
      seenHeaders.set(normalized, i);
    }
  }

  // Build sample rows (first N rows, stringified)
  const sampleRows: Array<Record<string, string>> = rawRows
    .slice(0, MAX_SAMPLE_ROWS)
    .map((row) => {
      const stringified: Record<string, string> = {};
      for (const header of headers) {
        stringified[header] = cleanValue(row[header]);
      }
      return stringified;
    });

  return {
    fileName,
    sheetName,
    headers,
    totalRows: rawRows.length,
    sampleRows,
    headerIssues,
    allRows: rawRows,
  };
}

// ─── Validation ──────────────────────────────────────────────────────────────

type FkLookup = {
  faculties: Map<string, bigint>;
  departments: Map<string, bigint>;
  programs: Map<string, bigint>;
  existingSapids: Set<string>;
  existingEmails: Set<string>;
};

async function buildFkLookups(): Promise<FkLookup> {
  const normalize = (s: string): string =>
    s.toLowerCase().trim().replace(/\s+/g, " ").replace(/\band\b/g, "&");

  const [facultyRows, deptRows, programRows, sapidRows, emailRows] = await Promise.all([
    sql/* sql */`SELECT id, faculty_name FROM public.tbl_faculties WHERE faculty_name IS NOT NULL`,
    sql/* sql */`SELECT id, department_name FROM public.tbl_departments WHERE department_name IS NOT NULL`,
    sql/* sql */`SELECT id, program_name FROM public.tbl_programs WHERE program_name IS NOT NULL`,
    sql/* sql */`SELECT LOWER(TRIM(COALESCE(sapid, ''))) as sapid FROM public.tbl_alumni WHERE sapid IS NOT NULL AND sapid != ''`,
    sql/* sql */`SELECT LOWER(TRIM(COALESCE(alumniemail, ''))) as email FROM public.tbl_alumni WHERE alumniemail IS NOT NULL AND alumniemail != '' UNION SELECT LOWER(TRIM(COALESCE(personalemail, ''))) as email FROM public.tbl_alumni WHERE personalemail IS NOT NULL AND personalemail != ''`,
  ]) as unknown as [
    Array<{ id: bigint; faculty_name: string }>,
    Array<{ id: bigint; department_name: string }>,
    Array<{ id: bigint; program_name: string }>,
    Array<{ sapid: string }>,
    Array<{ email: string }>
  ];

  const faculties = new Map<string, bigint>();
  for (const row of facultyRows) {
    if (row.faculty_name) {
      faculties.set(normalize(row.faculty_name), row.id);
      faculties.set(row.faculty_name.toLowerCase().trim(), row.id);
    }
  }

  const departments = new Map<string, bigint>();
  for (const row of deptRows) {
    if (row.department_name) {
      departments.set(normalize(row.department_name), row.id);
      departments.set(row.department_name.toLowerCase().trim(), row.id);
    }
  }

  const programs = new Map<string, bigint>();
  for (const row of programRows) {
    if (row.program_name) {
      programs.set(normalize(row.program_name), row.id);
      programs.set(row.program_name.toLowerCase().trim(), row.id);
    }
  }

  const existingSapids = new Set<string>();
  for (const row of sapidRows) {
    if (row.sapid) existingSapids.add(row.sapid);
  }

  const existingEmails = new Set<string>();
  for (const row of emailRows) {
    if (row.email) existingEmails.add(row.email);
  }

  return { faculties, departments, programs, existingSapids, existingEmails };
}

function resolveFk(
  value: string,
  lookup: Map<string, bigint>,
  fieldName: string
): bigint | null {
  if (!value) return null;
  const direct = lookup.get(value.toLowerCase().trim());
  if (direct) return direct;
  const normalize = (s: string): string =>
    s.toLowerCase().trim().replace(/\s+/g, " ").replace(/\band\b/g, "&");
  const normalized = normalize(value);
  const normMatch = lookup.get(normalized);
  if (normMatch) return normMatch;
  // Fuzzy: startsWith match
  for (const [key, val] of lookup) {
    if (key.startsWith(normalized) || normalized.startsWith(key)) return val;
  }
  return null;
}

function validateEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function validateField(
  value: string,
  column: ImportableColumn,
  lookups: FkLookup
): { valid: boolean; normalized: unknown; error?: string } {
  if (!value && column.required) {
    return { valid: false, normalized: null, error: `${column.label} is required` };
  }

  if (!value) return { valid: true, normalized: null };

  // Max length check
  if (column.maxLength && value.length > column.maxLength) {
    return {
      valid: false,
      normalized: value.slice(0, column.maxLength),
      error: `${column.label} exceeds max length of ${column.maxLength} characters`,
    };
  }

  switch (column.type) {
    case "email": {
      if (!validateEmail(value)) {
        return { valid: false, normalized: value, error: `Invalid email format: ${value}` };
      }
      return { valid: true, normalized: value.toLowerCase().trim() };
    }

    case "number": {
      const num = Number(value.replace(/,/g, ""));
      if (!Number.isFinite(num)) {
        return { valid: false, normalized: value, error: `${column.label} must be a number` };
      }
      return { valid: true, normalized: num };
    }

    case "year": {
      const year = extractYear(value);
      if (year === null) {
        return { valid: false, normalized: value, error: `${column.label} must be a valid year` };
      }
      return { valid: true, normalized: year };
    }

    case "date": {
      const d = new Date(value);
      if (isNaN(d.getTime())) {
        return { valid: false, normalized: value, error: `${column.label} is not a valid date` };
      }
      return { valid: true, normalized: d.toISOString().slice(0, 10) };
    }

    case "boolean": {
      const lower = value.toLowerCase().trim();
      if (["true", "1", "yes"].includes(lower)) return { valid: true, normalized: true };
      if (["false", "0", "no"].includes(lower)) return { valid: true, normalized: false };
      return { valid: false, normalized: value, error: `${column.label} must be true/false` };
    }

    case "fk_faculty": {
      const resolved = resolveFk(value, lookups.faculties, "faculty");
      if (!resolved) {
        return { valid: false, normalized: value, error: `Faculty "${value}" not found` };
      }
      return { valid: true, normalized: resolved };
    }

    case "fk_department": {
      const resolved = resolveFk(value, lookups.departments, "department");
      if (!resolved) {
        return { valid: false, normalized: value, error: `Department "${value}" not found` };
      }
      return { valid: true, normalized: resolved };
    }

    case "fk_program": {
      const resolved = resolveFk(value, lookups.programs, "program");
      if (!resolved) {
        return { valid: false, normalized: value, error: `Program "${value}" not found` };
      }
      return { valid: true, normalized: resolved };
    }

    case "file_ref": {
      // Sanitize: strip directory traversal, keep only filename
      const sanitized = value.replace(/\\/g, "/").split("/").pop() ?? value;
      if (!sanitized) {
        return { valid: false, normalized: value, error: `Invalid file reference: ${value}` };
      }
      return { valid: true, normalized: sanitized };
    }

    case "phone":
    case "text":
    default:
      return { valid: true, normalized: value };
  }
}

export async function validateRecords(
  mapping: Record<string, string>,
  rows: Array<Record<string, unknown>>,
  fileName: string
): Promise<ValidationSummary> {
  const lookups = await buildFkLookups();
  const errors: ValidationError[] = [];
  const duplicates: Array<{ rowNumber: number; sapid: string; name: string; reason: string }> = [];
  const validRecords: ValidationSummary["validRecords"] = [];

  const seenSapidsInFile = new Set<string>();
  const seenEmailsInFile = new Set<string>();

  for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
    const row = rows[rowIdx];
    const rowNumber = rowIdx + 2; // +1 for header row, +1 for 0-based index

    // Build the mapped record
    const mappedRecord: Record<string, unknown> = {};
    let sapid = "";
    let name = "";

    for (const [header, target] of Object.entries(mapping)) {
      if (target === "__skip__") continue;
      if (!ALLOWED_DB_COLUMNS.has(target)) continue;

      const column = COLUMN_BY_DB[target];
      if (!column) continue;

      const rawValue = cleanValue(row[header]);

      if (column.dbColumn === "sapid") {
        sapid = rawValue.toLowerCase().trim().replace(/\s+/g, "");
      }
      if (column.dbColumn === "alumniname") {
        name = rawValue;
      }

      const { valid, normalized, error } = validateField(rawValue, column, lookups);

      if (!valid && error) {
        errors.push({
          rowNumber,
          sapid,
          name,
          field: column.dbColumn,
          message: error,
          originalValue: rawValue,
        });
      }

      if (normalized !== null && normalized !== undefined && normalized !== "") {
        mappedRecord[column.dbColumn] = normalized;
      }
    }

    // Check required: sapid
    if (!sapid) {
      errors.push({
        rowNumber,
        sapid: "",
        name,
        field: "sapid",
        message: "SAP ID is required",
        originalValue: "",
      });
      continue;
    }

    // Check required: alumniname
    if (!mappedRecord.alumniname) {
      errors.push({
        rowNumber,
        sapid,
        name,
        field: "alumniname",
        message: "Alumni Name is required",
        originalValue: "",
      });
    }

    // Check required: personalemail — required field
    if (!mappedRecord.personalemail) {
      errors.push({
        rowNumber,
        sapid,
        name,
        field: "personalemail",
        message: "Personal Email is required",
        originalValue: "",
      });
      continue;
    }

    // Duplicate check: SAP ID within file
    if (seenSapidsInFile.has(sapid)) {
      duplicates.push({
        rowNumber,
        sapid,
        name,
        reason: "Duplicate SAP ID within file",
      });
      continue;
    }
    seenSapidsInFile.add(sapid);

    // Duplicate check: SAP ID in database
    if (lookups.existingSapids.has(sapid)) {
      duplicates.push({
        rowNumber,
        sapid,
        name,
        reason: "SAP ID already exists in database",
      });
      continue;
    }

    // Duplicate check: email within file (check personalemail and alumniemail)
    const email = String(mappedRecord.personalemail ?? mappedRecord.alumniemail ?? "").toLowerCase().trim();
    if (email && seenEmailsInFile.has(email)) {
      duplicates.push({
        rowNumber,
        sapid,
        name,
        reason: "Duplicate email within file",
      });
      continue;
    }
    if (email) seenEmailsInFile.add(email);

    // Duplicate check: email in database
    if (email && lookups.existingEmails.has(email)) {
      duplicates.push({
        rowNumber,
        sapid,
        name,
        reason: "Email already exists in database",
      });
      continue;
    }

    // Set defaults for new records
    mappedRecord.datasource = mappedRecord.datasource ?? `Bulk Import: ${fileName}`;
    // Enforce under-approval status — all bulk-imported records require admin verification
    mappedRecord.verify = "underApproval";

    validRecords.push({
      ...mappedRecord,
      _rowNumber: rowNumber,
      _sapid: sapid,
      _isNew: true,
    });
  }

  return {
    totalRows: rows.length,
    validRows: validRecords.length,
    invalidRows: errors.length,
    duplicateRows: duplicates.length,
    newRows: validRecords.length,
    errors,
    duplicates,
    validRecords,
  };
}

// ─── Import ───────────────────────────────────────────────────────────────────

const BATCH_SIZE = 100;

export async function importRecords(
  validRecords: ValidationSummary["validRecords"]
): Promise<ImportResult> {
  const startTime = Date.now();
  let inserted = 0;
  let skipped = 0;
  let failed = 0;
  const errors: Array<{ rowNumber: number; sapid: string; message: string }> = [];

  // Process in batches with transactions
  for (let i = 0; i < validRecords.length; i += BATCH_SIZE) {
    const batch = validRecords.slice(i, i + BATCH_SIZE);

    try {
      await sql.begin(async (tx) => {
        for (const record of batch) {
          try {
            // Enforce under-approval status for all bulk-imported records
            record.verify = "underApproval";

            // Build column list and values, excluding internal fields
            const columns: string[] = [];
            const values: unknown[] = [];

            for (const [key, value] of Object.entries(record)) {
              if (key.startsWith("_")) continue;
              if (value === null || value === undefined || value === "") continue;
              columns.push(key);
              values.push(value);
            }

            // Add system fields
            columns.push("createddatetime");
            values.push(new Date().toISOString());
            columns.push("updated_at");
            values.push(new Date().toISOString().slice(0, 10));

            const placeholders = values.map((_, idx) => `$${idx + 1}`).join(", ");
            await tx.unsafe(
              `INSERT INTO public.tbl_alumni (${columns.join(", ")}) VALUES (${placeholders})`,
              values as never[]
            );
            inserted++;
          } catch (err) {
            failed++;
            errors.push({
              rowNumber: record._rowNumber,
              sapid: record._sapid,
              message: err instanceof Error ? err.message : "Insert failed",
            });
          }
        }
      });
    } catch (txErr) {
      // Whole batch transaction failed — count remaining as failed
      const batchFailed = batch.length - (inserted % batch.length || 0);
      failed += batchFailed;
      errors.push({
        rowNumber: batch[0]?._rowNumber ?? 0,
        sapid: batch[0]?._sapid ?? "",
        message: txErr instanceof Error ? txErr.message : "Batch transaction failed",
      });
    }
  }

  skipped = validRecords.length - inserted - failed;

  return {
    totalRows: validRecords.length,
    inserted,
    skipped,
    failed,
    errors,
    durationMs: Date.now() - startTime,
  };
}
