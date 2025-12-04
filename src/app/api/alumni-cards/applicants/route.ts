import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { buildAccessFilterSQL } from "@/lib/userAccess";

export async function GET(request: Request) {
  try {
    const session = await auth();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status"); // "all" | "active" | "pending" | "onhold" | null
    
    // Build access filter for admin/viewer users
    const accessFilter = await buildAccessFilterSQL(session, "");
    const accessFilterCondition = accessFilter.hasFilter && accessFilter.sql ? sql` AND (${accessFilter.sql})` : sql``;
    
    // Build status filter
    // Note: NULL status should be treated as "pending" (default status)
    let statusCondition = sql``;
    if (status && status !== "all") {
      if (status === "active") {
        statusCondition = sql` AND c.status IS NOT NULL AND LOWER(TRIM(c.status)) = 'delivered'`;
      } else if (status === "pending") {
        // Include anything that's NOT 'delivered' or 'rejected' (NULL, empty string, 'pending', or any other value)
        statusCondition = sql` AND NOT (c.status IS NOT NULL AND TRIM(c.status) != '' AND LOWER(TRIM(c.status)) IN ('delivered', 'rejected'))`;
      } else if (status === "onhold") {
        statusCondition = sql` AND c.status IS NOT NULL AND LOWER(TRIM(c.status)) = 'rejected'`;
      }
    }
    
    // Fetch cards with status filter
    const rows = await sql/* sql */`
      SELECT 
        a.alumniid,
        a.sapid,
        a.alumniname,
        COALESCE(a.personalemail, a.officialemail, a.universityemail) AS email,
        a.yearofending,
        a.facultyname,
        a.departmentname,
        a.degreetitle,
        c.status,
        c.createdat
      FROM public.tblcard c
      JOIN public.tbl_alumni a ON a.alumniid = c.alumniid
      WHERE 1=1
        ${accessFilterCondition}
        ${statusCondition}
      ORDER BY c.createdat DESC`;
    
    // Fetch counts for all statuses
    // Handle null status values, empty strings, and case-insensitive matching
    // Anything that's NOT 'delivered' or 'rejected' should be treated as "pending" (default status)
    // This ensures: all_count = active_count + pending_count + onhold_count
    const counts = await sql/* sql */`
      SELECT 
        COUNT(*) FILTER (WHERE c.status IS NOT NULL AND TRIM(c.status) != '' AND LOWER(TRIM(c.status)) = 'delivered') as active_count,
        COUNT(*) FILTER (WHERE NOT (c.status IS NOT NULL AND TRIM(c.status) != '' AND LOWER(TRIM(c.status)) IN ('delivered', 'rejected'))) as pending_count,
        COUNT(*) FILTER (WHERE c.status IS NOT NULL AND TRIM(c.status) != '' AND LOWER(TRIM(c.status)) = 'rejected') as onhold_count,
        COUNT(*) as all_count
      FROM public.tblcard c
      JOIN public.tbl_alumni a ON a.alumniid = c.alumniid
      WHERE 1=1
        ${accessFilterCondition}`;
    
    const countRow = counts[0] as {
      active_count: bigint | number;
      pending_count: bigint | number;
      onhold_count: bigint | number;
      all_count: bigint | number;
    } | undefined;
    
    // Convert bigint to number safely
    const allCount = countRow?.all_count ? Number(countRow.all_count) : 0;
    const activeCount = countRow?.active_count ? Number(countRow.active_count) : 0;
    const pendingCount = countRow?.pending_count ? Number(countRow.pending_count) : 0;
    const onholdCount = countRow?.onhold_count ? Number(countRow.onhold_count) : 0;
    
    return NextResponse.json({ 
      items: rows,
      counts: {
        all: allCount,
        active: activeCount,
        pending: pendingCount,
        onhold: onholdCount,
      }
    }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}