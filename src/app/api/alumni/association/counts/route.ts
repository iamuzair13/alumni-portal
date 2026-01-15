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
    // Check both joined table value and fallback text column (matching list endpoint)
    let facultyFilterCondition = sql``;
    if (selectedFaculties.length > 0) {
      const normalizedFaculties = selectedFaculties.map(f => f.toLowerCase());
      // Check both f.faculty_name (from joined table) and a.facultyname (fallback)
      const facultyConditions = normalizedFaculties.map(f => sql`LOWER(TRIM(COALESCE(f.faculty_name, a.facultyname, ''))) = ${f}`);
      if (facultyConditions.length === 1) {
        facultyFilterCondition = sql` AND ${facultyConditions[0]}`;
      } else if (facultyConditions.length > 1) {
        const combinedCondition = combineOrConditions(facultyConditions);
        facultyFilterCondition = sql` AND (${combinedCondition})`;
      }
    }
    
    // Build department filter condition (case-insensitive with trim) - handle multiple
    // Check both joined table value and fallback text column (matching list endpoint)
    let departmentFilterCondition = sql``;
    if (selectedDepartments.length > 0) {
      const normalizedDepartments = selectedDepartments.map(d => d.toLowerCase());
      // Check both d.department_name (from joined table) and a.departmentname (fallback)
      const departmentConditions = normalizedDepartments.map(d => sql`LOWER(TRIM(COALESCE(d.department_name, a.departmentname, ''))) = ${d}`);
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
    
    // Base query: start from tbl_alumni and LEFT JOIN associations to include ALL alumni,
    // including those without any association membership (assoc.* will be NULL for non-members).
    // Also join faculties and departments for filtering.
    const baseQueryFromAlumni = sql`FROM public.tbl_alumni a
      LEFT JOIN public.tbl_associations assoc ON assoc.id = a.association_id
      LEFT JOIN public.tbl_faculties f ON f.id = a.faculty
      LEFT JOIN public.tbl_departments d ON d.id = a.department`;
    
    // Helper conditions for membership:
    // Members = alumni who have a non-null association_id (a.association_id IS NOT NULL)
    // Non-members = alumni who have a null association_id (a.association_id IS NULL)
    const membersCondition = sql` AND a.association_id IS NOT NULL`;
    const nonMembersCondition = sql` AND a.association_id IS NULL`;
    
    // Total count: Count ALL alumni (with or without associations), under current filters
    const totalCountQuery = sql`
      SELECT COUNT(DISTINCT a.alumniid) as count
      ${baseQueryFromAlumni}
      WHERE 1=1
      ${accessFilterCondition}
      ${associationFilterCondition}
      ${facultyFilterCondition}
      ${departmentFilterCondition}
      ${verifiedFilterCondition}
    `;
    
    // Get all count: same as total (kept separate for backward compatibility)
    const allCountQuery = sql`
      SELECT COUNT(DISTINCT a.alumniid) as count
      ${baseQueryFromAlumni}
      WHERE 1=1
      ${accessFilterCondition}
      ${associationFilterCondition}
      ${facultyFilterCondition}
      ${departmentFilterCondition}
      ${verifiedFilterCondition}
    `;
    
    // Get members count: alumni who have a non-null association_id
    const membersCountQuery = sql`
      SELECT COUNT(DISTINCT a.alumniid) as count
      ${baseQueryFromAlumni}
      WHERE 1=1
      ${accessFilterCondition}
      ${associationFilterCondition}
      ${facultyFilterCondition}
      ${departmentFilterCondition}
      ${verifiedFilterCondition}
      ${membersCondition}
    `;
    
    // Get non-members count: alumni who have a null association_id
    const nonMembersCountQuery = sql`
      SELECT COUNT(DISTINCT a.alumniid) as count
      ${baseQueryFromAlumni}
      WHERE 1=1
      ${accessFilterCondition}
      ${associationFilterCondition}
      ${facultyFilterCondition}
      ${departmentFilterCondition}
      ${verifiedFilterCondition}
      ${nonMembersCondition}
    `;
    
    // Get verified count: all verified alumni (regardless of association membership)
    const verifiedCountQuery = sql`
      SELECT COUNT(DISTINCT a.alumniid) as count
      ${baseQueryFromAlumni}
      WHERE 1=1
      ${accessFilterCondition}
      ${associationFilterCondition}
      ${facultyFilterCondition}
      ${departmentFilterCondition}
      AND LOWER(TRIM(COALESCE(a.verify, ''))) = 'true'
    `;
    
    // Get unverified count: all unverified alumni (regardless of association membership)
    const unverifiedCountQuery = sql`
      SELECT COUNT(DISTINCT a.alumniid) as count
      ${baseQueryFromAlumni}
      WHERE 1=1
      ${accessFilterCondition}
      ${associationFilterCondition}
      ${facultyFilterCondition}
      ${departmentFilterCondition}
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

