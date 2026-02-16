import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { sql } from "@/lib/dbconnect";
import { sendEmailDetailed } from "@/lib/email";
import { EMAIL_ACTION_TYPE, generateAdminActionEmail } from "@/lib/emailTemplates";
import {
  EMAIL_LOG_STATUS,
  EMAIL_TRIGGERED_BY,
  insertEmailLog,
} from "@/lib/emailLogs";

type Payload = {
  discountType?: string;
  applyingFor?: string;
  degreeTitle?: string;
  kinshipRelation?: string | null;
  kinshipFirstName?: string | null;
  kinshipLastName?: string | null;
  kinshipCnic?: string | null;
  fatherCnic?: string | null;
};

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ sapid: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }

    const { sapid } = await ctx.params;
    const normalizedSapid = String(sapid || "").trim();
    if (!normalizedSapid) {
      return NextResponse.json({ error: "Invalid SAP ID" }, { status: 400 });
    }

    const payload = (await req.json()) as Payload;
    const discountType = String(payload.discountType || "").trim();
    const applyingFor = String(payload.applyingFor || "").trim();
    const degreeTitle = String(payload.degreeTitle || "").trim();

    if (!discountType || !applyingFor || !degreeTitle) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const alumniRows = await sql/* sql */`
      SELECT
        alumniid,
        sapid,
        registrationno,
        alumniname,
        personalemail,
        officialemail,
        universityemail,
        alumniemail
      FROM public.tbl_alumni
      WHERE TRIM(COALESCE(sapid, '')) = ${normalizedSapid}
         OR TRIM(COALESCE(registrationno, '')) = ${normalizedSapid}
      ORDER BY alumniid DESC
      LIMIT 1
    `;

    const alumni = alumniRows[0] as
      | {
          alumniid: number;
          sapid: string | null;
          registrationno: string | null;
          alumniname: string | null;
          personalemail: string | null;
          officialemail: string | null;
          universityemail: string | null;
          alumniemail: string | null;
        }
      | undefined;

    if (!alumni?.alumniid) {
      return NextResponse.json({ error: "Alumni not found" }, { status: 404 });
    }

    const userEmail = session.user.email
      ? String(session.user.email).toLowerCase().trim()
      : null;
    const userSapid = (session.user as { sapid?: string | null })?.sapid
      ? String((session.user as { sapid?: string | null }).sapid)
          .toLowerCase()
          .trim()
      : null;
    const userRegNo = (session.user as { registrationno?: string | null })?.registrationno
      ? String((session.user as { registrationno?: string | null }).registrationno)
          .toLowerCase()
          .trim()
      : null;

    const isOwnerBySapid =
      userSapid &&
      String(alumni.sapid ?? "").toLowerCase().trim() === userSapid;
    const isOwnerByRegNo =
      userRegNo &&
      String(alumni.registrationno ?? "").toLowerCase().trim() === userRegNo;
    const isOwnerByEmail = userEmail
      ? [alumni.personalemail, alumni.officialemail, alumni.universityemail, alumni.alumniemail]
          .filter(Boolean)
          .some((e) => String(e).toLowerCase().trim() === userEmail)
      : false;

    const isOwner = Boolean(isOwnerBySapid || isOwnerByRegNo || isOwnerByEmail);
    if (!isOwner) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const kinshipFirstName = payload.kinshipFirstName
      ? String(payload.kinshipFirstName).trim()
      : null;
    const kinshipLastName = payload.kinshipLastName
      ? String(payload.kinshipLastName).trim()
      : null;
    const kinshipCnic = payload.kinshipCnic ? String(payload.kinshipCnic).trim() : null;

    await sql/* sql */`
      INSERT INTO public.alumni_scholarships (
        id,
        created_at,
        kinship_firstname,
        kinship_lastname,
        kinship_cnic,
        apply_for,
        degree_title,
        status
      ) VALUES (
        ${alumni.alumniid},
        NOW(),
        ${kinshipFirstName},
        ${kinshipLastName},
        ${kinshipCnic},
        ${applyingFor},
        ${degreeTitle},
        'pending'
      )
    `;

    const alumniName = String(alumni.alumniname || "Alumni").trim() || "Alumni";
    const recipientEmail = String(
      alumni.personalemail || alumni.officialemail || alumni.universityemail || alumni.alumniemail || ""
    ).trim();

    let emailSent: boolean | null = null;
    let emailError: string | null = null;

    if (recipientEmail && recipientEmail.includes("@")) {
      const tpl = generateAdminActionEmail({
        actionType: EMAIL_ACTION_TYPE.ALUMNI_SCHOLARSHIP_RECEIVED,
        alumniName,
      });

      const emailRes = await sendEmailDetailed({
        to: recipientEmail,
        subject: tpl.subject,
        html: tpl.html,
      });

      emailSent = emailRes.ok;
      emailError = emailRes.ok ? null : emailRes.errorMessage ?? "Unknown error";

      await insertEmailLog({
        recipientEmail,
        alumniId: alumni.alumniid,
        subject: tpl.subject,
        body: tpl.html,
        status: emailRes.ok ? EMAIL_LOG_STATUS.SENT : EMAIL_LOG_STATUS.FAILED,
        errorMessage: emailRes.ok ? null : emailError,
        triggeredBy: EMAIL_TRIGGERED_BY.AUTO,
        actionType: EMAIL_ACTION_TYPE.ALUMNI_SCHOLARSHIP_RECEIVED,
      });
    }

    return NextResponse.json(
      {
        ok: true,
        message: "Scholarship application submitted successfully",
        emailSent,
        emailError,
      },
      { status: 201 }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to submit scholarship application";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
