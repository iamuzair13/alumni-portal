import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { buildAccessFilterSQL } from "@/lib/userAccess";
import { buildAssociationTabMembershipMembersSQL } from "@/lib/association-tab-filters";
import {
  MANAGEMENT_DASHBOARD_MERCHANT_SEED,
  MANAGEMENT_DASHBOARD_SCOPE_NOTES,
  type ManagementDashboardPayload,
} from "@/lib/analytics/management-dashboard";

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

function resolvePeriodBounds(searchParams: URLSearchParams): {
  periodType: "all" | "year" | "month";
  year: number;
  month: number | null;
  periodStart: string;
  periodEnd: string;
  periodLabel: string;
} {
  const now = new Date();
  const raw = (searchParams.get("periodType") || "all").toLowerCase();
  const periodType = raw === "month" ? "month" : raw === "year" ? "year" : "all";
  const yearRaw = parseInt(searchParams.get("year") || String(now.getFullYear()), 10);
  const year = Number.isFinite(yearRaw) ? yearRaw : now.getFullYear();

  if (periodType === "all") {
    return {
      periodType: "all",
      year,
      month: null,
      periodStart: "",
      periodEnd: "",
      periodLabel: "All time",
    };
  }

  if (periodType === "month") {
    const monthRaw = parseInt(searchParams.get("month") || String(now.getMonth() + 1), 10);
    const month = Number.isFinite(monthRaw) ? Math.min(12, Math.max(1, monthRaw)) : now.getMonth() + 1;
    const periodStart = new Date(year, month - 1, 1).toISOString().slice(0, 10);
    const periodEnd = new Date(year, month, 0).toISOString().slice(0, 10);
    const periodLabel = new Date(year, month - 1, 1).toLocaleString("en", { month: "long", year: "numeric" });
    return { periodType, year, month, periodStart, periodEnd, periodLabel };
  }

  const periodStart = new Date(year, 0, 1).toISOString().slice(0, 10);
  const periodEnd = new Date(year, 11, 31).toISOString().slice(0, 10);
  return { periodType, year, month: null, periodStart, periodEnd, periodLabel: String(year) };
}

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
  const timeRangeLegacy = (searchParams.get("timeRange") || "").trim();
  const debug = (searchParams.get("debug") || "").trim() === "1";
  const selectedFacultyId = facultyIdParam && facultyIdParam !== "all" ? Number(facultyIdParam) : null;
  const facultyFilterCondition =
    selectedFacultyId && Number.isFinite(selectedFacultyId) ? sql` AND a.faculty = ${selectedFacultyId}` : sql``;

  const quarterStart = quarterStartDate();
  const yearStart = yearStartDate();

  const period = resolvePeriodBounds(searchParams);
  const { periodStart, periodEnd, periodLabel, periodType, year, month } = period;

  const applyPeriodFilter = periodType === "year" || periodType === "month";

  // Legacy timeRange param support (This Quarter / YTD) when periodType not sent
  const useLegacyTimeRange =
    !searchParams.get("periodType") && !searchParams.get("year") && timeRangeLegacy.length > 0;
  const timeRange = applyPeriodFilter ? periodLabel : useLegacyTimeRange ? timeRangeLegacy : "All time";
  const selectedStart = useLegacyTimeRange
    ? timeRangeLegacy === "YTD"
      ? yearStart
      : quarterStart
    : applyPeriodFilter
      ? periodStart
      : quarterStart;

  /** Calendar quarter/YTD when showing all data; selected period when year/month filter active. */
  const qStart = applyPeriodFilter ? periodStart : quarterStart;
  const yStart = applyPeriodFilter ? new Date(year, 0, 1).toISOString().slice(0, 10) : yearStart;
  const qEndEvents = applyPeriodFilter ? sql` AND fromdate <= ${periodEnd}::date` : sql``;
  const qEndTalk = applyPeriodFilter ? sql` AND t.date_1 <= ${periodEnd}::date` : sql``;
  const qEndJob = applyPeriodFilter ? sql` AND j.created_at::date <= ${periodEnd}::date` : sql``;
  const qEndStory = applyPeriodFilter ? sql` AND s.createdat::date <= ${periodEnd}::date` : sql``;
  const qEndNews = applyPeriodFilter ? sql` AND COALESCE(n.date, n.created_at::date) <= ${periodEnd}::date` : sql``;

  const alumniPeriodCond = applyPeriodFilter
    ? sql` AND a.todaydate::date >= ${periodStart}::date AND a.todaydate::date <= ${periodEnd}::date`
    : sql``;
  const scholarshipPeriodCond = applyPeriodFilter
    ? sql` AND s.created_at::date >= ${periodStart}::date AND s.created_at::date <= ${periodEnd}::date`
    : sql``;
  const membershipPeriodCond = applyPeriodFilter
    ? sql` AND m.created_at::date >= ${periodStart}::date AND m.created_at::date <= ${periodEnd}::date`
    : sql``;
  const cardPeriodCond = applyPeriodFilter
    ? sql` AND c.createdat::date >= ${periodStart}::date AND c.createdat::date <= ${periodEnd}::date`
    : sql``;

  try {
    const [kpiRows, alumniHeadlineRows] = await Promise.all([
      sql/* sql */`
        SELECT
          COUNT(*) FILTER (WHERE true)::int AS total_alumni,
          COUNT(*) FILTER (WHERE
            COALESCE(a.logincount, 0) >= 1
            OR TRIM(COALESCE(a.lasttimelogin, '')) <> ''
          )::int AS active_alumni
        FROM public.tbl_alumni a
        WHERE 1=1
        ${accessFilterCondition}
        ${facultyFilterCondition}
        ${alumniPeriodCond}
      `,
      sql/* sql */`
        SELECT
          COUNT(DISTINCT a.alumniid)::int AS total,
          COUNT(DISTINCT a.alumniid) FILTER (WHERE LOWER(COALESCE(a.verify, '')) = 'true')::int AS verified,
          COUNT(DISTINCT a.alumniid) FILTER (
            WHERE LOWER(TRIM(COALESCE(a.category, ''))) = 'a+'
               OR LOWER(TRIM(COALESCE(a.category, ''))) LIKE 'a+%'
          )::int AS category_a_plus,
          COUNT(DISTINCT a.alumniid) FILTER (
            WHERE (LOWER(TRIM(COALESCE(a.category, ''))) = 'a'
               OR (LOWER(TRIM(COALESCE(a.category, ''))) LIKE 'a%'
               AND LOWER(TRIM(COALESCE(a.category, ''))) NOT LIKE 'a+%'))
          )::int AS category_a,
          COUNT(DISTINCT a.alumniid) FILTER (
            WHERE LOWER(TRIM(COALESCE(a.category, ''))) = 'b'
               OR LOWER(TRIM(COALESCE(a.category, ''))) LIKE 'b%'
          )::int AS category_b,
          COUNT(DISTINCT a.alumniid) FILTER (
            WHERE LOWER(TRIM(COALESCE(a.category, ''))) = 'c'
               OR LOWER(TRIM(COALESCE(a.category, ''))) LIKE 'c%'
          )::int AS category_c,
          COUNT(DISTINCT a.alumniid) FILTER (
            WHERE LOWER(TRIM(COALESCE(a.category, ''))) = 'd'
               OR LOWER(TRIM(COALESCE(a.category, ''))) LIKE 'd%'
          )::int AS category_d
        FROM public.tbl_alumni a
        WHERE 1=1
        ${accessFilterCondition}
        ${facultyFilterCondition}
        ${alumniPeriodCond}
      `,
    ]);

    const eventRows = await sql/* sql */`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE fromdate >= ${qStart}::date${qEndEvents})::int AS quarter_count,
        COUNT(*) FILTER (WHERE fromdate >= ${yStart}::date${qEndEvents})::int AS ytd_count,
        COUNT(*) FILTER (WHERE fromdate >= ${selectedStart}::date)::int AS selected_range_count,
        COUNT(*) FILTER (WHERE 1=1${applyPeriodFilter ? sql` AND fromdate >= ${periodStart}::date AND fromdate <= ${periodEnd}::date` : sql``})::int AS period_count
      FROM public.tbl_events
    `;

    const jobsRows = await sql/* sql */`
      SELECT
        COUNT(*) FILTER (WHERE 1=1${applyPeriodFilter ? sql` AND j.created_at::date >= ${periodStart}::date AND j.created_at::date <= ${periodEnd}::date` : sql``})::int AS total,
        COUNT(*) FILTER (WHERE LOWER(COALESCE(company,'')) LIKE '%university of lahore%' OR LOWER(COALESCE(company,'')) LIKE '%uol%')::int AS uol_total,
        COUNT(*) FILTER (WHERE NOT (LOWER(COALESCE(company,'')) LIKE '%university of lahore%' OR LOWER(COALESCE(company,'')) LIKE '%uol%'))::int AS other_total,
        COUNT(*) FILTER (
          WHERE (LOWER(COALESCE(company,'')) LIKE '%university of lahore%' OR LOWER(COALESCE(company,'')) LIKE '%uol%')
            AND j.created_at >= ${qStart}::timestamptz${qEndJob}
        )::int AS uol_quarter,
        COUNT(*) FILTER (
          WHERE (LOWER(COALESCE(company,'')) LIKE '%university of lahore%' OR LOWER(COALESCE(company,'')) LIKE '%uol%')
            AND j.created_at >= ${yStart}::timestamptz${qEndJob}
        )::int AS uol_ytd,
        COUNT(*) FILTER (
          WHERE NOT (LOWER(COALESCE(company,'')) LIKE '%university of lahore%' OR LOWER(COALESCE(company,'')) LIKE '%uol%')
            AND j.created_at >= ${qStart}::timestamptz${qEndJob}
        )::int AS other_quarter,
        COUNT(*) FILTER (
          WHERE NOT (LOWER(COALESCE(company,'')) LIKE '%university of lahore%' OR LOWER(COALESCE(company,'')) LIKE '%uol%')
            AND j.created_at >= ${yStart}::timestamptz${qEndJob}
        )::int AS other_ytd
      FROM public.tbljobs j
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
      ${scholarshipPeriodCond}
    `;

    const membershipRows = await sql/* sql */`
      SELECT
        COUNT(*) FILTER (WHERE LOWER(COALESCE(m.status,'pending')) IN ('approved','active'))::int AS active_benefits,
        COUNT(*) FILTER (WHERE TRIM(COALESCE(m.gym_membership_month,'')) <> '')::int AS gym_count,
        COUNT(*) FILTER (WHERE TRIM(COALESCE(m.swimmingpool_membership_month,'')) <> '')::int AS swimming_count,
        COUNT(*) FILTER (
          WHERE LOWER(COALESCE(m.reason,'')) LIKE '%free%' AND LOWER(COALESCE(m.reason,'')) LIKE '%gym%'
        )::int AS free_gym_hint,
        COUNT(*) FILTER (
          WHERE LOWER(COALESCE(m.reason,'')) LIKE '%free%' AND LOWER(COALESCE(m.reason,'')) LIKE '%pool%'
        )::int AS free_pool_hint,
        COUNT(*) FILTER (
          WHERE LOWER(COALESCE(m.reason,'')) LIKE '%qalander%' OR LOWER(COALESCE(m.reason,'')) LIKE '%qalandar%'
        )::int AS qalander_hint,
        COUNT(*) FILTER (
          WHERE LOWER(COALESCE(m.reason,'')) LIKE '%health%' OR LOWER(COALESCE(m.reason,'')) LIKE '%hospital%' OR LOWER(COALESCE(m.reason,'')) LIKE '%ulh%'
        )::int AS healthcare_hint,
        COUNT(*) FILTER (
          WHERE LOWER(COALESCE(m.reason,'')) LIKE '%vehicle%' OR LOWER(COALESCE(m.reason,'')) LIKE '%sticker%'
        )::int AS vehicle_hint
      FROM public.alumni_memberships m
      JOIN public.tbl_alumni a ON a.alumniid = m.alumniid
      WHERE 1=1
      ${accessFilterCondition}
      ${facultyFilterCondition}
      ${membershipPeriodCond}
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
      ${alumniPeriodCond}
      GROUP BY 1
      ORDER BY 2 DESC
    `;

    const chapterAssocRows = await sql/* sql */`
      SELECT
        (SELECT COUNT(*)::int FROM public.tblchapters c WHERE TRIM(COALESCE(c.national_chapter,'')) <> '') AS national_chapters,
        (SELECT COUNT(*)::int FROM public.tblchapters c WHERE TRIM(COALESCE(c.international_chapter,'')) <> '') AS international_chapters,
        (SELECT COUNT(DISTINCT fid)::int
         FROM (
           SELECT a.association_id AS fid
           FROM public.tbl_alumni a
           WHERE a.association_id IS NOT NULL
           ${accessFilterCondition}
           ${facultyFilterCondition}
           UNION
           SELECT a.faculty AS fid
           FROM public.tbl_alumni a
           WHERE a.faculty IS NOT NULL
           ${accessFilterCondition}
           ${facultyFilterCondition}
         ) association_faculties
         WHERE fid IS NOT NULL) AS associations,
        (SELECT COUNT(DISTINCT a.alumniid)::int
         FROM public.tbl_alumni a
         WHERE 1=1
         ${accessFilterCondition}
         ${facultyFilterCondition}
         ${buildAssociationTabMembershipMembersSQL()}) AS association_members,
        (SELECT COUNT(DISTINCT ac.id)::int FROM public.alumni_chapter ac JOIN public.tbl_alumni a ON a.alumniid = ac.id WHERE 1=1 ${accessFilterCondition} ${facultyFilterCondition} ${alumniPeriodCond}) AS members,
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
      ${cardPeriodCond}
    `;

    const talksRows = await sql/* sql */`
      SELECT
        COUNT(*)::int AS total_count,
        COUNT(*) FILTER (WHERE t.date_1 >= ${qStart}::date${qEndTalk})::int AS quarter_count,
        COUNT(*) FILTER (WHERE t.date_1 >= ${yStart}::date${qEndTalk})::int AS ytd_count,
        COUNT(*) FILTER (WHERE 1=1${applyPeriodFilter ? sql` AND t.date_1 >= ${periodStart}::date AND t.date_1 <= ${periodEnd}::date` : sql``})::int AS period_count,
        COUNT(*) FILTER (WHERE LOWER(COALESCE(t.mentorshipprogram,'')) IN ('yes','true','1') AND t.date_1 >= ${qStart}::date${qEndTalk})::int AS mentorship_quarter,
        COUNT(*) FILTER (WHERE LOWER(COALESCE(t.mentorshipprogram,'')) IN ('yes','true','1') AND t.date_1 >= ${yStart}::date${qEndTalk})::int AS mentorship_ytd,
        COUNT(*) FILTER (WHERE LOWER(COALESCE(t.activity,'')) LIKE '%seminar%' AND t.date_1 >= ${qStart}::date${qEndTalk})::int AS seminars_quarter,
        COUNT(*) FILTER (WHERE LOWER(COALESCE(t.activity,'')) LIKE '%seminar%' AND t.date_1 >= ${yStart}::date${qEndTalk})::int AS seminars_ytd,
        COUNT(*) FILTER (WHERE LOWER(COALESCE(t.activity,'')) LIKE '%conference%' AND t.date_1 >= ${qStart}::date${qEndTalk})::int AS conferences_quarter,
        COUNT(*) FILTER (WHERE LOWER(COALESCE(t.activity,'')) LIKE '%conference%' AND t.date_1 >= ${yStart}::date${qEndTalk})::int AS conferences_ytd,
        COUNT(*) FILTER (WHERE (LOWER(COALESCE(t.activity,'')) LIKE '%high achiever%' OR LOWER(COALESCE(t.topic,'')) LIKE '%high achiever%') AND t.date_1 >= ${qStart}::date${qEndTalk})::int AS high_achievers_quarter,
        COUNT(*) FILTER (WHERE (LOWER(COALESCE(t.activity,'')) LIKE '%high achiever%' OR LOWER(COALESCE(t.topic,'')) LIKE '%high achiever%') AND t.date_1 >= ${yStart}::date${qEndTalk})::int AS high_achievers_ytd,
        COUNT(*) FILTER (WHERE (LOWER(COALESCE(t.activity,'')) LIKE '%wellbeing%' OR LOWER(COALESCE(t.topic,'')) LIKE '%wellbeing%') AND t.date_1 >= ${qStart}::date${qEndTalk})::int AS wellbeing_quarter,
        COUNT(*) FILTER (WHERE (LOWER(COALESCE(t.activity,'')) LIKE '%wellbeing%' OR LOWER(COALESCE(t.topic,'')) LIKE '%wellbeing%') AND t.date_1 >= ${yStart}::date${qEndTalk})::int AS wellbeing_ytd
      FROM public.tblalumnitalks t
      JOIN public.tbl_alumni a ON a.alumniid = t.alumniid
      WHERE 1=1
      ${accessFilterCondition}
      ${facultyFilterCondition}
    `;

    const chapterEventsRows = await sql/* sql */`
      SELECT
        COUNT(*) FILTER (WHERE e.fromdate >= ${qStart}::date${applyPeriodFilter ? sql` AND e.fromdate <= ${periodEnd}::date` : sql``})::int AS quarter_count,
        COUNT(*) FILTER (WHERE e.fromdate >= ${yStart}::date${applyPeriodFilter ? sql` AND e.fromdate <= ${periodEnd}::date` : sql``})::int AS ytd_count,
        COUNT(*) FILTER (WHERE 1=1${applyPeriodFilter ? sql` AND e.fromdate >= ${periodStart}::date AND e.fromdate <= ${periodEnd}::date` : sql``})::int AS total_count
      FROM public.tbl_events e
    `;

    const careerDerivedRows = await sql/* sql */`
      SELECT
        COUNT(*) FILTER (
          WHERE (LOWER(COALESCE(j.category,'')) LIKE '%recruit%' OR LOWER(COALESCE(j.title,'')) LIKE '%recruit%')
            AND j.created_at >= ${qStart}::date${qEndJob}
        )::int AS recruitment_quarter,
        COUNT(*) FILTER (
          WHERE (LOWER(COALESCE(j.category,'')) LIKE '%recruit%' OR LOWER(COALESCE(j.title,'')) LIKE '%recruit%')
            AND j.created_at >= ${yStart}::date${qEndJob}
        )::int AS recruitment_ytd,
        COUNT(*) FILTER (
          WHERE (LOWER(COALESCE(j.category,'')) LIKE '%startup%' OR LOWER(COALESCE(j.title,'')) LIKE '%startup%')
            AND j.created_at >= ${qStart}::date${qEndJob}
        )::int AS startups_quarter,
        COUNT(*) FILTER (
          WHERE (LOWER(COALESCE(j.category,'')) LIKE '%startup%' OR LOWER(COALESCE(j.title,'')) LIKE '%startup%')
            AND j.created_at >= ${yStart}::date${qEndJob}
        )::int AS startups_ytd,
        COUNT(*) FILTER (
          WHERE (LOWER(COALESCE(j.category,'')) LIKE '%course%' OR LOWER(COALESCE(j.category,'')) LIKE '%upskill%' OR LOWER(COALESCE(j.title,'')) LIKE '%course%' OR LOWER(COALESCE(j.title,'')) LIKE '%upskill%')
            AND j.created_at >= ${qStart}::date${qEndJob}
        )::int AS upskill_quarter,
        COUNT(*) FILTER (
          WHERE (LOWER(COALESCE(j.category,'')) LIKE '%course%' OR LOWER(COALESCE(j.category,'')) LIKE '%upskill%' OR LOWER(COALESCE(j.title,'')) LIKE '%course%' OR LOWER(COALESCE(j.title,'')) LIKE '%upskill%')
            AND j.created_at >= ${yStart}::date${qEndJob}
        )::int AS upskill_ytd
      FROM public.tbljobs j
    `;

    const transitionRows = await sql/* sql */`
      SELECT
        COUNT(*) FILTER (WHERE LOWER(TRIM(COALESCE(a.occupation_transition_timing,''))) = 'before graduation')::int AS before_graduation,
        COUNT(*) FILTER (WHERE LOWER(TRIM(COALESCE(a.occupation_transition_timing,''))) LIKE '%immediately%')::int AS immediate,
        COUNT(*) FILTER (WHERE LOWER(TRIM(COALESCE(a.occupation_transition_timing,''))) LIKE '%within 3 month%')::int AS within_3,
        COUNT(*) FILTER (WHERE LOWER(TRIM(COALESCE(a.occupation_transition_timing,''))) LIKE '%within 6 month%')::int AS within_6,
        COUNT(*) FILTER (WHERE LOWER(TRIM(COALESCE(a.occupation_transition_timing,''))) LIKE '%after 6 month%')::int AS after_6,
        COUNT(*) FILTER (
          WHERE TRIM(COALESCE(a.occupation_transition_timing,'')) <> ''
            AND LOWER(TRIM(COALESCE(a.occupation_transition_timing,''))) NOT IN ('before graduation')
            AND LOWER(TRIM(COALESCE(a.occupation_transition_timing,''))) NOT LIKE '%immediately%'
            AND LOWER(TRIM(COALESCE(a.occupation_transition_timing,''))) NOT LIKE '%within 3 month%'
            AND LOWER(TRIM(COALESCE(a.occupation_transition_timing,''))) NOT LIKE '%within 6 month%'
            AND LOWER(TRIM(COALESCE(a.occupation_transition_timing,''))) NOT LIKE '%after 6 month%'
        )::int AS unknown_bucket
      FROM public.tbl_alumni a
      WHERE 1=1
      ${accessFilterCondition}
      ${facultyFilterCondition}
      ${alumniPeriodCond}
    `;

    const occupationRows = await sql/* sql */`
      SELECT
        COUNT(*) FILTER (
          WHERE LOWER(TRIM(COALESCE(a.employeed,''))) IN ('employed','employed/business')
        )::int AS employed,
        COUNT(*) FILTER (
          WHERE LOWER(TRIM(COALESCE(a.employeed,''))) LIKE '%self-employed%' OR LOWER(TRIM(COALESCE(a.employeed,''))) LIKE '%entrepreneur%'
        )::int AS self_employed,
        COUNT(*) FILTER (
          WHERE LOWER(TRIM(COALESCE(a.employeed,''))) LIKE '%searching%'
        )::int AS unemployed_searching,
        COUNT(*) FILTER (
          WHERE LOWER(TRIM(COALESCE(a.employeed,''))) LIKE '%choice%'
        )::int AS unemployed_choice,
        COUNT(*) FILTER (WHERE TRIM(COALESCE(a.employeed,'')) <> '')::int AS with_status
      FROM public.tbl_alumni a
      WHERE 1=1
      ${accessFilterCondition}
      ${facultyFilterCondition}
      ${alumniPeriodCond}
    `;

    const provinceRows = await sql/* sql */`
      SELECT
        COUNT(*) FILTER (
          WHERE LOWER(TRIM(COALESCE(a.province,''))) LIKE '%punjab%'
            AND LOWER(TRIM(COALESCE(a.province,''))) NOT LIKE '%islamabad%'
        )::int AS punjab,
        COUNT(*) FILTER (
          WHERE LOWER(TRIM(COALESCE(a.province,''))) LIKE '%islamabad%'
            OR LOWER(TRIM(COALESCE(a.province,''))) LIKE '%ict%'
            OR LOWER(TRIM(COALESCE(a.province,''))) LIKE '%federal capital%'
        )::int AS islamabad,
        COUNT(*) FILTER (
          WHERE LOWER(TRIM(COALESCE(a.province,''))) LIKE '%khyber%'
            OR LOWER(TRIM(COALESCE(a.province,''))) LIKE '%kpk%'
            OR LOWER(TRIM(COALESCE(a.province,''))) = 'kp'
        )::int AS kpk,
        COUNT(*) FILTER (
          WHERE LOWER(TRIM(COALESCE(a.province,''))) LIKE '%sindh%'
        )::int AS sindh,
        COUNT(*) FILTER (
          WHERE LOWER(TRIM(COALESCE(a.province,''))) LIKE '%ajk%'
            OR LOWER(TRIM(COALESCE(a.province,''))) LIKE '%azad%'
        )::int AS ajk,
        COUNT(*) FILTER (
          WHERE LOWER(TRIM(COALESCE(a.province,''))) LIKE '%gilgit%'
            OR LOWER(TRIM(COALESCE(a.province,''))) LIKE '%baltistan%'
            OR LOWER(TRIM(COALESCE(a.province,''))) LIKE '%gb%'
        )::int AS gb,
        COUNT(*) FILTER (
          WHERE LOWER(TRIM(COALESCE(a.province,''))) LIKE '%baloch%'
        )::int AS balochistan,
        COUNT(*) FILTER (
          WHERE TRIM(COALESCE(a.country,'')) <> ''
            AND LOWER(TRIM(COALESCE(a.country,''))) NOT LIKE '%pakistan%'
            AND LOWER(TRIM(COALESCE(a.country,''))) NOT IN ('pk')
        )::int AS overseas,
        COUNT(*)::int AS total_rows
      FROM public.tbl_alumni a
      WHERE 1=1
      ${accessFilterCondition}
      ${facultyFilterCondition}
      ${alumniPeriodCond}
    `;

    const uaaFacultyResolvedCond =
      selectedFacultyId && Number.isFinite(selectedFacultyId)
        ? sql` AND COALESCE(uaa.faculty_id, fby.id) = ${selectedFacultyId}`
        : sql``;

    const uraFacultyCond =
      selectedFacultyId && Number.isFinite(selectedFacultyId)
        ? sql` AND COALESCE(res.legacy_faculty_id, parent_fac.legacy_faculty_id, grandparent_fac.legacy_faculty_id, fby_res.id) = ${selectedFacultyId}`
        : sql``;

    let trainedFacultyAdmins: {
      total: number | null;
      byFaculty: Array<{ faculty: string; facultyId: number | null; count: number }>;
    } = { total: null, byFaculty: [] };
    const trainedFacultyAdminsDebug: {
      tableCheck?: unknown;
      mergedError?: string;
      uaaOnlyError?: string;
      legacyError?: string;
    } = {};

    const applyTrainedAdminRows = (
      totalRows: Array<{ c?: number }>,
      byFacultyRows: unknown
    ) => {
      const total = Number((totalRows[0] as { c?: number } | undefined)?.c ?? 0);
      const byFaculty = (byFacultyRows as unknown as Array<{ faculty: string; faculty_id: number | null; cnt: number }>).map((r) => ({
        faculty: r.faculty || "Unknown",
        facultyId: r.faculty_id ?? null,
        count: Number(r.cnt ?? 0),
      }));
      trainedFacultyAdmins = {
        total: Number.isFinite(total) ? total : null,
        byFaculty,
      };
    };

    /** Setup /users uses `user_resource_access` + `resources` (see rbac.ts); legacy uses `user_access_assignments`. */
    const loadTrainedFromMergedPairs = async () => {
      const tables = await sql/* sql */`
        SELECT
          to_regclass('public.user_resource_access') AS ura,
          to_regclass('public.resources') AS resources,
          to_regclass('public.user_access_assignments') AS uaa,
          to_regclass('public.users') AS users,
          to_regclass('public.tbl_faculties') AS faculties
      `;
      trainedFacultyAdminsDebug.tableCheck =
        (tables as unknown as Array<Record<string, unknown>>)?.[0] ?? null;

      const tc = trainedFacultyAdminsDebug.tableCheck as
        | { ura?: string | null; resources?: string | null; uaa?: string | null }
        | null
        | undefined;
      const hasUaa = Boolean(tc?.uaa);

      // URA-only query is valid even when `user_access_assignments` doesn't exist.
      if (!hasUaa) {
        const totalRowsUraOnly = await sql/* sql */`
          WITH ura_pairs AS (
            SELECT DISTINCT
              u.id AS user_id,
              COALESCE(
                res.legacy_faculty_id,
                parent_fac.legacy_faculty_id,
                grandparent_fac.legacy_faculty_id,
                fby_res.id
              ) AS faculty_id
            FROM public.user_resource_access ura
            INNER JOIN public.users u ON u.id = ura.user_id
            INNER JOIN public.resources res ON ura.resource_id = res.id
            LEFT JOIN public.resources parent_dept ON res.parent_id = parent_dept.id AND parent_dept.type = 'department'
            LEFT JOIN public.resources parent_fac ON
              (res.type = 'department' AND res.parent_id = parent_fac.id AND parent_fac.type = 'faculty')
              OR (res.type = 'program' AND parent_dept.parent_id = parent_fac.id AND parent_fac.type = 'faculty')
            LEFT JOIN public.resources grandparent_fac ON
              res.type = 'program' AND parent_dept.parent_id = grandparent_fac.id AND grandparent_fac.type = 'faculty'
            LEFT JOIN public.tbl_faculties fby_res ON
              COALESCE(res.legacy_faculty_id, parent_fac.legacy_faculty_id, grandparent_fac.legacy_faculty_id) IS NULL
              AND LENGTH(TRIM(COALESCE(
                CASE WHEN res.type = 'faculty' THEN res.name
                     WHEN res.type = 'department' THEN parent_fac.name
                     WHEN res.type = 'program' THEN grandparent_fac.name
                     ELSE NULL END,
                ''
              ))) > 0
              AND LOWER(TRIM(fby_res.faculty_name)) = LOWER(TRIM(COALESCE(
                CASE WHEN res.type = 'faculty' THEN res.name
                     WHEN res.type = 'department' THEN parent_fac.name
                     WHEN res.type = 'program' THEN grandparent_fac.name
                     ELSE NULL END,
                ''
              )))
            WHERE res.type IN ('faculty', 'department', 'program')
              AND COALESCE(u.blocked, false) = false
              AND (
                LOWER(TRIM(COALESCE(u.type, ''))) IN ('admin', 'viewer', 'superadmin', 'user')
                OR LOWER(TRIM(COALESCE(u.legacy_type, ''))) IN ('admin', 'viewer', 'superadmin', 'user')
              )
              AND COALESCE(res.legacy_faculty_id, parent_fac.legacy_faculty_id, grandparent_fac.legacy_faculty_id, fby_res.id) IS NOT NULL
              ${uraFacultyCond}
          )
          SELECT COUNT(DISTINCT user_id)::int AS c FROM ura_pairs
        `;
        const byFacultyUraOnly = await sql/* sql */`
          WITH ura_pairs AS (
            SELECT DISTINCT
              u.id AS user_id,
              COALESCE(
                res.legacy_faculty_id,
                parent_fac.legacy_faculty_id,
                grandparent_fac.legacy_faculty_id,
                fby_res.id
              ) AS faculty_id
            FROM public.user_resource_access ura
            INNER JOIN public.users u ON u.id = ura.user_id
            INNER JOIN public.resources res ON ura.resource_id = res.id
            LEFT JOIN public.resources parent_dept ON res.parent_id = parent_dept.id AND parent_dept.type = 'department'
            LEFT JOIN public.resources parent_fac ON
              (res.type = 'department' AND res.parent_id = parent_fac.id AND parent_fac.type = 'faculty')
              OR (res.type = 'program' AND parent_dept.parent_id = parent_fac.id AND parent_fac.type = 'faculty')
            LEFT JOIN public.resources grandparent_fac ON
              res.type = 'program' AND parent_dept.parent_id = grandparent_fac.id AND grandparent_fac.type = 'faculty'
            LEFT JOIN public.tbl_faculties fby_res ON
              COALESCE(res.legacy_faculty_id, parent_fac.legacy_faculty_id, grandparent_fac.legacy_faculty_id) IS NULL
              AND LENGTH(TRIM(COALESCE(
                CASE WHEN res.type = 'faculty' THEN res.name
                     WHEN res.type = 'department' THEN parent_fac.name
                     WHEN res.type = 'program' THEN grandparent_fac.name
                     ELSE NULL END,
                ''
              ))) > 0
              AND LOWER(TRIM(fby_res.faculty_name)) = LOWER(TRIM(COALESCE(
                CASE WHEN res.type = 'faculty' THEN res.name
                     WHEN res.type = 'department' THEN parent_fac.name
                     WHEN res.type = 'program' THEN grandparent_fac.name
                     ELSE NULL END,
                ''
              )))
            WHERE res.type IN ('faculty', 'department', 'program')
              AND COALESCE(u.blocked, false) = false
              AND (
                LOWER(TRIM(COALESCE(u.type, ''))) IN ('admin', 'viewer', 'superadmin', 'user')
                OR LOWER(TRIM(COALESCE(u.legacy_type, ''))) IN ('admin', 'viewer', 'superadmin', 'user')
              )
              AND COALESCE(res.legacy_faculty_id, parent_fac.legacy_faculty_id, grandparent_fac.legacy_faculty_id, fby_res.id) IS NOT NULL
              ${uraFacultyCond}
          ),
          per_faculty AS (
            SELECT faculty_id, COUNT(DISTINCT user_id)::int AS cnt
            FROM ura_pairs
            GROUP BY faculty_id
          )
          SELECT
            COALESCE(NULLIF(TRIM(tf.faculty_name), ''), 'Faculty #' || pf.faculty_id::text) AS faculty,
            pf.faculty_id AS faculty_id,
            pf.cnt
          FROM per_faculty pf
          LEFT JOIN public.tbl_faculties tf ON tf.id = pf.faculty_id
          ORDER BY pf.cnt DESC, faculty ASC
        `;
        applyTrainedAdminRows(totalRowsUraOnly as Array<{ c?: number }>, byFacultyUraOnly);
        return;
      }

      // If `user_access_assignments` exists, use the union (URA + legacy UAA).
      const totalRowsMerged = await sql/* sql */`
        WITH ura_pairs AS (
          SELECT DISTINCT
            u.id AS user_id,
            COALESCE(
              res.legacy_faculty_id,
              parent_fac.legacy_faculty_id,
              grandparent_fac.legacy_faculty_id,
              fby_res.id
            ) AS faculty_id
          FROM public.user_resource_access ura
          INNER JOIN public.users u ON u.id = ura.user_id
          INNER JOIN public.resources res ON ura.resource_id = res.id
          LEFT JOIN public.resources parent_dept ON res.parent_id = parent_dept.id AND parent_dept.type = 'department'
          LEFT JOIN public.resources parent_fac ON
            (res.type = 'department' AND res.parent_id = parent_fac.id AND parent_fac.type = 'faculty')
            OR (res.type = 'program' AND parent_dept.parent_id = parent_fac.id AND parent_fac.type = 'faculty')
          LEFT JOIN public.resources grandparent_fac ON
            res.type = 'program' AND parent_dept.parent_id = grandparent_fac.id AND grandparent_fac.type = 'faculty'
          LEFT JOIN public.tbl_faculties fby_res ON
            COALESCE(res.legacy_faculty_id, parent_fac.legacy_faculty_id, grandparent_fac.legacy_faculty_id) IS NULL
            AND LENGTH(TRIM(COALESCE(
              CASE WHEN res.type = 'faculty' THEN res.name
                   WHEN res.type = 'department' THEN parent_fac.name
                   WHEN res.type = 'program' THEN grandparent_fac.name
                   ELSE NULL END,
              ''
            ))) > 0
            AND LOWER(TRIM(fby_res.faculty_name)) = LOWER(TRIM(COALESCE(
              CASE WHEN res.type = 'faculty' THEN res.name
                   WHEN res.type = 'department' THEN parent_fac.name
                   WHEN res.type = 'program' THEN grandparent_fac.name
                   ELSE NULL END,
              ''
            )))
          WHERE res.type IN ('faculty', 'department', 'program')
            AND COALESCE(u.blocked, false) = false
            AND (
              LOWER(TRIM(COALESCE(u.type, ''))) IN ('admin', 'viewer', 'superadmin', 'user')
              OR LOWER(TRIM(COALESCE(u.legacy_type, ''))) IN ('admin', 'viewer', 'superadmin', 'user')
            )
            AND COALESCE(res.legacy_faculty_id, parent_fac.legacy_faculty_id, grandparent_fac.legacy_faculty_id, fby_res.id) IS NOT NULL
            ${uraFacultyCond}
        ),
        uaa_pairs AS (
          SELECT DISTINCT
            u.id AS user_id,
            COALESCE(uaa.faculty_id, fby.id) AS faculty_id
          FROM public.user_access_assignments uaa
          INNER JOIN public.users u ON (u.id = uaa.userid OR u.legacy_userid = uaa.userid)
          LEFT JOIN public.tbl_faculties fby ON uaa.faculty_id IS NULL
            AND LENGTH(TRIM(COALESCE(uaa.faculty_name, ''))) > 0
            AND LOWER(TRIM(fby.faculty_name)) = LOWER(TRIM(uaa.faculty_name))
          WHERE COALESCE(uaa.faculty_id, fby.id) IS NOT NULL
            AND COALESCE(u.blocked, false) = false
            AND (
              LOWER(TRIM(COALESCE(u.type, ''))) IN ('admin', 'viewer', 'superadmin', 'user')
              OR LOWER(TRIM(COALESCE(u.legacy_type, ''))) IN ('admin', 'viewer', 'superadmin', 'user')
            )
            ${uaaFacultyResolvedCond}
        ),
        pairs AS (
          SELECT user_id, faculty_id FROM ura_pairs
          UNION
          SELECT user_id, faculty_id FROM uaa_pairs
        )
        SELECT COUNT(DISTINCT user_id)::int AS c FROM pairs
      `;
      const byFacultyMerged = await sql/* sql */`
        WITH ura_pairs AS (
          SELECT DISTINCT
            u.id AS user_id,
            COALESCE(
              res.legacy_faculty_id,
              parent_fac.legacy_faculty_id,
              grandparent_fac.legacy_faculty_id,
              fby_res.id
            ) AS faculty_id
          FROM public.user_resource_access ura
          INNER JOIN public.users u ON u.id = ura.user_id
          INNER JOIN public.resources res ON ura.resource_id = res.id
          LEFT JOIN public.resources parent_dept ON res.parent_id = parent_dept.id AND parent_dept.type = 'department'
          LEFT JOIN public.resources parent_fac ON
            (res.type = 'department' AND res.parent_id = parent_fac.id AND parent_fac.type = 'faculty')
            OR (res.type = 'program' AND parent_dept.parent_id = parent_fac.id AND parent_fac.type = 'faculty')
          LEFT JOIN public.resources grandparent_fac ON
            res.type = 'program' AND parent_dept.parent_id = grandparent_fac.id AND grandparent_fac.type = 'faculty'
          LEFT JOIN public.tbl_faculties fby_res ON
            COALESCE(res.legacy_faculty_id, parent_fac.legacy_faculty_id, grandparent_fac.legacy_faculty_id) IS NULL
            AND LENGTH(TRIM(COALESCE(
              CASE WHEN res.type = 'faculty' THEN res.name
                   WHEN res.type = 'department' THEN parent_fac.name
                   WHEN res.type = 'program' THEN grandparent_fac.name
                   ELSE NULL END,
              ''
            ))) > 0
            AND LOWER(TRIM(fby_res.faculty_name)) = LOWER(TRIM(COALESCE(
              CASE WHEN res.type = 'faculty' THEN res.name
                   WHEN res.type = 'department' THEN parent_fac.name
                   WHEN res.type = 'program' THEN grandparent_fac.name
                   ELSE NULL END,
              ''
            )))
          WHERE res.type IN ('faculty', 'department', 'program')
            AND COALESCE(u.blocked, false) = false
            AND (
              LOWER(TRIM(COALESCE(u.type, ''))) IN ('admin', 'viewer', 'superadmin', 'user')
              OR LOWER(TRIM(COALESCE(u.legacy_type, ''))) IN ('admin', 'viewer', 'superadmin', 'user')
            )
            AND COALESCE(res.legacy_faculty_id, parent_fac.legacy_faculty_id, grandparent_fac.legacy_faculty_id, fby_res.id) IS NOT NULL
            ${uraFacultyCond}
        ),
        uaa_pairs AS (
          SELECT DISTINCT
            u.id AS user_id,
            COALESCE(uaa.faculty_id, fby.id) AS faculty_id
          FROM public.user_access_assignments uaa
          INNER JOIN public.users u ON (u.id = uaa.userid OR u.legacy_userid = uaa.userid)
          LEFT JOIN public.tbl_faculties fby ON uaa.faculty_id IS NULL
            AND LENGTH(TRIM(COALESCE(uaa.faculty_name, ''))) > 0
            AND LOWER(TRIM(fby.faculty_name)) = LOWER(TRIM(uaa.faculty_name))
          WHERE COALESCE(uaa.faculty_id, fby.id) IS NOT NULL
            AND COALESCE(u.blocked, false) = false
            AND (
              LOWER(TRIM(COALESCE(u.type, ''))) IN ('admin', 'viewer', 'superadmin', 'user')
              OR LOWER(TRIM(COALESCE(u.legacy_type, ''))) IN ('admin', 'viewer', 'superadmin', 'user')
            )
            ${uaaFacultyResolvedCond}
        ),
        pairs AS (
          SELECT user_id, faculty_id FROM ura_pairs
          UNION
          SELECT user_id, faculty_id FROM uaa_pairs
        ),
        per_faculty AS (
          SELECT faculty_id, COUNT(DISTINCT user_id)::int AS cnt
          FROM pairs
          GROUP BY faculty_id
        )
        SELECT
          COALESCE(NULLIF(TRIM(tf.faculty_name), ''), 'Faculty #' || pf.faculty_id::text) AS faculty,
          pf.faculty_id AS faculty_id,
          pf.cnt
        FROM per_faculty pf
        LEFT JOIN public.tbl_faculties tf ON tf.id = pf.faculty_id
        ORDER BY pf.cnt DESC, faculty ASC
      `;
      applyTrainedAdminRows(totalRowsMerged as Array<{ c?: number }>, byFacultyMerged);
    };

    try {
      await loadTrainedFromMergedPairs();
    } catch (e) {
      trainedFacultyAdminsDebug.mergedError = e instanceof Error ? e.message : String(e);
      try {
        const totalRowsUaaOnly = await sql/* sql */`
          SELECT COUNT(DISTINCT u.id)::int AS c
          FROM public.user_access_assignments uaa
          INNER JOIN public.users u ON (u.id = uaa.userid OR u.legacy_userid = uaa.userid)
          WHERE COALESCE(uaa.faculty_id, (
            SELECT f2.id FROM public.tbl_faculties f2
            WHERE LENGTH(TRIM(COALESCE(uaa.faculty_name, ''))) > 0
              AND LOWER(TRIM(f2.faculty_name)) = LOWER(TRIM(uaa.faculty_name))
            LIMIT 1
          )) IS NOT NULL
            AND COALESCE(u.blocked, false) = false
            AND (
              LOWER(TRIM(COALESCE(u.type, ''))) IN ('admin', 'viewer', 'superadmin', 'user')
              OR LOWER(TRIM(COALESCE(u.legacy_type, ''))) IN ('admin', 'viewer', 'superadmin', 'user')
            )
            ${uaaFacultyResolvedCond}
        `;
        const byFacultyUaaOnly = await sql/* sql */`
          SELECT
            COALESCE(NULLIF(TRIM(f.faculty_name), ''), NULLIF(TRIM(uaa.faculty_name), ''), 'Faculty #' || COALESCE(uaa.faculty_id, fby.id)::text) AS faculty,
            COALESCE(uaa.faculty_id, fby.id) AS faculty_id,
            COUNT(DISTINCT u.id)::int AS cnt
          FROM public.user_access_assignments uaa
          INNER JOIN public.users u ON (u.id = uaa.userid OR u.legacy_userid = uaa.userid)
          LEFT JOIN public.tbl_faculties f ON f.id = uaa.faculty_id
          LEFT JOIN public.tbl_faculties fby ON uaa.faculty_id IS NULL
            AND LENGTH(TRIM(COALESCE(uaa.faculty_name, ''))) > 0
            AND LOWER(TRIM(fby.faculty_name)) = LOWER(TRIM(uaa.faculty_name))
          WHERE COALESCE(uaa.faculty_id, fby.id) IS NOT NULL
            AND COALESCE(u.blocked, false) = false
            AND (
              LOWER(TRIM(COALESCE(u.type, ''))) IN ('admin', 'viewer', 'superadmin', 'user')
              OR LOWER(TRIM(COALESCE(u.legacy_type, ''))) IN ('admin', 'viewer', 'superadmin', 'user')
            )
            ${uaaFacultyResolvedCond}
          GROUP BY COALESCE(uaa.faculty_id, fby.id), f.faculty_name, uaa.faculty_name, fby.faculty_name
          ORDER BY cnt DESC, faculty ASC
        `;
        applyTrainedAdminRows(totalRowsUaaOnly as Array<{ c?: number }>, byFacultyUaaOnly);
      } catch (e2) {
        trainedFacultyAdminsDebug.uaaOnlyError = e2 instanceof Error ? e2.message : String(e2);
        trainedFacultyAdmins = { total: null, byFaculty: [] };
      }
    }

    const hasNoTrainedData =
      (trainedFacultyAdmins.total ?? 0) === 0 && (trainedFacultyAdmins.byFaculty?.length ?? 0) === 0;

    if (hasNoTrainedData) {
      try {
        const totalRowsLegacy = await sql/* sql */`
          SELECT COUNT(DISTINCT uaa.userid)::int AS c
          FROM public.user_access_assignments uaa
          INNER JOIN public.tbl_users tu ON tu.userid = uaa.userid
          WHERE (uaa.faculty_id IS NOT NULL OR LENGTH(TRIM(COALESCE(uaa.faculty_name, ''))) > 0)
            AND COALESCE(tu.blocked, false) = false
            AND LOWER(TRIM(COALESCE(tu.type, ''))) IN ('admin', 'viewer', 'superadmin', 'user')
            ${selectedFacultyId && Number.isFinite(selectedFacultyId) ? sql` AND uaa.faculty_id = ${selectedFacultyId}` : sql``}
        `;
        const byFacultyRowsLegacy = await sql/* sql */`
          SELECT
            COALESCE(
              NULLIF(TRIM(f.faculty_name), ''),
              NULLIF(TRIM(uaa.faculty_name), ''),
              CASE WHEN uaa.faculty_id IS NOT NULL THEN 'Faculty #' || uaa.faculty_id::text ELSE 'Unassigned faculty' END
            ) AS faculty,
            uaa.faculty_id AS faculty_id,
            COUNT(DISTINCT uaa.userid)::int AS cnt
          FROM public.user_access_assignments uaa
          INNER JOIN public.tbl_users tu ON tu.userid = uaa.userid
          LEFT JOIN public.tbl_faculties f ON f.id = uaa.faculty_id
          WHERE (uaa.faculty_id IS NOT NULL OR LENGTH(TRIM(COALESCE(uaa.faculty_name, ''))) > 0)
            AND COALESCE(tu.blocked, false) = false
            AND LOWER(TRIM(COALESCE(tu.type, ''))) IN ('admin', 'viewer', 'superadmin', 'user')
            ${selectedFacultyId && Number.isFinite(selectedFacultyId) ? sql` AND uaa.faculty_id = ${selectedFacultyId}` : sql``}
          GROUP BY uaa.faculty_id, f.faculty_name, uaa.faculty_name
          ORDER BY cnt DESC, 1 ASC
        `;
        applyTrainedAdminRows(totalRowsLegacy as Array<{ c?: number }>, byFacultyRowsLegacy);
      } catch (e3) {
        trainedFacultyAdminsDebug.legacyError = e3 instanceof Error ? e3.message : String(e3);
        /* tbl_users may not exist */
      }
    }

    let storiesPub = 0;
    let storiesQ = 0;
    let storiesY = 0;
    try {
      const storyAgg = await sql/* sql */`
        SELECT
          COUNT(*)::int AS total_pub,
          COUNT(*) FILTER (WHERE s.createdat >= ${qStart}::timestamp${qEndStory})::int AS q,
          COUNT(*) FILTER (WHERE s.createdat >= ${yStart}::timestamp${qEndStory})::int AS y
        FROM public.tblalumnistories s
        INNER JOIN public.tbl_alumni a ON a.alumniid = s.alumniid
        WHERE s.alumnistories IS NOT NULL
          AND TRIM(s.alumnistories) <> ''
          AND (s.status IS NULL OR LOWER(TRIM(s.status)) NOT IN ('rejected', 'declined', 'draft'))
          ${accessFilterCondition}
          ${facultyFilterCondition}
      `;
      const sr = storyAgg[0] as { total_pub?: number; q?: number; y?: number } | undefined;
      storiesPub = Number(sr?.total_pub ?? 0);
      storiesQ = Number(sr?.q ?? 0);
      storiesY = Number(sr?.y ?? 0);
      if (applyPeriodFilter) {
        storiesPub = periodType === "month" ? storiesQ : storiesY;
      }
    } catch {
      storiesPub = 0;
      storiesQ = 0;
      storiesY = 0;
    }

    let nlTotal = 0;
    let nlQ = 0;
    let nlY = 0;
    try {
      const nl = await sql/* sql */`
        SELECT
          COUNT(*)::int AS c,
          COUNT(*) FILTER (WHERE COALESCE(n.date, n.created_at::date) >= ${qStart}::date${qEndNews})::int AS cq,
          COUNT(*) FILTER (WHERE COALESCE(n.date, n.created_at::date) >= ${yStart}::date${qEndNews})::int AS cy
        FROM public.newsletters n
      `;
      const nr = nl[0] as { c?: number; cq?: number; cy?: number } | undefined;
      nlTotal = Number(nr?.c ?? 0);
      nlQ = Number(nr?.cq ?? 0);
      nlY = Number(nr?.cy ?? 0);
      if (applyPeriodFilter) {
        nlTotal = periodType === "month" ? nlQ : nlY;
      }
    } catch {
      nlTotal = 0;
      nlQ = 0;
      nlY = 0;
    }

    const discountCatRows = await sql/* sql */`
      SELECT
        COUNT(*) FILTER (WHERE LOWER(COALESCE(s.discount_type,'')) LIKE '%dining%' OR LOWER(COALESCE(s.discount_type,'')) LIKE '%café%' OR LOWER(COALESCE(s.discount_type,'')) LIKE '%cafe%')::int AS dining,
        COUNT(*) FILTER (WHERE LOWER(COALESCE(s.discount_type,'')) LIKE '%retail%' OR LOWER(COALESCE(s.discount_type,'')) LIKE '%shop%')::int AS retail,
        COUNT(*) FILTER (WHERE LOWER(COALESCE(s.discount_type,'')) LIKE '%travel%' OR LOWER(COALESCE(s.discount_type,'')) LIKE '%leisure%')::int AS travel,
        COUNT(*) FILTER (WHERE LOWER(COALESCE(s.discount_type,'')) LIKE '%health%' OR LOWER(COALESCE(s.discount_type,'')) LIKE '%wellness%')::int AS health,
        COUNT(*) FILTER (WHERE LOWER(COALESCE(s.discount_type,'')) LIKE '%professional%' OR LOWER(COALESCE(s.discount_type,'')) LIKE '%education%')::int AS professional,
        COUNT(*) FILTER (WHERE LOWER(COALESCE(s.discount_type,'')) LIKE '%financ%')::int AS financial
      FROM public.alumni_scholarships s
      JOIN public.tbl_alumni a ON a.alumniid = s.id
      WHERE 1=1
      ${accessFilterCondition}
      ${facultyFilterCondition}
      ${scholarshipPeriodCond}
    `;

    const kpi = (kpiRows[0] ?? {}) as { total_alumni?: number; active_alumni?: number };
    const ah = (alumniHeadlineRows[0] ?? {}) as Record<string, number | undefined>;
    const ev = (eventRows[0] ?? {}) as { total?: number; quarter_count?: number; ytd_count?: number; selected_range_count?: number; period_count?: number };
    const jb = (jobsRows[0] ?? {}) as Record<string, number | undefined>;
    const sc = (scholarshipsRows[0] ?? {}) as Record<string, number | undefined>;
    const mb = (membershipRows[0] ?? {}) as Record<string, number | undefined>;
    const ca = (chapterAssocRows[0] ?? {}) as Record<string, number | undefined>;
    const cd = (cardsRows[0] ?? {}) as Record<string, number | undefined>;
    const tk = (talksRows[0] ?? {}) as Record<string, number | undefined>;
    const ce = (chapterEventsRows[0] ?? {}) as { quarter_count?: number; ytd_count?: number; total_count?: number };
    const cr = (careerDerivedRows[0] ?? {}) as Record<string, number | undefined>;
    const tr = (transitionRows[0] ?? {}) as Record<string, number | undefined>;
    const oc = (occupationRows[0] ?? {}) as Record<string, number | undefined>;
    const pr = (provinceRows[0] ?? {}) as Record<string, number | undefined>;
    const dc = (discountCatRows[0] ?? {}) as Record<string, number | undefined>;

    const totalWithOcc = Number(oc.with_status ?? 0);
    const occOther = Math.max(
      0,
      totalWithOcc -
        Number(oc.employed ?? 0) -
        Number(oc.self_employed ?? 0) -
        Number(oc.unemployed_searching ?? 0) -
        Number(oc.unemployed_choice ?? 0)
    );

    const provinceSumKnown =
      Number(pr.punjab ?? 0) +
      Number(pr.islamabad ?? 0) +
      Number(pr.kpk ?? 0) +
      Number(pr.sindh ?? 0) +
      Number(pr.ajk ?? 0) +
      Number(pr.gb ?? 0) +
      Number(pr.balochistan ?? 0) +
      Number(pr.overseas ?? 0);
    const provinceOther = Math.max(0, Number(pr.total_rows ?? 0) - provinceSumKnown);

    const meetupsForKpi = applyPeriodFilter
      ? (ev.period_count ?? null)
      : useLegacyTimeRange
        ? timeRangeLegacy === "YTD"
          ? (ev.ytd_count ?? null)
          : (ev.quarter_count ?? null)
        : (ev.total ?? null);
    const engagementsForKpi = applyPeriodFilter
      ? (tk.period_count ?? null)
      : useLegacyTimeRange
        ? timeRangeLegacy === "YTD"
          ? (tk.ytd_count ?? null)
          : (tk.quarter_count ?? null)
        : (tk.total_count ?? null);

    const eventsInPeriod = applyPeriodFilter ? (ev.period_count ?? null) : (ev.total ?? null);

    const payload: ManagementDashboardPayload = {
      meta: {
        quarterStart,
        yearStart,
        timeRange,
        periodType,
        year,
        month,
        periodStart: applyPeriodFilter ? periodStart : undefined,
        periodEnd: applyPeriodFilter ? periodEnd : undefined,
        periodColumnPrimary: applyPeriodFilter ? periodLabel : "This Quarter",
        periodColumnSecondary: applyPeriodFilter ? (periodType === "month" ? `YTD ${year}` : periodLabel) : "YTD",
        facultyId: facultyIdParam,
      },
      alumniHeadline: {
        total: ah.total ?? null,
        verified: ah.verified ?? null,
        category: {
          aPlus: ah.category_a_plus ?? null,
          a: ah.category_a ?? null,
          b: ah.category_b ?? null,
          c: ah.category_c ?? null,
          d: ah.category_d ?? null,
        },
      },
      kpis: {
        totalAlumni: kpi.total_alumni ?? null,
        totalRegistrations: kpi.total_alumni ?? null,
        activeAlumni: kpi.active_alumni ?? null,
        totalEngagements: engagementsForKpi,
        totalEventsMeetups: meetupsForKpi,
        jobsPosted: jb.total ?? null,
        scholarshipsProcessed: sc.processed ?? null,
        activeBenefitsDiscounts: mb.active_benefits ?? null,
      },
      sectionA: {
        facultyRows: facultyRows.map((r) => r as { faculty: string; registrations: number }),
        trainedFacultyAdmins,
        transitionVelocity: {
          beforeGraduation: tr.before_graduation ?? null,
          immediateAfterGraduation: tr.immediate ?? null,
          within3Months: tr.within_3 ?? null,
          within6Months: tr.within_6 ?? null,
          after6Months: tr.after_6 ?? null,
          unknown: tr.unknown_bucket ?? null,
        },
        currentOccupation: {
          employed: oc.employed ?? null,
          selfEmployed: oc.self_employed ?? null,
          unemployedSearching: oc.unemployed_searching ?? null,
          unemployedByChoice: oc.unemployed_choice ?? null,
          other: occOther > 0 ? occOther : null,
        },
        provinceLocation: {
          punjab: pr.punjab ?? null,
          islamabad: pr.islamabad ?? null,
          kpk: pr.kpk ?? null,
          sindh: pr.sindh ?? null,
          ajk: pr.ajk ?? null,
          gb: pr.gb ?? null,
          balochistan: pr.balochistan ?? null,
          overseas: pr.overseas ?? null,
          other: provinceOther > 0 ? provinceOther : null,
        },
      },
      sectionB: {
        chaptersAssociations: {
          nationalChapters: ca.national_chapters ?? null,
          internationalChapters: ca.international_chapters ?? null,
          associations: ca.associations ?? null,
          associationMembers: ca.association_members ?? null,
          members: ca.members ?? null,
          leadersAppointed: ca.leaders_appointed ?? null,
          meetupsQuarter: ev.quarter_count ?? null,
          meetupsYtd: ev.ytd_count ?? null,
          meetupsTotal: applyPeriodFilter ? eventsInPeriod : (ev.total ?? null),
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
        publications: {
          successStoriesPublished: storiesPub,
          successStoriesQuarter: storiesQ,
          successStoriesYtd: storiesY,
          newslettersIssued: nlTotal,
          newslettersQuarter: nlQ,
          newslettersYtd: nlY,
          surveysConducted: null,
        },
      },
      sectionC: {
        career: {
          recruitmentDrives: { quarter: cr.recruitment_quarter ?? 0, ytd: cr.recruitment_ytd ?? 0 },
          jobsPostedUol: { quarter: jb.uol_quarter ?? null, ytd: jb.uol_ytd ?? null },
          jobsPostedOtherEmployers: { quarter: jb.other_quarter ?? null, ytd: jb.other_ytd ?? null },
          startupsSupport: { quarter: cr.startups_quarter ?? 0, ytd: cr.startups_ytd ?? 0 },
          upskillCourses: { quarter: cr.upskill_quarter ?? 0, ytd: cr.upskill_ytd ?? 0 },
        },
        scholarships: {
          kinship: { applied: sc.kinship_applied ?? null, processed: sc.kinship_processed ?? null },
          mastersPhd: { applied: sc.masters_phd_applied ?? null, processed: sc.masters_phd_processed ?? null },
          iqPrograms: { applied: sc.iq_applied ?? null, processed: sc.iq_processed ?? null },
        },
        giveBackFinancialAssistance: null,
      },
      sectionD: {
        memberships: {
          gymDiscountActive: mb.gym_count ?? null,
          swimmingPoolDiscountActive: mb.swimming_count ?? null,
          freeGymThreeMonth: mb.free_gym_hint ?? null,
          freePoolThreeMonth: mb.free_pool_hint ?? null,
          qalanderClub: mb.qalander_hint ?? null,
          healthcareDiscounts: mb.healthcare_hint ?? null,
          vehicleStickers: mb.vehicle_hint ?? null,
        },
        discountCategories: {
          diningAndCafes: dc.dining ?? null,
          retailAndShopping: dc.retail ?? null,
          travelAndLeisure: dc.travel ?? null,
          healthAndWellness: dc.health ?? null,
          professionalServices: dc.professional ?? null,
          financialServices: dc.financial ?? null,
        },
        merchants: [...MANAGEMENT_DASHBOARD_MERCHANT_SEED],
      },
    };

    return NextResponse.json(
      {
        ...payload,
        ...(debug ? { debug: { trainedFacultyAdmins: trainedFacultyAdminsDebug } } : {}),
        scopeNotes: MANAGEMENT_DASHBOARD_SCOPE_NOTES,
        legacy: {
          totalEventsMeetupsSelectedRange: ev.selected_range_count ?? null,
          jobsUolAllTime: jb.uol_total ?? null,
          jobsOtherAllTime: jb.other_total ?? null,
        },
      },
      { status: 200 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch realtime dashboard analytics";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
