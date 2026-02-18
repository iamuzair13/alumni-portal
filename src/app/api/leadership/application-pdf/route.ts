import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canModify, isSuperAdminUser, isAdminUser } from "@/lib/alumniProfile";
import { buildAccessFilterSQL } from "@/lib/userAccess";
import { sql } from "@/lib/dbconnect";
import { generateLeadershipApplicationPDF } from "@/lib/pdfGenerator";

function inferRoleNameFromPosition(position: string): "president" | "vice_president" | "coordinator" {
  const s = String(position || "").toLowerCase();
  if (s.includes("vice")) return "vice_president";
  if (s.includes("coordinator")) return "coordinator";
  return "president";
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!canModify(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

    let item: Record<string, unknown> | null = null;

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
          a.alumniid,
          a.sapid,
          a.registrationno,
          a.alumniname,
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

      item = rows[0] as Record<string, unknown>;
    } else {
      const rows = await sql/* sql */`
        SELECT 
          ass.id as application_id,
          ass.q3 as role,
          ass.status,
          ass.createddatetime,
          ass.additional_achievements,
          a.alumniid,
          a.sapid,
          a.registrationno,
          a.alumniname,
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

      item = rows[0] as Record<string, unknown>;
    }

    const position = type === "chapter" ? String(item.post ?? "") : String(item.role ?? "");
    const roleName = inferRoleNameFromPosition(position);

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
        ON al.leadership_type = ${type}
       AND (
          (${type} = 'chapter' AND al.chapter_application_id = ${applicationId})
          OR
          (${type} = 'association' AND al.association_application_id = ${applicationId})
       )
       AND al.criterion_id = c.id
       AND al.actor_type = 'alumni'
      LEFT JOIN public.leadership_criteria_confirmations ad
        ON ad.leadership_type = ${type}
       AND (
          (${type} = 'chapter' AND ad.chapter_application_id = ${applicationId})
          OR
          (${type} = 'association' AND ad.association_application_id = ${applicationId})
       )
       AND ad.criterion_id = c.id
       AND ad.actor_type = 'admin'
      WHERE lr.leadership_type = ${type}
        AND lr.role_name = ${roleName}
      ORDER BY c.sort_order ASC, c.id ASC
    `;

    const pdf = await generateLeadershipApplicationPDF({
      leadershipType: type,
      status: String(item.status ?? "pending"),
      position,
      applicant: {
        name: String(item.alumniname ?? ""),
        sapId: String(item.sapid ?? ""),
        registrationNo: item.registrationno ? String(item.registrationno) : null,
        email:
          (item.personalemail ? String(item.personalemail) : null) ||
          (item.officialemail ? String(item.officialemail) : null) ||
          (item.universityemail ? String(item.universityemail) : null) ||
          "",
        faculty: item.facultyname ? String(item.facultyname) : null,
        department: item.departmentname ? String(item.departmentname) : null,
        program: item.program_name ? String(item.program_name) : (item.degreetitle ? String(item.degreetitle) : null),
      },
      additionalAchievements: item.additional_achievements ? String(item.additional_achievements) : null,
      createdAt: (type === "chapter" ? item.created_at : item.createddatetime) ? String(type === "chapter" ? item.created_at : item.createddatetime) : null,
      updatedAt: item.updated_at ? String(item.updated_at) : null,
      rejectionReason: item.rejection_reason ? String(item.rejection_reason) : null,
      criteria: (criteriaRows || []).map((c: Record<string, unknown>) => ({
        label: String(c.label ?? ""),
        description: c.description ? String(c.description) : null,
        isMandatory: Boolean(c.is_mandatory),
        alumniConfirmed: Boolean(c.alumni_confirmed),
        adminConfirmed: Boolean(c.admin_confirmed),
      })),
    });

    const filenameBase = `${type}-leadership-application-${String(item.sapid ?? "").trim() || String(item.registrationno ?? "").trim() || String(applicationId)}`;

    return new NextResponse(pdf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filenameBase}.pdf"`,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to generate PDF";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
