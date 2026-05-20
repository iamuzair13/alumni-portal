import { sql } from "@/lib/dbconnect";

/** Parse tbl_faculties.id from form/API values. */
export function parseFacultyId(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number.parseInt(String(value).trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Returns faculty id only when it exists in tbl_faculties (safe for FK columns). */
export async function resolveValidFacultyId(value: unknown): Promise<number | null> {
  const facultyId = parseFacultyId(value);
  if (!facultyId) return null;
  const rows = await sql<{ id: number }[]>/* sql */`
    SELECT id FROM public.tbl_faculties WHERE id = ${facultyId} LIMIT 1
  `;
  return rows[0]?.id ?? null;
}

async function facultyIdExists(facultyId: number): Promise<boolean> {
  const rows = await sql<{ id: number }[]>/* sql */`
    SELECT id FROM public.tbl_faculties WHERE id = ${facultyId} LIMIT 1
  `;
  return !!rows[0]?.id;
}

/**
 * Faculty and association are the same entity (tbl_faculties.id).
 * Resolves association id from faculty FK or, for legacy payloads, faculty name.
 */
export async function resolveAssociationIdFromFaculty(args: {
  facultyId?: unknown;
  facultyName?: string | null;
}): Promise<number | null> {
  const facultyId = parseFacultyId(args.facultyId);
  if (facultyId) {
    const rows = await sql<{ id: number }[]>/* sql */`
      SELECT id FROM public.tbl_faculties WHERE id = ${facultyId} LIMIT 1
    `;
    if (rows[0]?.id) return facultyId;
  }

  const facultyName = args.facultyName ? String(args.facultyName).trim() : "";
  if (!facultyName) return null;

  const assocRows = await sql<{ id: number }[]>/* sql */`
    SELECT id
    FROM public.tbl_faculties
    WHERE faculty_name IS NOT NULL
      AND LOWER(TRIM(faculty_name)) LIKE LOWER(TRIM(${`%${facultyName}%`}))
    ORDER BY
      CASE
        WHEN LOWER(TRIM(faculty_name)) = LOWER(TRIM(${facultyName})) THEN 0
        WHEN LOWER(TRIM(faculty_name)) LIKE LOWER(TRIM(${facultyName})) || '%' THEN 1
        WHEN LOWER(TRIM(faculty_name)) LIKE '%' || LOWER(TRIM(${facultyName})) || '%' THEN 2
        ELSE 3
      END,
      id ASC
    LIMIT 1
  `;

  return assocRows[0]?.id ?? null;
}

/**
 * On first registration, association_id must match faculty (same tbl_faculties row).
 * Does not overwrite an existing association_id unless onlyWhenEmpty is false.
 */
export async function autoAssignAssociationFromFaculty(args: {
  alumniId: number;
  facultyId?: unknown;
  facultyName?: string | null;
  onlyWhenEmpty?: boolean;
}): Promise<void> {
  const onlyWhenEmpty = args.onlyWhenEmpty !== false;
  const associationId = await resolveAssociationIdFromFaculty({
    facultyId: args.facultyId,
    facultyName: args.facultyName,
  });
  if (!associationId) return;
  if (!(await facultyIdExists(associationId))) return;

  try {
    if (onlyWhenEmpty) {
      const current = await sql<{ association_id: number | null; faculty: number | null }[]>/* sql */`
        SELECT association_id, faculty
        FROM public.tbl_alumni
        WHERE alumniid = ${args.alumniId}
        LIMIT 1
      `;
      if (current[0]?.association_id) return;
    }

    await sql/* sql */`
      UPDATE public.tbl_alumni
      SET
        association_id = ${associationId},
        faculty = COALESCE(faculty, ${associationId})
      WHERE alumniid = ${args.alumniId}
    `;
  } catch {
    // Best-effort; do not fail registration
  }
}
