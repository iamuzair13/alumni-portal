import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const alumniid = Number(id);
    if (!alumniid) return NextResponse.json({ error: "invalid id" }, { status: 400 });
    const rows = await sql/* sql */`
      SELECT cardid, alumniid, cnicno, cardaddress, delivery_city, delivery_society_name, delivery_street_no, delivery_house_no, status, cardpicture, card_image, createdat, validity_date
      FROM public.tblcard WHERE alumniid = ${alumniid}
      ORDER BY cardid DESC LIMIT 1`;
    const r = rows[0];
    if (!r) return NextResponse.json({ message: "Not found" }, { status: 404 });
    return NextResponse.json({ card: r }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}