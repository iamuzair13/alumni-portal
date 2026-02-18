import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { canModify } from "@/lib/alumniProfile";
import { sql } from "@/lib/dbconnect";
import { EMAIL_ACTION_TYPE, generateAdminActionEmail } from "@/lib/emailTemplates";

type EmailPreviewBody = {
  actionType: string;
  alumniId: number;
};

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!canModify(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const payload = (await req.json().catch(() => null)) as Partial<EmailPreviewBody> | null;
    const actionType = String(payload?.actionType ?? "").trim();
    const alumniId = Number(payload?.alumniId);

    if (!actionType) {
      return NextResponse.json({ error: "actionType is required" }, { status: 400 });
    }

    if (!Number.isFinite(alumniId) || alumniId <= 0) {
      return NextResponse.json({ error: "Invalid alumniId" }, { status: 400 });
    }

    if (actionType !== EMAIL_ACTION_TYPE.ALUMNI_VERIFY) {
      return NextResponse.json({ error: "Unsupported actionType for preview" }, { status: 400 });
    }

    const rows = await sql/* sql */`
      SELECT alumniid, alumniname, sapid, registrationno, password
      FROM public.tbl_alumni
      WHERE alumniid = ${alumniId}
      LIMIT 1
    `;

    const alumni = rows[0] as
      | {
          alumniid: number;
          alumniname: string | null;
          sapid: string | null;
          registrationno: string | null;
          password: string | null;
        }
      | undefined;

    if (!alumni) {
      return NextResponse.json({ error: "Alumni not found" }, { status: 404 });
    }

    const storedPassword = String(alumni.password || "").trim();
    if (!storedPassword) {
      return NextResponse.json({ error: "PASSWORD_NOT_SET" }, { status: 400 });
    }
    const passwordToSend = storedPassword;

    const alumniName = String(alumni.alumniname || "Alumni").trim() || "Alumni";
    const tpl = generateAdminActionEmail({
      actionType: EMAIL_ACTION_TYPE.ALUMNI_VERIFY,
      alumniName,
      sapId: alumni.sapid,
      regNo: alumni.registrationno,
      generatedPassword: passwordToSend,
    });

    return NextResponse.json({
      ok: true,
      subject: tpl.subject,
      body: tpl.html,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate preview";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
