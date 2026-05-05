import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { buildAccessFilterSQL } from "@/lib/userAccess";
import { combineOrConditions } from "@/lib/master-filter-utils";
import {
  buildAssociationTabDepartmentFilterSQL,
  buildAssociationTabFacultyFilterSQL,
  buildAssociationTabMembershipMembersSQL,
  buildAssociationTabMembershipNonMembersSQL,
} from "@/lib/association-tab-filters";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const { searchParams } = new URL(request.url);
    
    // Get filter parameters (arrays for multi-select)
    const facultiesParam = searchParams.get("faculties");
    const departmentsParam = searchParams.get("departments");
    const associationsParam = searchParams.get("associations");
    const verified = searchParams.get("verified");
    
    const selectedFaculties = facultiesParam ? facultiesParam.split(',').map(s => s.trim()).filter(Boolean) : [];
    const selectedDepartments = departmentsParam ? departmentsParam.split(',').map(s => s.trim()).filter(Boolean) : [];
    const selectedAssociations = associationsParam ? associationsParam.split(',').map(s => s.trim()).filter(Boolean).map(Number).filter(n => !isNaN(n)) : [];
    
    // Build access filter for admin/viewer users
    const accessFilter = await buildAccessFilterSQL(session, "");
    const accessFilterCondition = accessFilter.hasFilter && accessFilter.sql ? sql` AND (${accessFilter.sql})` : sql``;
    
    const facultyFilterCondition = buildAssociationTabFacultyFilterSQL(selectedFaculties);
    const departmentFilterCondition = buildAssociationTabDepartmentFilterSQL(selectedDepartments);
    
    // Association filter: match either association_id or faculty FK (same tbl_faculties ids)
    let associationFilterCondition = sql``;
    if (selectedAssociations.length > 0) {
      const associationConditions = selectedAssociations.map((id) =>
        sql`(a.association_id = ${id} OR a.faculty = ${id})`
      );
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
    
    // Base query: start from tbl_alumni and LEFT JOIN assoc row keyed by association_id.
    // Non-members are alumni with both association_id and faculty NULL (see membership conditions).
    // Also join faculties and departments for filtering.
    const baseQueryFromAlumni = sql`FROM public.tbl_alumni a
      LEFT JOIN public.tbl_faculties assoc ON assoc.id = a.association_id
      LEFT JOIN public.tbl_faculties f ON f.id = a.faculty
      LEFT JOIN public.tbl_departments d ON d.id = a.department`;
    
    const membersCondition = buildAssociationTabMembershipMembersSQL();
    const nonMembersCondition = buildAssociationTabMembershipNonMembersSQL();
    
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
    
    // Members: linked via association_id or faculty (same as association chip filters)
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
    
    // Non-members: neither association_id nor faculty FK set
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
    const msg = err instanceof Error ? err.message : "Failed to fetch counts";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

