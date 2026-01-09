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
    // Database values: "UnderReview", "UnderPrinting", "Active", "Onhold", "Delivered"
    // Legacy: "Pending" and "Process" are migrated to "UnderReview" and "UnderPrinting" respectively
    // NULL or empty status should be treated as "UnderReview" (default status)
    const counts = await sql/* sql */`
      SELECT 
        COUNT(*) FILTER (WHERE c.status IS NULL OR TRIM(c.status) = '' OR UPPER(TRIM(c.status)) = 'PENDING' OR UPPER(TRIM(c.status)) = 'UNDERREVIEW') as under_review_count,
        COUNT(*) FILTER (WHERE c.status IS NOT NULL AND (UPPER(TRIM(c.status)) = 'PROCESS' OR UPPER(TRIM(c.status)) = 'UNDERPRINTING')) as underprinting_count,
        COUNT(*) FILTER (WHERE c.status IS NOT NULL AND UPPER(TRIM(c.status)) = 'ACTIVE') as active_count,
        COUNT(*) FILTER (WHERE c.status IS NOT NULL AND UPPER(TRIM(c.status)) = 'ONHOLD') as onhold_count,
        COUNT(*) FILTER (WHERE c.status IS NOT NULL AND UPPER(TRIM(c.status)) = 'DELIVERED') as delivered_count,
        COUNT(*) as all_count
      FROM public.tblcard c
      JOIN public.tbl_alumni a ON a.alumniid = c.alumniid
      WHERE 1=1
        ${accessFilterCondition}`;
    
    const countRow = counts[0] as {
      under_review_count: bigint | number;
      underprinting_count: bigint | number;
      active_count: bigint | number;
      onhold_count: bigint | number;
      delivered_count: bigint | number;
      all_count: bigint | number;
    } | undefined;
    
    // Convert bigint to number safely
    const allCount = countRow?.all_count ? Number(countRow.all_count) : 0;
    const underReviewCount = countRow?.under_review_count ? Number(countRow.under_review_count) : 0;
    const underprintingCount = countRow?.underprinting_count ? Number(countRow.underprinting_count) : 0;
    const activeCount = countRow?.active_count ? Number(countRow.active_count) : 0;
    const onholdCount = countRow?.onhold_count ? Number(countRow.onhold_count) : 0;
    const deliveredCount = countRow?.delivered_count ? Number(countRow.delivered_count) : 0;
    
    return NextResponse.json({ 
      all: allCount,
      "under-review": underReviewCount,
      underprinting: underprintingCount,
      active: activeCount,
      onhold: onholdCount,
      delivered: deliveredCount,
    }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

