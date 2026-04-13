import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { buildAccessFilterSQL } from "@/lib/userAccess";
import { buildMasterFilterConditions } from "@/lib/master-filter-utils";

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    // Build master filter conditions excluding associations filter to avoid circular dependency
    const masterFilterConditions = buildMasterFilterConditions(searchParams, "associations");

    let accessFilterCondition = sql``;
    try {
      const accessFilter = await buildAccessFilterSQL(session, "");
      accessFilterCondition = accessFilter.hasFilter && accessFilter.sql ? sql` AND (${accessFilter.sql})` : sql``;
    } catch (filterError) {
      return NextResponse.json({ error: "Failed to build access filter" }, { status: 500 });
    }

    // Associations are faculties: association_id on alumni references tbl_faculties.id
    const allAssociations = await sql/* sql */`
      SELECT id, faculty_name AS association_name
      FROM public.tbl_faculties
      ORDER BY faculty_name ASC
    `;

    const associations = (allAssociations as unknown as Array<{ id: number; association_name: string }>);

    // For each association, count alumni who are members
    const counts = await Promise.all(
      associations.map(async (association) => {
        // Count alumni who are members of this association
        const countRows = await sql/* sql */`
          SELECT COUNT(DISTINCT a.alumniid) as count
          FROM public.tbl_alumni a
          WHERE (a.sapid IS NOT NULL AND a.sapid != '' OR a.registrationno IS NOT NULL AND a.registrationno != '')
            AND (a.association_id = ${association.id} OR a.faculty = ${association.id})
            ${accessFilterCondition}
            ${masterFilterConditions}
        `;

        const count = Number((countRows[0] as { count: number | string | bigint })?.count || 0);
        return { 
          id: association.id, 
          name: association.association_name,
          count 
        };
      })
    );

    const associationsWithCounts = counts.map(({ id, name, count }) => ({
      value: String(id),
      label: name,
      count,
    }));

    return NextResponse.json({ success: true, associations: associationsWithCounts }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch associations";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

