import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const alumniIdParam = searchParams.get("alumniId");
    
    if (!alumniIdParam) {
      return NextResponse.json({ error: "Alumni ID is required" }, { status: 400 });
    }
    
    const alumniId = parseInt(alumniIdParam, 10);
    if (isNaN(alumniId)) {
      return NextResponse.json({ error: "Invalid alumni ID" }, { status: 400 });
    }
    
    // Get the alumni's current association membership
    const rows = await sql/* sql */`
      SELECT 
        a.association_id,
        assoc.title,
        assoc.description,
        assoc.dean,
        assoc.phone,
        assoc.email,
        assoc.address
      FROM public.tbl_alumni a
      LEFT JOIN public.tbl_associations assoc ON assoc.id = a.association_id
      WHERE a.alumniid = ${alumniId}
      LIMIT 1
    `;
    
    if (rows.length === 0) {
      return NextResponse.json({ error: "Alumni not found" }, { status: 404 });
    }
    
    const association = rows[0].association_id ? {
      id: rows[0].association_id,
      title: rows[0].title,
      description: rows[0].description,
      dean: rows[0].dean,
      phone: rows[0].phone,
      email: rows[0].email,
      address: rows[0].address,
    } : null;
    
    return NextResponse.json({ association }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch association membership";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const userSapid = session?.user ? ((session.user as { sapid?: string | null })?.sapid ? String((session.user as { sapid?: string | null }).sapid) : null) : null;
    const userRegNo = session?.user ? ((session.user as { registrationno?: string | null })?.registrationno ? String((session.user as { registrationno?: string | null }).registrationno) : null) : null;
    
    if (!session?.user?.email && !userSapid && !userRegNo) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { alumniId, associationId } = body;

    if (!alumniId) {
      return NextResponse.json({ error: "Alumni ID is required" }, { status: 400 });
    }

    if (!associationId) {
      return NextResponse.json({ error: "Association ID is required" }, { status: 400 });
    }

    const alumniIdNum = Number(alumniId);
    const associationIdNum = Number(associationId);
    
    if (isNaN(alumniIdNum) || alumniIdNum <= 0) {
      return NextResponse.json({ error: "Invalid alumni ID" }, { status: 400 });
    }
    
    if (isNaN(associationIdNum) || associationIdNum <= 0) {
      return NextResponse.json({ error: "Invalid association ID" }, { status: 400 });
    }

    // Verify the association exists
    const associationRows = await sql/* sql */`
      SELECT id, title FROM public.tbl_associations 
      WHERE id = ${associationIdNum}
      LIMIT 1
    `;
    
    if (associationRows.length === 0) {
      return NextResponse.json({ error: "Association not found" }, { status: 404 });
    }

    // Update the alumni's association membership
    await sql/* sql */`
      UPDATE public.tbl_alumni
      SET association_id = ${associationIdNum}
      WHERE alumniid = ${alumniIdNum}
    `;

    return NextResponse.json({ 
      success: true,
      message: "Successfully joined the association",
      associationTitle: associationRows[0].title
    }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to join association";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

