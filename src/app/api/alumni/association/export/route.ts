import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { canModify } from "@/lib/alumniProfile";
import { buildAccessFilterSQL } from "@/lib/userAccess";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admins can export
    if (!canModify(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const facultiesParam = searchParams.get("faculties");
    const departmentsParam = searchParams.get("departments");
    const associationsParam = searchParams.get("associations");
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
      // Build OR conditions for multiple associations
      const associationConditions = selectedAssociations.map(id => sql`a.association_id = ${id}`);
      if (associationConditions.length === 1) {
        associationFilterCondition = sql` AND ${associationConditions[0]}`;
      } else if (associationConditions.length > 1) {
        const combinedCondition = combineOrConditions(associationConditions);
        associationFilterCondition = sql` AND (${combinedCondition})`;
      }
    }
    
    // Build membership filter condition
    const membershipJoinType: "JOIN" | "LEFT JOIN" = membershipFilter === "members" ? "JOIN" : "LEFT JOIN";
    let membershipWhereCondition = sql``;
    
    if (membershipFilter === "non-members") {
      // For non-members: must not have any association
      membershipWhereCondition = sql` AND a.association_id IS NULL`;
    } else if (membershipFilter === "members") {
      // For members: must have at least one association
      membershipWhereCondition = sql` AND a.association_id IS NOT NULL`;
    }
    // For "all": no additional condition needed, just use LEFT JOIN
    
    // Build the query based on membership filter
    const baseQuery = membershipJoinType === "JOIN"
      ? sql`FROM public.tbl_alumni a
      JOIN public.tbl_associations assoc ON assoc.id = a.association_id`
      : sql`FROM public.tbl_alumni a
      LEFT JOIN public.tbl_associations assoc ON assoc.id = a.association_id`;

    // Fetch ALL fields from tbl_alumni with association data
    const query = sql/* sql */`
      SELECT 
        a.*,
        -- Association organization data
        assoc.id as association_id_value,
        assoc.title as association_title,
        assoc.description as association_description,
        assoc.dean as association_dean,
        assoc.phone as association_phone,
        assoc.email as association_email,
        assoc.address as association_address,
        assoc.created_at as association_created_at
      ${baseQuery}
      WHERE 1=1
        ${accessFilterCondition}
        ${facultyFilterCondition}
        ${departmentFilterCondition}
        ${associationFilterCondition}
        ${membershipWhereCondition}
      ORDER BY a.alumniid DESC
    `;

    const rows = await query;
    
    return NextResponse.json({ items: rows }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to export alumni association data";
    console.error("[API] Export error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

