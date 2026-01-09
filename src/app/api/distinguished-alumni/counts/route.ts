import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";

export async function GET() {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch total count from distinguished_alumni table
    const countResult = await sql/* sql */`
      SELECT COUNT(*) as total
      FROM public.distinguished_alumni
    `;
    
    const total = countResult[0]?.total ? Number(countResult[0].total) : 0;

    return NextResponse.json({
      total
    }, { status: 200 });
  } catch (error) {
    console.error("[API] Error fetching distinguished alumni counts:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch counts" },
      { status: 500 }
    );
  }
}
