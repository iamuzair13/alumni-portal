import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";

export async function GET() {
  try {
    const rows = await sql/* sql */`
      SELECT 
        id,
        faculty_name AS title,
        NULL::text AS description,
        NULL::text AS dean,
        NULL::text AS phone,
        NULL::text AS email,
        NULL::text AS address,
        created_at
      FROM public.tbl_faculties
      ORDER BY faculty_name ASC
    `;
    
    const associations = rows.map((r: Record<string, unknown>) => ({
      id: Number(r.id),
      title: String(r.title || ""),
      description: r.description ? String(r.description) : null,
      dean: r.dean ? String(r.dean) : null,
      phone: r.phone ? String(r.phone) : null,
      email: r.email ? String(r.email) : null,
      address: r.address ? String(r.address) : null,
    }));
    return NextResponse.json({ associations }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch associations";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

