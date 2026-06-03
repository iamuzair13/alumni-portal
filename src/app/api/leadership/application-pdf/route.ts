import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canModify, isSuperAdminUser, isAdminUser } from "@/lib/alumniProfile";
import { buildAccessFilterSQL } from "@/lib/userAccess";
import { sql } from "@/lib/dbconnect";
import { resolveAlumniProfilePhotoForPdf } from "@/lib/alumniProfilePhotoPdf";
import { generateLeadershipApplicationPDF, sanitizePdfText } from "@/lib/pdfGenerator";
import { publicUploadsUrlFromStored } from "@/lib/uploadsImageUrl";

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

    const canStaffDownload = canModify(session.user);
    const sessionAlumniIdRaw = (session.user as { userId?: number | null })?.userId;
    const sessionAlumniId = sessionAlumniIdRaw && Number.isFinite(Number(sessionAlumniIdRaw)) ? Number(sessionAlumniIdRaw) : null;

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
    const isAlumni = !canStaffDownload;
    if (isAlumni && (!sessionAlumniId || sessionAlumniId <= 0)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const shouldApplyFilter = !isAlumni && !isSuperAdmin && !isAdmin;
    const accessFilter = shouldApplyFilter ? await buildAccessFilterSQL(session, "") : { sql: null, hasFilter: false };

    let item: Record<string, unknown> | null = null;
    let roleRow: Record<string, unknown> | null = null;

    if (type === "chapter") {
      const rows = await sql/* sql */`
        SELECT 
          cl.id as application_id,
          cl.post,
          cl.chapter_id,
          cl.status,
          cl.created_at,
          cl.updated_at,
          cl.rejection_reason,
          cl.additional_achievements,
          cl.plan_strategy,
          cl.strategy_assessment_marks,
          cl.achievement_assessment_marks,
          cl.bonus_marks,
          cl.optional_criteria_proficiency,
          cl.cv_file_url,
          cl.additional_file1_url,
          cl.additional_file2_url,
          ch.national_chapter,
          ch.international_chapter,
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
          a.degreetitle,
          a.image1,
          a.image2
        FROM public.chapter_leadership cl
        LEFT JOIN public.tbl_alumni a ON a.alumniid = cl.alumniid
        LEFT JOIN public.tbl_faculties f ON f.id = a.faculty
        LEFT JOIN public.tbl_departments d ON d.id = a.department
        LEFT JOIN public.tbl_programs p ON p.id = a.program
        LEFT JOIN public.tblchapters ch ON ch.id = cl.chapter_id
        WHERE cl.id = ${applicationId}
          ${isAlumni && sessionAlumniId ? sql` AND cl.alumniid = ${sessionAlumniId}` : sql``}
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

      const position = String(item.post ?? "");
      const roleName = inferRoleNameFromPosition(position);
      const roleRows = await sql/* sql */`
        SELECT role_description, office_term_governance_html
        FROM public.leadership_roles
        WHERE leadership_type = 'chapter'
          AND role_name = ${roleName}
        LIMIT 1
      `;
      roleRow = (roleRows?.[0] as Record<string, unknown> | undefined) ?? null;
    } else {
      const rows = await sql/* sql */`
        SELECT 
          ass.id as application_id,
          ass.q3 as role,
          ass.association_id,
          ass.status,
          ass.createddatetime,
          ass.additional_achievements,
          ass.plan_strategy,
          ass.strategy_assessment_marks,
          ass.achievement_assessment_marks,
          ass.bonus_marks,
          ass.optional_criteria_proficiency,
          ass.cv_file_url,
          ass.additional_file1_url,
          ass.additional_file2_url,
          fac.faculty_name as association_name,
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
          a.degreetitle,
          a.image1,
          a.image2
        FROM public.tblalumniassociation ass
        LEFT JOIN public.tbl_alumni a ON a.alumniid = ass.alumni_id
        LEFT JOIN public.tbl_faculties f ON f.id = a.faculty
        LEFT JOIN public.tbl_departments d ON d.id = a.department
        LEFT JOIN public.tbl_programs p ON p.id = a.program
        LEFT JOIN public.tbl_faculties fac ON fac.id = ass.association_id
        WHERE ass.id = ${applicationId}
          ${isAlumni && sessionAlumniId ? sql` AND ass.alumni_id = ${sessionAlumniId}` : sql``}
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

      const position = String(item.role ?? "");
      const roleName = inferRoleNameFromPosition(position);
      const roleRows = await sql/* sql */`
        SELECT role_description, office_term_governance_html
        FROM public.leadership_roles
        WHERE leadership_type = 'association'
          AND role_name = ${roleName}
        LIMIT 1
      `;
      roleRow = (roleRows?.[0] as Record<string, unknown> | undefined) ?? null;
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
        c.criterion_score,
        c.has_textbox,
        c.textbox_label,
        c.is_textbox_required,
        (al.confirmed = true) as alumni_confirmed,
        (ad.confirmed = true) as admin_confirmed,
        COALESCE(al.response, CASE WHEN al.confirmed = true THEN 'YES' ELSE NULL END) as alumni_response,
        COALESCE(ad.response, CASE WHEN ad.confirmed = true THEN 'YES' ELSE NULL END) as admin_response,
        ad.obtained_marks as obtained_marks,
        al.text_response as alumni_text_response
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

    const alumniProfilePhoto = await resolveAlumniProfilePhotoForPdf(
      item.image1 as string | null | undefined,
      item.image2 as string | null | undefined
    );

    const pdf = await generateLeadershipApplicationPDF({
      leadershipType: type,
      alumniProfilePhoto,
      categoryType:
        type === "chapter"
          ? ((item.national_chapter ? "national" : item.international_chapter ? "international" : null) as any)
          : ("association" as any),
      categoryName:
        type === "chapter"
          ? (item.national_chapter ? String(item.national_chapter) : item.international_chapter ? String(item.international_chapter) : null)
          : (item.association_name ? String(item.association_name) : null),
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
        gender: item.gender ? String(item.gender) : null,
        phone:
          (item.contactno ? String(item.contactno) : null) ||
          (item.officialnumber ? String(item.officialnumber) : null) ||
          null,
        passingYear: Number.isFinite(Number(item.yearofending)) ? Number(item.yearofending) : null,
        faculty: item.facultyname ? String(item.facultyname) : null,
        department: item.departmentname ? String(item.departmentname) : null,
        program: item.program_name ? String(item.program_name) : (item.degreetitle ? String(item.degreetitle) : null),
      },
      roleDescription: roleRow ? sanitizePdfText(roleRow.role_description, 20_000) : "",
      officeTermGovernanceHtml: roleRow ? sanitizePdfText(roleRow.office_term_governance_html, 20_000) : "",
      additionalAchievements: item.additional_achievements ? sanitizePdfText(item.additional_achievements, 12_000) : null,
      planStrategy: item.plan_strategy ? sanitizePdfText(item.plan_strategy, 12_000) : null,
      strategyAssessmentMarks: Number.isFinite(Number(item.strategy_assessment_marks)) ? Number(item.strategy_assessment_marks) : 0,
      achievementAssessmentMarks: Number.isFinite(Number(item.achievement_assessment_marks)) ? Number(item.achievement_assessment_marks) : 0,
      bonusMarks: Number.isFinite(Number(item.bonus_marks)) ? Number(item.bonus_marks) : 0,
      createdAt: (type === "chapter" ? item.created_at : item.createddatetime) ? String(type === "chapter" ? item.created_at : item.createddatetime) : null,
      updatedAt: item.updated_at ? String(item.updated_at) : null,
      rejectionReason: item.rejection_reason ? String(item.rejection_reason) : null,
      uploadedDocuments: [
        item.cv_file_url
          ? { label: "CV", url: publicUploadsUrlFromStored(String(item.cv_file_url)) ?? "" }
          : null,
        item.additional_file1_url
          ? { label: "Supporting Document 1", url: publicUploadsUrlFromStored(String(item.additional_file1_url)) ?? "" }
          : null,
        item.additional_file2_url
          ? { label: "Supporting Document 2", url: publicUploadsUrlFromStored(String(item.additional_file2_url)) ?? "" }
          : null,
      ].filter((d): d is { label: string; url: string } => Boolean(d?.url)),
      criteria: (criteriaRows || []).map((c: Record<string, unknown>) => ({
        id: Number(c.id ?? 0),
        label: String(c.label ?? ""),
        description: c.description ? String(c.description) : null,
        isMandatory: Boolean(c.is_mandatory),
        criterionScore: Number.isFinite(Number(c.criterion_score)) ? Number(c.criterion_score) : null,
        hasTextbox: Boolean(c.has_textbox),
        textboxLabel: c.textbox_label ? String(c.textbox_label) : null,
        alumniConfirmed: Boolean(c.alumni_confirmed),
        adminConfirmed: Boolean(c.admin_confirmed),
        alumniResponse: c.alumni_response ? String(c.alumni_response) : null,
        adminResponse: c.admin_response ? String(c.admin_response) : null,
        alumniTextResponse: c.alumni_text_response ? sanitizePdfText(c.alumni_text_response, 6_000) : null,
        obtainedMarks: Number.isFinite(Number(c.obtained_marks)) ? Number(c.obtained_marks) : null,
      })),
      optionalCriteriaProficiency: normalizeOptionalCriteriaProficiency(item.optional_criteria_proficiency ?? null),
    });

    const filenameBase = `${type}-leadership-application-${String(item.sapid ?? "").trim() || String(item.registrationno ?? "").trim() || String(applicationId)}`;

    if (pdf.length > 8 * 1024 * 1024) {
      console.error("[leadership/application-pdf] Generated PDF unexpectedly large", {
        applicationId,
        type,
        bytes: pdf.length,
      });
      return NextResponse.json(
        { error: "Generated PDF is too large. Please contact support." },
        { status: 500 }
      );
    }

    const body = new Uint8Array(pdf);
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(pdf.length),
        "Content-Disposition": `attachment; filename="${filenameBase}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to generate PDF";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
