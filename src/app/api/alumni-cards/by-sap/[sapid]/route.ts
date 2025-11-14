import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";

export async function GET(_: Request, ctx: { params: Promise<{ sapid: string }> }) {
  try {
    const { sapid } = await ctx.params;
    const rows = await sql/* sql */`
      SELECT c.cardid, c.alumniid, c.cnicno, c.cardaddress, c.status, c.cardpicture, c.createdat
      FROM public.tblcard c
      JOIN public.tbl_alumni a ON a.alumniid = c.alumniid
      WHERE a.sapid = ${sapid}
      LIMIT 1`;
    const r = rows[0];
    if (!r) return NextResponse.json({ message: "Not found" }, { status: 404 });
    return NextResponse.json({ card: r }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ sapid: string }> }) {
  try {
    const { sapid } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const status = String(body?.status || "");
    if (!status || !["pending", "rejected", "delivered"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    const rows = await sql/* sql */`
      UPDATE public.tblcard c
      SET status = ${status}
      FROM public.tbl_alumni a
      WHERE a.alumniid = c.alumniid AND a.sapid = ${sapid}
      RETURNING c.cardid`;
    if (!rows[0]) return NextResponse.json({ message: "Not found" }, { status: 404 });
    return NextResponse.json({ cardid: rows[0].cardid }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}