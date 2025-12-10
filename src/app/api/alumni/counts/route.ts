import { NextResponse } from "next/server";
import { sql, retryDbOperation } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { buildAccessFilterSQL } from "@/lib/userAccess";

export async function GET(req: Request) {
  try {
    const session = await auth();
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    // Get all values for multi-select filters
    const facultyParams = searchParams.getAll("faculty");
    const departmentParams = searchParams.getAll("department");
    const programParams = searchParams.getAll("program");
    const faculty = facultyParams.length > 0 ? facultyParams : (searchParams.get("faculty") || "");
    const department = departmentParams.length > 0 ? departmentParams : (searchParams.get("department") || "");
    const program = programParams.length > 0 ? programParams : (searchParams.get("program") || "");
    const searchTerm = search && search.trim() ? `%${search.trim().toLowerCase()}%` : null;

    // Build access filter for admin/viewer users
    const accessFilter = await buildAccessFilterSQL(session, "");
    
    // Debug logging
    console.log("[alumni/counts] Access filter:", {
      hasFilter: accessFilter.hasFilter,
      isSuperAdmin: !accessFilter.hasFilter
    });
    
    // Build access filter condition for WHERE clause
    // Wrap the entire OR chain in parentheses since AND has higher precedence than OR
    const accessFilterCondition = accessFilter.hasFilter && accessFilter.sql ? sql` AND (${accessFilter.sql})` : sql``;
    
    // Helper function to combine SQL conditions with OR
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const combineOrConditions = (conditions: any[]): any => {
      if (conditions.length === 0) return sql``;
      if (conditions.length === 1) return conditions[0];
      if (conditions.length === 2) return sql`${conditions[0]} OR ${conditions[1]}`;
      const mid = Math.ceil(conditions.length / 2);
      const left = combineOrConditions(conditions.slice(0, mid));
      const right = combineOrConditions(conditions.slice(mid));
      return sql`${left} OR ${right}`;
    };
    
    // Build filters for faculty, department, and program (handle arrays)
    let facultyFilter = sql``;
    if (faculty && (Array.isArray(faculty) ? faculty.length > 0 : faculty)) {
      if (Array.isArray(faculty) && faculty.length > 0) {
        const facultyConditions = faculty.map(f => sql`LOWER(TRIM(COALESCE(facultyname, ''))) = LOWER(TRIM(${f}))`);
        const combinedCondition = combineOrConditions(facultyConditions);
        facultyFilter = sql`AND (${combinedCondition})`;
      } else if (!Array.isArray(faculty) && faculty) {
        facultyFilter = sql`AND LOWER(TRIM(COALESCE(facultyname, ''))) = LOWER(TRIM(${faculty}))`;
      }
      console.log("[alumni/counts] Filtering for faculty:", faculty);
    }
    
    let departmentFilter = sql``;
    if (department && (Array.isArray(department) ? department.length > 0 : department)) {
      if (Array.isArray(department) && department.length > 0) {
        const departmentConditions = department.map(d => sql`LOWER(TRIM(COALESCE(departmentname, ''))) = LOWER(TRIM(${d}))`);
        const combinedCondition = combineOrConditions(departmentConditions);
        departmentFilter = sql`AND (${combinedCondition})`;
      } else if (!Array.isArray(department) && department) {
        departmentFilter = sql`AND LOWER(TRIM(COALESCE(departmentname, ''))) = LOWER(TRIM(${department}))`;
      }
      console.log("[alumni/counts] Filtering for department:", department);
    }
    
    let programFilter = sql``;
    if (program && (Array.isArray(program) ? program.length > 0 : program)) {
      if (Array.isArray(program) && program.length > 0) {
        const programConditions = program.map(p => sql`LOWER(TRIM(COALESCE(degreetitle, ''))) = LOWER(TRIM(${p}))`);
        const combinedCondition = combineOrConditions(programConditions);
        programFilter = sql`AND (${combinedCondition})`;
      } else if (!Array.isArray(program) && program) {
        programFilter = sql`AND LOWER(TRIM(COALESCE(degreetitle, ''))) = LOWER(TRIM(${program}))`;
      }
      console.log("[alumni/counts] Filtering for program:", program);
    }

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
          ${facultyFilter}
          ${departmentFilter}
          ${programFilter}
          ${accessFilterCondition}
          AND (
            LOWER(sapid) LIKE ${searchTerm}
            OR LOWER(COALESCE(registrationno, '')) LIKE ${searchTerm}
            OR LOWER(COALESCE(alumniname, '')) LIKE ${searchTerm}
            OR LOWER(COALESCE(personalemail, '')) LIKE ${searchTerm}
            OR LOWER(COALESCE(officialemail, '')) LIKE ${searchTerm}
            OR LOWER(COALESCE(facultyname, '')) LIKE ${searchTerm}
            OR LOWER(COALESCE(departmentname, '')) LIKE ${searchTerm}
            OR LOWER(COALESCE(degreetitle, '')) LIKE ${searchTerm}
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
          ${facultyFilter}
          ${departmentFilter}
          ${programFilter}
          ${accessFilterCondition}
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
        category: { aPlus: 0, a: 0, b: 0, c: 0 },
      }, { status: 200 });
    }

    // Convert to numbers
    // Category counts will be added later when data is available
    const response = {
      total: Number(row.total || 0),
      verified: Number(row.verified || 0),
      unverified: Number(row.unverified || 0),
      underApproval: Number(row.under_approval || 0),
      active: Number(row.active || 0),
      inactive: Number(row.inactive || 0),
      category: { aPlus: 0, a: 0, b: 0, c: 0 }, // Placeholder - will be updated when category data is available
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
