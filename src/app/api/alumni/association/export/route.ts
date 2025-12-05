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
    const faculty = searchParams.get("faculty") || "";
    const department = searchParams.get("department") || "";
    const membershipFilter = searchParams.get("membershipFilter") || "members";

    // Build access filter for admin/viewer users
    const accessFilter = await buildAccessFilterSQL(session, "");
    const accessFilterCondition = accessFilter.hasFilter && accessFilter.sql ? sql` AND (${accessFilter.sql})` : sql``;

    // Build faculty filter condition
    let facultyFilterCondition = sql``;
    if (faculty && faculty.trim()) {
      const facultyValue = faculty.trim();
      facultyFilterCondition = sql` AND LOWER(TRIM(COALESCE(a.facultyname, ''))) = LOWER(${facultyValue})`;
    }
    
    // Build department filter condition
    let departmentFilterCondition = sql``;
    if (department && department.trim()) {
      const departmentValue = department.trim();
      departmentFilterCondition = sql` AND LOWER(TRIM(COALESCE(a.departmentname, ''))) = LOWER(${departmentValue})`;
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

