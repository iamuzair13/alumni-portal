import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/auth";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    const email = String(session.user.email);
    const rows = await sql/* sql */`
      SELECT alumniid, alumniname, facultyname, degreetitle, academicsession
      FROM public.tbl_alumni
      WHERE personalemail = ${email} OR officialemail = ${email} OR universityemail = ${email}
      ORDER BY alumniid DESC LIMIT 1`;
    const r = rows[0] as { alumniid: number; alumniname?: string | null; facultyname?: string | null; degreetitle?: string | null; academicsession?: string | null } | undefined;
    if (!r?.alumniid) return NextResponse.json({ error: "ALUMNI_NOT_FOUND" }, { status: 404 });
    const result = {
      alumniid: r.alumniid,
      name: r.alumniname ?? null,
      faculty: r.facultyname ?? null,
      degree: r.degreetitle ?? null,
      session: r.academicsession ?? null,
    };
    return NextResponse.json({ item: result }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch profile";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}