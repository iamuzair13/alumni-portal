import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { buildAccessFilterSQL } from "@/lib/userAccess";

type NumOrNull = number | null;

const quarterStartDate = (): string => {
  const now = new Date();
  const qStartMonth = Math.floor(now.getMonth() / 3) * 3;
  return new Date(now.getFullYear(), qStartMonth, 1).toISOString().slice(0, 10);
};

const yearStartDate = (): string => {
  const now = new Date();
  return new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
};

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accessFilter = await buildAccessFilterSQL(session, "a");
  const accessFilterCondition =
    accessFilter.hasFilter && accessFilter.sql ? sql` AND (${accessFilter.sql})` : sql``;
  const { searchParams } = new URL(req.url);
  const facultyIdParam = searchParams.get("facultyId");
  const timeRange = (searchParams.get("timeRange") || "This Quarter").trim();
  const selectedFacultyId = facultyIdParam && facultyIdParam !== "all" ? Number(facultyIdParam) : null;
  const facultyFilterCondition =
    selectedFacultyId && Number.isFinite(selectedFacultyId) ? sql` AND a.faculty = ${selectedFacultyId}` : sql``;

  const quarterStart = quarterStartDate();
  const yearStart = yearStartDate();
  const selectedStart = timeRange === "YTD" ? yearStart : quarterStart;

  try {
    const [kpiRows] = await Promise.all([
      sql/* sql */`
        SELECT
          COUNT(*) FILTER (WHERE true)::int AS total_alumni,
          COUNT(*) FILTER (WHERE LOWER(COALESCE(a.alumnistatus,'')) = 'active')::int AS active_alumni
        FROM public.tbl_alumni a
        WHERE 1=1
        ${accessFilterCondition}
        ${facultyFilterCondition}
      `,
    ]);

    const eventRows = await sql/* sql */`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE fromdate >= ${quarterStart}::date)::int AS quarter_count,
        COUNT(*) FILTER (WHERE fromdate >= ${yearStart}::date)::int AS ytd_count,
        COUNT(*) FILTER (WHERE fromdate >= ${selectedStart}::date)::int AS selected_range_count
      FROM public.tbl_events
    `;

    const jobsRows = await sql/* sql */`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE LOWER(COALESCE(company,'')) LIKE '%university of lahore%' OR LOWER(COALESCE(company,'')) LIKE '%uol%')::int AS uol_total,
        COUNT(*) FILTER (WHERE NOT (LOWER(COALESCE(company,'')) LIKE '%university of lahore%' OR LOWER(COALESCE(company,'')) LIKE '%uol%'))::int AS other_total
      FROM public.tbljobs
    `;

    const scholarshipsRows = await sql/* sql */`
      SELECT
        COUNT(*) FILTER (WHERE LOWER(COALESCE(s.status, 'pending')) IN ('approved','not-approved'))::int AS processed,
        COUNT(*) FILTER (WHERE LOWER(COALESCE(s.apply_for,'')) LIKE '%kinship%')::int AS kinship_applied,
        COUNT(*) FILTER (WHERE LOWER(COALESCE(s.apply_for,'')) LIKE '%kinship%' AND LOWER(COALESCE(s.status,'pending')) IN ('approved','not-approved'))::int AS kinship_processed,
        COUNT(*) FILTER (WHERE LOWER(COALESCE(s.apply_for,'')) LIKE '%master%' OR LOWER(COALESCE(s.apply_for,'')) LIKE '%phd%')::int AS masters_phd_applied,
        COUNT(*) FILTER (WHERE (LOWER(COALESCE(s.apply_for,'')) LIKE '%master%' OR LOWER(COALESCE(s.apply_for,'')) LIKE '%phd%') AND LOWER(COALESCE(s.status,'pending')) IN ('approved','not-approved'))::int AS masters_phd_processed,
        COUNT(*) FILTER (WHERE LOWER(COALESCE(s.apply_for,'')) LIKE '%iq%')::int AS iq_applied,
        COUNT(*) FILTER (WHERE LOWER(COALESCE(s.apply_for,'')) LIKE '%iq%' AND LOWER(COALESCE(s.status,'pending')) IN ('approved','not-approved'))::int AS iq_processed
      FROM public.alumni_scholarships s
      JOIN public.tbl_alumni a ON a.alumniid = s.id
      WHERE 1=1
      ${accessFilterCondition}
      ${facultyFilterCondition}
    `;

    const membershipRows = await sql/* sql */`
      SELECT
        COUNT(*) FILTER (WHERE LOWER(COALESCE(m.status,'pending')) IN ('approved','active'))::int AS active_benefits,
        COUNT(*) FILTER (WHERE TRIM(COALESCE(m.gym_membership_month,'')) <> '')::int AS gym_count,
        COUNT(*) FILTER (WHERE TRIM(COALESCE(m.swimmingpool_membership_month,'')) <> '')::int AS swimming_count
      FROM public.alumni_memberships m
      JOIN public.tbl_alumni a ON a.alumniid = m.alumniid
      WHERE 1=1
      ${accessFilterCondition}
      ${facultyFilterCondition}
    `;

    const facultyRows = await sql/* sql */`
      SELECT
        COALESCE(NULLIF(TRIM(f.faculty_name), ''), NULLIF(TRIM(a.facultyname), ''), 'Under Processing') AS faculty,
        COUNT(*)::int AS registrations
      FROM public.tbl_alumni a
      LEFT JOIN public.tbl_faculties f ON f.id = a.faculty
      WHERE 1=1
      ${accessFilterCondition}
      ${facultyFilterCondition}
      GROUP BY 1
      ORDER BY 2 DESC
    `;

    const chapterAssocRows = await sql/* sql */`
      SELECT
        (SELECT COUNT(*)::int FROM public.tblchapters c WHERE TRIM(COALESCE(c.national_chapter,'')) <> '') AS national_chapters,
        (SELECT COUNT(*)::int FROM public.tblchapters c WHERE TRIM(COALESCE(c.international_chapter,'')) <> '') AS international_chapters,
        (SELECT COUNT(*)::int FROM public.tblalumniassociation aa) AS associations,
        (SELECT COUNT(DISTINCT ac.id)::int FROM public.alumni_chapter ac JOIN public.tbl_alumni a ON a.alumniid = ac.id WHERE 1=1 ${accessFilterCondition} ${facultyFilterCondition}) AS members,
        (SELECT COUNT(*)::int FROM public.chapter_leadership cl WHERE LOWER(COALESCE(cl.status,'')) = 'approved') AS leaders_appointed
    `;

    const cardsRows = await sql/* sql */`
      SELECT
        COUNT(*)::int AS card_total,
        COUNT(*) FILTER (WHERE c.status IS NULL OR TRIM(COALESCE(c.status,'')) = '')::int AS applied,
        COUNT(*) FILTER (WHERE UPPER(TRIM(COALESCE(c.status,''))) IN ('UNDERREVIEW','PENDING'))::int AS review,
        COUNT(*) FILTER (WHERE UPPER(TRIM(COALESCE(c.status,''))) = 'ONHOLD')::int AS on_hold,
        COUNT(*) FILTER (WHERE UPPER(TRIM(COALESCE(c.status,''))) IN ('UNDERPRINTING','PROCESS'))::int AS under_printing,
        COUNT(*) FILTER (WHERE UPPER(TRIM(COALESCE(c.status,''))) IN ('ACTIVE'))::int AS ready_for_delivery,
        COUNT(*) FILTER (WHERE UPPER(TRIM(COALESCE(c.status,''))) = 'DELIVERED')::int AS delivered
      FROM public.tblcard c
      JOIN public.tbl_alumni a ON a.alumniid = c.alumniid
      WHERE 1=1
      ${accessFilterCondition}
      ${facultyFilterCondition}
    `;

    const talksRows = await sql/* sql */`
      SELECT
        COUNT(*) FILTER (WHERE t.date_1 >= ${quarterStart}::date)::int AS quarter_count,
        COUNT(*) FILTER (WHERE t.date_1 >= ${yearStart}::date)::int AS ytd_count,
        COUNT(*) FILTER (WHERE LOWER(COALESCE(t.mentorshipprogram,'')) IN ('yes','true','1') AND t.date_1 >= ${quarterStart}::date)::int AS mentorship_quarter,
        COUNT(*) FILTER (WHERE LOWER(COALESCE(t.mentorshipprogram,'')) IN ('yes','true','1') AND t.date_1 >= ${yearStart}::date)::int AS mentorship_ytd,
        COUNT(*) FILTER (WHERE LOWER(COALESCE(t.activity,'')) LIKE '%seminar%' AND t.date_1 >= ${quarterStart}::date)::int AS seminars_quarter,
        COUNT(*) FILTER (WHERE LOWER(COALESCE(t.activity,'')) LIKE '%seminar%' AND t.date_1 >= ${yearStart}::date)::int AS seminars_ytd,
        COUNT(*) FILTER (WHERE LOWER(COALESCE(t.activity,'')) LIKE '%conference%' AND t.date_1 >= ${quarterStart}::date)::int AS conferences_quarter,
        COUNT(*) FILTER (WHERE LOWER(COALESCE(t.activity,'')) LIKE '%conference%' AND t.date_1 >= ${yearStart}::date)::int AS conferences_ytd,
        COUNT(*) FILTER (WHERE (LOWER(COALESCE(t.activity,'')) LIKE '%high achiever%' OR LOWER(COALESCE(t.topic,'')) LIKE '%high achiever%') AND t.date_1 >= ${quarterStart}::date)::int AS high_achievers_quarter,
        COUNT(*) FILTER (WHERE (LOWER(COALESCE(t.activity,'')) LIKE '%high achiever%' OR LOWER(COALESCE(t.topic,'')) LIKE '%high achiever%') AND t.date_1 >= ${yearStart}::date)::int AS high_achievers_ytd,
        COUNT(*) FILTER (WHERE (LOWER(COALESCE(t.activity,'')) LIKE '%wellbeing%' OR LOWER(COALESCE(t.topic,'')) LIKE '%wellbeing%') AND t.date_1 >= ${quarterStart}::date)::int AS wellbeing_quarter,
        COUNT(*) FILTER (WHERE (LOWER(COALESCE(t.activity,'')) LIKE '%wellbeing%' OR LOWER(COALESCE(t.topic,'')) LIKE '%wellbeing%') AND t.date_1 >= ${yearStart}::date)::int AS wellbeing_ytd
      FROM public.tblalumnitalks t
      JOIN public.tbl_alumni a ON a.alumniid = t.alumniid
      WHERE 1=1
      ${accessFilterCondition}
      ${facultyFilterCondition}
    `;

    const chapterEventsRows = await sql/* sql */`
      SELECT
        COUNT(*) FILTER (WHERE e.fromdate >= ${quarterStart}::date)::int AS quarter_count,
        COUNT(*) FILTER (WHERE e.fromdate >= ${yearStart}::date)::int AS ytd_count,
        COUNT(*)::int AS total_count
      FROM public.tbl_events e
    `;

    const careerDerivedRows = await sql/* sql */`
      SELECT
        COUNT(*) FILTER (
          WHERE (LOWER(COALESCE(j.category,'')) LIKE '%recruit%' OR LOWER(COALESCE(j.title,'')) LIKE '%recruit%')
            AND j.created_at >= ${quarterStart}::date
        )::int AS recruitment_quarter,
        COUNT(*) FILTER (
          WHERE (LOWER(COALESCE(j.category,'')) LIKE '%recruit%' OR LOWER(COALESCE(j.title,'')) LIKE '%recruit%')
            AND j.created_at >= ${yearStart}::date
        )::int AS recruitment_ytd,
        COUNT(*) FILTER (
          WHERE (LOWER(COALESCE(j.category,'')) LIKE '%startup%' OR LOWER(COALESCE(j.title,'')) LIKE '%startup%')
            AND j.created_at >= ${quarterStart}::date
        )::int AS startups_quarter,
        COUNT(*) FILTER (
          WHERE (LOWER(COALESCE(j.category,'')) LIKE '%startup%' OR LOWER(COALESCE(j.title,'')) LIKE '%startup%')
            AND j.created_at >= ${yearStart}::date
        )::int AS startups_ytd,
        COUNT(*) FILTER (
          WHERE (LOWER(COALESCE(j.category,'')) LIKE '%course%' OR LOWER(COALESCE(j.category,'')) LIKE '%upskill%' OR LOWER(COALESCE(j.title,'')) LIKE '%course%' OR LOWER(COALESCE(j.title,'')) LIKE '%upskill%')
            AND j.created_at >= ${quarterStart}::date
        )::int AS upskill_quarter,
        COUNT(*) FILTER (
          WHERE (LOWER(COALESCE(j.category,'')) LIKE '%course%' OR LOWER(COALESCE(j.category,'')) LIKE '%upskill%' OR LOWER(COALESCE(j.title,'')) LIKE '%course%' OR LOWER(COALESCE(j.title,'')) LIKE '%upskill%')
            AND j.created_at >= ${yearStart}::date
        )::int AS upskill_ytd
      FROM public.tbljobs j
    `;

    const kpi = (kpiRows[0] ?? {}) as { total_alumni?: number; active_alumni?: number };
    const ev = (eventRows[0] ?? {}) as { total?: number; quarter_count?: number; ytd_count?: number; selected_range_count?: number };
    const jb = (jobsRows[0] ?? {}) as { total?: number; uol_total?: number; other_total?: number };
    const sc = (scholarshipsRows[0] ?? {}) as Record<string, number | undefined>;
    const mb = (membershipRows[0] ?? {}) as { active_benefits?: number; gym_count?: number; swimming_count?: number };
    const ca = (chapterAssocRows[0] ?? {}) as Record<string, number | undefined>;
    const cd = (cardsRows[0] ?? {}) as Record<string, number | undefined>;
    const tk = (talksRows[0] ?? {}) as Record<string, number | undefined>;
    const ce = (chapterEventsRows[0] ?? {}) as { quarter_count?: number; ytd_count?: number; total_count?: number };
    const cr = (careerDerivedRows[0] ?? {}) as Record<string, number | undefined>;

    return NextResponse.json(
      {
        kpis: {
          totalAlumni: kpi.total_alumni ?? null,
          totalRegistrations: kpi.total_alumni ?? null,
          activeAlumni: kpi.active_alumni ?? null,
          totalEngagements: timeRange === "YTD" ? tk.ytd_count ?? null : tk.quarter_count ?? null,
          totalEventsMeetups: ev.selected_range_count ?? null,
          jobsPosted: jb.total ?? null,
          scholarshipsProcessed: sc.processed ?? null,
          activeBenefitsDiscounts: mb.active_benefits ?? null,
        },
        sectionA: {
          facultyRows: facultyRows.map((r) => r as { faculty: string; registrations: number }),
        },
        sectionB: {
          chaptersAssociations: {
            nationalChapters: ca.national_chapters ?? null,
            internationalChapters: ca.international_chapters ?? null,
            associations: ca.associations ?? null,
            members: ca.members ?? null,
            leadersAppointed: ca.leaders_appointed ?? null,
            meetupsQuarter: ev.quarter_count ?? null,
            meetupsYtd: ev.ytd_count ?? null,
            meetupsTotal: ev.total ?? null,
          },
          cardsStatus: {
            totalCards: cd.card_total ?? null,
            applied: cd.applied ?? null,
            review: cd.review ?? null,
            onHold: cd.on_hold ?? null,
            underPrinting: cd.under_printing ?? null,
            readyForDelivery: cd.ready_for_delivery ?? null,
            delivered: cd.delivered ?? null,
          },
          activities: {
            mentorshipSessions: { quarter: tk.mentorship_quarter ?? 0, ytd: tk.mentorship_ytd ?? 0 },
            seminarsParticipation: { quarter: tk.seminars_quarter ?? 0, ytd: tk.seminars_ytd ?? 0 },
            conferencesParticipation: { quarter: tk.conferences_quarter ?? 0, ytd: tk.conferences_ytd ?? 0 },
            alumniTalks: { quarter: tk.quarter_count ?? 0, ytd: tk.ytd_count ?? 0 },
            highAchieversRecognition: { quarter: tk.high_achievers_quarter ?? 0, ytd: tk.high_achievers_ytd ?? 0 },
            wellbeingSupport: { quarter: tk.wellbeing_quarter ?? 0, ytd: tk.wellbeing_ytd ?? 0 },
            chapterEvents: { quarter: ce.quarter_count ?? 0, ytd: ce.ytd_count ?? 0, total: ce.total_count ?? 0 },
          },
        },
        sectionC: {
          career: {
            recruitmentDrives: { quarter: cr.recruitment_quarter ?? 0, ytd: cr.recruitment_ytd ?? 0 },
            jobsPostedUol: { quarter: null as NumOrNull, ytd: jb.uol_total ?? null },
            jobsPostedOtherEmployers: { quarter: null as NumOrNull, ytd: jb.other_total ?? null },
            startupsSupport: { quarter: cr.startups_quarter ?? 0, ytd: cr.startups_ytd ?? 0 },
            upskillCourses: { quarter: cr.upskill_quarter ?? 0, ytd: cr.upskill_ytd ?? 0 },
          },
          scholarships: {
            kinship: { applied: sc.kinship_applied ?? null, processed: sc.kinship_processed ?? null },
            mastersPhd: { applied: sc.masters_phd_applied ?? null, processed: sc.masters_phd_processed ?? null },
            iqPrograms: { applied: sc.iq_applied ?? null, processed: sc.iq_processed ?? null },
          },
          giveBackFinancialAssistance: null as NumOrNull,
        },
        sectionD: {
          memberships: {
            gym: mb.gym_count ?? null,
            swimmingPool: mb.swimming_count ?? null,
            freeMemberships: null as NumOrNull,
            healthcareDiscounts: null as NumOrNull,
            vehicleStickers: null as NumOrNull,
          },
          discountCategories: {
            diningAndCafes: null as NumOrNull,
            retailAndShopping: null as NumOrNull,
            travelAndLeisure: null as NumOrNull,
            healthAndWellness: null as NumOrNull,
            professionalServices: null as NumOrNull,
            financialServices: null as NumOrNull,
          },
          merchants: [] as Array<{ merchant: string; discount: string; reference: string }>,
        },
      },
      { status: 200 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch realtime dashboard analytics";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

