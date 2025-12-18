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
    // Database values: "Pending", "Process", "Active", "Delivered", "Onhold"
    // NULL or empty status should be treated as "Pending" (default status)
    let statusCondition = sql``;
    if (status && status !== "all") {
      if (status === "pending") {
        // Pending: NULL, empty, or "Pending"
        statusCondition = sql` AND (c.status IS NULL OR TRIM(c.status) = '' OR UPPER(TRIM(c.status)) = 'PENDING')`;
      } else if (status === "process") {
        // Process: "Process" (note: "inprocess" maps to "Process" in database)
        statusCondition = sql` AND c.status IS NOT NULL AND UPPER(TRIM(c.status)) = 'PROCESS'`;
      } else if (status === "active") {
        // Active: "Active"
        statusCondition = sql` AND c.status IS NOT NULL AND UPPER(TRIM(c.status)) = 'ACTIVE'`;
      } else if (status === "delivered") {
        // Delivered: "Delivered"
        statusCondition = sql` AND c.status IS NOT NULL AND UPPER(TRIM(c.status)) = 'DELIVERED'`;
      } else if (status === "onhold") {
        // Onhold: "Onhold"
        statusCondition = sql` AND c.status IS NOT NULL AND UPPER(TRIM(c.status)) = 'ONHOLD'`;
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
        f.faculty_name as facultyname,
        d.department_name as departmentname,
        COALESCE(p.program_name, a.degreetitle) as degreetitle,
        c.status,
        c.createdat
      FROM public.tblcard c
      JOIN public.tbl_alumni a ON a.alumniid = c.alumniid
      LEFT JOIN public.tbl_faculties f ON f.id = a.faculty
      LEFT JOIN public.tbl_departments d ON d.id = a.department
      LEFT JOIN public.tbl_programs p ON p.id = a.program
      WHERE 1=1
        ${accessFilterCondition}
        ${statusCondition}
      ORDER BY c.createdat DESC`;
    
    // Fetch counts for all statuses
    // Database values: "Pending", "Process", "Active", "Delivered", "Onhold"
    // NULL or empty status should be treated as "Pending" (default status)
    const counts = await sql/* sql */`
      SELECT 
        COUNT(*) FILTER (WHERE c.status IS NULL OR TRIM(c.status) = '' OR UPPER(TRIM(c.status)) = 'PENDING') as pending_count,
        COUNT(*) FILTER (WHERE c.status IS NOT NULL AND UPPER(TRIM(c.status)) = 'PROCESS') as process_count,
        COUNT(*) FILTER (WHERE c.status IS NOT NULL AND UPPER(TRIM(c.status)) = 'ACTIVE') as active_count,
        COUNT(*) FILTER (WHERE c.status IS NOT NULL AND UPPER(TRIM(c.status)) = 'DELIVERED') as delivered_count,
        COUNT(*) FILTER (WHERE c.status IS NOT NULL AND UPPER(TRIM(c.status)) = 'ONHOLD') as onhold_count,
        COUNT(*) as all_count
      FROM public.tblcard c
      JOIN public.tbl_alumni a ON a.alumniid = c.alumniid
      WHERE 1=1
        ${accessFilterCondition}`;
    
    const countRow = counts[0] as {
      pending_count: bigint | number;
      process_count: bigint | number;
      active_count: bigint | number;
      delivered_count: bigint | number;
      onhold_count: bigint | number;
      all_count: bigint | number;
    } | undefined;
    
    // Convert bigint to number safely
    const allCount = countRow?.all_count ? Number(countRow.all_count) : 0;
    const pendingCount = countRow?.pending_count ? Number(countRow.pending_count) : 0;
    const processCount = countRow?.process_count ? Number(countRow.process_count) : 0;
    const activeCount = countRow?.active_count ? Number(countRow.active_count) : 0;
    const deliveredCount = countRow?.delivered_count ? Number(countRow.delivered_count) : 0;
    const onholdCount = countRow?.onhold_count ? Number(countRow.onhold_count) : 0;
    
    return NextResponse.json({ 
      items: rows,
      counts: {
        all: allCount,
        pending: pendingCount,
        process: processCount,
        active: activeCount,
        delivered: deliveredCount,
        onhold: onholdCount,
      }
    }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}