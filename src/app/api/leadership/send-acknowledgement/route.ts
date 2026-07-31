import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { canModify } from "@/lib/alumniProfile";
import { logAdminAction } from "@/lib/adminActivityLog";
import { sendEmailDetailed } from "@/lib/email";
import {
  EMAIL_LOG_STATUS,
  EMAIL_TRIGGERED_BY,
  insertEmailLog,
} from "@/lib/emailLogs";
import {
  EMAIL_ACTION_TYPE,
  generateAdminActionEmail,
} from "@/lib/emailTemplates";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canModify(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { applicationId, type } = body as {
      applicationId?: number;
      type?: "chapter" | "association";
    };

    if (!applicationId || !type) {
      return NextResponse.json(
        { error: "Missing required fields: applicationId, type" },
        { status: 400 },
      );
    }

    if (type !== "chapter" && type !== "association") {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    // Fetch application + alumni details
    let alumniId: number | null = null;
    let alumniName = "";
    let alumniEmail = "";
    let positionTitle = "";
    let orgName = "";

    if (type === "chapter") {
      const rows = await sql/* sql */`
        SELECT
          cl.id,
          cl.post,
          cl.status,
          cl.alumniid,
          a.alumniname,
          a.personalemail,
          a.officialemail,
          a.universityemail,
          ch.national_chapter,
          ch.international_chapter
        FROM public.chapter_leadership cl
        LEFT JOIN public.tbl_alumni a ON a.alumniid = cl.alumniid
        LEFT JOIN public.tblchapters ch ON ch.id = cl.chapter_id
        WHERE cl.id = ${Number(applicationId)}
        LIMIT 1
      `;

      if (!rows || rows.length === 0) {
        return NextResponse.json({ error: "Application not found" }, { status: 404 });
      }

      const r = rows[0] as Record<string, unknown>;
      alumniId = Number(r.alumniid) || null;
      alumniName = String(r.alumniname ?? "");
      alumniEmail =
        String(r.personalemail ?? "") ||
        String(r.officialemail ?? "") ||
        String(r.universityemail ?? "");
      positionTitle = String(r.post ?? "");
      orgName =
        String(r.national_chapter ?? "") ||
        String(r.international_chapter ?? "") ||
        "your selected chapter";
    } else {
      const rows = await sql/* sql */`
        SELECT
          ass.id,
          ass.q3,
          ass.status,
          ass.alumni_id,
          a.alumniname,
          a.personalemail,
          a.officialemail,
          a.universityemail,
          fac.faculty_name as association_name
        FROM public.tblalumniassociation ass
        LEFT JOIN public.tbl_alumni a ON a.alumniid = ass.alumni_id
        LEFT JOIN public.tbl_faculties fac ON fac.id = ass.association_id
        WHERE ass.id = ${Number(applicationId)}
        LIMIT 1
      `;

      if (!rows || rows.length === 0) {
        return NextResponse.json({ error: "Application not found" }, { status: 404 });
      }

      const r = rows[0] as Record<string, unknown>;
      alumniId = Number(r.alumni_id) || null;
      alumniName = String(r.alumniname ?? "");
      alumniEmail =
        String(r.personalemail ?? "") ||
        String(r.officialemail ?? "") ||
        String(r.universityemail ?? "");
      positionTitle = String(r.q3 ?? "");
      orgName = String(r.association_name ?? "") || "the Alumni Association";
    }

    if (!alumniEmail || !alumniEmail.includes("@")) {
      return NextResponse.json(
        { error: "Applicant does not have a valid email address" },
        { status: 400 },
      );
    }

    // Check for duplicate acknowledgement
    const existingLogs = await sql/* sql */`
      SELECT id, status, created_at
      FROM public.email_logs
      WHERE alumni_id = ${alumniId}
        AND action_type = ${EMAIL_ACTION_TYPE.LEADERSHIP_ACKNOWLEDGEMENT}
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (existingLogs && existingLogs.length > 0) {
      const lastLog = existingLogs[0] as {
        id: number;
        status: string;
        created_at: string;
      };
      return NextResponse.json({
        ok: false,
        alreadySent: true,
        lastSentAt: lastLog.created_at,
        lastStatus: lastLog.status,
        message:
          lastLog.status === EMAIL_LOG_STATUS.SENT
            ? "Acknowledgement email was already sent to this applicant."
            : "A previous acknowledgement email attempt failed. You can try sending again.",
      });
    }

    // Generate email content
    const tpl = generateAdminActionEmail({
      actionType: EMAIL_ACTION_TYPE.LEADERSHIP_ACKNOWLEDGEMENT,
      alumniName: alumniName || "Alumni",
    });

    const emailHtml = tpl.html
      .replaceAll("{POSITION_TITLE}", positionTitle || "the leadership position")
      .replaceAll("{ORG}", orgName);

    // Send email
    const res = await sendEmailDetailed({
      to: alumniEmail,
      subject: tpl.subject,
      html: emailHtml,
    });

    // Log email
    await insertEmailLog({
      recipientEmail: alumniEmail,
      alumniId,
      subject: tpl.subject,
      body: emailHtml,
      status: res.ok ? EMAIL_LOG_STATUS.SENT : EMAIL_LOG_STATUS.FAILED,
      errorMessage: res.ok ? null : res.errorMessage ?? "Unknown error",
      triggeredBy: EMAIL_TRIGGERED_BY.ADMIN_ACTION,
      actionType: EMAIL_ACTION_TYPE.LEADERSHIP_ACKNOWLEDGEMENT,
    });

    await logAdminAction({
      session,
      req,
      input: {
        action: "leadership.send_acknowledgement",
        entityType: type === "chapter" ? "chapter_leadership" : "tblalumniassociation",
        entityId: Number(applicationId),
        metadata: { type, alumniId, alumniEmail, positionTitle },
      },
    });

    return NextResponse.json({
      ok: res.ok,
      alreadySent: false,
      errorMessage: res.ok ? undefined : res.errorMessage,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to send acknowledgement";
    console.error("[leadership][send-acknowledgement] failed", {
      message: msg,
      stack: err instanceof Error ? err.stack : undefined,
    });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
