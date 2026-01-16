import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { buildAccessFilterSQL } from "@/lib/userAccess";

export async function GET(request: Request) {
  try {
    const session = await auth();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status"); // "all" | "active" | "pending" | "onhold" | "overdue-under-review" | "overdue-under-printing" | null
    const overdueType = searchParams.get("overdueType"); // "under-review" | "under-printing" for overdue filtering
    
    // Build access filter for admin/viewer users
    const accessFilter = await buildAccessFilterSQL(session, "");
    const accessFilterCondition = accessFilter.hasFilter && accessFilter.sql ? sql` AND (${accessFilter.sql})` : sql``;
    
    // Build status filter
    // Database values: "UnderReview", "UnderPrinting", "Active", "Onhold", "Delivered"
    // Legacy: "Pending" → "UnderReview", "Process" → "UnderPrinting"
    // NULL or empty status should be treated as "UnderReview" (default status)
    let statusCondition = sql``;
    let overdueCondition = sql``;
    
    if (status && status !== "all") {
      if (status === "overdue") {
        // Overdue tab - filter based on overdueType
        if (overdueType === "under-review") {
          // Overdue Under Review: status is UnderReview AND createdat > 7 days ago
          statusCondition = sql` AND (c.status IS NULL OR TRIM(c.status) = '' OR UPPER(TRIM(c.status)) = 'PENDING' OR UPPER(TRIM(c.status)) = 'UNDERREVIEW')`;
          overdueCondition = sql` AND c.createdat < NOW() - INTERVAL '7 days'`;
        } else if (overdueType === "under-printing") {
          // Overdue Under Printing: status is UnderPrinting AND createdat > 7 days ago
          // Note: This uses createdat as a proxy since we don't have status_changed_at field
          // In a production system, you'd want to add a status_changed_at field to track when status changed
          statusCondition = sql` AND c.status IS NOT NULL AND (UPPER(TRIM(c.status)) = 'PROCESS' OR UPPER(TRIM(c.status)) = 'UNDERPRINTING')`;
          overdueCondition = sql` AND c.createdat < NOW() - INTERVAL '7 days'`;
        }
      } else if (status === "under-review") {
        // UnderReview: NULL, empty, legacy "Pending", or "UnderReview" (camelCase)
        // Match case-insensitively to handle "UnderReview", "underreview", "UNDERREVIEW", etc.
        statusCondition = sql` AND (c.status IS NULL OR TRIM(c.status) = '' OR UPPER(TRIM(c.status)) = 'PENDING' OR UPPER(TRIM(c.status)) = 'UNDERREVIEW')`;
      } else if (status === "underprinting") {
        // UnderPrinting: legacy "Process" or "UnderPrinting"
        statusCondition = sql` AND c.status IS NOT NULL AND (UPPER(TRIM(c.status)) = 'PROCESS' OR UPPER(TRIM(c.status)) = 'UNDERPRINTING')`;
      } else if (status === "active") {
        // Active: "Active"
        statusCondition = sql` AND c.status IS NOT NULL AND UPPER(TRIM(c.status)) = 'ACTIVE'`;
      } else if (status === "onhold") {
        // Onhold: "Onhold"
        statusCondition = sql` AND c.status IS NOT NULL AND UPPER(TRIM(c.status)) = 'ONHOLD'`;
      } else if (status === "delivered") {
        // Delivered: "Delivered"
        statusCondition = sql` AND c.status IS NOT NULL AND UPPER(TRIM(c.status)) = 'DELIVERED'`;
      }
    }
    
    // Fetch cards with status filter
    const rows = await sql/* sql */`
      SELECT 
        a.alumniid,
        a.sapid,
        a.registrationno,
        a.alumniname,
        COALESCE(a.personalemail, a.officialemail, a.universityemail) AS email,
        a.yearofending,
        COALESCE(f.faculty_name, a.facultyname) as facultyname,
        COALESCE(d.department_name, a.departmentname) as departmentname,
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
        ${overdueCondition}
      ORDER BY c.createdat DESC`;
    
    // Fetch counts for all statuses
    // Database values: "UnderReview", "UnderPrinting", "Active", "Onhold", "Delivered"
    // Legacy: "Pending" → "UnderReview", "Process" → "UnderPrinting"
    // NULL or empty status should be treated as "UnderReview" (default status)
    const counts = await sql/* sql */`
      SELECT 
        COUNT(*) FILTER (WHERE c.status IS NULL OR TRIM(c.status) = '' OR UPPER(TRIM(c.status)) = 'PENDING' OR UPPER(TRIM(c.status)) = 'UNDERREVIEW') as under_review_count,
        COUNT(*) FILTER (WHERE c.status IS NOT NULL AND (UPPER(TRIM(c.status)) = 'PROCESS' OR UPPER(TRIM(c.status)) = 'UNDERPRINTING')) as underprinting_count,
        COUNT(*) FILTER (WHERE c.status IS NOT NULL AND UPPER(TRIM(c.status)) = 'ACTIVE') as active_count,
        COUNT(*) FILTER (WHERE c.status IS NOT NULL AND UPPER(TRIM(c.status)) = 'ONHOLD') as onhold_count,
        COUNT(*) FILTER (WHERE c.status IS NOT NULL AND UPPER(TRIM(c.status)) = 'DELIVERED') as delivered_count,
        COUNT(*) FILTER (WHERE (c.status IS NULL OR TRIM(c.status) = '' OR UPPER(TRIM(c.status)) = 'PENDING' OR UPPER(TRIM(c.status)) = 'UNDERREVIEW') AND c.createdat < NOW() - INTERVAL '7 days') as overdue_under_review_count,
        COUNT(*) FILTER (WHERE c.status IS NOT NULL AND (UPPER(TRIM(c.status)) = 'PROCESS' OR UPPER(TRIM(c.status)) = 'UNDERPRINTING') AND c.createdat < NOW() - INTERVAL '7 days') as overdue_under_printing_count,
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
      overdue_under_review_count: bigint | number;
      overdue_under_printing_count: bigint | number;
      all_count: bigint | number;
    } | undefined;
    
    // Convert bigint to number safely
    const allCount = countRow?.all_count ? Number(countRow.all_count) : 0;
    const underReviewCount = countRow?.under_review_count ? Number(countRow.under_review_count) : 0;
    const underprintingCount = countRow?.underprinting_count ? Number(countRow.underprinting_count) : 0;
    const activeCount = countRow?.active_count ? Number(countRow.active_count) : 0;
    const onholdCount = countRow?.onhold_count ? Number(countRow.onhold_count) : 0;
    const deliveredCount = countRow?.delivered_count ? Number(countRow.delivered_count) : 0;
    const overdueUnderReviewCount = countRow?.overdue_under_review_count ? Number(countRow.overdue_under_review_count) : 0;
    const overdueUnderPrintingCount = countRow?.overdue_under_printing_count ? Number(countRow.overdue_under_printing_count) : 0;
    
    return NextResponse.json({ 
      items: rows,
      counts: {
        all: allCount,
        "under-review": underReviewCount,
        underprinting: underprintingCount,
        active: activeCount,
        onhold: onholdCount,
        delivered: deliveredCount,
        "overdue-under-review": overdueUnderReviewCount,
        "overdue-under-printing": overdueUnderPrintingCount,
      }
    }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}