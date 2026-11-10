/**
 * Explicit column lists for queries against public.tbl_alumni (and helpers to
 * render them inside `sql` tagged templates).
 *
 * Why this exists (S1): several routes used `SELECT a.*` on a table that holds
 * the plaintext `password` column (~80 cols). The raw row was then spread into
 * JSON responses and export payloads, so alumni passwords leaked into API
 * responses and downloadable exports.
 *
 * Rules:
 *  - NEVER add `password`, `password_hash`, or reset/verification tokens here.
 *  - Columns must exist in the live table or the query fails. The list below
 *    was built from schema.sql's CREATE TABLE (minus columns dropped by
 *    migrations/066) plus schema/migration additions (profile_updated, medal,
 *    medal_document, change_approval).
 *  - `pre_sap_registration` is an ad-hoc column read by full-details and the
 *    profile UI but absent from schema.sql. It is included in the detail/self
 *    lists only; remove it if the target DB lacks the column.
 */
import { sql } from "@/lib/dbconnect";

const ALUMNI_COLUMNS_CORE = [
  "alumniid",
  "alumniemail",
  "todaydate",
  "registrationno",
  "sapid",
  "alumniname",
  "gender",
  "fathername",
  "dateofbirth",
  "maritalstatus",
  "cnicpassport",
  "contactno",
  "contactno1",
  "personalemail",
  "universityemail",
  "country",
  "province",
  "city",
  "address",
  "academicsession",
  "cgpa",
  "yearofstarting",
  "yearofending",
  "campusname",
  "majorsubject",
  "industry",
  "employeed",
  "occupation_transition_timing",
  "nameoforganization",
  "designation",
  "totalyearsofexpereince",
  "officialemail",
  "officialnumber",
  "work_city",
  "supervisordesignation",
  "work_country",
  "supervisornumber",
  "image1",
  "cv",
  "aboutme",
  "lasttimelogin",
  "logincount",
  "verify",
  "emailsendcount",
  "emailsendstatus",
  "createddatetime",
  "facebook",
  "instagram",
  "youtube",
  "linkedin",
  "datasource",
  "alumnistatus",
  "higher_education_institute_name",
  "degree_title",
  "is_scholarship",
  "higher_education_program",
  "father_cnic",
  "image2",
  "association_id",
  "association_job",
  "chapter_leadership",
  "organization_address",
  "higher_education_institute_country",
  "higher_education_institute_province",
  "higher_education_institute_city",
  "about",
  "category",
  "faculty",
  "department",
  "program",
  "contactno1show",
  "personalemailshow",
  "alumni_consent_info",
  "alumni_consent_pic",
  "updated_at",
  "change_approval",
  "profile_updated",
  "medal",
  "medal_document",
] as const;

const AD_HOC_COLUMNS = ["pre_sap_registration"] as const;

/** Detail routes: every non-credential column a row-level read currently returns. */
export const ALUMNI_DETAIL_COLUMNS: readonly string[] = [
  ...ALUMNI_COLUMNS_CORE,
  ...AD_HOC_COLUMNS,
];

/** Export routes: same coverage — these feed JSON export payloads / Excel downloads. */
export const ALUMNI_EXPORT_COLUMNS: readonly string[] = [...ALUMNI_COLUMNS_CORE];

/** Alumni self-service reads (own record). */
export const ALUMNI_SELF_COLUMNS: readonly string[] = [
  ...ALUMNI_COLUMNS_CORE,
  ...AD_HOC_COLUMNS,
];

/** Admin/list reads. */
export const ALUMNI_LIST_COLUMNS: readonly string[] = [...ALUMNI_COLUMNS_CORE];

const IDENT_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/**
 * Render `a."col1", a."col2", ...` for use inside a `sql` tagged template.
 * Both the alias and every column come from compile-time constants, so
 * `sql.unsafe` is safe here (identifiers are never user-influenced).
 */
export function alumniColumns(alias: string, columns: readonly string[] = ALUMNI_DETAIL_COLUMNS) {
  const a = IDENT_RE.test(alias) ? alias : "a";
  return sql.unsafe(columns.map((c) => `${a}."${c}"`).join(", "));
}

/** Keys that must never reach a serialized response. */
const SENSITIVE_KEYS = new Set([
  "password",
  "password_hash",
  "passwordhash",
  "passwd",
  "reset_token",
  "resettoken",
  "passwordresettoken",
  "verification_token",
  "verificationtoken",
]);

/**
 * Defense-in-depth: recursively remove credential-bearing keys from a value
 * before it is serialized to JSON. Returns a new structure; does not mutate.
 * Safety net for fields that slip past explicit column lists (joined rows,
 * spread objects, nested payloads).
 */
export function stripSensitive<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((v) => stripSensitive(v)) as T;
  }
  if (value !== null && typeof value === "object") {
    if (value instanceof Date || value instanceof Uint8Array || value instanceof Blob) {
      return value;
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(k.toLowerCase())) continue;
      out[k] = stripSensitive(v);
    }
    return out as T;
  }
  return value;
}
