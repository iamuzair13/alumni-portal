import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";

export async function GET() {
  try {
    const rows = await sql/* sql */`
      SELECT 
        id,
        title,
        description,
        dean,
        phone,
        email,
        address,
        created_at
      FROM public.tbl_associations
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
    
    console.log(`[API] Associations list: ${associations.length} total`);
    
    return NextResponse.json({ associations }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch associations";
    console.error("[API] Error fetching associations:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

