import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdminUser, isSuperAdminUser } from "@/lib/alumniProfile";
import { sql } from "@/lib/dbconnect";

type BulkEditBody = {
  employeeIds?: string[];
  updates?: Record<string, unknown>;
  createDrafts?: Array<{
    sapid: string;
    updates: Record<string, unknown>;
  }>;
};

const SENSITIVE_FIELDS = new Set(["verify", "category"]);

/**
 * Resolve faculty/department/program names to their FK IDs.
 * The staff bulk-upload modal sends human-readable names from dropdown options,
 * but tbl_alumni stores bigint FKs in faculty/department/program columns.
 */
async function resolveFkNamesToIds(updates: Record<string, unknown>): Promise<Record<string, unknown>> {
  const resolved = { ...updates };

  const facultyName = resolved.faculty;
  if (typeof facultyName === "string" && facultyName.trim()) {
    const rows = await sql<{ id: bigint }[]>`
      SELECT id FROM public.tbl_faculties
      WHERE LOWER(TRIM(faculty_name)) = LOWER(TRIM(${facultyName}))
      LIMIT 1
    `;
    resolved.faculty = rows[0]?.id ?? null;
  }

  const departmentName = resolved.department;
  if (typeof departmentName === "string" && departmentName.trim()) {
    const rows = await sql<{ id: bigint }[]>`
      SELECT id FROM public.tbl_departments
      WHERE LOWER(TRIM(department_name)) = LOWER(TRIM(${departmentName}))
      LIMIT 1
    `;
    resolved.department = rows[0]?.id ?? null;
  }

  const programName = resolved.program;
  if (typeof programName === "string" && programName.trim()) {
    const rows = await sql<{ id: bigint }[]>`
      SELECT id FROM public.tbl_programs
      WHERE LOWER(TRIM(program_name)) = LOWER(TRIM(${programName}))
      LIMIT 1
    `;
    resolved.program = rows[0]?.id ?? null;
  }

  return resolved;
}

async function tableExists(tableName: string): Promise<boolean> {
  const rows = await sql/* sql */`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ${tableName}
    ) AS exists
  ` as Array<{ exists: boolean }>;
  return Boolean(rows[0]?.exists);
}

async function columnExists(tableName: string, columnName: string): Promise<boolean> {
  const rows = await sql/* sql */`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = ${tableName}
        AND column_name = ${columnName}
    ) AS exists
  ` as Array<{ exists: boolean }>;
  return Boolean(rows[0]?.exists);
}

function normalizeSap(value: string): string {
  const raw = String(value ?? "").trim();
  const compact = raw.replace(/\s+/g, "");
  if (/^\d+\.0+$/.test(compact)) return compact.replace(/\.0+$/, "");
  return compact.toLowerCase();
}

function pickDefined<T extends Record<string, unknown>>(value: T): Partial<T> {
  const out: Partial<T> = {};
  Object.entries(value).forEach(([key, next]) => {
    if (next !== undefined) {
      (out as Record<string, unknown>)[key] = next;
    }
  });
  return out;
}

function isEmptyObject(value: Record<string, unknown>) {
  return Object.keys(value).length === 0;
}

async function updateAlumniBySap(sapids: string[], updates: Record<string, unknown>) {
  const setFragments: string[] = [];
  const params: any[] = [];
  const columns = [
    "alumniname",
    "personalemail",
    "officialemail",
    "faculty",
    "department",
    "program",
    "campusname",
    "category",
    "verify",
    "designation",
    "nameoforganization",
    "work_country",
    "work_city",
    "occupation_transition_timing",
    "employeed",
    "contactno",
    "contactno1",
    "cnicpassport",
    "yearofending",
    "lasttimelogin",
    "logincount",
    "about",
  ] as const;

  columns.forEach((column) => {
    if (Object.prototype.hasOwnProperty.call(updates, column)) {
      params.push((updates as Record<string, string | number | boolean | null>)[column]);
      setFragments.push(`${column} = $${params.length}`);
    }
  });

  if (setFragments.length === 0) {
    return 0;
  }

  params.push(sapids);
  const sapParamIndex = params.length;
  const rows = await sql.unsafe(
    `UPDATE public.tbl_alumni SET ${setFragments.join(", ")}, updated_at = current_date WHERE LOWER(TRIM(sapid)) = ANY($${sapParamIndex}::text[]) RETURNING alumniid, sapid`,
    params
  ) as Array<{ alumniid: number; sapid: string | null }>;

  return rows.length;
}

