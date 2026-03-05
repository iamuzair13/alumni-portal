import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { buildAccessFilterSQL } from "@/lib/userAccess";
import { isSuperAdminUser, isAdminUser } from "@/lib/alumniProfile";

function inferRoleNameFromPosition(position: string): "president" | "vice_president" | "coordinator" {
  const s = String(position || "").toLowerCase();
  if (s.includes("vice")) return "vice_president";
  if (s.includes("coordinator")) return "coordinator";
  return "president";
}

function normalizeOptionalCriteriaProficiency(raw: unknown): Record<string, number> | null {
  try {
    let obj: unknown = raw;
    if (typeof obj === "string") {
      const s = obj.trim();
      if (!s) return null;
      obj = JSON.parse(s) as unknown;
    }
    if (!obj || typeof obj !== "object") return null;

    const rec = obj as Record<string, unknown>;
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(rec)) {
      const id = Number(k);
      const rating = Number(v);
      if (!Number.isFinite(id) || id <= 0) continue;
      if (!Number.isFinite(rating) || rating < 1) continue;
      out[String(id)] = Math.min(5, Math.max(1, Math.round(rating)));
    }
    return Object.keys(out).length ? out : null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const type = searchParams.get("type");
    const applicationIdRaw = searchParams.get("applicationId");

    if (type !== "chapter" && type !== "association") {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    const applicationId = Number(applicationIdRaw);
    if (!Number.isFinite(applicationId) || applicationId <= 0) {
      return NextResponse.json({ error: "Invalid applicationId" }, { status: 400 });
    }

    const isSuperAdmin = isSuperAdminUser(session?.user);
    const isAdmin = isAdminUser(session?.user);
    const shouldApplyFilter = !isSuperAdmin && !isAdmin;
    const accessFilter = shouldApplyFilter ? await buildAccessFilterSQL(session, "") : { sql: null, hasFilter: false };

    if (type === "chapter") {
      const rows = await sql/* sql */`
        SELECT 
          cl.id as application_id,
          cl.post,
          cl.status,
          cl.created_at,
          cl.updated_at,
          cl.rejection_reason,
          cl.additional_achievements,
          cl.plan_strategy,
          cl.optional_criteria_proficiency,
          cl.cv_file_url,
          cl.additional_file1_url,
          cl.additional_file2_url,
          a.alumniid,
          a.sapid,
          a.registrationno,
          a.alumniname,
          a.gender,
          a.contactno,
          a.officialnumber,
          a.yearofending,
          a.personalemail,
          a.officialemail,
          a.universityemail,
          f.faculty_name as facultyname,
          d.department_name as departmentname,
          p.program_name as program_name,
          a.degreetitle
        FROM public.chapter_leadership cl
        LEFT JOIN public.tbl_alumni a ON a.alumniid = cl.alumniid
        LEFT JOIN public.tbl_faculties f ON f.id = a.faculty
        LEFT JOIN public.tbl_departments d ON d.id = a.department
        LEFT JOIN public.tbl_programs p ON p.id = a.program
        WHERE cl.id = ${applicationId}
          ${accessFilter.hasFilter && accessFilter.sql
            ? sql` AND EXISTS (
                SELECT 1 FROM public.tbl_alumni a_filter
                WHERE a_filter.alumniid = cl.alumniid
                  AND (${accessFilter.sql})
              )`
            : sql``}
        LIMIT 1
      `;

      if (!rows || rows.length === 0) {
        return NextResponse.json({ error: "Application not found" }, { status: 404 });
      }

      const r = rows[0] as Record<string, unknown>;
      const position = String(r.post ?? "");
      const roleName = inferRoleNameFromPosition(position);

      const roleRows = await sql/* sql */`
        SELECT role_description, office_term_governance_html
        FROM public.leadership_roles
        WHERE leadership_type = 'chapter'
          AND role_name = ${roleName}
        LIMIT 1
      `;
      const roleRow = (roleRows?.[0] as Record<string, unknown> | undefined) ?? null;

      const criteriaRows = await sql/* sql */`
        SELECT
          c.id,
          c.label,
          c.description,
          c.is_mandatory,
          c.sort_order,
          (al.confirmed = true) as alumni_confirmed,
          (ad.confirmed = true) as admin_confirmed
        FROM public.leadership_roles lr
        JOIN public.leadership_role_criteria c ON c.role_id = lr.id
        LEFT JOIN public.leadership_criteria_confirmations al
          ON al.leadership_type = 'chapter'
         AND al.chapter_application_id = ${applicationId}
         AND al.criterion_id = c.id
         AND al.actor_type = 'alumni'
        LEFT JOIN public.leadership_criteria_confirmations ad
          ON ad.leadership_type = 'chapter'
         AND ad.chapter_application_id = ${applicationId}
         AND ad.criterion_id = c.id
         AND ad.actor_type = 'admin'
        WHERE lr.leadership_type = 'chapter'
          AND lr.role_name = ${roleName}
        ORDER BY c.sort_order ASC, c.id ASC
      `;

      const optionalCriteriaProficiency = normalizeOptionalCriteriaProficiency(r.optional_criteria_proficiency ?? null);

      return NextResponse.json(
        {
          item: {
            type: "chapter",
            id: Number(r.application_id),
            alumniId: Number(r.alumniid),
            sapId: String(r.sapid ?? ""),
            registrationNo: r.registrationno ? String(r.registrationno) : null,
            name: String(r.alumniname ?? ""),
            gender: r.gender ? String(r.gender) : null,
            passingYear: Number.isFinite(Number(r.yearofending)) ? Number(r.yearofending) : null,
            email:
              (r.personalemail ? String(r.personalemail) : null) ||
              (r.officialemail ? String(r.officialemail) : null) ||
              (r.universityemail ? String(r.universityemail) : null) ||
              "",
            phone: (r.contactno ? String(r.contactno) : null) || (r.officialnumber ? String(r.officialnumber) : null) || null,
            faculty: r.facultyname ? String(r.facultyname) : null,
            department: r.departmentname ? String(r.departmentname) : null,
            program: r.program_name ? String(r.program_name) : (r.degreetitle ? String(r.degreetitle) : null),
            position,
            roleDescription: roleRow ? String(roleRow.role_description ?? "") : "",
            officeTermGovernanceHtml: roleRow ? String((roleRow as Record<string, unknown>).office_term_governance_html ?? "") : "",
            status: r.status ? String(r.status) : "pending",
            additionalAchievements: r.additional_achievements ? String(r.additional_achievements) : null,
            planStrategy: r.plan_strategy ? String(r.plan_strategy) : null,
            optionalCriteriaProficiency,
            cvFileUrl: r.cv_file_url ? String(r.cv_file_url) : null,
            additionalFile1Url: r.additional_file1_url ? String(r.additional_file1_url) : null,
            additionalFile2Url: r.additional_file2_url ? String(r.additional_file2_url) : null,
            createdAt: r.created_at ?? null,
            updatedAt: r.updated_at ?? null,
            rejectionReason: r.rejection_reason ? String(r.rejection_reason) : null,
          },
          criteria: (criteriaRows || []).map((c: Record<string, unknown>) => ({
            id: Number(c.id),
            label: String(c.label ?? ""),
            description: c.description ? String(c.description) : null,
            is_mandatory: Boolean(c.is_mandatory),
            sort_order: Number(c.sort_order ?? 0),
            alumni_confirmed: Boolean(c.alumni_confirmed),
            admin_confirmed: Boolean(c.admin_confirmed),
          })),
        },
        { status: 200 }
      );
    }

    const rows = await sql/* sql */`
      SELECT 
        ass.id as application_id,
        ass.q3 as role,
        ass.status,
        ass.createddatetime,
        ass.additional_achievements,
        ass.plan_strategy,
        ass.optional_criteria_proficiency,
        ass.cv_file_url,
        ass.additional_file1_url,
        ass.additional_file2_url,
        a.alumniid,
        a.sapid,
        a.registrationno,
        a.alumniname,
        a.gender,
        a.contactno,
        a.officialnumber,
        a.yearofending,
        a.personalemail,
        a.officialemail,
        a.universityemail,
        f.faculty_name as facultyname,
        d.department_name as departmentname,
        p.program_name as program_name,
        a.degreetitle
      FROM public.tblalumniassociation ass
      LEFT JOIN public.tbl_alumni a ON a.alumniid = ass.alumni_id
      LEFT JOIN public.tbl_faculties f ON f.id = a.faculty
      LEFT JOIN public.tbl_departments d ON d.id = a.department
      LEFT JOIN public.tbl_programs p ON p.id = a.program
      WHERE ass.id = ${applicationId}
        ${accessFilter.hasFilter && accessFilter.sql
          ? sql` AND EXISTS (
              SELECT 1 FROM public.tbl_alumni a_filter
              WHERE a_filter.alumniid = ass.alumni_id
                AND (${accessFilter.sql})
            )`
          : sql``}
      LIMIT 1
    `;

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    const r = rows[0] as Record<string, unknown>;
    const position = String(r.role ?? "");
    const roleName = inferRoleNameFromPosition(position);

    const roleRows = await sql/* sql */`
      SELECT role_description, office_term_governance_html
      FROM public.leadership_roles
      WHERE leadership_type = 'association'
        AND role_name = ${roleName}
      LIMIT 1
    `;
    const roleRow = (roleRows?.[0] as Record<string, unknown> | undefined) ?? null;

    const criteriaRows = await sql/* sql */`
      SELECT
        c.id,
        c.label,
        c.description,
        c.is_mandatory,
        c.sort_order,
        (al.confirmed = true) as alumni_confirmed,
        (ad.confirmed = true) as admin_confirmed
      FROM public.leadership_roles lr
      JOIN public.leadership_role_criteria c ON c.role_id = lr.id
      LEFT JOIN public.leadership_criteria_confirmations al
        ON al.leadership_type = 'association'
       AND al.association_application_id = ${applicationId}
       AND al.criterion_id = c.id
       AND al.actor_type = 'alumni'
      LEFT JOIN public.leadership_criteria_confirmations ad
        ON ad.leadership_type = 'association'
       AND ad.association_application_id = ${applicationId}
       AND ad.criterion_id = c.id
       AND ad.actor_type = 'admin'
      WHERE lr.leadership_type = 'association'
        AND lr.role_name = ${roleName}
      ORDER BY c.sort_order ASC, c.id ASC
    `;

    const optionalCriteriaProficiency = normalizeOptionalCriteriaProficiency(r.optional_criteria_proficiency ?? null);

    return NextResponse.json(
      {
        item: {
          type: "association",
          id: Number(r.application_id),
          alumniId: Number(r.alumniid),
          sapId: String(r.sapid ?? ""),
          registrationNo: r.registrationno ? String(r.registrationno) : null,
          name: String(r.alumniname ?? ""),
          gender: r.gender ? String(r.gender) : null,
          passingYear: Number.isFinite(Number(r.yearofending)) ? Number(r.yearofending) : null,
          email:
            (r.personalemail ? String(r.personalemail) : null) ||
            (r.officialemail ? String(r.officialemail) : null) ||
            (r.universityemail ? String(r.universityemail) : null) ||
            "",
          phone: (r.contactno ? String(r.contactno) : null) || (r.officialnumber ? String(r.officialnumber) : null) || null,
          faculty: r.facultyname ? String(r.facultyname) : null,
          department: r.departmentname ? String(r.departmentname) : null,
          program: r.program_name ? String(r.program_name) : (r.degreetitle ? String(r.degreetitle) : null),
          position,
          roleDescription: roleRow ? String(roleRow.role_description ?? "") : "",
          officeTermGovernanceHtml: roleRow ? String((roleRow as Record<string, unknown>).office_term_governance_html ?? "") : "",
          status: r.status ? String(r.status) : "pending",
          additionalAchievements: r.additional_achievements ? String(r.additional_achievements) : null,
          planStrategy: r.plan_strategy ? String(r.plan_strategy) : null,
          optionalCriteriaProficiency,
          cvFileUrl: r.cv_file_url ? String(r.cv_file_url) : null,
          additionalFile1Url: r.additional_file1_url ? String(r.additional_file1_url) : null,
          additionalFile2Url: r.additional_file2_url ? String(r.additional_file2_url) : null,
          createdAt: r.createddatetime ?? null,
          updatedAt: null,
          rejectionReason: null,
        },
        criteria: (criteriaRows || []).map((c: Record<string, unknown>) => ({
          id: Number(c.id),
          label: String(c.label ?? ""),
          description: c.description ? String(c.description) : null,
          is_mandatory: Boolean(c.is_mandatory),
          sort_order: Number(c.sort_order ?? 0),
          alumni_confirmed: Boolean(c.alumni_confirmed),
          admin_confirmed: Boolean(c.admin_confirmed),
        })),
      },
      { status: 200 }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch application details";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
