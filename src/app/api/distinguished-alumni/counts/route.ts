import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { buildIdBasedAccessFilterSQL } from "@/lib/rbac";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const faculty = searchParams.getAll("faculty");
    const department = searchParams.getAll("department");
    const program = searchParams.getAll("program");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const combineOrConditions = (conditions: any[]): any => {
      if (conditions.length === 0) return sql`1 = 0`;
      if (conditions.length === 1) return conditions[0];
      if (conditions.length === 2) return sql`${conditions[0]} OR ${conditions[1]}`;
      const mid = Math.ceil(conditions.length / 2);
      const left = combineOrConditions(conditions.slice(0, mid));
      const right = combineOrConditions(conditions.slice(mid));
      return sql`${left} OR ${right}`;
    };

    const access = await buildIdBasedAccessFilterSQL(session, {
      alias: "x",
      facultyColumn: "effective_faculty_id",
      departmentColumn: "effective_department_id",
      programColumn: "effective_program_id",
    });
    const accessFilter = access.sql ? sql`AND (${access.sql})` : sql``;

    let facultyFilter = sql``;
    if (faculty && faculty.length > 0) {
      const conditions = faculty.map((f) => {
        const normalized = String(f).trim();
        if (normalized === "NULL" || normalized === "null") return sql`(x.effective_faculty_id IS NULL)`;
        const id = Number.parseInt(normalized, 10);
        if (Number.isNaN(id)) return sql`1 = 0`;
        return sql`(x.effective_faculty_id = ${id})`;
      });
      facultyFilter = sql`AND (${combineOrConditions(conditions)})`;
    }

    let departmentFilter = sql``;
    if (department && department.length > 0) {
      const conditions = department.map((dept) => {
        const normalized = String(dept).trim();
        if (normalized === "NULL" || normalized === "null") return sql`(x.effective_department_id IS NULL)`;
        const id = Number.parseInt(normalized, 10);
        if (Number.isNaN(id)) return sql`1 = 0`;
        return sql`(x.effective_department_id = ${id})`;
      });
      departmentFilter = sql`AND (${combineOrConditions(conditions)})`;
    }

    let programFilter = sql``;
    if (program && program.length > 0) {
      const conditions = program.map((prog) => {
        const normalized = String(prog).trim();
        if (normalized === "NULL" || normalized === "null") return sql`(x.effective_program_id IS NULL)`;
        const id = Number.parseInt(normalized, 10);
        if (Number.isNaN(id)) return sql`1 = 0`;
        return sql`(x.effective_program_id = ${id})`;
      });
      programFilter = sql`AND (${combineOrConditions(conditions)})`;
    }

    let searchFilter = sql``;
    if (search.trim()) {
      const searchTerm = `%${search.trim().toLowerCase()}%`;
      searchFilter = sql`AND (
        LOWER(x.name) LIKE ${searchTerm}
        OR LOWER(x.slug) LIKE ${searchTerm}
        OR LOWER(x.role) LIKE ${searchTerm}
        OR LOWER(x.summary) LIKE ${searchTerm}
        OR LOWER(x.headline) LIKE ${searchTerm}
      )`;
    }

    const countResult = await sql/* sql */`
      SELECT COUNT(*) as total
      FROM (
        SELECT
          d.id,
          d.name,
          d.slug,
          d.role,
          d.summary,
          d.headline,
          COALESCE(d.program_id, prog.id) as effective_program_id,
          COALESCE(d.department_id, prog.department_id, dept.id) as effective_department_id,
          COALESCE(d.faculty_id, dept.faculty_id, prog_dept.faculty_id) as effective_faculty_id
        FROM public.distinguished_alumni d
        LEFT JOIN public.tbl_programs prog ON d.program_id = prog.id
        LEFT JOIN public.tbl_departments dept ON d.department_id = dept.id
        LEFT JOIN public.tbl_departments prog_dept ON prog.department_id = prog_dept.id
      ) x
      WHERE 1=1
      ${accessFilter}
      ${searchFilter}
      ${facultyFilter}
      ${departmentFilter}
      ${programFilter}
    `;
    
    const total = countResult[0]?.total ? Number(countResult[0].total) : 0;

    return NextResponse.json({
      total
    }, { status: 200 });
  } catch (error) {

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch counts" },
      { status: 500 }
    );
  }
}