async function insertAlumni(sapid: string, updates: Record<string, unknown>) {
  const columns: string[] = ["sapid"];
  const values: any[] = [sapid];

  const allowed = [
    "alumniname",
    "personalemail",
    "officialemail",
    "faculty",
    "department",
    "program",
    "campusname",
    "category",
    "verify",
    "designation",
    "nameoforganization",
    "work_country",
    "work_city",
    "occupation_transition_timing",
    "employeed",
    "contactno",
    "contactno1",
    "cnicpassport",
    "yearofending",
    "lasttimelogin",
    "logincount",
    "about",
  ] as const;

  allowed.forEach((column) => {
    if (Object.prototype.hasOwnProperty.call(updates, column)) {
      columns.push(column);
      values.push((updates as Record<string, string | number | boolean | null>)[column]);
    }
  });

  columns.push("createddatetime");
  values.push(new Date().toISOString());
  columns.push("updated_at");
  values.push(new Date().toISOString().slice(0, 10));

  const placeholders = values.map((_, index) => `$${index + 1}`).join(", ");
  const result = await sql.unsafe(
    `INSERT INTO public.tbl_alumni (${columns.join(", ")}) VALUES (${placeholders}) RETURNING alumniid, sapid`,
    values
  ) as Array<{ alumniid: number; sapid: string | null }>;

  return result[0] ?? null;
}

