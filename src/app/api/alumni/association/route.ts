import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { sendEmailDetailed } from "@/lib/email";
import { buildAccessFilterSQL } from "@/lib/userAccess";
import { EMAIL_ACTION_TYPE, generateAdminActionEmail } from "@/lib/emailTemplates";
import { EMAIL_LOG_STATUS, EMAIL_TRIGGERED_BY, insertEmailLog } from "@/lib/emailLogs";

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
    
    // Helper function to combine OR conditions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const combineOrConditions = (conditions: any[]): any => {
      if (conditions.length === 0) return sql``;
      if (conditions.length === 1) return conditions[0];
      if (conditions.length === 2) return sql`${conditions[0]} OR ${conditions[1]}`;
      const mid = Math.ceil(conditions.length / 2);
      const left = combineOrConditions(conditions.slice(0, mid));
      const right = combineOrConditions(conditions.slice(mid));
      return sql`${left} OR ${right}`;
    };
    
    // Build faculty filter condition (case-insensitive with trim) - handle multiple
    // Check both joined table value and fallback text column
    let facultyFilterCondition = sql``;
    if (selectedFaculties.length > 0) {
      const normalizedFaculties = selectedFaculties.map(f => f.toLowerCase());
      // Check both f.faculty_name (from joined table) and a.facultyname (fallback)
      const facultyConditions = normalizedFaculties.map(f => sql`LOWER(TRIM(COALESCE(f.faculty_name, a.facultyname, ''))) = ${f}`);
      if (facultyConditions.length === 1) {
        facultyFilterCondition = sql` AND ${facultyConditions[0]}`;
      } else if (facultyConditions.length > 1) {
        const combinedCondition = combineOrConditions(facultyConditions);
        facultyFilterCondition = sql` AND (${combinedCondition})`;
      }
    }
    
    // Build department filter condition (case-insensitive with trim) - handle multiple
    // Check both joined table value and fallback text column
    let departmentFilterCondition = sql``;
    if (selectedDepartments.length > 0) {
      const normalizedDepartments = selectedDepartments.map(d => d.toLowerCase());
      // Check both d.department_name (from joined table) and a.departmentname (fallback)
      const departmentConditions = normalizedDepartments.map(d => sql`LOWER(TRIM(COALESCE(d.department_name, a.departmentname, ''))) = ${d}`);
      if (departmentConditions.length === 1) {
        departmentFilterCondition = sql` AND ${departmentConditions[0]}`;
      } else if (departmentConditions.length > 1) {
        const combinedCondition = combineOrConditions(departmentConditions);
        departmentFilterCondition = sql` AND (${combinedCondition})`;
      }
    }
    
    // Build association filter condition - handle multiple
    let associationFilterCondition = sql``;
    if (selectedAssociations.length > 0) {
      // Build OR conditions for multiple associations
      const associationConditions = selectedAssociations.map(id => sql`a.association_id = ${id}`);
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
    
    // Build membership filter condition
    const membershipJoinType: "JOIN" | "LEFT JOIN" = membershipFilter === "members" ? "JOIN" : "LEFT JOIN";
    let membershipWhereCondition = sql``;
    
    if (membershipFilter === "non-members") {
      // For non-members: must not have any association
      membershipWhereCondition = sql` AND a.association_id IS NULL`;
    } else if (membershipFilter === "members") {
      // For members: must have at least one association
      membershipWhereCondition = sql` AND a.association_id IS NOT NULL`;
    }
    // For "all": no additional condition needed, just use LEFT JOIN
    
    // Build the query based on membership filter
    const baseQuery = membershipJoinType === "JOIN"
      ? sql`FROM public.tbl_alumni a
      JOIN public.tbl_associations assoc ON assoc.id = a.association_id`
      : sql`FROM public.tbl_alumni a
      LEFT JOIN public.tbl_associations assoc ON assoc.id = a.association_id`;

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
          assoc.title as association_title,
          assoc.description as association_description,
          assoc.dean as association_dean,
          assoc.phone as association_phone,
          assoc.email as association_email,
          assoc.address as association_address,
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
    const { alumniId, role, criteriaIds, criteriaResponses, additionalAchievements, planStrategy, optionalCriteriaProficiency, cvFileUrl, additionalFile1Url, additionalFile2Url } = body as {
      alumniId?: number;
      role?: string;
      criteriaIds?: unknown;
      criteriaResponses?: unknown;
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

    const additionalAchievementsTextRaw = typeof additionalAchievements === "string" ? additionalAchievements : "";
    const additionalAchievementsText = String(additionalAchievementsTextRaw ?? "").trim().slice(0, 5000);
    const additionalAchievementsValue = additionalAchievementsText ? additionalAchievementsText : null;

    const planStrategyTextRaw = typeof planStrategy === "string" ? planStrategy : "";
    const planStrategyText = String(planStrategyTextRaw ?? "").trim().slice(0, 1000);
    const planStrategyValue = planStrategyText ? planStrategyText : null;
    if (planStrategyValue && planStrategyValue.length < 50) {
      return NextResponse.json({ error: "Plan/strategy must be at least 50 characters (or leave it empty)." }, { status: 400 });
    }

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
      await sql/* sql */`
        INSERT INTO public.leadership_criteria_confirmations (
          leadership_type,
          association_application_id,
          criterion_id,
          actor_type,
          confirmed,
          response,
          created_at
        )
        SELECT
          'association',
          ${Number(createdRecord.id)},
          u.criterion_id,
          'alumni',
          (u.response = 'YES'),
          u.response,
          NOW()
        FROM UNNEST(${ids}::bigint[], ${responses}::text[]) AS u(criterion_id, response)
        JOIN public.leadership_role_criteria c ON c.id = u.criterion_id
        ON CONFLICT (association_application_id, criterion_id, actor_type)
        DO UPDATE SET confirmed = EXCLUDED.confirmed, response = EXCLUDED.response
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

