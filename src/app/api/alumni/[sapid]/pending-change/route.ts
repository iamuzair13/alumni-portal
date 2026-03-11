import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { canModify } from "@/lib/alumniProfile";

function parseJsonbRecord(v: unknown): Record<string, unknown> {
  if (!v) return {};
  if (typeof v === "object") return v as Record<string, unknown>;
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return {};
    try {
      const parsed = JSON.parse(s) as unknown;
      if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
      return {};
    } catch {
      return {};
    }
  }
  return {};
}

export async function GET(_: Request, ctx: { params: Promise<{ sapid: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sapid } = await ctx.params;
    const normalizedIdentifier = String(sapid || "").trim();

    const rows = await sql/* sql */`
      SELECT alumniid, sapid, registrationno, personalemail, universityemail, officialemail, change_approval
      FROM public.tbl_alumni
      WHERE sapid = ${normalizedIdentifier}
         OR registrationno = ${normalizedIdentifier}
         OR (alumniid::text = ${normalizedIdentifier})
      LIMIT 1
    `;

    if (!rows[0]) {
      return NextResponse.json({ error: "Alumni not found" }, { status: 404 });
    }

    const row = rows[0] as Record<string, unknown>;
    const alumniId = Number(row.alumniid);
    if (!alumniId || !Number.isFinite(alumniId)) {
      return NextResponse.json({ error: "Invalid alumni record" }, { status: 400 });
    }

    const userEmail = session.user.email ? String(session.user.email) : null;
    const userSapid = (session.user as { sapid?: string | null })?.sapid ? String((session.user as { sapid?: string | null }).sapid) : null;
    const userRegNo = (session.user as { registrationno?: string | null })?.registrationno ? String((session.user as { registrationno?: string | null }).registrationno) : null;

    const isOwnerBySapid = userSapid && String(row.sapid ?? "").toLowerCase().trim() === userSapid.toLowerCase().trim();
    const isOwnerByRegNo = userRegNo && String(row.registrationno ?? "").toLowerCase().trim() === userRegNo.toLowerCase().trim();
    const isOwnerByEmail = userEmail && (
      String(row.personalemail ?? "").toLowerCase().trim() === userEmail.toLowerCase().trim() ||
      String(row.universityemail ?? "").toLowerCase().trim() === userEmail.toLowerCase().trim() ||
      String(row.officialemail ?? "").toLowerCase().trim() === userEmail.toLowerCase().trim()
    );

    const isOwner = isOwnerBySapid || isOwnerByRegNo || isOwnerByEmail;
    if (!isOwner && !canModify(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const approval = String(row.change_approval ?? "").toLowerCase().trim();
    if (approval !== "pending") {
      return NextResponse.json({ pending: false, request: null }, { status: 200 });
    }

    const reqRows = await sql/* sql */`
      SELECT id, alumni_id, old_data, new_data, status, created_at
      FROM public.tbl_alumni_change_requests
      WHERE alumni_id = ${alumniId} AND status = 'pending'
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (!reqRows[0]) {
      return NextResponse.json({ pending: false, request: null }, { status: 200 });
    }

    const r = reqRows[0] as Record<string, unknown>;

    return NextResponse.json(
      {
        pending: true,
        request: {
          id: r.id,
          alumni_id: r.alumni_id,
          status: r.status,
          created_at: r.created_at,
          old_data: parseJsonbRecord(r.old_data),
          new_data: parseJsonbRecord(r.new_data),
        },
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
