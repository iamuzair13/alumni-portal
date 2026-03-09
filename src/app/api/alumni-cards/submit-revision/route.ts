import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { sql } from "@/lib/dbconnect";

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as { sapId?: string };
    const sapId = String(body?.sapId || "").trim();
    if (!sapId) {
      return NextResponse.json({ error: "sapId is required" }, { status: 400 });
    }

    const sessionSapid = (session.user as { sapid?: string | null })?.sapid ? String((session.user as { sapid?: string | null }).sapid).trim() : "";
    const sessionRegNo = (session.user as { registrationno?: string | null })?.registrationno ? String((session.user as { registrationno?: string | null }).registrationno).trim() : "";

    const sessionAlumniIdRaw = (session.user as { userId?: number | string | null; alumniid?: number | string | null })?.userId ??
      (session.user as { userId?: number | string | null; alumniid?: number | string | null })?.alumniid ??
      null;
    const sessionAlumniId = sessionAlumniIdRaw !== null && sessionAlumniIdRaw !== undefined && String(sessionAlumniIdRaw).trim() !== ""
      ? Number(sessionAlumniIdRaw)
      : null;

    // Ownership check:
    // - Alumni sessions often carry alumniid as userId. Prefer verifying by alumniid.
    // - Fallback to sapid/registrationno string match for older sessions.
    let isOwner = (sessionSapid && sessionSapid === sapId) || (sessionRegNo && sessionRegNo === sapId);
    if (!isOwner && sessionAlumniId && Number.isFinite(sessionAlumniId) && sessionAlumniId > 0) {
      const ownerRows = await sql/* sql */`
        SELECT alumniid
        FROM public.tbl_alumni
        WHERE alumniid = ${sessionAlumniId}
          AND (
            TRIM(COALESCE(sapid, '')) = ${sapId}
            OR TRIM(COALESCE(registrationno, '')) = ${sapId}
          )
        LIMIT 1
      ` as Array<{ alumniid: number }>;
      isOwner = !!ownerRows[0];
    }

    if (!isOwner) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const rows = await sql/* sql */`
      UPDATE public.tblcard c
      SET status = 'UnderReview', reason_onhold = NULL
      FROM public.tbl_alumni a
      WHERE a.alumniid = c.alumniid
        AND (
          TRIM(COALESCE(a.sapid, '')) = ${sapId}
          OR TRIM(COALESCE(a.registrationno, '')) = ${sapId}
        )
        AND UPPER(TRIM(COALESCE(c.status, ''))) = 'ONHOLD'
      RETURNING c.cardid
    ` as Array<{ cardid: number }>;

    if (!rows[0]) {
      return NextResponse.json(
        { error: "Revision can only be submitted when the card is On Hold." },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true, cardid: rows[0].cardid }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}
