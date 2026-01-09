import "server-only";

import { sql } from "@/lib/dbconnect";

export type AccessAssignmentsInput = {
  faculties?: string[] | null;
  departments?: string[] | null;
  programs?: string[] | null;
};

export type AccessAssignmentRow = {
  faculty_id: number | null;
  department_id: number | null;
  program_id: number | null;
  faculty_name: string | null;
  department_name: string | null;
  program_name: string | null;
};

function norm(v: string) {
  return v.toLowerCase().trim();
}

function uniqNorm(values: string[] | null | undefined): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of values ?? []) {
    const t = String(raw ?? "").trim();
    if (!t) continue;
    const k = norm(t);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

let FACULTY_CACHE: { ts: number; names: string[] } | null = null;
const FACULTY_CACHE_TTL_MS = 5 * 60 * 1000;

export async function getAllFacultyNamesCached(): Promise<string[]> {
  const now = Date.now();
  if (FACULTY_CACHE && now - FACULTY_CACHE.ts < FACULTY_CACHE_TTL_MS) {
    return FACULTY_CACHE.names;
  }
  const rows = await sql/* sql */`
    SELECT faculty_name
    FROM public.tbl_faculties
    WHERE faculty_name IS NOT NULL
    ORDER BY faculty_name ASC
  ` as Array<{ faculty_name: string | null }>;
  const names = (rows ?? []).map((r) => String(r.faculty_name ?? "").trim()).filter(Boolean);
  FACULTY_CACHE = { ts: now, names };
  return names;
}

/**
 * Converts a UI selection into canonical assignment rows (using DB casing/names).
 * Priority:
 * - If programs provided -> program-level rows
 * - Else if departments provided -> department-level rows
 * - Else -> faculty-level rows
 */
export async function buildAccessAssignmentRowsFromDb(input: AccessAssignmentsInput): Promise<AccessAssignmentRow[]> {
  const faculties = uniqNorm(input.faculties);
  const departments = uniqNorm(input.departments);
  const programs = uniqNorm(input.programs);

  const normalizedFaculties = faculties.map(norm);
  const normalizedDepartments = departments.map(norm);
  const normalizedPrograms = programs.map(norm);

  // Program-level
  if (normalizedPrograms.length > 0) {
    const rows = await sql/* sql */`
      SELECT
        f.id as faculty_id,
        d.id as department_id,
        p.id as program_id,
        f.faculty_name as faculty_name,
        d.department_name as department_name,
        p.program_name as program_name
      FROM public.tbl_programs p
      LEFT JOIN public.tbl_departments d ON p.department_id = d.id
      LEFT JOIN public.tbl_faculties f ON d.faculty_id = f.id
      WHERE LOWER(TRIM(COALESCE(p.program_name, ''))) = ANY(${normalizedPrograms})
      ${normalizedDepartments.length > 0 ? sql` AND LOWER(TRIM(COALESCE(d.department_name, ''))) = ANY(${normalizedDepartments})` : sql``}
      ${normalizedFaculties.length > 0 ? sql` AND LOWER(TRIM(COALESCE(f.faculty_name, ''))) = ANY(${normalizedFaculties})` : sql``}
      ORDER BY f.faculty_name ASC NULLS LAST, d.department_name ASC NULLS LAST, p.program_name ASC NULLS LAST
    ` as AccessAssignmentRow[];

    return uniqRows(rows);
  }

  // Department-level
  if (normalizedDepartments.length > 0) {
    const rows = await sql/* sql */`
      SELECT
        f.id as faculty_id,
        d.id as department_id,
        NULL::bigint as program_id,
        f.faculty_name as faculty_name,
        d.department_name as department_name,
        NULL::text as program_name
      FROM public.tbl_departments d
      LEFT JOIN public.tbl_faculties f ON d.faculty_id = f.id
      WHERE LOWER(TRIM(COALESCE(d.department_name, ''))) = ANY(${normalizedDepartments})
      ${normalizedFaculties.length > 0 ? sql` AND LOWER(TRIM(COALESCE(f.faculty_name, ''))) = ANY(${normalizedFaculties})` : sql``}
      ORDER BY f.faculty_name ASC NULLS LAST, d.department_name ASC NULLS LAST
    ` as AccessAssignmentRow[];

    return uniqRows(rows);
  }

  // Faculty-level
  if (normalizedFaculties.length > 0) {
    const rows = await sql/* sql */`
      SELECT
        id as faculty_id,
        NULL::bigint as department_id,
        NULL::bigint as program_id,
        faculty_name as faculty_name,
        NULL::text as department_name,
        NULL::text as program_name
      FROM public.tbl_faculties
      WHERE LOWER(TRIM(COALESCE(faculty_name, ''))) = ANY(${normalizedFaculties})
      ORDER BY faculty_name ASC NULLS LAST
    ` as AccessAssignmentRow[];

    return uniqRows(rows);
  }

  return [];
}

function uniqRows(rows: AccessAssignmentRow[]): AccessAssignmentRow[] {
  const seen = new Set<string>();
  const out: AccessAssignmentRow[] = [];
  for (const r of rows ?? []) {
    // Use IDs for uniqueness check (preferred) or fall back to names
    const k = [
      String(r.faculty_id ?? ""),
      String(r.department_id ?? ""),
      String(r.program_id ?? ""),
    ].join("|");
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({
      faculty_id: r.faculty_id ? Number(r.faculty_id) : null,
      department_id: r.department_id ? Number(r.department_id) : null,
      program_id: r.program_id ? Number(r.program_id) : null,
      faculty_name: r.faculty_name ? String(r.faculty_name).trim() : null,
      department_name: r.department_name ? String(r.department_name).trim() : null,
      program_name: r.program_name ? String(r.program_name).trim() : null,
    });
  }
  return out;
}