async function ensureOptionalAssignment(tableCandidates: string[], sapids: string[], templateId: string | null) {
  if (!templateId) return;

  for (const tableName of tableCandidates) {
    if (!(await tableExists(tableName))) continue;
    if (!(await columnExists(tableName, "sapid"))) continue;
    const hasTemplateId = await columnExists(tableName, "template_id");
    const hasTemplateName = await columnExists(tableName, "template_name");

    for (const sapid of sapids) {
      const insertColumns = ["sapid"];
      const insertValues: any[] = [sapid];
      if (hasTemplateId) {
        insertColumns.push("template_id");
        insertValues.push(templateId);
      }
      if (hasTemplateName) {
        insertColumns.push("template_name");
        insertValues.push(templateId);
      }
      const placeholders = insertValues.map((_, index) => `$${index + 1}`).join(", ");
      await sql.unsafe(
        `INSERT INTO public.${tableName} (${insertColumns.join(", ")}) VALUES (${placeholders})
         ON CONFLICT DO NOTHING`,
        insertValues
      );
    }
    return;
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isAdmin = isAdminUser(session.user);
    const isSuperAdmin = isSuperAdminUser(session.user);
    if (!isAdmin && !isSuperAdmin) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const body = (await req.json()) as BulkEditBody;
    const employeeIds = Array.from(new Set((body.employeeIds ?? []).map(normalizeSap).filter(Boolean)));
    const updates = pickDefined(body.updates ?? {});
    const createDrafts = (body.createDrafts ?? [])
      .map((draft) => ({
        sapid: normalizeSap(draft.sapid),
        updates: pickDefined(draft.updates ?? {}),
      }))
      .filter((draft) => draft.sapid);

    if (employeeIds.length > 500) {
      return NextResponse.json({ error: "MAX_500_IDS" }, { status: 400 });
    }
    if (employeeIds.length === 0 && !isEmptyObject(updates) && createDrafts.length === 0) {
      return NextResponse.json({ error: "MISSING_EMPLOYEE_IDS" }, { status: 400 });
    }
    if (isEmptyObject(updates) && createDrafts.length === 0) {
      return NextResponse.json({ error: "EMPTY_UPDATE" }, { status: 400 });
    }
    if (createDrafts.some((draft) => isEmptyObject(draft.updates))) {
      return NextResponse.json({ error: "EMPTY_UPDATE" }, { status: 400 });
    }
    if ((Object.keys(updates).some((field) => SENSITIVE_FIELDS.has(field)) || createDrafts.some((draft) => Object.keys(draft.updates).some((field) => SENSITIVE_FIELDS.has(field)))) && !isSuperAdmin) {
      return NextResponse.json({ error: "FORBIDDEN_SENSITIVE_FIELD" }, { status: 403 });
    }

    const normalizedUpdates: Record<string, unknown> = { ...updates };
    if (Object.prototype.hasOwnProperty.call(normalizedUpdates, "remarks")) {
      normalizedUpdates.about = normalizedUpdates.remarks;
      delete normalizedUpdates.remarks;
    }

    // Resolve faculty/department/program names to FK IDs
    const resolvedUpdates = await resolveFkNamesToIds(normalizedUpdates);

    const tableReady = await tableExists("tbl_alumni");
    if (!tableReady) {
      return NextResponse.json({ error: "TABLE_NOT_AVAILABLE" }, { status: 500 });
    }

    const affected = new Set<string>();
    let updatedCount = 0;

    if (employeeIds.length > 0 && !isEmptyObject(updates)) {
      const rows = await sql/* sql */`
        SELECT alumniid, sapid, personalemail, officialemail
        FROM public.tbl_alumni
        WHERE LOWER(TRIM(sapid)) = ANY(${employeeIds})
      ` as Array<{ alumniid: number; sapid: string | null; personalemail: string | null; officialemail: string | null }>;

      if (rows.length === 0) {
        return NextResponse.json({ error: "NO_ROWS_FOUND" }, { status: 404 });
      }

      const emailFields = ["personalemail", "officialemail"].filter((key) => Object.prototype.hasOwnProperty.call(resolvedUpdates, key));
      if (emailFields.length > 0) {
        for (const field of emailFields) {
          const email = String(resolvedUpdates[field] ?? "").trim();
          if (!email) continue;
          const columnName = field === "personalemail" ? "personalemail" : "officialemail";
          const conflicts = await sql.unsafe(
            `SELECT sapid
             FROM public.tbl_alumni
             WHERE LOWER(TRIM(${columnName})) = LOWER(TRIM($1))
               AND NOT (LOWER(TRIM(sapid)) = ANY($2::text[]))`,
            [email, employeeIds]
          ) as Array<{ sapid: string | null }>;
          if (conflicts.length > 0) {
            return NextResponse.json({ error: "EMAIL_CONFLICT" }, { status: 409 });
          }
        }
      }

      updatedCount += await updateAlumniBySap(employeeIds, resolvedUpdates);
      employeeIds.forEach((sapid) => affected.add(sapid));
    }

    for (const draft of createDrafts) {
      const existing = await sql/* sql */`
        SELECT alumniid
        FROM public.tbl_alumni
        WHERE LOWER(TRIM(sapid)) = ${draft.sapid}
        LIMIT 1
      ` as Array<{ alumniid: number }>;
      if (existing.length > 0) {
        const nextUpdates = { ...draft.updates };
        if (Object.prototype.hasOwnProperty.call(nextUpdates, "remarks")) {
          nextUpdates.about = nextUpdates.remarks;
          delete nextUpdates.remarks;
        }
        delete (nextUpdates as Record<string, unknown>).sapid;
        const resolvedDraftUpdates = await resolveFkNamesToIds(nextUpdates);
        const count = await updateAlumniBySap([draft.sapid], resolvedDraftUpdates);
        if (count > 0) {
          updatedCount += count;
          affected.add(draft.sapid);
        }
        continue;
      }

      const insertUpdates = { ...draft.updates };
      if (Object.prototype.hasOwnProperty.call(insertUpdates, "remarks")) {
        insertUpdates.about = insertUpdates.remarks;
        delete insertUpdates.remarks;
      }
      const resolvedInsertUpdates = await resolveFkNamesToIds(insertUpdates);
      const inserted = await insertAlumni(draft.sapid, resolvedInsertUpdates);
      if (inserted) {
        updatedCount += 1;
        affected.add(draft.sapid);
      }
    }

    const templateId = typeof body.updates?.formTemplateId === "string" ? String(body.updates.formTemplateId) : null;
    await ensureOptionalAssignment(["staff_form_assignments", "user_form_assignments", "form_assignments"], Array.from(affected), templateId);

    return NextResponse.json(
      {
        updatedCount,
        affectedEmployeeIds: Array.from(affected),
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    if (String(message).includes("duplicate key") || String(message).includes("unique")) {
      return NextResponse.json({ error: "EMAIL_CONFLICT" }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
