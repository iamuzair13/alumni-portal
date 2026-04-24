import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { buildAccessFilterSQL } from "@/lib/userAccess";

type KpiPayload = {
  totalEventsMeetups: number | null;
  jobsPosted: number | null;
  scholarshipsProcessed: number | null;
  activeBenefitsDiscounts: number | null;
};

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accessFilter = await buildAccessFilterSQL(session, "a");
  const accessFilterCondition =
    accessFilter.hasFilter && accessFilter.sql ? sql` AND (${accessFilter.sql})` : sql``;

  const payload: KpiPayload = {
    totalEventsMeetups: null,
    jobsPosted: null,
    scholarshipsProcessed: null,
    activeBenefitsDiscounts: null,
  };

  try {
    const eventRows = await sql/* sql */`
      SELECT COUNT(*)::int AS count
      FROM public.tbl_events
    `;
    payload.totalEventsMeetups = Number((eventRows[0] as { count?: number } | undefined)?.count ?? 0);
  } catch {
    payload.totalEventsMeetups = null;
  }

  try {
    const jobRows = await sql/* sql */`
      SELECT COUNT(*)::int AS count
      FROM public.tbljobs
    `;
    payload.jobsPosted = Number((jobRows[0] as { count?: number } | undefined)?.count ?? 0);
  } catch {
    payload.jobsPosted = null;
  }

  try {
    const scholarshipRows = await sql/* sql */`
      SELECT COUNT(*)::int AS count
      FROM public.alumni_scholarships s
      JOIN public.tbl_alumni a ON a.alumniid = s.id
      WHERE LOWER(COALESCE(s.status, 'pending')) IN ('approved', 'not-approved')
      ${accessFilterCondition}
    `;
    payload.scholarshipsProcessed = Number((scholarshipRows[0] as { count?: number } | undefined)?.count ?? 0);
  } catch {
    payload.scholarshipsProcessed = null;
  }

  try {
    const membershipRows = await sql/* sql */`
      SELECT COUNT(*)::int AS count
      FROM public.alumni_memberships m
      JOIN public.tbl_alumni a ON a.alumniid = m.alumniid
      WHERE LOWER(COALESCE(m.status, 'pending')) IN ('approved', 'active')
      ${accessFilterCondition}
    `;
    payload.activeBenefitsDiscounts = Number((membershipRows[0] as { count?: number } | undefined)?.count ?? 0);
  } catch {
    payload.activeBenefitsDiscounts = null;
  }

  return NextResponse.json(payload, { status: 200 });
}

