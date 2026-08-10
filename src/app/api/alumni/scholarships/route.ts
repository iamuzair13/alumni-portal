import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { buildAccessFilterSQL } from "@/lib/userAccess";
import { isMergedScholarshipSlug, toMergedScholarshipSlug } from "@/lib/scholarshipLetter";

type RawRow = {
  alumniid: number;
  sapid: string | null;
  registrationno: string | null;
  alumniname: string | null;
  contactno: string | null;
  personalemail: string | null;
  officialemail: string | null;
  universityemail: string | null;
  faculty_name: string | null;
  department_name: string | null;
  program_name: string | null;
  created_at: string | null;
  kinship_firstname: string | null;
  kinship_lastname: string | null;
  kinship_cnic: string | null;
  apply_for: string | null;
  degree_title: string | null;
  discount_type: string | null;
  status: string | null;
  reason: string | null;
  withdrawn_at: string | null;
  withdrawn_by: string | null;
  withdrawal_reason: string | null;
};

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = (searchParams.get("search") || "").trim();
    const statusFilter = (searchParams.get("status") || "").trim().toLowerCase();
    const page = Math.max(parseInt(searchParams.get("page") || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "50", 10), 1), 200);
    const offset = (page - 1) * limit;

    const accessFilter = await buildAccessFilterSQL(session, "a");
    const accessFilterCondition =
      accessFilter.hasFilter && accessFilter.sql ? sql` AND (${accessFilter.sql})` : sql``;

    let searchCondition = sql``;
    if (search) {
      const term = `%${search.toLowerCase()}%`;
      searchCondition = sql`
        AND (
          LOWER(COALESCE(a.sapid, '')) LIKE ${term}
          OR LOWER(COALESCE(a.registrationno, '')) LIKE ${term}
          OR LOWER(COALESCE(a.alumniname, '')) LIKE ${term}
          OR LOWER(COALESCE(asch.kinship_firstname, '')) LIKE ${term}
          OR LOWER(COALESCE(asch.kinship_lastname, '')) LIKE ${term}
          OR LOWER(COALESCE(asch.kinship_cnic, '')) LIKE ${term}
          OR LOWER(COALESCE(asch.apply_for, '')) LIKE ${term}
          OR LOWER(COALESCE(asch.degree_title, '')) LIKE ${term}
        )
      `;
    }

    // Optional status filter: pending, approved, not-approved, not-applicable
    let statusCondition = sql``;
    if (statusFilter && statusFilter !== "all") {
      const normalized =
        statusFilter === "not approved" || statusFilter === "not-approved"
          ? "not-approved"
          : statusFilter;
      statusCondition = sql` AND LOWER(COALESCE(asch.status, 'pending')) = ${normalized}`;
    }

    const countRows = await sql/* sql */`
      SELECT COUNT(*) AS total
      FROM public.alumni_scholarships asch
      JOIN public.tbl_alumni a ON a.alumniid = asch.id
      WHERE 1=1
        ${accessFilterCondition}
        ${searchCondition}
        ${statusCondition}
    `;

    const total = Number((countRows as any)[0]?.total || 0);
    const totalPages = Math.max(1, Math.ceil(total / limit));

    const rawRows = await sql/* sql */`
      SELECT
        a.alumniid,
        a.sapid,
        a.registrationno,
        a.alumniname,
        a.contactno,
        a.personalemail,
        a.officialemail,
        a.universityemail,
        COALESCE(NULLIF(TRIM(a.facultyname), ''), f.faculty_name) AS faculty_name,
        COALESCE(NULLIF(TRIM(a.departmentname), ''), d.department_name) AS department_name,
        COALESCE(NULLIF(TRIM(a.degreetitle), ''), p.program_name) AS program_name,
        asch.created_at,
        asch.kinship_firstname,
        asch.kinship_lastname,
        asch.kinship_cnic,
        asch.apply_for,
        asch.degree_title,
        asch.discount_type,
        COALESCE(asch.status, 'pending') AS status,
        asch.reason,
        asch.withdrawn_at,
        asch.withdrawn_by,
        asch.withdrawal_reason
      FROM public.alumni_scholarships asch
      JOIN public.tbl_alumni a ON a.alumniid = asch.id
      LEFT JOIN public.tbl_faculties f ON f.id = a.faculty
      LEFT JOIN public.tbl_departments d ON d.id = a.department
      LEFT JOIN public.tbl_programs p ON p.id = a.program
      WHERE 1=1
        ${accessFilterCondition}
        ${searchCondition}
        ${statusCondition}
      ORDER BY asch.created_at DESC, a.alumniid DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const rows = rawRows as unknown as RawRow[];

    const items = rows.map((r) => {
      const d = String(r.discount_type || "").trim().toLowerCase();
      return {
      applyFor:
        d === "masters-phd"
          ? (() => {
              const base = String(r.apply_for || "").trim();
              if (!base) return null;
              return base.toLowerCase().includes("phd")
                ? `${base} (25% discount)`
                : `${base} (50% discount)`;
            })()
          : isMergedScholarshipSlug(d) || toMergedScholarshipSlug(d)
            ? String(r.apply_for || "").trim() || null
            : r.apply_for ?? null,
      alumniId: r.alumniid,
      sapid: r.sapid ?? "",
      registrationNo: r.registrationno ?? null,
      name: r.alumniname ?? "",
      contactno: r.contactno ?? null,
      email: r.personalemail || r.officialemail || r.universityemail || null,
      faculty: r.faculty_name ?? null,
      department: r.department_name ?? null,
      program: r.program_name ?? null,
      createdAt: r.created_at,
      kinshipFirstName: r.kinship_firstname ?? null,
      kinshipLastName: r.kinship_lastname ?? null,
      kinshipCnic: r.kinship_cnic ?? null,
      scholarshipDegreeTitle: r.degree_title ?? null,
      discountType: r.discount_type ?? null,
      status: (r.status ?? "pending").toLowerCase(),
      rejectionReason: r.reason ?? null,
      withdrawnAt: r.withdrawn_at ?? null,
      withdrawnBy: r.withdrawn_by ?? null,
      withdrawalReason: r.withdrawal_reason ?? null,
    };
    });

    // Compute status counts (pending, approved, not-approved) across all filtered records
    const countsRows = await sql/* sql */`
      SELECT LOWER(COALESCE(status, 'pending')) AS status, COUNT(*) AS count
      FROM public.alumni_scholarships asch
      JOIN public.tbl_alumni a ON a.alumniid = asch.id
      WHERE 1=1
        ${accessFilterCondition}
        ${searchCondition}
      GROUP BY LOWER(COALESCE(status, 'pending'))
    `;

    const countsRaw = countsRows as unknown as { status: string; count: number }[];
    const counts = {
      pending: 0,
      approved: 0,
      notApproved: 0,
      notApplicable: 0,
      withdrawn: 0,
    };
    for (const row of countsRaw) {
      const s = row.status;
      if (s === "approved") counts.approved = Number(row.count || 0);
      else if (s === "not-approved" || s === "not approved") counts.notApproved = Number(row.count || 0);
      else if (s === "not-applicable") counts.notApplicable = Number(row.count || 0);
      else if (s === "withdrawn") counts.withdrawn = Number(row.count || 0);
      else counts.pending = counts.pending + Number(row.count || 0);
    }

    return NextResponse.json(
      {
        items,
        total,
        page,
        limit,
        totalPages,
        counts,
      },
      { status: 200 }
    );
  } catch (err) {

    const msg = err instanceof Error ? err.message : "Failed to fetch scholarships";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}


