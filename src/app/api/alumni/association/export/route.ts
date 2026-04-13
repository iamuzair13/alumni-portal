import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { canModify } from "@/lib/alumniProfile";
import { buildAccessFilterSQL } from "@/lib/userAccess";
import { combineOrConditions } from "@/lib/master-filter-utils";
import {
  buildAssociationTabDepartmentFilterSQL,
  buildAssociationTabFacultyFilterSQL,
} from "@/lib/association-tab-filters";

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
    
    const facultyFilterCondition = buildAssociationTabFacultyFilterSQL(selectedFaculties);
    const departmentFilterCondition = buildAssociationTabDepartmentFilterSQL(selectedDepartments);
    
    // Build association filter condition — match association_id or faculty FK
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

    let membershipWhereCondition = sql``;
    if (membershipFilter === "non-members") {
      membershipWhereCondition = sql` AND a.association_id IS NULL`;
    } else if (membershipFilter === "members") {
      membershipWhereCondition = sql` AND a.association_id IS NOT NULL`;
    }

    const baseQuery = sql`FROM public.tbl_alumni a
      LEFT JOIN public.tbl_faculties assoc ON assoc.id = a.association_id
      LEFT JOIN public.tbl_faculties f ON f.id = a.faculty
      LEFT JOIN public.tbl_departments d ON d.id = a.department`;

    // Fetch ALL fields from tbl_alumni with association data
    const query = sql/* sql */`
      SELECT 
        a.*,
        -- Association organization data
        assoc.id as association_id_value,
        COALESCE(assoc.faculty_name, f.faculty_name) as association_title,
        NULL::text as association_description,
        NULL::text as association_dean,
        NULL::text as association_phone,
        NULL::text as association_email,
        NULL::text as association_address,
        COALESCE(assoc.created_at, f.created_at) as association_created_at
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
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

