import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";

export async function GET() {
  try {
    const result = await sql/* sql */`
      SELECT DISTINCT 
        degreetitle,
        COUNT(*) as count
      FROM public.tbl_alumni
      WHERE degreetitle IS NOT NULL 
        AND TRIM(degreetitle) != ''
      GROUP BY degreetitle
      ORDER BY degreetitle ASC
    `;

    const programs = (result as unknown as Array<{ degreetitle: string; count: number | string | bigint }>).map((row) => ({
      program: row.degreetitle,
      count: Number(row.count || 0)
    }));

    return NextResponse.json({
      success: true,
      total: programs.length,
      totalAlumni: programs.reduce((sum, p) => sum + p.count, 0),
      programs
    }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch programs";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

