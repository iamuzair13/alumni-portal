import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { buildAccessFilterSQL } from "@/lib/userAccess";

type RawRow = {
  membership_id: number;
  alumniid: number;
  sapid: string | null;
  registrationno: string | null;
  alumniname: string | null;
  facultyname: string | null;
  departmentname: string | null;
  degreetitle: string | null;
  created_at: string | null;
  gym_membership_month: string | null;
  swimmingpool_membership_month: string | null;
  status: string | null;
  reason: string | null;
};

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = (searchParams.get("search") || "").trim();
    const page = Math.max(parseInt(searchParams.get("page") || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "50", 10), 1), 200);
    const offset = (page - 1) * limit;
    const statusParam = searchParams.get("status");

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
        )
      `;
    }

    let statusCondition = sql``;
    if (statusParam && statusParam !== "all") {
      const statusValue = statusParam === "not-approved" ? "not-approved" : statusParam;
      statusCondition = sql` AND LOWER(COALESCE(am.status, 'pending')) = ${statusValue.toLowerCase()}`;
    }

    const countRows = await sql/* sql */`
      SELECT COUNT(*) AS total
      FROM public.alumni_memberships am
      JOIN public.tbl_alumni a ON a.alumniid = am.alumniid
      WHERE 1=1
        ${accessFilterCondition}
        ${searchCondition}
        ${statusCondition}
    `;

    const total = Number((countRows as any)[0]?.total || 0);
    const totalPages = Math.max(1, Math.ceil(total / limit));

    const rawRows = await sql/* sql */`
      SELECT
        am.id AS membership_id,
        a.alumniid,
        a.sapid,
        a.registrationno,
        a.alumniname,
        a.facultyname,
        a.departmentname,
        a.degreetitle,
        am.created_at,
        am.gym_membership_month,
        am.swimmingpool_membership_month,
        COALESCE(am.status, 'pending') AS status,
        am.reason
      FROM public.alumni_memberships am
      JOIN public.tbl_alumni a ON a.alumniid = am.alumniid
      WHERE 1=1
        ${accessFilterCondition}
        ${searchCondition}
        ${statusCondition}
      ORDER BY am.created_at DESC, am.id DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const rows = rawRows as unknown as RawRow[];

    const items = rows.map((r) => ({
      id: r.membership_id, // Membership record ID (for updates)
      alumniId: r.alumniid, // Alumni ID (for reference)
      sapid: r.sapid ?? "",
      registrationNo: r.registrationno ?? null,
      name: r.alumniname ?? "",
      faculty: r.facultyname ?? null,
      department: r.departmentname ?? null,
      program: r.degreetitle ?? null,
      createdAt: r.created_at,
      gymMembershipMonth: r.gym_membership_month ?? null,
      swimmingPoolMembershipMonth: r.swimmingpool_membership_month ?? null,
      status: (r.status ?? "pending").toLowerCase(),
      rejectionReason: r.reason ?? null,
    }));

    // Compute status counts (pending, approved, not-approved) across all filtered records
           const countsRows = await sql/* sql */`
             SELECT LOWER(COALESCE(status, 'pending')) AS status, COUNT(*) AS count
             FROM public.alumni_memberships am
             JOIN public.tbl_alumni a ON a.alumniid = am.alumniid
             WHERE 1=1
               ${accessFilterCondition}
               ${searchCondition}
             GROUP BY LOWER(COALESCE(status, 'pending'))
           `;

    const counts = {
      pending: 0,
      approved: 0,
      notApproved: 0,
    };

    for (const row of countsRows as any[]) {
      const status = String(row.status || "pending").toLowerCase();
      const count = Number(row.count || 0);
      if (status === "approved") {
        counts.approved = count;
      } else if (status === "not-approved") {
        counts.notApproved = count;
      } else {
        counts.pending += count;
      }
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
    const msg = err instanceof Error ? err.message : "Failed to fetch memberships";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

