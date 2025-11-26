import { NextResponse } from "next/server";
import { sql, retryDbOperation } from "@/lib/dbconnect";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const searchTerm = search && search.trim() ? `%${search.trim().toLowerCase()}%` : null;

    // Verify field is now VARCHAR(10) - handle as string only
    let result;
    
    if (searchTerm) {
      result = await retryDbOperation(async () => await sql/* sql */`
        SELECT 
          COUNT(*) as total,
          -- Verified: verify = 'true' (string)
          COUNT(CASE 
            WHEN LOWER(COALESCE(verify, '')) = 'true' 
            THEN 1 
          END) as verified,
          -- Unverified: verify = 'false' (string)
          COUNT(CASE 
            WHEN LOWER(COALESCE(verify, '')) = 'false' 
            THEN 1 
          END) as unverified,
          -- Under Approval: verify = 'pending' (new registrations awaiting admin approval)
          COUNT(CASE 
            WHEN verify = 'pending'
            THEN 1 
          END) as under_approval,
          -- Active: has logged in
          COUNT(CASE 
            WHEN (lasttimelogin IS NOT NULL AND lasttimelogin != '') 
            OR (logincount IS NOT NULL AND logincount > 0) 
            THEN 1 
          END) as active,
          -- Inactive: never logged in
          COUNT(CASE 
            WHEN (lasttimelogin IS NULL OR lasttimelogin = '') 
            AND (logincount IS NULL OR logincount = 0) 
            THEN 1 
          END) as inactive
        FROM public.tbl_alumni
        WHERE (sapid IS NOT NULL AND sapid != '' OR registrationno IS NOT NULL AND registrationno != '')
          AND (
            LOWER(sapid) LIKE ${searchTerm}
            OR LOWER(COALESCE(registrationno, '')) LIKE ${searchTerm}
            OR LOWER(COALESCE(alumniname, '')) LIKE ${searchTerm}
            OR LOWER(COALESCE(personalemail, '')) LIKE ${searchTerm}
            OR LOWER(COALESCE(officialemail, '')) LIKE ${searchTerm}
            OR LOWER(COALESCE(facultyname, '')) LIKE ${searchTerm}
            OR LOWER(COALESCE(departmentname, '')) LIKE ${searchTerm}
          )
      `);
    } else {
      result = await retryDbOperation(async () => await sql/* sql */`
        SELECT 
          COUNT(*) as total,
          -- Verified: verify = 'true' (string)
          COUNT(CASE 
            WHEN LOWER(COALESCE(verify, '')) = 'true' 
            THEN 1 
          END) as verified,
          -- Unverified: verify = 'false' (string)
          COUNT(CASE 
            WHEN LOWER(COALESCE(verify, '')) = 'false' 
            THEN 1 
          END) as unverified,
          -- Under Approval: verify = 'pending' (new registrations awaiting admin approval)
          COUNT(CASE 
            WHEN verify = 'pending'
            THEN 1 
          END) as under_approval,
          -- Active: has logged in
          COUNT(CASE 
            WHEN (lasttimelogin IS NOT NULL AND lasttimelogin != '') 
            OR (logincount IS NOT NULL AND logincount > 0) 
            THEN 1 
          END) as active,
          -- Inactive: never logged in
          COUNT(CASE 
            WHEN (lasttimelogin IS NULL OR lasttimelogin = '') 
            AND (logincount IS NULL OR logincount = 0) 
            THEN 1 
          END) as inactive
        FROM public.tbl_alumni
        WHERE (sapid IS NOT NULL AND sapid != '' OR registrationno IS NOT NULL AND registrationno != '' OR verify = 'pending')
      `);
    }

    const row = result[0] as {
      total: number | string | bigint;
      verified: number | string | bigint;
      unverified: number | string | bigint;
      under_approval: number | string | bigint;
      active: number | string | bigint;
      inactive: number | string | bigint;
    } | undefined;

    if (!row) {
      return NextResponse.json({
        total: 0,
        verified: 0,
        unverified: 0,
        underApproval: 0,
        active: 0,
        inactive: 0,
      }, { status: 200 });
    }

    // Convert to numbers
    const response = {
      total: Number(row.total || 0),
      verified: Number(row.verified || 0),
      unverified: Number(row.unverified || 0),
      underApproval: Number(row.under_approval || 0),
      active: Number(row.active || 0),
      inactive: Number(row.inactive || 0),
    };

    return NextResponse.json(response, { status: 200 });
  } catch (err) {
    console.error("[API] Error fetching counts:", err);
    
    // Check for connection timeout errors
    const isConnectionError = err instanceof Error && (
      err.message.includes('CONNECT_TIMEOUT') ||
      err.message.includes('ETIMEDOUT') ||
      err.message.includes('timeout') ||
      (err as Error & { code?: string }).code === 'CONNECT_TIMEOUT' ||
      (err as Error & { code?: string }).code === 'ETIMEDOUT'
    );
    
    if (isConnectionError) {
      return NextResponse.json({ 
        error: "Database connection timeout. Please try again in a moment.",
        retryable: true
      }, { status: 503 }); // Service Unavailable
    }
    
    const message = err instanceof Error ? err.message : "Failed to fetch counts";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
