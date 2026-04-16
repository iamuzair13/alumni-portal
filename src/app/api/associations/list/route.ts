import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";

export async function GET() {
  try {
    const rows = await sql/* sql */`
      SELECT 
        id,
        COALESCE(
          NULLIF(TRIM(to_jsonb(a) ->> 'title'), ''),
          NULLIF(TRIM(to_jsonb(a) ->> 'association_name'), ''),
          NULLIF(TRIM(to_jsonb(a) ->> 'name'), ''),
          NULLIF(TRIM(to_jsonb(a) ->> 'faculty_name'), ''),
          ('Association #' || id::text)
        ) AS title,
        NULLIF(TRIM(to_jsonb(a) ->> 'description'), '') AS description,
        NULLIF(TRIM(to_jsonb(a) ->> 'dean'), '') AS dean,
        NULLIF(TRIM(to_jsonb(a) ->> 'phone'), '') AS phone,
        NULLIF(TRIM(to_jsonb(a) ->> 'email'), '') AS email,
        NULLIF(TRIM(to_jsonb(a) ->> 'address'), '') AS address
      FROM public.tbl_associations a
      ORDER BY title ASC
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

