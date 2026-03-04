import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { buildAccessFilterSQL } from "@/lib/userAccess";
import { sendEmailDetailed } from "@/lib/email";
import { EMAIL_ACTION_TYPE, generateAdminActionEmail } from "@/lib/emailTemplates";
import { EMAIL_LOG_STATUS, EMAIL_TRIGGERED_BY, insertEmailLog } from "@/lib/emailLogs";

export async function GET() {
  try {
    const session = await auth();
    
    // Build access filter for admin/viewer users
    const accessFilter = await buildAccessFilterSQL(session, "");
    const accessFilterCondition = accessFilter.hasFilter && accessFilter.sql ? sql` AND (${accessFilter.sql})` : sql``;
    
    const rows = await sql/* sql */`
      SELECT 
        a.alumniid,
        a.sapid,
        a.alumniname,
        a.departmentname,
        a.facultyname,
        a.degreetitle,
        a.personalemail,
        a.officialemail,
        a.universityemail,
        a.registrationno,
        cl.post,
        cl.created_at
      FROM public.tbl_alumni a
      JOIN public.chapter_leadership cl ON cl.id = a.chapter_leadership
      WHERE 1=1
        ${accessFilterCondition}
      ORDER BY cl.created_at DESC NULLS LAST, a.alumniid DESC`;
    
    const items = rows.map((r: Record<string, unknown>) => ({
      sapid: String(r.sapid ?? ""),
      registrationNo: r.registrationno ? String(r.registrationno) : null,
      name: String(r.alumniname ?? ""),
      department: r.departmentname ? String(r.departmentname) : null,
      faculty: r.facultyname ? String(r.facultyname) : null,
      program: r.degreetitle ? String(r.degreetitle) : null,
      email: (r.personalemail ? String(r.personalemail) : null) || (r.officialemail ? String(r.officialemail) : null) || (r.universityemail ? String(r.universityemail) : null),
      post: r.post ? String(r.post) : null,
      createdAt: r.created_at,
    }));
    
    return NextResponse.json({ items }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch chapter leadership";
    return NextResponse.json({ error: msg }, { status: 500 });
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
    const { alumniId, post, criteriaIds, additionalAchievements, cvFileUrl, additionalFile1Url, additionalFile2Url } = body as {
      alumniId?: number;
      post?: string;
      criteriaIds?: unknown;
      additionalAchievements?: unknown;
      cvFileUrl?: unknown;
      additionalFile1Url?: unknown;
      additionalFile2Url?: unknown;
    };

    if (!alumniId) {
      return NextResponse.json({ error: "Alumni ID is required" }, { status: 400 });
    }

    if (!post) {
      return NextResponse.json({ error: "Post is required" }, { status: 400 });
    }

    // Validate post
    const validPosts = ["president", "vicePresident", "coordinator"];
    if (!validPosts.includes(post)) {
      return NextResponse.json({ error: "Invalid post selected" }, { status: 400 });
    }

    const roleName = post === "vicePresident" ? "vice_president" : post;
    const confirmedCriteriaIds = Array.isArray(criteriaIds)
      ? Array.from(
          new Set(
            criteriaIds
              .map((x) => Number(x))
              .filter((n) => Number.isFinite(n) && n > 0)
          )
        )
      : [];

    const mandatoryRows = await sql/* sql */`
      SELECT c.id
      FROM public.leadership_roles r
      JOIN public.leadership_role_criteria c ON c.role_id = r.id
      WHERE r.leadership_type = 'chapter'
        AND r.role_name = ${roleName}
        AND c.is_mandatory = true
    `;
    const mandatoryIds = (mandatoryRows ?? []).map((r: Record<string, unknown>) => Number(r.id)).filter((n) => Number.isFinite(n) && n > 0);
    const missingMandatory = mandatoryIds.filter((id) => !confirmedCriteriaIds.includes(id));
    if (missingMandatory.length > 0) {
      return NextResponse.json(
        { error: "Please confirm all mandatory criteria before submitting." },
        { status: 400 }
      );
    }

    // Map post values to display names
    const postDisplayNames: Record<string, string> = {
      president: "President",
      vicePresident: "Vice President",
      coordinator: "Coordinator",
    };

    const postDisplayName = postDisplayNames[post] || post;
    const alumniIdNum = Number(alumniId);
    if (isNaN(alumniIdNum) || alumniIdNum <= 0) {
      return NextResponse.json({ error: "Invalid alumni ID" }, { status: 400 });
    }

    const additionalAchievementsTextRaw = typeof additionalAchievements === "string" ? additionalAchievements : "";
    const additionalAchievementsText = String(additionalAchievementsTextRaw ?? "").trim().slice(0, 5000);
    const additionalAchievementsValue = additionalAchievementsText ? additionalAchievementsText : null;

    const cvFileUrlValue = typeof cvFileUrl === "string" && cvFileUrl.trim() ? cvFileUrl.trim().slice(0, 500) : null;
    const additionalFile1UrlValue = typeof additionalFile1Url === "string" && additionalFile1Url.trim() ? additionalFile1Url.trim().slice(0, 500) : null;
    const additionalFile2UrlValue = typeof additionalFile2Url === "string" && additionalFile2Url.trim() ? additionalFile2Url.trim().slice(0, 500) : null;

    if (!cvFileUrlValue) {
      return NextResponse.json({ error: "CV upload is required" }, { status: 400 });
    }

    // Check if alumni already has a pending application (by alumniid)
    const pendingApp = await sql/* sql */`
      SELECT id, status FROM public.chapter_leadership 
      WHERE alumniid = ${alumniIdNum} AND status = 'pending'
      LIMIT 1
    `;
    
    if (pendingApp && pendingApp.length > 0) {
      return NextResponse.json({ 
        error: "You already have a pending application. Please wait for admin approval." 
      }, { status: 400 });
    }

    // Check if alumni already has an approved leadership position
    const approvedApp = await sql/* sql */`
      SELECT cl.id, cl.status 
      FROM public.chapter_leadership cl
      INNER JOIN public.tbl_alumni a ON a.chapter_leadership = cl.id
      WHERE a.alumniid = ${alumniIdNum} AND cl.status = 'approved'
      LIMIT 1
    `;
    
    if (approvedApp && approvedApp.length > 0) {
      return NextResponse.json({ 
        error: "You are already approved as a leader. No further application is required." 
      }, { status: 400 });
    }

    // Also check if there's a rejected application that we should allow resubmission
    // (Optional: you might want to block resubmission of rejected apps too)

    // Insert new record with status='pending' (DO NOT link to tbl_alumni yet)
    // Store alumniid for reference (aligned with schema)
    // Use INSERT with ON CONFLICT to prevent duplicates (if unique constraint exists)
    const newChapterLeadership = await sql/* sql */`
      INSERT INTO public.chapter_leadership (
        post,
        created_at,
        status,
        updated_at,
        alumniid,
        additional_achievements,
        cv_file_url,
        additional_file1_url,
        additional_file2_url
      )
      VALUES (
        ${postDisplayName},
        NOW(),
        'pending',
        NOW(),
        ${alumniIdNum},
        ${additionalAchievementsValue},
        ${cvFileUrlValue},
        ${additionalFile1UrlValue},
        ${additionalFile2UrlValue}
      )
      RETURNING id, status
    `;
    
    if (!newChapterLeadership || newChapterLeadership.length === 0) {
      throw new Error("Failed to create chapter leadership record");
    }
    
    const createdRecord = newChapterLeadership[0] as { id: number; status: string };

    if (confirmedCriteriaIds.length > 0) {
      await sql/* sql */`
        INSERT INTO public.leadership_criteria_confirmations (
          leadership_type,
          chapter_application_id,
          criterion_id,
          actor_type,
          confirmed,
          created_at
        )
        SELECT
          'chapter',
          ${Number(createdRecord.id)},
          c.id,
          'alumni',
          true,
          NOW()
        FROM public.leadership_role_criteria c
        WHERE c.id = ANY(${confirmedCriteriaIds}::bigint[])
        ON CONFLICT (chapter_application_id, criterion_id, actor_type) DO NOTHING
      `;
    }

    // Verify the record was created with 'pending' status
    if (createdRecord.status !== 'pending') {

    }

    try {
      const alumniRows = await sql/* sql */`
        SELECT
          alumniname,
          COALESCE(personalemail, officialemail, universityemail, alumniemail) AS email
        FROM public.tbl_alumni
        WHERE alumniid = ${alumniIdNum}
        LIMIT 1
      `;

      const alumni = alumniRows[0] as { alumniname?: string | null; email?: string | null } | undefined;
      const recipientEmail = String(alumni?.email || "").trim();
      const alumniName = String(alumni?.alumniname || "Alumni").trim() || "Alumni";

      if (recipientEmail && recipientEmail.includes("@")) {
        const tpl = generateAdminActionEmail({
          actionType: EMAIL_ACTION_TYPE.CHAPTER_LEADERSHIP_ACK,
          alumniName,
        });

        const html = tpl.html.replaceAll("{ROLE}", postDisplayName);

        const emailRes = await sendEmailDetailed({
          to: recipientEmail,
          subject: tpl.subject,
          html,
        });

        await insertEmailLog({
          recipientEmail,
          alumniId: alumniIdNum,
          subject: tpl.subject,
          body: html,
          status: emailRes.ok ? EMAIL_LOG_STATUS.SENT : EMAIL_LOG_STATUS.FAILED,
          errorMessage: emailRes.ok ? null : emailRes.errorMessage ?? "Unknown error",
          triggeredBy: EMAIL_TRIGGERED_BY.AUTO,
          actionType: EMAIL_ACTION_TYPE.CHAPTER_LEADERSHIP_ACK,
        });
      }
    } catch {
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

