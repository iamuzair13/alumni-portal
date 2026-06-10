import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { sendEmailDetailed } from "@/lib/email";
import { buildAccessFilterSQL } from "@/lib/userAccess";
import { EMAIL_ACTION_TYPE, generateAdminActionEmail } from "@/lib/emailTemplates";
import { EMAIL_LOG_STATUS, EMAIL_TRIGGERED_BY, insertEmailLog } from "@/lib/emailLogs";
import { combineOrConditions } from "@/lib/master-filter-utils";
import {
  buildAssociationTabDepartmentFilterSQL,
  buildAssociationTabFacultyFilterSQL,
  buildAssociationTabMembershipMembersSQL,
  buildAssociationTabMembershipNonMembersSQL,
} from "@/lib/association-tab-filters";
import {
  parseRequiredAdditionalAchievements,
  parseRequiredPlanStrategy,
} from "@/lib/leadershipApplicationFields";

export async function GET(request: NextRequest) {

  try {

    const session = await auth();

    const { searchParams } = new URL(request.url);

    // Get filter parameters (arrays for multi-select)
    const facultiesParam = searchParams.get("faculties");
    const departmentsParam = searchParams.get("departments");
    const associationsParam = searchParams.get("associations");
    const verified = searchParams.get("verified");
    const membershipFilter = searchParams.get("membershipFilter") || "members"; // "all", "members", "non-members"
    
    const selectedFaculties = facultiesParam ? facultiesParam.split(',').map(s => s.trim()).filter(Boolean) : [];
    const selectedDepartments = departmentsParam ? departmentsParam.split(',').map(s => s.trim()).filter(Boolean) : [];
    const selectedAssociations = associationsParam ? associationsParam.split(',').map(s => s.trim()).filter(Boolean).map(Number).filter(n => !isNaN(n)) : [];
    
    // Pagination parameters
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") || "100", 10), 500); // Max 500 per page
    const offset = (page - 1) * limit;
    
    // Debug logging

    // Build access filter for admin/viewer users
    const accessFilter = await buildAccessFilterSQL(session, "");
    const accessFilterCondition = accessFilter.hasFilter && accessFilter.sql ? sql` AND (${accessFilter.sql})` : sql``;
    
    const facultyFilterCondition = buildAssociationTabFacultyFilterSQL(selectedFaculties);
    const departmentFilterCondition = buildAssociationTabDepartmentFilterSQL(selectedDepartments);
    
    // Build association filter condition - handle multiple (faculty id = association id in tbl_faculties)
    let associationFilterCondition = sql``;
    if (selectedAssociations.length > 0) {
      const associationConditions = selectedAssociations.map((id) =>
        sql`(a.association_id = ${id} OR a.faculty = ${id})`
      );
      if (associationConditions.length === 1) {
        associationFilterCondition = sql` AND ${associationConditions[0]}`;
      } else if (associationConditions.length > 1) {
        const combinedCondition = combineOrConditions(associationConditions);
        associationFilterCondition = sql` AND (${combinedCondition})`;
      }
    }
    
    // Build verified filter condition
    let verifiedFilterCondition = sql``;
    if (verified === "true") {
      verifiedFilterCondition = sql` AND a.verify = 'true'`;
    } else if (verified === "false") {
      verifiedFilterCondition = sql` AND (a.verify IS NULL OR a.verify = '' OR a.verify != 'true')`;
    }
    
    let membershipWhereCondition = sql``;
    if (membershipFilter === "non-members") {
      membershipWhereCondition = buildAssociationTabMembershipNonMembersSQL() as unknown as typeof membershipWhereCondition;
    } else if (membershipFilter === "members") {
      membershipWhereCondition = buildAssociationTabMembershipMembersSQL() as unknown as typeof membershipWhereCondition;
    }

    const baseQuery = sql`FROM public.tbl_alumni a
      LEFT JOIN public.tbl_faculties assoc ON assoc.id = a.association_id`;

    // First, get the total count
    let countResult;
    try {
      countResult = await sql/* sql */`
        SELECT COUNT(*) as total
        ${baseQuery}
        LEFT JOIN public.tbl_faculties f ON f.id = a.faculty
        LEFT JOIN public.tbl_departments d ON d.id = a.department
        WHERE 1=1
          ${accessFilterCondition}
          ${facultyFilterCondition}
          ${departmentFilterCondition}
          ${associationFilterCondition}
          ${verifiedFilterCondition}
          ${membershipWhereCondition}
      `;
    } catch (countError) {

      throw countError;
    }
    
    const total = Number(countResult[0]?.total || 0);
    const totalPages = Math.max(1, Math.ceil(total / limit));
    
    // Then get the paginated results
    let rows;
    try {
      rows = await sql/* sql */`
        SELECT 
          a.alumniid,
          a.sapid,
          a.alumniname,
          COALESCE(d.department_name, a.departmentname) as departmentname,
          COALESCE(f.faculty_name, a.facultyname) as facultyname,
          a.degreetitle,
          a.personalemail,
          a.officialemail,
          a.universityemail,
          a.registrationno,
          a.association_id,
          COALESCE(assoc.faculty_name, f.faculty_name) as association_title,
          NULL::text as association_description,
          NULL::text as association_dean,
          NULL::text as association_phone,
          NULL::text as association_email,
          NULL::text as association_address,
          assoc.created_at as association_created_at
        ${baseQuery}
        LEFT JOIN public.tbl_faculties f ON f.id = a.faculty
        LEFT JOIN public.tbl_departments d ON d.id = a.department
        WHERE 1=1
          ${accessFilterCondition}
          ${facultyFilterCondition}
          ${departmentFilterCondition}
          ${associationFilterCondition}
          ${verifiedFilterCondition}
          ${membershipWhereCondition}
        ORDER BY a.alumniid DESC
        LIMIT ${limit} OFFSET ${offset}`;
    } catch (queryError) {

      throw queryError;
    }

    const items = rows.map((r: Record<string, unknown>) => ({
      sapid: String(r.sapid ?? ""),
      registrationNo: r.registrationno ? String(r.registrationno) : null,
      name: String(r.alumniname ?? ""),
      department: r.departmentname ? String(r.departmentname) : null,
      faculty: r.facultyname ? String(r.facultyname) : null,
      program: r.degreetitle ? String(r.degreetitle) : null,
      email: (r.personalemail ? String(r.personalemail) : null) || (r.officialemail ? String(r.officialemail) : null) || (r.universityemail ? String(r.universityemail) : null),
      associationTitle: r.association_title ? String(r.association_title) : null,
      associationId: r.association_id ? Number(r.association_id) : null,
      createdAt: r.association_created_at || null,
    }));

    return NextResponse.json({ 
      items,
      total,
      page,
      limit,
      totalPages,
    }, { status: 200 });
  } catch (err) {

    const msg = err instanceof Error ? err.message : "Failed to fetch association";
    const errorDetails = err instanceof Error ? err.stack : String(err);

    return NextResponse.json({ error: msg, details: process.env.NODE_ENV === "development" ? errorDetails : undefined }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const userSapid = session?.user ? ((session.user as { sapid?: string | null })?.sapid ? String((session.user as { sapid?: string | null }).sapid) : null) : null;
    const userRegNo = session?.user ? ((session.user as { registrationno?: string | null })?.registrationno ? String((session.user as { registrationno?: string | null }).registrationno) : null) : null;
    if (!session?.user?.email && !userSapid && !userRegNo) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { alumniId, role, associationId, criteriaIds, criteriaResponses, textboxResponses, additionalAchievements, planStrategy, optionalCriteriaProficiency, cvFileUrl, additionalFile1Url, additionalFile2Url } = body as {
      alumniId?: number;
      role?: string;
      associationId?: number | string | null;
      criteriaIds?: unknown;
      criteriaResponses?: unknown;
      textboxResponses?: Record<string, unknown>;
      additionalAchievements?: unknown;
      planStrategy?: unknown;
      optionalCriteriaProficiency?: unknown;
      cvFileUrl?: unknown;
      additionalFile1Url?: unknown;
      additionalFile2Url?: unknown;
    };

    if (!alumniId) {
      return NextResponse.json({ error: "Alumni ID is required" }, { status: 400 });
    }

    if (!role) {
      return NextResponse.json({ error: "Role is required" }, { status: 400 });
    }

    const associationIdNumRaw = associationId === null || associationId === undefined ? null : Number(associationId);
    const associationIdNum = associationIdNumRaw && Number.isFinite(associationIdNumRaw) && associationIdNumRaw > 0 ? associationIdNumRaw : null;
    if (!associationIdNum) {
      return NextResponse.json({ error: "Only one leadership category can be selected." }, { status: 400 });
    }

    // Validate role
    const validRoles = ["president", "vicePresident", "coordinator"];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: "Invalid role selected" }, { status: 400 });
    }

    const roleName = role === "vicePresident" ? "vice_president" : role;
    const legacyConfirmedCriteriaIds = Array.isArray(criteriaIds)
      ? Array.from(new Set(criteriaIds.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0)))
      : [];

    const normalizedResponses: Record<number, "YES" | "NO"> = {};
    if (criteriaResponses && typeof criteriaResponses === "object" && !Array.isArray(criteriaResponses)) {
      for (const [k, v] of Object.entries(criteriaResponses as Record<string, unknown>)) {
        const id = Number(k);
        const resp = String(v ?? "").toUpperCase();
        if (!Number.isFinite(id) || id <= 0) continue;
        if (resp !== "YES" && resp !== "NO") continue;
        normalizedResponses[id] = resp as "YES" | "NO";
      }
    }

    for (const id of legacyConfirmedCriteriaIds) {
      if (!normalizedResponses[id]) normalizedResponses[id] = "YES";
    }

    const normalizedTextboxResponses: Record<number, string> = {};
    if (textboxResponses && typeof textboxResponses === "object" && !Array.isArray(textboxResponses)) {
      for (const [k, v] of Object.entries(textboxResponses as Record<string, unknown>)) {
        const id = Number(k);
        if (!Number.isFinite(id) || id <= 0) continue;
        const raw = String(v ?? "");
        const trimmed = raw.trim().slice(0, 500);
        if (!trimmed) continue;
        normalizedTextboxResponses[id] = trimmed;
      }
    }

    const responseIds = Object.keys(normalizedResponses)
      .map((k) => Number(k))
      .filter((n) => Number.isFinite(n) && n > 0);

    const mandatoryRows = await sql/* sql */`
      SELECT c.id
      FROM public.leadership_roles r
      JOIN public.leadership_role_criteria c ON c.role_id = r.id
      WHERE r.leadership_type = 'association'
        AND r.role_name = ${roleName}
        AND c.is_mandatory = true
    `;
    const mandatoryIds = (mandatoryRows ?? []).map((r: Record<string, unknown>) => Number(r.id)).filter((n) => Number.isFinite(n) && n > 0);
    const missingMandatory = mandatoryIds.filter((id) => {
      const v = normalizedResponses[id];
      return v !== "YES" && v !== "NO";
    });
    if (missingMandatory.length > 0) {
      return NextResponse.json({ error: "Please select YES or NO for all role criteria." }, { status: 400 });
    }

    // Server-side validation for required textbox criteria
    if (responseIds.length > 0) {
      const criteriaConfig = await sql/* sql */`
        SELECT
          id,
          has_textbox,
          is_textbox_required
        FROM public.leadership_role_criteria
        WHERE id = ANY(${responseIds}::bigint[])
      `;

      const hasTextboxById = new Map<number, boolean>();
      const isTextboxRequiredById = new Map<number, boolean>();
      (criteriaConfig ?? []).forEach((row: Record<string, unknown>) => {
        const id = Number(row.id);
        if (!Number.isFinite(id) || id <= 0) return;
        hasTextboxById.set(id, Boolean(row.has_textbox));
        isTextboxRequiredById.set(id, Boolean(row.is_textbox_required));
      });

      for (const id of responseIds) {
        const needs = hasTextboxById.get(id) === true && isTextboxRequiredById.get(id) === true;
        if (!needs) continue;

        const resp = normalizedResponses[id];
        const shouldRequire = resp === "YES"; // optional criteria are always YES
        if (!shouldRequire) continue;

        const txt = normalizedTextboxResponses[id];
        if (!txt || !String(txt).trim()) {
          return NextResponse.json({ error: "Please provide responses for all required textbox criteria." }, { status: 400 });
        }
      }
    }

    // Map role values to display names
    const roleDisplayNames: Record<string, string> = {
      president: "President",
      vicePresident: "Vice President",
      coordinator: "Coordinator",
    };

    const roleDisplayName = roleDisplayNames[role] || role;
    const alumniIdNum = Number(alumniId);
    if (isNaN(alumniIdNum) || alumniIdNum <= 0) {
      return NextResponse.json({ error: "Invalid alumni ID" }, { status: 400 });
    }

    const additionalAchievementsParsed = parseRequiredAdditionalAchievements(additionalAchievements);
    if (!additionalAchievementsParsed.ok) {
      return NextResponse.json({ error: additionalAchievementsParsed.error }, { status: 400 });
    }
    const additionalAchievementsValue = additionalAchievementsParsed.value;

    const planStrategyParsed = parseRequiredPlanStrategy(planStrategy);
    if (!planStrategyParsed.ok) {
      return NextResponse.json({ error: planStrategyParsed.error }, { status: 400 });
    }
    const planStrategyValue = planStrategyParsed.value;

    const optionalCriteriaProficiencyObj = optionalCriteriaProficiency && typeof optionalCriteriaProficiency === "object"
      ? (optionalCriteriaProficiency as Record<string, unknown>)
      : null;
    const optionalCriteriaProficiencyValue = optionalCriteriaProficiencyObj
      ? Object.fromEntries(
          Object.entries(optionalCriteriaProficiencyObj)
            .map(([k, v]) => {
              const id = Number(k);
              const rating = Number(v);
              if (!Number.isFinite(id) || id <= 0) return null;
              if (!Number.isFinite(rating) || rating < 1) return null;
              const normalized = Math.min(5, Math.max(1, Math.round(rating)));
              return [String(id), normalized] as const;
            })
            .filter(Boolean) as Array<readonly [string, number]>
        )
      : null;

    const cvFileUrlValue = typeof cvFileUrl === "string" && cvFileUrl.trim() ? cvFileUrl.trim().slice(0, 500) : null;
    const additionalFile1UrlValue = typeof additionalFile1Url === "string" && additionalFile1Url.trim() ? additionalFile1Url.trim().slice(0, 500) : null;
    const additionalFile2UrlValue = typeof additionalFile2Url === "string" && additionalFile2Url.trim() ? additionalFile2Url.trim().slice(0, 500) : null;

    if (!cvFileUrlValue) {
      return NextResponse.json({ error: "CV upload is required" }, { status: 400 });
    }

    // Check if alumni already has a pending application (by alumni_id)
    const pendingApp = await sql/* sql */`
      SELECT id, status FROM public.tblalumniassociation 
      WHERE alumni_id = ${alumniIdNum} AND status = 'pending'
      LIMIT 1
    `;
    
    if (pendingApp && pendingApp.length > 0) {
      return NextResponse.json({ 
        error: "You already have a pending application. Please wait for admin approval." 
      }, { status: 400 });
    }

    // Check if alumni already has an approved leadership position
    const approvedApp = await sql/* sql */`
      SELECT ass.id, ass.status 
      FROM public.tblalumniassociation ass
      INNER JOIN public.tbl_alumni a ON a.association_job = ass.id
      WHERE a.alumniid = ${alumniIdNum} AND ass.status = 'approved'
      LIMIT 1
    `;
    
    if (approvedApp && approvedApp.length > 0) {
      return NextResponse.json({ 
        error: "You are already approved as a leader. No further application is required." 
      }, { status: 400 });
    }

    // Insert new record with status='pending' (DO NOT link to tbl_alumni yet)
    // Aligned with schema - add status, rejection_reason, updated_at, alumni_id
    const insertResult = await sql/* sql */`
      INSERT INTO public.tblalumniassociation (
        q3,
        createddatetime,
        status,
        alumni_id,
        association_id,
        additional_achievements,
        plan_strategy,
        optional_criteria_proficiency,
        cv_file_url,
        additional_file1_url,
        additional_file2_url
      )
      VALUES (
        ${roleDisplayName},
        NOW(),
        'pending',
        ${alumniIdNum},
        ${associationIdNum},
        ${additionalAchievementsValue},
        ${planStrategyValue},
        ${optionalCriteriaProficiencyValue ? JSON.stringify(optionalCriteriaProficiencyValue) : null},
        ${cvFileUrlValue},
        ${additionalFile1UrlValue},
        ${additionalFile2UrlValue}
      )
      RETURNING id, status
    `;
    
    if (!insertResult || insertResult.length === 0) {
      throw new Error("Failed to create association leadership record");
    }
    
    const createdRecord = insertResult[0] as { id: number; status: string };

    if (responseIds.length > 0) {
      const ids = responseIds;
      const responses = ids.map((id) => normalizedResponses[id]);
      const criteriaConfig = await sql/* sql */`
        SELECT id, has_textbox
        FROM public.leadership_role_criteria
        WHERE id = ANY(${ids}::bigint[])
      `;

      const hasTextboxById = new Map<number, boolean>();
      (criteriaConfig ?? []).forEach((row: Record<string, unknown>) => {
        const id = Number(row.id);
        if (!Number.isFinite(id) || id <= 0) return;
        hasTextboxById.set(id, Boolean(row.has_textbox));
      });

      const textResponses = ids.map((id) => {
        if (!hasTextboxById.get(id)) return null;
        const txt = normalizedTextboxResponses[id];
        return txt ? String(txt) : null;
      });

      await sql/* sql */`
        INSERT INTO public.leadership_criteria_confirmations (
          leadership_type,
          association_application_id,
          criterion_id,
          actor_type,
          confirmed,
          response,
          text_response,
          created_at
        )
        SELECT
          'association',
          ${Number(createdRecord.id)},
          u.criterion_id,
          'alumni',
          (u.response = 'YES'),
          u.response,
          u.text_response,
          NOW()
        FROM UNNEST(${ids}::bigint[], ${responses}::text[], ${textResponses}::text[]) AS u(
          criterion_id,
          response,
          text_response
        )
        JOIN public.leadership_role_criteria c ON c.id = u.criterion_id
        ON CONFLICT (association_application_id, criterion_id, actor_type)
        DO UPDATE SET
          confirmed = EXCLUDED.confirmed,
          response = EXCLUDED.response,
          text_response = EXCLUDED.text_response
      `;
    }

    // Verify the record was created with 'pending' status
    if (createdRecord.status !== 'pending') {

    }

    // Send confirmation email
    try {
      const alumniRows = await sql/* sql */`
        SELECT
          alumniname,
          COALESCE(personalemail, officialemail, universityemail, alumniemail) AS email
        FROM public.tbl_alumni 
        WHERE alumniid = ${alumniId}
        LIMIT 1
      `;
      const alumni = alumniRows[0] as {
        alumniname: string | null;
        email: string | null;
      } | undefined;
      
      if (alumni) {
        const alumniEmail = alumni.email;
        const alumniName = alumni.alumniname || "Alumni";
        
        if (alumniEmail) {
          const tpl = generateAdminActionEmail({
            actionType: EMAIL_ACTION_TYPE.ASSOCIATION_LEADERSHIP_ACK,
            alumniName,
          });

          const html = tpl.html.replaceAll("{ROLE}", roleDisplayName);

          const emailRes = await sendEmailDetailed({
            to: alumniEmail,
            subject: tpl.subject,
            html,
          });

          await insertEmailLog({
            recipientEmail: alumniEmail,
            alumniId: alumniIdNum,
            subject: tpl.subject,
            body: html,
            status: emailRes.ok ? EMAIL_LOG_STATUS.SENT : EMAIL_LOG_STATUS.FAILED,
            errorMessage: emailRes.ok ? null : emailRes.errorMessage ?? "Unknown error",
            triggeredBy: EMAIL_TRIGGERED_BY.AUTO,
            actionType: EMAIL_ACTION_TYPE.ASSOCIATION_LEADERSHIP_ACK,
          });
        }
      }
    } catch (emailError) {
      // Don't fail the request if email fails

    }

    return NextResponse.json({ 
      success: true, 
      message: "Application submitted successfully. It is now pending admin approval." 
    });
  } catch (error) {

    const errorMessage = error instanceof Error ? error.message : "Failed to submit application";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

