import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";

export async function GET() {
  try {
    const rows = await sql/* sql */`
      SELECT 
        a.alumniid,
        a.sapid,
        a.alumniname,
        COALESCE(a.personalemail, a.officialemail, a.universityemail) AS email,
        a.yearofending,
        a.facultyname,
        a.departmentname,
        a.degreetitle,
        c.status,
        c.createdat
      FROM public.tblcard c
      JOIN public.tbl_alumni a ON a.alumniid = c.alumniid
      ORDER BY c.createdat DESC`;
    return NextResponse.json({ items: rows }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}