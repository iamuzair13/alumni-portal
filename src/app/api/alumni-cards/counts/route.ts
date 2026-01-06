import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { buildAccessFilterSQL } from "@/lib/userAccess";

export async function GET() {
  try {
    const session = await auth();
    
    // Build access filter for admin/viewer users
    const accessFilter = await buildAccessFilterSQL(session, "");
    const accessFilterCondition = accessFilter.hasFilter && accessFilter.sql ? sql` AND (${accessFilter.sql})` : sql``;
    
    // Fetch counts for all statuses
    // Database values: "Pending", "Process", "Active", "Delivered", "Onhold", "UnderPrinting", "Printed"
    // NULL or empty status should be treated as "Pending" (default status)
    const counts = await sql/* sql */`
      SELECT 
        COUNT(*) FILTER (WHERE c.status IS NULL OR TRIM(c.status) = '' OR UPPER(TRIM(c.status)) = 'PENDING') as pending_count,
        COUNT(*) FILTER (WHERE c.status IS NOT NULL AND UPPER(TRIM(c.status)) = 'PROCESS') as process_count,
        COUNT(*) FILTER (WHERE c.status IS NOT NULL AND UPPER(TRIM(c.status)) = 'ACTIVE') as active_count,
        COUNT(*) FILTER (WHERE c.status IS NOT NULL AND UPPER(TRIM(c.status)) = 'DELIVERED') as delivered_count,
        COUNT(*) FILTER (WHERE c.status IS NOT NULL AND UPPER(TRIM(c.status)) = 'ONHOLD') as onhold_count,
        COUNT(*) FILTER (WHERE c.status IS NOT NULL AND UPPER(TRIM(c.status)) = 'UNDERPRINTING') as underprinting_count,
        COUNT(*) FILTER (WHERE c.status IS NOT NULL AND UPPER(TRIM(c.status)) = 'PRINTED') as printed_count,
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
      underprinting_count: bigint | number;
      printed_count: bigint | number;
      all_count: bigint | number;
    } | undefined;
    
    // Convert bigint to number safely
    const allCount = countRow?.all_count ? Number(countRow.all_count) : 0;
    const pendingCount = countRow?.pending_count ? Number(countRow.pending_count) : 0;
    const processCount = countRow?.process_count ? Number(countRow.process_count) : 0;
    const activeCount = countRow?.active_count ? Number(countRow.active_count) : 0;
    const deliveredCount = countRow?.delivered_count ? Number(countRow.delivered_count) : 0;
    const onholdCount = countRow?.onhold_count ? Number(countRow.onhold_count) : 0;
    const underprintingCount = countRow?.underprinting_count ? Number(countRow.underprinting_count) : 0;
    const printedCount = countRow?.printed_count ? Number(countRow.printed_count) : 0;
    
    return NextResponse.json({ 
      all: allCount,
      pending: pendingCount,
      process: processCount,
      active: activeCount,
      delivered: deliveredCount,
      onhold: onholdCount,
      underprinting: underprintingCount,
      printed: printedCount,
    }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

