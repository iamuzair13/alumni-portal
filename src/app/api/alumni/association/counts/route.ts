import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { buildAccessFilterSQL } from "@/lib/userAccess";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const { searchParams } = new URL(request.url);
    
    // Get filter parameters (arrays for multi-select)
    const facultiesParam = searchParams.get("faculties");
    const departmentsParam = searchParams.get("departments");
    const associationsParam = searchParams.get("associations");
    const verified = searchParams.get("verified");
    const membershipFilter = searchParams.get("membershipFilter") || "members";
    
    const selectedFaculties = facultiesParam ? facultiesParam.split(',').map(s => s.trim()).filter(Boolean) : [];
    const selectedDepartments = departmentsParam ? departmentsParam.split(',').map(s => s.trim()).filter(Boolean) : [];
    const selectedAssociations = associationsParam ? associationsParam.split(',').map(s => s.trim()).filter(Boolean).map(Number).filter(n => !isNaN(n)) : [];
    
    // Build access filter for admin/viewer users
    const accessFilter = await buildAccessFilterSQL(session, "");
    const accessFilterCondition = accessFilter.hasFilter && accessFilter.sql ? sql` AND (${accessFilter.sql})` : sql``;
    
    // Helper function to combine OR conditions
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
    
    // Build faculty filter condition (case-insensitive with trim) - handle multiple
    let facultyFilterCondition = sql``;
    if (selectedFaculties.length > 0) {
      const normalizedFaculties = selectedFaculties.map(f => f.toLowerCase());
      const facultyConditions = normalizedFaculties.map(f => sql`LOWER(TRIM(COALESCE(a.facultyname, ''))) = ${f}`);
      if (facultyConditions.length === 1) {
        facultyFilterCondition = sql` AND ${facultyConditions[0]}`;
      } else if (facultyConditions.length > 1) {
        const combinedCondition = combineOrConditions(facultyConditions);
        facultyFilterCondition = sql` AND (${combinedCondition})`;
      }
    }
    
    // Build department filter condition (case-insensitive with trim) - handle multiple
    let departmentFilterCondition = sql``;
    if (selectedDepartments.length > 0) {
      const normalizedDepartments = selectedDepartments.map(d => d.toLowerCase());
      const departmentConditions = normalizedDepartments.map(d => sql`LOWER(TRIM(COALESCE(a.departmentname, ''))) = ${d}`);
      if (departmentConditions.length === 1) {
        departmentFilterCondition = sql` AND ${departmentConditions[0]}`;
      } else if (departmentConditions.length > 1) {
        const combinedCondition = combineOrConditions(departmentConditions);
        departmentFilterCondition = sql` AND (${combinedCondition})`;
      }
    }
    
    // Build association filter condition - handle multiple
    let associationFilterCondition = sql``;
    if (selectedAssociations.length > 0) {
      const associationConditions = selectedAssociations.map(id => sql`a.association_id = ${id}`);
      if (associationConditions.length === 1) {
        associationFilterCondition = sql` AND ${associationConditions[0]}`;
      } else if (associationConditions.length > 1) {
        const combinedCondition = combineOrConditions(associationConditions);
        associationFilterCondition = sql` AND (${combinedCondition})`;
      }
    }
    
    // Build verified filter condition
    let verifiedFilterCondition = sql``;
    if (verified === "true") {
      verifiedFilterCondition = sql` AND a.verify = 'true'`;
    } else if (verified === "false") {
      verifiedFilterCondition = sql` AND (a.verify IS NULL OR a.verify = '' OR a.verify != 'true')`;
    }
    
    // Determine join type based on membership filter
    const membershipJoinType: "JOIN" | "LEFT JOIN" = membershipFilter === "members" ? "JOIN" : "LEFT JOIN";
    let membershipWhereCondition = sql``;
    
    if (membershipFilter === "non-members") {
      membershipWhereCondition = sql` AND a.association_id IS NULL`;
    } else if (membershipFilter === "members") {
      membershipWhereCondition = sql` AND a.association_id IS NOT NULL`;
    }
    
    // Base query structure (matching the main route structure)
    const baseQuery = membershipJoinType === "JOIN"
      ? sql`FROM public.tbl_alumni a
      JOIN public.tbl_associations assoc ON assoc.id = a.association_id`
      : sql`FROM public.tbl_alumni a
      LEFT JOIN public.tbl_associations assoc ON assoc.id = a.association_id`;
    
    // Get total count (with all filters except membership and verified)
    const totalCountQuery = sql`
      SELECT COUNT(DISTINCT a.alumniid) as count
      ${baseQuery}
      WHERE 1=1
      ${accessFilterCondition}
      ${associationFilterCondition}
      ${facultyFilterCondition}
      ${departmentFilterCondition}
      ${verifiedFilterCondition}
    `;
    
    // Get all count (membershipFilter = "all", with verified filter)
    const allCountQuery = sql`
      SELECT COUNT(DISTINCT a.alumniid) as count
      FROM public.tbl_alumni a
      LEFT JOIN public.tbl_associations assoc ON assoc.id = a.association_id
      WHERE 1=1
      ${accessFilterCondition}
      ${associationFilterCondition}
      ${facultyFilterCondition}
      ${departmentFilterCondition}
      ${verifiedFilterCondition}
    `;
    
    // Get members count (membershipFilter = "members", with verified filter)
    const membersCountQuery = sql`
      SELECT COUNT(DISTINCT a.alumniid) as count
      FROM public.tbl_alumni a
      JOIN public.tbl_associations assoc ON assoc.id = a.association_id
      WHERE 1=1
      ${accessFilterCondition}
      ${associationFilterCondition}
      ${facultyFilterCondition}
      ${departmentFilterCondition}
      ${verifiedFilterCondition}
      AND a.association_id IS NOT NULL
    `;
    
    // Get non-members count (membershipFilter = "non-members", with verified filter)
    const nonMembersCountQuery = sql`
      SELECT COUNT(DISTINCT a.alumniid) as count
      FROM public.tbl_alumni a
      LEFT JOIN public.tbl_associations assoc ON assoc.id = a.association_id
      WHERE 1=1
      ${accessFilterCondition}
      ${associationFilterCondition}
      ${facultyFilterCondition}
      ${departmentFilterCondition}
      ${verifiedFilterCondition}
      AND a.association_id IS NULL
    `;
    
    // Get verified count (verified = true, with all other filters)
    const verifiedCountQuery = sql`
      SELECT COUNT(DISTINCT a.alumniid) as count
      ${baseQuery}
      WHERE 1=1
      ${accessFilterCondition}
      ${associationFilterCondition}
      ${facultyFilterCondition}
      ${departmentFilterCondition}
      ${membershipWhereCondition}
      AND a.verify = 'true'
    `;
    
    // Get unverified count (verified = false, with all other filters)
    const unverifiedCountQuery = sql`
      SELECT COUNT(DISTINCT a.alumniid) as count
      ${baseQuery}
      WHERE 1=1
      ${accessFilterCondition}
      ${associationFilterCondition}
      ${facultyFilterCondition}
      ${departmentFilterCondition}
      ${membershipWhereCondition}
      AND (a.verify IS NULL OR a.verify = '' OR a.verify != 'true')
    `;
    
    // Execute all queries in parallel
    const [totalResult, allResult, membersResult, nonMembersResult, verifiedResult, unverifiedResult] = await Promise.all([
      totalCountQuery,
      allCountQuery,
      membersCountQuery,
      nonMembersCountQuery,
      verifiedCountQuery,
      unverifiedCountQuery,
    ]);
    
    const total = Number((totalResult as unknown as Array<{ count: bigint }>)[0]?.count || 0);
    const all = Number((allResult as unknown as Array<{ count: bigint }>)[0]?.count || 0);
    const members = Number((membersResult as unknown as Array<{ count: bigint }>)[0]?.count || 0);
    const nonMembers = Number((nonMembersResult as unknown as Array<{ count: bigint }>)[0]?.count || 0);
    const verifiedCount = Number((verifiedResult as unknown as Array<{ count: bigint }>)[0]?.count || 0);
    const unverifiedCount = Number((unverifiedResult as unknown as Array<{ count: bigint }>)[0]?.count || 0);
    
    return NextResponse.json({
      total,
      all,
      members,
      nonMembers,
      verified: verifiedCount,
      unverified: unverifiedCount,
    }, { status: 200 });
  } catch (err) {
    console.error("[API] Error fetching alumni association counts:", err);
    const msg = err instanceof Error ? err.message : "Failed to fetch counts";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

