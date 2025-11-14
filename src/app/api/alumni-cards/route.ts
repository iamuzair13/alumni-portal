import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const alumniId = Number(body?.alumniId);
    if (!alumniId) return NextResponse.json({ error: "alumniId required" }, { status: 400 });
    const cnicno = String(body?.cnicno || "");
    const cardaddress = String(body?.cardaddress || "");
    const status = String(body?.status || "requested");
    const cardpicture = String(body?.cardpicture || "profile").slice(0, 50);
    const rows = await sql/* sql */`
      INSERT INTO public.tblcard (alumniid, cnicno, cardaddress, status, cardpicture, createdat)
      VALUES (${alumniId}, ${cnicno}, ${cardaddress}, ${status}, ${cardpicture}, NOW())
      ON CONFLICT (alumniid) DO UPDATE
      SET cnicno = EXCLUDED.cnicno,
          cardaddress = EXCLUDED.cardaddress,
          status = EXCLUDED.status,
          cardpicture = EXCLUDED.cardpicture,
          createdat = NOW()
      RETURNING cardid`;
    return NextResponse.json({ cardid: rows[0]?.cardid }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to create card";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}