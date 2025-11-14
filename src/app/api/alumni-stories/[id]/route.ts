import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const alumniid = Number(id);
    const rows = await sql/* sql */`
      SELECT 
        s.alumniid,
        s.alumnistories,
        s.alumniimage,
        s.status,
        s.createdat,
        a.alumniname,
        a.degreetitle,
        a.academicsession
      FROM public.tblalumnistories s
      JOIN public.tbl_alumni a ON a.alumniid = s.alumniid
      WHERE s.alumniid = ${alumniid}
      LIMIT 1`;
    const r = rows[0];
    if (!r) return NextResponse.json({ message: "Not found" }, { status: 404 });
    const result = {
      id: String(r.alumniid ?? ""),
      date: r.createdat ? new Date(r.createdat).toISOString() : new Date().toISOString(),
      name: String(r.alumniname ?? ""),
      program: String(r.degreetitle ?? ""),
      session: String(r.academicsession ?? ""),
      shortDescription: String(r.alumnistories ?? ""),
      imageUrl: String(r.alumniimage ?? ""),
    };
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch story";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const alumniid = Number(id);
    const res = await sql/* sql */`
      DELETE FROM public.tblalumnistories WHERE alumniid = ${alumniid} RETURNING alumniid`;
    if (!res[0]) return NextResponse.json({ message: "Not found" }, { status: 404 });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to delete";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}