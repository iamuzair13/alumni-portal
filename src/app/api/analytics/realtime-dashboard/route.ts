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
import { collectSystemHealth } from "@/lib/analytics/systemHealth";

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

function formatQuarterMonthLabel(quarterStart: string): string {
  const start = new Date(`${quarterStart}T12:00:00`);
  if (Number.isNaN(start.getTime())) return "This Q";
  const end = new Date(start.getFullYear(), start.getMonth() + 3, 0);
  const fmt = (d: Date) => d.toLocaleString("en", { month: "short" });
  return `${fmt(start)}–${fmt(end)} ${start.getFullYear()}`;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function parseISODateParam(value: string | null): string {
  const trimmed = (value || "").trim();
  return ISO_DATE.test(trimmed) ? trimmed : "";
}

function formatRangeLabel(start: string, end: string): string {
  const fmt = (iso: string) => {
    const d = new Date(`${iso}T12:00:00`);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" });
  };
  return `${fmt(start)} – ${fmt(end)}`;
}

function resolvePeriodBounds(searchParams: URLSearchParams): {
  periodType: "all" | "year" | "month" | "range";
  year: number;
  month: number | null;
  periodStart: string;
  periodEnd: string;
  periodLabel: string;
} {
  const now = new Date();
  const raw = (searchParams.get("periodType") || "all").toLowerCase();
  const periodType =
    raw === "month" ? "month" : raw === "year" ? "year" : raw === "range" ? "range" : "all";
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

  if (periodType === "range") {
    let dateFrom = parseISODateParam(searchParams.get("dateFrom"));
    let dateTo = parseISODateParam(searchParams.get("dateTo"));
    if (!dateFrom && !dateTo) {
      dateTo = now.toISOString().slice(0, 10);
      const from = new Date(now);
      from.setDate(from.getDate() - 29);
      dateFrom = from.toISOString().slice(0, 10);
    } else if (!dateFrom) {
      dateFrom = dateTo;
    } else if (!dateTo) {
      dateTo = dateFrom;
    }
    if (dateFrom > dateTo) {
      const swap = dateFrom;
      dateFrom = dateTo;
      dateTo = swap;
    }
    return {
      periodType: "range",
      year,
      month: null,
      periodStart: dateFrom,
      periodEnd: dateTo,
      periodLabel: formatRangeLabel(dateFrom, dateTo),
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

  const applyPeriodFilter = periodType === "year" || periodType === "month" || periodType === "range";

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
          )::int AS category_d,
          COUNT(DISTINCT a.alumniid) FILTER (
            WHERE LOWER(COALESCE(a.verify, '')) = 'true'
              AND (
                LOWER(TRIM(COALESCE(a.category, ''))) = 'a+'
                OR LOWER(TRIM(COALESCE(a.category, ''))) LIKE 'a+%'
              )
          )::int AS verified_category_a_plus,
          COUNT(DISTINCT a.alumniid) FILTER (
            WHERE LOWER(COALESCE(a.verify, '')) = 'true'
              AND (
                LOWER(TRIM(COALESCE(a.category, ''))) = 'a'
                OR (
                  LOWER(TRIM(COALESCE(a.category, ''))) LIKE 'a%'
                  AND LOWER(TRIM(COALESCE(a.category, ''))) NOT LIKE 'a+%'
                )
              )
          )::int AS verified_category_a,
          COUNT(DISTINCT a.alumniid) FILTER (
            WHERE LOWER(COALESCE(a.verify, '')) = 'true'
              AND (
                LOWER(TRIM(COALESCE(a.category, ''))) = 'b'
                OR LOWER(TRIM(COALESCE(a.category, ''))) LIKE 'b%'
              )
          )::int AS verified_category_b,
          COUNT(DISTINCT a.alumniid) FILTER (
            WHERE LOWER(COALESCE(a.verify, '')) = 'true'
              AND (
                LOWER(TRIM(COALESCE(a.category, ''))) = 'c'
                OR LOWER(TRIM(COALESCE(a.category, ''))) LIKE 'c%'
              )
          )::int AS verified_category_c,
          COUNT(DISTINCT a.alumniid) FILTER (
            WHERE LOWER(COALESCE(a.verify, '')) = 'true'
              AND (
                LOWER(TRIM(COALESCE(a.category, ''))) = 'd'
                OR LOWER(TRIM(COALESCE(a.category, ''))) LIKE 'd%'
              )
          )::int AS verified_category_d
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
        COUNT(*)::int AS all_total,
        COUNT(*) FILTER (WHERE 1=1${applyPeriodFilter ? sql` AND j.created_at::date >= ${periodStart}::date AND j.created_at::date <= ${periodEnd}::date` : sql``})::int AS total,
        COUNT(*) FILTER (WHERE LOWER(COALESCE(company,'')) LIKE '%university of lahore%' OR LOWER(COALESCE(company,'')) LIKE '%uol%')::int AS uol_total,
        COUNT(*) FILTER (
          WHERE (LOWER(COALESCE(company,'')) LIKE '%university of lahore%' OR LOWER(COALESCE(company,'')) LIKE '%uol%')
            AND j.created_at >= ${qStart}::timestamptz${qEndJob}
        )::int + COUNT(*) FILTER (
          WHERE NOT (LOWER(COALESCE(company,'')) LIKE '%university of lahore%' OR LOWER(COALESCE(company,'')) LIKE '%uol%')
            AND j.created_at >= ${qStart}::timestamptz${qEndJob}
        )::int AS quarter_total,
        COUNT(*) FILTER (
          WHERE (LOWER(COALESCE(company,'')) LIKE '%university of lahore%' OR LOWER(COALESCE(company,'')) LIKE '%uol%')
            AND j.created_at >= ${yStart}::timestamptz${qEndJob}
        )::int + COUNT(*) FILTER (
          WHERE NOT (LOWER(COALESCE(company,'')) LIKE '%university of lahore%' OR LOWER(COALESCE(company,'')) LIKE '%uol%')
            AND j.created_at >= ${yStart}::timestamptz${qEndJob}
        )::int AS ytd_total,
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

    const jobsCategoryRows = await sql/* sql */`
      SELECT
        COALESCE(NULLIF(TRIM(j.category), ''), 'Uncategorized') AS category,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (
          WHERE LOWER(COALESCE(j.company,'')) LIKE '%university of lahore%'
            OR LOWER(COALESCE(j.company,'')) LIKE '%uol%'
        )::int AS uol,
        COUNT(*) FILTER (
          WHERE NOT (
            LOWER(COALESCE(j.company,'')) LIKE '%university of lahore%'
            OR LOWER(COALESCE(j.company,'')) LIKE '%uol%'
          )
        )::int AS other,
        COUNT(*) FILTER (WHERE j.created_at >= ${qStart}::timestamptz${qEndJob})::int AS quarter,
        COUNT(*) FILTER (WHERE j.created_at >= ${yStart}::timestamptz${qEndJob})::int AS ytd
      FROM public.tbljobs j
      GROUP BY 1
      ORDER BY total DESC, category ASC
    `;

    const scholarshipsRows = await sql/* sql */`
      SELECT
        COUNT(*)::int AS total_applied,
        COUNT(*) FILTER (WHERE LOWER(COALESCE(s.status, 'pending')) = 'approved')::int AS approved,
        COUNT(*) FILTER (WHERE LOWER(COALESCE(s.status, 'pending')) IN ('approved','not-approved'))::int AS processed,
        COUNT(*) FILTER (WHERE LOWER(COALESCE(s.apply_for,'')) LIKE '%kinship%')::int AS kinship_applied,
        COUNT(*) FILTER (
          WHERE LOWER(COALESCE(s.apply_for,'')) LIKE '%kinship%'
            AND LOWER(COALESCE(s.status,'pending')) = 'approved'
        )::int AS kinship_approved,
        COUNT(*) FILTER (WHERE LOWER(COALESCE(s.apply_for,'')) LIKE '%kinship%' AND LOWER(COALESCE(s.status,'pending')) IN ('approved','not-approved'))::int AS kinship_processed,
        COUNT(*) FILTER (WHERE LOWER(COALESCE(s.apply_for,'')) LIKE '%master%' OR LOWER(COALESCE(s.apply_for,'')) LIKE '%phd%')::int AS masters_phd_applied,
        COUNT(*) FILTER (
          WHERE (LOWER(COALESCE(s.apply_for,'')) LIKE '%master%' OR LOWER(COALESCE(s.apply_for,'')) LIKE '%phd%')
            AND LOWER(COALESCE(s.status,'pending')) = 'approved'
        )::int AS masters_phd_approved,
        COUNT(*) FILTER (WHERE (LOWER(COALESCE(s.apply_for,'')) LIKE '%master%' OR LOWER(COALESCE(s.apply_for,'')) LIKE '%phd%') AND LOWER(COALESCE(s.status,'pending')) IN ('approved','not-approved'))::int AS masters_phd_processed,
        COUNT(*) FILTER (WHERE LOWER(COALESCE(s.apply_for,'')) LIKE '%iq%')::int AS iq_applied,
        COUNT(*) FILTER (
          WHERE LOWER(COALESCE(s.apply_for,'')) LIKE '%iq%'
            AND LOWER(COALESCE(s.status,'pending')) = 'approved'
        )::int AS iq_approved,
        COUNT(*) FILTER (WHERE LOWER(COALESCE(s.apply_for,'')) LIKE '%iq%' AND LOWER(COALESCE(s.status,'pending')) IN ('approved','not-approved'))::int AS iq_processed
      FROM public.alumni_scholarships s
      JOIN public.tbl_alumni a ON a.alumniid = s.id
      WHERE 1=1
      ${accessFilterCondition}
      ${facultyFilterCondition}
      ${scholarshipPeriodCond}
    `;

    const facultyScholarshipRows = await sql/* sql */`
      SELECT
        COALESCE(NULLIF(TRIM(f.faculty_name), ''), NULLIF(TRIM(a.facultyname), ''), 'Under Processing') AS faculty,
        COUNT(*)::int AS applied,
        COUNT(*) FILTER (WHERE LOWER(COALESCE(s.status, 'pending')) = 'approved')::int AS approved,
        COUNT(*) FILTER (WHERE LOWER(COALESCE(s.status, 'pending')) IN ('approved','not-approved'))::int AS processed,
        COUNT(*) FILTER (WHERE LOWER(COALESCE(s.apply_for,'')) LIKE '%kinship%')::int AS kinship_applied,
        COUNT(*) FILTER (
          WHERE LOWER(COALESCE(s.apply_for,'')) LIKE '%kinship%'
            AND LOWER(COALESCE(s.status,'pending')) = 'approved'
        )::int AS kinship_approved,
        COUNT(*) FILTER (
          WHERE LOWER(COALESCE(s.apply_for,'')) LIKE '%kinship%'
            AND LOWER(COALESCE(s.status,'pending')) IN ('approved','not-approved')
        )::int AS kinship_processed,
        COUNT(*) FILTER (
          WHERE LOWER(COALESCE(s.apply_for,'')) LIKE '%master%'
            OR LOWER(COALESCE(s.apply_for,'')) LIKE '%phd%'
        )::int AS masters_applied,
        COUNT(*) FILTER (
          WHERE (LOWER(COALESCE(s.apply_for,'')) LIKE '%master%' OR LOWER(COALESCE(s.apply_for,'')) LIKE '%phd%')
            AND LOWER(COALESCE(s.status,'pending')) = 'approved'
        )::int AS masters_approved,
        COUNT(*) FILTER (
          WHERE (LOWER(COALESCE(s.apply_for,'')) LIKE '%master%' OR LOWER(COALESCE(s.apply_for,'')) LIKE '%phd%')
            AND LOWER(COALESCE(s.status,'pending')) IN ('approved','not-approved')
        )::int AS masters_processed,
        COUNT(*) FILTER (WHERE LOWER(COALESCE(s.apply_for,'')) LIKE '%iq%')::int AS iq_applied,
        COUNT(*) FILTER (
          WHERE LOWER(COALESCE(s.apply_for,'')) LIKE '%iq%'
            AND LOWER(COALESCE(s.status,'pending')) = 'approved'
        )::int AS iq_approved,
        COUNT(*) FILTER (
          WHERE LOWER(COALESCE(s.apply_for,'')) LIKE '%iq%'
            AND LOWER(COALESCE(s.status,'pending')) IN ('approved','not-approved')
        )::int AS iq_processed
      FROM public.alumni_scholarships s
      JOIN public.tbl_alumni a ON a.alumniid = s.id
      LEFT JOIN public.tbl_faculties f ON f.id = a.faculty
      WHERE 1=1
      ${accessFilterCondition}
      ${facultyFilterCondition}
      ${scholarshipPeriodCond}
      GROUP BY 1
      ORDER BY applied DESC, faculty ASC
    `;

    const membershipRows = await sql/* sql */`
      SELECT
        COUNT(*)::int AS total_count,
        COUNT(*) FILTER (WHERE LOWER(COALESCE(m.status,'pending')) IN ('approved','active'))::int AS active_benefits,
        COUNT(*) FILTER (
          WHERE LOWER(TRIM(COALESCE(m.facility_type,''))) = 'gym'
            OR TRIM(COALESCE(m.gym_membership_month,'')) <> ''
        )::int AS gym_count,
        COUNT(*) FILTER (
          WHERE (
            LOWER(TRIM(COALESCE(m.facility_type,''))) = 'gym'
            OR TRIM(COALESCE(m.gym_membership_month,'')) <> ''
          )
          AND LOWER(COALESCE(m.status,'pending')) IN ('approved','active')
        )::int AS gym_approved,
        COUNT(*) FILTER (
          WHERE LOWER(TRIM(COALESCE(m.facility_type,''))) = 'pool'
            OR TRIM(COALESCE(m.swimmingpool_membership_month,'')) <> ''
        )::int AS swimming_count,
        COUNT(*) FILTER (
          WHERE (
            LOWER(TRIM(COALESCE(m.facility_type,''))) = 'pool'
            OR TRIM(COALESCE(m.swimmingpool_membership_month,'')) <> ''
          )
          AND LOWER(COALESCE(m.status,'pending')) IN ('approved','active')
        )::int AS swimming_approved,
        COUNT(*) FILTER (
          WHERE LOWER(COALESCE(m.reason,'')) LIKE '%free%' AND LOWER(COALESCE(m.reason,'')) LIKE '%gym%'
        )::int AS free_gym_hint,
        COUNT(*) FILTER (
          WHERE LOWER(COALESCE(m.reason,'')) LIKE '%free%' AND LOWER(COALESCE(m.reason,'')) LIKE '%pool%'
        )::int AS free_pool_hint,
        COUNT(*) FILTER (
          WHERE LOWER(COALESCE(m.reason,'')) LIKE '%qalander%'
            OR LOWER(COALESCE(m.reason,'')) LIKE '%qalandar%'
            OR LOWER(TRIM(COALESCE(m.facility_type,''))) = 'cricket'
            OR TRIM(COALESCE(m.cricket_membership_month,'')) <> ''
        )::int AS qalander_hint,
        COUNT(*) FILTER (
          WHERE (
            LOWER(COALESCE(m.reason,'')) LIKE '%qalander%'
            OR LOWER(COALESCE(m.reason,'')) LIKE '%qalandar%'
            OR LOWER(TRIM(COALESCE(m.facility_type,''))) = 'cricket'
            OR TRIM(COALESCE(m.cricket_membership_month,'')) <> ''
          )
          AND LOWER(COALESCE(m.status,'pending')) IN ('approved','active')
        )::int AS qalander_approved,
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

    const facultyMembershipRows = await sql/* sql */`
      SELECT
        COALESCE(NULLIF(TRIM(f.faculty_name), ''), NULLIF(TRIM(a.facultyname), ''), 'Under Processing') AS faculty,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (
          WHERE LOWER(TRIM(COALESCE(m.facility_type,''))) = 'gym'
            OR TRIM(COALESCE(m.gym_membership_month,'')) <> ''
        )::int AS gym,
        COUNT(*) FILTER (
          WHERE (
            LOWER(TRIM(COALESCE(m.facility_type,''))) = 'gym'
            OR TRIM(COALESCE(m.gym_membership_month,'')) <> ''
          )
          AND LOWER(COALESCE(m.status,'pending')) IN ('approved','active')
        )::int AS gym_approved,
        COUNT(*) FILTER (
          WHERE LOWER(TRIM(COALESCE(m.facility_type,''))) = 'pool'
            OR TRIM(COALESCE(m.swimmingpool_membership_month,'')) <> ''
        )::int AS pool,
        COUNT(*) FILTER (
          WHERE (
            LOWER(TRIM(COALESCE(m.facility_type,''))) = 'pool'
            OR TRIM(COALESCE(m.swimmingpool_membership_month,'')) <> ''
          )
          AND LOWER(COALESCE(m.status,'pending')) IN ('approved','active')
        )::int AS pool_approved,
        COUNT(*) FILTER (
          WHERE LOWER(COALESCE(m.reason,'')) LIKE '%qalander%'
            OR LOWER(COALESCE(m.reason,'')) LIKE '%qalandar%'
            OR LOWER(TRIM(COALESCE(m.facility_type,''))) = 'cricket'
            OR TRIM(COALESCE(m.cricket_membership_month,'')) <> ''
        )::int AS qalander,
        COUNT(*) FILTER (
          WHERE (
            LOWER(COALESCE(m.reason,'')) LIKE '%qalander%'
            OR LOWER(COALESCE(m.reason,'')) LIKE '%qalandar%'
            OR LOWER(TRIM(COALESCE(m.facility_type,''))) = 'cricket'
            OR TRIM(COALESCE(m.cricket_membership_month,'')) <> ''
          )
          AND LOWER(COALESCE(m.status,'pending')) IN ('approved','active')
        )::int AS qalander_approved
      FROM public.alumni_memberships m
      JOIN public.tbl_alumni a ON a.alumniid = m.alumniid
      LEFT JOIN public.tbl_faculties f ON f.id = a.faculty
      WHERE 1=1
      ${accessFilterCondition}
      ${facultyFilterCondition}
      ${membershipPeriodCond}
      GROUP BY 1
      ORDER BY total DESC, faculty ASC
    `;

    const facultyRows = await sql/* sql */`
      SELECT
        COALESCE(NULLIF(TRIM(f.faculty_name), ''), NULLIF(TRIM(a.facultyname), ''), 'Under Processing') AS faculty,
        COUNT(*)::int AS registrations,
        COUNT(*) FILTER (WHERE LOWER(COALESCE(a.verify, '')) = 'true')::int AS verified,
        COUNT(*) FILTER (WHERE
          COALESCE(a.logincount, 0) >= 1
          OR TRIM(COALESCE(a.lasttimelogin, '')) <> ''
        )::int AS active
      FROM public.tbl_alumni a
      LEFT JOIN public.tbl_faculties f ON f.id = a.faculty
      WHERE 1=1
      ${accessFilterCondition}
      ${facultyFilterCondition}
      ${alumniPeriodCond}
      GROUP BY 1
      ORDER BY 2 DESC
    `;

    const facultyCategoryRows = await sql/* sql */`
      SELECT
        COALESCE(NULLIF(TRIM(f.faculty_name), ''), NULLIF(TRIM(a.facultyname), ''), 'Under Processing') AS faculty,
        COUNT(DISTINCT a.alumniid) FILTER (
          WHERE LOWER(COALESCE(a.verify, '')) = 'true'
            AND (
              LOWER(TRIM(COALESCE(a.category, ''))) = 'a+'
              OR LOWER(TRIM(COALESCE(a.category, ''))) LIKE 'a+%'
            )
        )::int AS a_plus,
        COUNT(DISTINCT a.alumniid) FILTER (
          WHERE LOWER(COALESCE(a.verify, '')) = 'true'
            AND (
              LOWER(TRIM(COALESCE(a.category, ''))) = 'a'
              OR (
                LOWER(TRIM(COALESCE(a.category, ''))) LIKE 'a%'
                AND LOWER(TRIM(COALESCE(a.category, ''))) NOT LIKE 'a+%'
              )
            )
        )::int AS a,
        COUNT(DISTINCT a.alumniid) FILTER (
          WHERE LOWER(COALESCE(a.verify, '')) = 'true'
            AND (
              LOWER(TRIM(COALESCE(a.category, ''))) = 'b'
              OR LOWER(TRIM(COALESCE(a.category, ''))) LIKE 'b%'
            )
        )::int AS b,
        COUNT(DISTINCT a.alumniid) FILTER (
          WHERE LOWER(COALESCE(a.verify, '')) = 'true'
            AND (
              LOWER(TRIM(COALESCE(a.category, ''))) = 'c'
              OR LOWER(TRIM(COALESCE(a.category, ''))) LIKE 'c%'
            )
        )::int AS c,
        COUNT(DISTINCT a.alumniid) FILTER (
          WHERE LOWER(COALESCE(a.verify, '')) = 'true'
            AND (
              LOWER(TRIM(COALESCE(a.category, ''))) = 'd'
              OR LOWER(TRIM(COALESCE(a.category, ''))) LIKE 'd%'
            )
        )::int AS d
      FROM public.tbl_alumni a
      LEFT JOIN public.tbl_faculties f ON f.id = a.faculty
      WHERE 1=1
      ${accessFilterCondition}
      ${facultyFilterCondition}
      ${alumniPeriodCond}
      GROUP BY 1
      ORDER BY (
        COUNT(DISTINCT a.alumniid) FILTER (WHERE LOWER(COALESCE(a.verify, '')) = 'true')
      ) DESC
    `;

    const facultyOccupationRows = await sql/* sql */`
      SELECT
        COALESCE(NULLIF(TRIM(f.faculty_name), ''), NULLIF(TRIM(a.facultyname), ''), 'Under Processing') AS faculty,
        COUNT(*) FILTER (
          WHERE LOWER(COALESCE(a.verify, '')) = 'true'
            AND LOWER(TRIM(COALESCE(a.employeed,''))) IN ('employed','employed/business')
        )::int AS employed,
        COUNT(*) FILTER (
          WHERE LOWER(COALESCE(a.verify, '')) = 'true'
            AND (
              LOWER(TRIM(COALESCE(a.employeed,''))) LIKE '%self-employed%'
              OR LOWER(TRIM(COALESCE(a.employeed,''))) LIKE '%entrepreneur%'
            )
        )::int AS self_employed,
        COUNT(*) FILTER (
          WHERE LOWER(COALESCE(a.verify, '')) = 'true'
            AND LOWER(TRIM(COALESCE(a.employeed,''))) LIKE '%searching%'
        )::int AS unemployed_searching,
        COUNT(*) FILTER (
          WHERE LOWER(COALESCE(a.verify, '')) = 'true'
            AND LOWER(TRIM(COALESCE(a.employeed,''))) LIKE '%choice%'
        )::int AS unemployed_choice,
        COUNT(*) FILTER (
          WHERE LOWER(COALESCE(a.verify, '')) = 'true' AND TRIM(COALESCE(a.employeed,'')) <> ''
        )::int AS with_status
      FROM public.tbl_alumni a
      LEFT JOIN public.tbl_faculties f ON f.id = a.faculty
      WHERE 1=1
      ${accessFilterCondition}
      ${facultyFilterCondition}
      ${alumniPeriodCond}
      GROUP BY 1
      ORDER BY 6 DESC
    `;

    const facultyTransitionRows = await sql/* sql */`
      SELECT
        COALESCE(NULLIF(TRIM(f.faculty_name), ''), NULLIF(TRIM(a.facultyname), ''), 'Under Processing') AS faculty,
        COUNT(*) FILTER (
          WHERE LOWER(COALESCE(a.verify, '')) = 'true'
            AND LOWER(TRIM(COALESCE(a.occupation_transition_timing,''))) = 'before graduation'
        )::int AS before_graduation,
        COUNT(*) FILTER (
          WHERE LOWER(COALESCE(a.verify, '')) = 'true'
            AND LOWER(TRIM(COALESCE(a.occupation_transition_timing,''))) LIKE '%immediately%'
        )::int AS immediate,
        COUNT(*) FILTER (
          WHERE LOWER(COALESCE(a.verify, '')) = 'true'
            AND LOWER(TRIM(COALESCE(a.occupation_transition_timing,''))) LIKE '%within 3 month%'
        )::int AS within_3,
        COUNT(*) FILTER (
          WHERE LOWER(COALESCE(a.verify, '')) = 'true'
            AND LOWER(TRIM(COALESCE(a.occupation_transition_timing,''))) LIKE '%within 6 month%'
        )::int AS within_6,
        COUNT(*) FILTER (
          WHERE LOWER(COALESCE(a.verify, '')) = 'true'
            AND LOWER(TRIM(COALESCE(a.occupation_transition_timing,''))) LIKE '%after 6 month%'
        )::int AS after_6,
        COUNT(*) FILTER (
          WHERE LOWER(COALESCE(a.verify, '')) = 'true'
            AND TRIM(COALESCE(a.occupation_transition_timing,'')) <> ''
            AND LOWER(TRIM(COALESCE(a.occupation_transition_timing,''))) NOT IN ('before graduation')
            AND LOWER(TRIM(COALESCE(a.occupation_transition_timing,''))) NOT LIKE '%immediately%'
            AND LOWER(TRIM(COALESCE(a.occupation_transition_timing,''))) NOT LIKE '%within 3 month%'
            AND LOWER(TRIM(COALESCE(a.occupation_transition_timing,''))) NOT LIKE '%within 6 month%'
            AND LOWER(TRIM(COALESCE(a.occupation_transition_timing,''))) NOT LIKE '%after 6 month%'
        )::int AS unknown_bucket,
        COUNT(*) FILTER (WHERE LOWER(COALESCE(a.verify, '')) = 'true')::int AS verified_total
      FROM public.tbl_alumni a
      LEFT JOIN public.tbl_faculties f ON f.id = a.faculty
      WHERE 1=1
      ${accessFilterCondition}
      ${facultyFilterCondition}
      ${alumniPeriodCond}
      GROUP BY 1
      ORDER BY 8 DESC
    `;

    const facultyLocationRows = await sql/* sql */`
      SELECT
        COALESCE(NULLIF(TRIM(f.faculty_name), ''), NULLIF(TRIM(a.facultyname), ''), 'Under Processing') AS faculty,
        COUNT(*) FILTER (
          WHERE LOWER(COALESCE(a.verify, '')) = 'true'
            AND LOWER(TRIM(COALESCE(a.province,''))) LIKE '%punjab%'
            AND LOWER(TRIM(COALESCE(a.province,''))) NOT LIKE '%islamabad%'
        )::int AS punjab,
        COUNT(*) FILTER (
          WHERE LOWER(COALESCE(a.verify, '')) = 'true'
            AND (
              LOWER(TRIM(COALESCE(a.province,''))) LIKE '%islamabad%'
              OR LOWER(TRIM(COALESCE(a.province,''))) LIKE '%ict%'
              OR LOWER(TRIM(COALESCE(a.province,''))) LIKE '%federal capital%'
            )
        )::int AS islamabad,
        COUNT(*) FILTER (
          WHERE LOWER(COALESCE(a.verify, '')) = 'true'
            AND (
              LOWER(TRIM(COALESCE(a.province,''))) LIKE '%khyber%'
              OR LOWER(TRIM(COALESCE(a.province,''))) LIKE '%kpk%'
              OR LOWER(TRIM(COALESCE(a.province,''))) = 'kp'
            )
        )::int AS kpk,
        COUNT(*) FILTER (
          WHERE LOWER(COALESCE(a.verify, '')) = 'true'
            AND LOWER(TRIM(COALESCE(a.province,''))) LIKE '%sindh%'
        )::int AS sindh,
        COUNT(*) FILTER (
          WHERE LOWER(COALESCE(a.verify, '')) = 'true'
            AND (
              LOWER(TRIM(COALESCE(a.province,''))) LIKE '%ajk%'
              OR LOWER(TRIM(COALESCE(a.province,''))) LIKE '%azad%'
            )
        )::int AS ajk,
        COUNT(*) FILTER (
          WHERE LOWER(COALESCE(a.verify, '')) = 'true'
            AND (
              LOWER(TRIM(COALESCE(a.province,''))) LIKE '%gilgit%'
              OR LOWER(TRIM(COALESCE(a.province,''))) LIKE '%baltistan%'
              OR LOWER(TRIM(COALESCE(a.province,''))) LIKE '%gb%'
            )
        )::int AS gb,
        COUNT(*) FILTER (
          WHERE LOWER(COALESCE(a.verify, '')) = 'true'
            AND LOWER(TRIM(COALESCE(a.province,''))) LIKE '%baloch%'
        )::int AS balochistan,
        COUNT(*) FILTER (
          WHERE LOWER(COALESCE(a.verify, '')) = 'true'
            AND TRIM(COALESCE(a.country,'')) <> ''
            AND LOWER(TRIM(COALESCE(a.country,''))) NOT LIKE '%pakistan%'
            AND LOWER(TRIM(COALESCE(a.country,''))) NOT IN ('pk')
        )::int AS overseas,
        COUNT(*) FILTER (WHERE LOWER(COALESCE(a.verify, '')) = 'true')::int AS verified_total
      FROM public.tbl_alumni a
      LEFT JOIN public.tbl_faculties f ON f.id = a.faculty
      WHERE 1=1
      ${accessFilterCondition}
      ${facultyFilterCondition}
      ${alumniPeriodCond}
      GROUP BY 1
      ORDER BY verified_total DESC
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

    const nationalChapterMemberRows = await sql/* sql */`
      WITH national_chapters AS (
        SELECT DISTINCT TRIM(c.national_chapter) AS chapter_name
        FROM public.tblchapters c
        WHERE c.is_active = true
          AND TRIM(COALESCE(c.national_chapter, '')) <> ''
      ),
      member_counts AS (
        SELECT
          TRIM(c.national_chapter) AS chapter_name,
          COUNT(DISTINCT a.alumniid)::int AS members
        FROM public.tblchapters c
        INNER JOIN public.alumni_chapter ac ON (
          ac.chapter1 = c.id OR ac.chapter2 = c.id OR ac.chapter3 = c.id
        )
        INNER JOIN public.tbl_alumni a ON a.alumniid = ac.id
        WHERE c.is_active = true
          AND TRIM(COALESCE(c.national_chapter, '')) <> ''
          ${accessFilterCondition}
          ${facultyFilterCondition}
          ${alumniPeriodCond}
        GROUP BY TRIM(c.national_chapter)
      )
      SELECT
        nc.chapter_name AS chapter,
        COALESCE(mc.members, 0)::int AS members
      FROM national_chapters nc
      LEFT JOIN member_counts mc ON mc.chapter_name = nc.chapter_name
      ORDER BY members DESC, chapter ASC
    `;

    const internationalChapterMemberRows = await sql/* sql */`
      WITH international_chapters AS (
        SELECT DISTINCT TRIM(c.international_chapter) AS chapter_name
        FROM public.tblchapters c
        WHERE c.is_active = true
          AND TRIM(COALESCE(c.international_chapter, '')) <> ''
      ),
      member_counts AS (
        SELECT
          TRIM(c.international_chapter) AS chapter_name,
          COUNT(DISTINCT a.alumniid)::int AS members
        FROM public.tblchapters c
        INNER JOIN public.alumni_chapter ac ON (
          ac.chapter1 = c.id OR ac.chapter2 = c.id OR ac.chapter3 = c.id
        )
        INNER JOIN public.tbl_alumni a ON a.alumniid = ac.id
        WHERE c.is_active = true
          AND TRIM(COALESCE(c.international_chapter, '')) <> ''
          ${accessFilterCondition}
          ${facultyFilterCondition}
          ${alumniPeriodCond}
        GROUP BY TRIM(c.international_chapter)
      )
      SELECT
        ic.chapter_name AS chapter,
        COALESCE(mc.members, 0)::int AS members
      FROM international_chapters ic
      LEFT JOIN member_counts mc ON mc.chapter_name = ic.chapter_name
      ORDER BY members DESC, chapter ASC
    `;

    const nationalMembersRows = await sql/* sql */`
      SELECT COUNT(DISTINCT a.alumniid)::int AS national_members
      FROM public.tblchapters c
      INNER JOIN public.alumni_chapter ac ON (
        ac.chapter1 = c.id OR ac.chapter2 = c.id OR ac.chapter3 = c.id
      )
      INNER JOIN public.tbl_alumni a ON a.alumniid = ac.id
      WHERE c.is_active = true
        AND TRIM(COALESCE(c.national_chapter, '')) <> ''
        ${accessFilterCondition}
        ${facultyFilterCondition}
        ${alumniPeriodCond}
    `;

    const internationalMembersRows = await sql/* sql */`
      SELECT COUNT(DISTINCT a.alumniid)::int AS international_members
      FROM public.tblchapters c
      INNER JOIN public.alumni_chapter ac ON (
        ac.chapter1 = c.id OR ac.chapter2 = c.id OR ac.chapter3 = c.id
      )
      INNER JOIN public.tbl_alumni a ON a.alumniid = ac.id
      WHERE c.is_active = true
        AND TRIM(COALESCE(c.international_chapter, '')) <> ''
        ${accessFilterCondition}
        ${facultyFilterCondition}
        ${alumniPeriodCond}
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

    const verifiedCardsRows = await sql/* sql */`
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
      WHERE LOWER(COALESCE(a.verify, '')) = 'true'
      ${accessFilterCondition}
      ${facultyFilterCondition}
      ${cardPeriodCond}
    `;

    const facultyHonorCardRows = await sql/* sql */`
      SELECT
        COALESCE(NULLIF(TRIM(f.faculty_name), ''), NULLIF(TRIM(a.facultyname), ''), 'Under Processing') AS faculty,
        COUNT(*) FILTER (WHERE c.status IS NULL OR TRIM(COALESCE(c.status,'')) = '')::int AS applied,
        COUNT(*) FILTER (WHERE UPPER(TRIM(COALESCE(c.status,''))) IN ('UNDERREVIEW','PENDING'))::int AS review,
        COUNT(*) FILTER (WHERE UPPER(TRIM(COALESCE(c.status,''))) = 'ONHOLD')::int AS on_hold,
        COUNT(*) FILTER (WHERE UPPER(TRIM(COALESCE(c.status,''))) IN ('UNDERPRINTING','PROCESS'))::int AS under_printing,
        COUNT(*) FILTER (WHERE UPPER(TRIM(COALESCE(c.status,''))) IN ('ACTIVE'))::int AS ready_for_delivery,
        COUNT(*) FILTER (WHERE UPPER(TRIM(COALESCE(c.status,''))) = 'DELIVERED')::int AS delivered,
        COUNT(*)::int AS card_total
      FROM public.tblcard c
      JOIN public.tbl_alumni a ON a.alumniid = c.alumniid
      LEFT JOIN public.tbl_faculties f ON f.id = a.faculty
      WHERE LOWER(COALESCE(a.verify, '')) = 'true'
      ${accessFilterCondition}
      ${facultyFilterCondition}
      ${cardPeriodCond}
      GROUP BY 1
      ORDER BY card_total DESC
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

    const eventsMeetupsSummaryRows = await sql/* sql */`
      SELECT
        COUNT(*) FILTER (
          WHERE LOWER(TRIM(COALESCE(category, ''))) NOT LIKE '%meetup%'
        )::int AS events_total,
        COUNT(*) FILTER (
          WHERE LOWER(TRIM(COALESCE(category, ''))) NOT LIKE '%meetup%'
            AND fromdate >= ${qStart}::date${qEndEvents}
        )::int AS events_quarter,
        COUNT(*) FILTER (
          WHERE LOWER(TRIM(COALESCE(category, ''))) NOT LIKE '%meetup%'
            AND fromdate >= ${yStart}::date${qEndEvents}
        )::int AS events_ytd,
        COUNT(*) FILTER (
          WHERE LOWER(TRIM(COALESCE(category, ''))) LIKE '%meetup%'
        )::int AS meetups_total,
        COUNT(*) FILTER (
          WHERE LOWER(TRIM(COALESCE(category, ''))) LIKE '%meetup%'
            AND fromdate >= ${qStart}::date${qEndEvents}
        )::int AS meetups_quarter,
        COUNT(*) FILTER (
          WHERE LOWER(TRIM(COALESCE(category, ''))) LIKE '%meetup%'
            AND fromdate >= ${yStart}::date${qEndEvents}
        )::int AS meetups_ytd
      FROM public.tbl_events
    `;

    const eventsByChapterRows = await sql/* sql */`
      WITH active_chapters AS (
        SELECT
          c.id,
          COALESCE(
            NULLIF(TRIM(c.national_chapter), ''),
            NULLIF(TRIM(c.international_chapter), '')
          ) AS chapter_name
        FROM public.tblchapters c
        WHERE c.is_active = true
          AND (
            TRIM(COALESCE(c.national_chapter, '')) <> ''
            OR TRIM(COALESCE(c.international_chapter, '')) <> ''
          )
      ),
      chapter_counts AS (
        SELECT
          e.chapter_id,
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE e.fromdate >= ${yStart}::date${qEndEvents})::int AS ytd,
          COUNT(*) FILTER (WHERE e.fromdate >= ${qStart}::date${qEndEvents})::int AS quarter
        FROM public.tbl_events e
        WHERE e.chapter_id IS NOT NULL
          AND LOWER(TRIM(COALESCE(e.category, ''))) NOT LIKE '%meetup%'
        GROUP BY e.chapter_id
      ),
      unassigned AS (
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE e.fromdate >= ${yStart}::date${qEndEvents})::int AS ytd,
          COUNT(*) FILTER (WHERE e.fromdate >= ${qStart}::date${qEndEvents})::int AS quarter
        FROM public.tbl_events e
        WHERE e.chapter_id IS NULL
          AND LOWER(TRIM(COALESCE(e.category, ''))) NOT LIKE '%meetup%'
      )
      SELECT
        ac.chapter_name AS chapter,
        COALESCE(cc.total, 0)::int AS total,
        COALESCE(cc.ytd, 0)::int AS ytd,
        COALESCE(cc.quarter, 0)::int AS quarter
      FROM active_chapters ac
      LEFT JOIN chapter_counts cc ON cc.chapter_id = ac.id
      UNION ALL
      SELECT
        'No chapter' AS chapter,
        COALESCE(u.total, 0)::int AS total,
        COALESCE(u.ytd, 0)::int AS ytd,
        COALESCE(u.quarter, 0)::int AS quarter
      FROM unassigned u
      WHERE COALESCE(u.total, 0) > 0
      ORDER BY total DESC, chapter ASC
    `;

    const meetupsByChapterRows = await sql/* sql */`
      WITH active_chapters AS (
        SELECT
          c.id,
          COALESCE(
            NULLIF(TRIM(c.national_chapter), ''),
            NULLIF(TRIM(c.international_chapter), '')
          ) AS chapter_name
        FROM public.tblchapters c
        WHERE c.is_active = true
          AND (
            TRIM(COALESCE(c.national_chapter, '')) <> ''
            OR TRIM(COALESCE(c.international_chapter, '')) <> ''
          )
      ),
      chapter_counts AS (
        SELECT
          e.chapter_id,
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE e.fromdate >= ${yStart}::date${qEndEvents})::int AS ytd,
          COUNT(*) FILTER (WHERE e.fromdate >= ${qStart}::date${qEndEvents})::int AS quarter
        FROM public.tbl_events e
        WHERE e.chapter_id IS NOT NULL
          AND LOWER(TRIM(COALESCE(e.category, ''))) LIKE '%meetup%'
        GROUP BY e.chapter_id
      ),
      unassigned AS (
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE e.fromdate >= ${yStart}::date${qEndEvents})::int AS ytd,
          COUNT(*) FILTER (WHERE e.fromdate >= ${qStart}::date${qEndEvents})::int AS quarter
        FROM public.tbl_events e
        WHERE e.chapter_id IS NULL
          AND LOWER(TRIM(COALESCE(e.category, ''))) LIKE '%meetup%'
      )
      SELECT
        ac.chapter_name AS chapter,
        COALESCE(cc.total, 0)::int AS total,
        COALESCE(cc.ytd, 0)::int AS ytd,
        COALESCE(cc.quarter, 0)::int AS quarter
      FROM active_chapters ac
      LEFT JOIN chapter_counts cc ON cc.chapter_id = ac.id
      UNION ALL
      SELECT
        'No chapter' AS chapter,
        COALESCE(u.total, 0)::int AS total,
        COALESCE(u.ytd, 0)::int AS ytd,
        COALESCE(u.quarter, 0)::int AS quarter
      FROM unassigned u
      WHERE COALESCE(u.total, 0) > 0
      ORDER BY total DESC, chapter ASC
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
        )::int AS unknown_bucket,
        COUNT(*) FILTER (
          WHERE LOWER(COALESCE(a.verify, '')) = 'true'
            AND LOWER(TRIM(COALESCE(a.occupation_transition_timing,''))) = 'before graduation'
        )::int AS verified_before_graduation,
        COUNT(*) FILTER (
          WHERE LOWER(COALESCE(a.verify, '')) = 'true'
            AND LOWER(TRIM(COALESCE(a.occupation_transition_timing,''))) LIKE '%immediately%'
        )::int AS verified_immediate,
        COUNT(*) FILTER (
          WHERE LOWER(COALESCE(a.verify, '')) = 'true'
            AND LOWER(TRIM(COALESCE(a.occupation_transition_timing,''))) LIKE '%within 3 month%'
        )::int AS verified_within_3,
        COUNT(*) FILTER (
          WHERE LOWER(COALESCE(a.verify, '')) = 'true'
            AND LOWER(TRIM(COALESCE(a.occupation_transition_timing,''))) LIKE '%within 6 month%'
        )::int AS verified_within_6,
        COUNT(*) FILTER (
          WHERE LOWER(COALESCE(a.verify, '')) = 'true'
            AND LOWER(TRIM(COALESCE(a.occupation_transition_timing,''))) LIKE '%after 6 month%'
        )::int AS verified_after_6,
        COUNT(*) FILTER (
          WHERE LOWER(COALESCE(a.verify, '')) = 'true'
            AND TRIM(COALESCE(a.occupation_transition_timing,'')) <> ''
            AND LOWER(TRIM(COALESCE(a.occupation_transition_timing,''))) NOT IN ('before graduation')
            AND LOWER(TRIM(COALESCE(a.occupation_transition_timing,''))) NOT LIKE '%immediately%'
            AND LOWER(TRIM(COALESCE(a.occupation_transition_timing,''))) NOT LIKE '%within 3 month%'
            AND LOWER(TRIM(COALESCE(a.occupation_transition_timing,''))) NOT LIKE '%within 6 month%'
            AND LOWER(TRIM(COALESCE(a.occupation_transition_timing,''))) NOT LIKE '%after 6 month%'
        )::int AS verified_unknown_bucket
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
        COUNT(*) FILTER (WHERE TRIM(COALESCE(a.employeed,'')) <> '')::int AS with_status,
        COUNT(*) FILTER (
          WHERE LOWER(COALESCE(a.verify, '')) = 'true'
            AND LOWER(TRIM(COALESCE(a.employeed,''))) IN ('employed','employed/business')
        )::int AS verified_employed,
        COUNT(*) FILTER (
          WHERE LOWER(COALESCE(a.verify, '')) = 'true'
            AND (
              LOWER(TRIM(COALESCE(a.employeed,''))) LIKE '%self-employed%'
              OR LOWER(TRIM(COALESCE(a.employeed,''))) LIKE '%entrepreneur%'
            )
        )::int AS verified_self_employed,
        COUNT(*) FILTER (
          WHERE LOWER(COALESCE(a.verify, '')) = 'true'
            AND LOWER(TRIM(COALESCE(a.employeed,''))) LIKE '%searching%'
        )::int AS verified_unemployed_searching,
        COUNT(*) FILTER (
          WHERE LOWER(COALESCE(a.verify, '')) = 'true'
            AND LOWER(TRIM(COALESCE(a.employeed,''))) LIKE '%choice%'
        )::int AS verified_unemployed_choice,
        COUNT(*) FILTER (
          WHERE LOWER(COALESCE(a.verify, '')) = 'true' AND TRIM(COALESCE(a.employeed,'')) <> ''
        )::int AS verified_with_status
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
        COUNT(*)::int AS total_rows,
        COUNT(*) FILTER (
          WHERE LOWER(COALESCE(a.verify, '')) = 'true'
            AND LOWER(TRIM(COALESCE(a.province,''))) LIKE '%punjab%'
            AND LOWER(TRIM(COALESCE(a.province,''))) NOT LIKE '%islamabad%'
        )::int AS verified_punjab,
        COUNT(*) FILTER (
          WHERE LOWER(COALESCE(a.verify, '')) = 'true'
            AND (
              LOWER(TRIM(COALESCE(a.province,''))) LIKE '%islamabad%'
              OR LOWER(TRIM(COALESCE(a.province,''))) LIKE '%ict%'
              OR LOWER(TRIM(COALESCE(a.province,''))) LIKE '%federal capital%'
            )
        )::int AS verified_islamabad,
        COUNT(*) FILTER (
          WHERE LOWER(COALESCE(a.verify, '')) = 'true'
            AND (
              LOWER(TRIM(COALESCE(a.province,''))) LIKE '%khyber%'
              OR LOWER(TRIM(COALESCE(a.province,''))) LIKE '%kpk%'
              OR LOWER(TRIM(COALESCE(a.province,''))) = 'kp'
            )
        )::int AS verified_kpk,
        COUNT(*) FILTER (
          WHERE LOWER(COALESCE(a.verify, '')) = 'true'
            AND LOWER(TRIM(COALESCE(a.province,''))) LIKE '%sindh%'
        )::int AS verified_sindh,
        COUNT(*) FILTER (
          WHERE LOWER(COALESCE(a.verify, '')) = 'true'
            AND (
              LOWER(TRIM(COALESCE(a.province,''))) LIKE '%ajk%'
              OR LOWER(TRIM(COALESCE(a.province,''))) LIKE '%azad%'
            )
        )::int AS verified_ajk,
        COUNT(*) FILTER (
          WHERE LOWER(COALESCE(a.verify, '')) = 'true'
            AND (
              LOWER(TRIM(COALESCE(a.province,''))) LIKE '%gilgit%'
              OR LOWER(TRIM(COALESCE(a.province,''))) LIKE '%baltistan%'
              OR LOWER(TRIM(COALESCE(a.province,''))) LIKE '%gb%'
            )
        )::int AS verified_gb,
        COUNT(*) FILTER (
          WHERE LOWER(COALESCE(a.verify, '')) = 'true'
            AND LOWER(TRIM(COALESCE(a.province,''))) LIKE '%baloch%'
        )::int AS verified_balochistan,
        COUNT(*) FILTER (
          WHERE LOWER(COALESCE(a.verify, '')) = 'true'
            AND TRIM(COALESCE(a.country,'')) <> ''
            AND LOWER(TRIM(COALESCE(a.country,''))) NOT LIKE '%pakistan%'
            AND LOWER(TRIM(COALESCE(a.country,''))) NOT IN ('pk')
        )::int AS verified_overseas,
        COUNT(*) FILTER (WHERE LOWER(COALESCE(a.verify, '')) = 'true')::int AS verified_total_rows
      FROM public.tbl_alumni a
      WHERE 1=1
      ${accessFilterCondition}
      ${facultyFilterCondition}
      ${alumniPeriodCond}
    `;

    // Exact distinct province values (no "Other" grouping) for the location card.
    const provinceDistinctRows = await sql/* sql */`
      SELECT
        TRIM(COALESCE(a.province, '')) AS region,
        COUNT(*)::int AS count
      FROM public.tbl_alumni a
      WHERE 1=1
        ${accessFilterCondition}
        ${facultyFilterCondition}
        ${alumniPeriodCond}
        AND TRIM(COALESCE(a.province, '')) <> ''
      GROUP BY TRIM(COALESCE(a.province, ''))
      ORDER BY count DESC
    `;

    const verifiedProvinceDistinctRows = await sql/* sql */`
      SELECT
        TRIM(COALESCE(a.province, '')) AS region,
        COUNT(*)::int AS count
      FROM public.tbl_alumni a
      WHERE 1=1
        ${accessFilterCondition}
        ${facultyFilterCondition}
        ${alumniPeriodCond}
        AND TRIM(COALESCE(a.province, '')) <> ''
        AND LOWER(COALESCE(a.verify, '')) = 'true'
      GROUP BY TRIM(COALESCE(a.province, ''))
      ORDER BY count DESC
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
      superadminsTotal: number | null;
      adminsTotal: number | null;
      viewersTotal: number | null;
      byFaculty: Array<{
        faculty: string;
        facultyId: number | null;
        count: number;
        admins: number;
        viewers: number;
        firstTrainedAt: string | null;
        lastTrainedAt: string | null;
      }>;
    } = { total: null, superadminsTotal: null, adminsTotal: null, viewersTotal: null, byFaculty: [] };
    const trainedFacultyAdminsDebug: {
      tableCheck?: unknown;
      mergedError?: string;
      uaaOnlyError?: string;
      legacyError?: string;
    } = {};

    const applyTrainedAdminRows = (
      totalRows: Array<{ c?: number; admins_total?: number; viewers_total?: number }>,
      byFacultyRows: unknown
    ) => {
      const totalRow = totalRows[0] as { c?: number; admins_total?: number; viewers_total?: number } | undefined;
      const adminsTotal = Number(totalRow?.admins_total ?? 0);
      const viewersTotal = Number(totalRow?.viewers_total ?? 0);
      const byFaculty = (
        byFacultyRows as unknown as Array<{
          faculty: string;
          faculty_id: number | null;
          cnt: number;
          admins?: number;
          viewers?: number;
          first_trained_at?: string | Date | null;
          last_trained_at?: string | Date | null;
        }>
      ).map((r) => ({
        faculty: r.faculty || "Unknown",
        facultyId: r.faculty_id ?? null,
        count: Number(r.cnt ?? 0),
        admins: Number(r.admins ?? 0),
        viewers: Number(r.viewers ?? 0),
        firstTrainedAt: r.first_trained_at ? new Date(r.first_trained_at).toISOString() : null,
        lastTrainedAt: r.last_trained_at ? new Date(r.last_trained_at).toISOString() : null,
      }));
      trainedFacultyAdmins = {
        total: null,
        superadminsTotal: trainedFacultyAdmins.superadminsTotal,
        adminsTotal: Number.isFinite(adminsTotal) ? adminsTotal : null,
        viewersTotal: Number.isFinite(viewersTotal) ? viewersTotal : null,
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
                LOWER(TRIM(COALESCE(u.type, ''))) IN ('admin', 'viewer', 'user')
                OR LOWER(TRIM(COALESCE(u.legacy_type, ''))) IN ('admin', 'viewer', 'user')
              )
              AND COALESCE(res.legacy_faculty_id, parent_fac.legacy_faculty_id, grandparent_fac.legacy_faculty_id, fby_res.id) IS NOT NULL
              ${uraFacultyCond}
          ),
          scoped_users AS (
            SELECT DISTINCT user_id FROM ura_pairs
          ),
          user_roles AS (
            SELECT
              u.id AS user_id,
              LOWER(TRIM(COALESCE(NULLIF(TRIM(u.type), ''), NULLIF(TRIM(u.legacy_type), ''), ''))) AS user_type
            FROM public.users u
            INNER JOIN scoped_users s ON s.user_id = u.id
            WHERE COALESCE(u.blocked, false) = false
          )
          SELECT
            COUNT(DISTINCT user_id)::int AS c,
            COUNT(DISTINCT user_id) FILTER (WHERE user_type = 'admin')::int AS admins_total,
            COUNT(DISTINCT user_id) FILTER (WHERE user_type IN ('viewer', 'user'))::int AS viewers_total
          FROM user_roles
        `;
        const byFacultyUraOnly = await sql/* sql */`
          WITH ura_scoped AS (
            SELECT
              u.id AS user_id,
              COALESCE(
                res.legacy_faculty_id,
                parent_fac.legacy_faculty_id,
                grandparent_fac.legacy_faculty_id,
                fby_res.id
              ) AS faculty_id,
              CASE
                WHEN LOWER(TRIM(COALESCE(ura.access_level, ''))) IN ('write', 'admin') THEN 'admin'
                WHEN LOWER(TRIM(COALESCE(ura.access_level, ''))) = 'read' THEN 'viewer'
                WHEN LOWER(TRIM(COALESCE(NULLIF(TRIM(u.type), ''), NULLIF(TRIM(u.legacy_type), ''), ''))) = 'admin' THEN 'admin'
                WHEN LOWER(TRIM(COALESCE(NULLIF(TRIM(u.type), ''), NULLIF(TRIM(u.legacy_type), ''), ''))) IN ('viewer', 'user') THEN 'viewer'
                ELSE 'viewer'
              END AS user_type,
              ura.created_at AS assignment_at,
              u.created_at AS user_created_at
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
                LOWER(TRIM(COALESCE(u.type, ''))) IN ('admin', 'viewer', 'user')
                OR LOWER(TRIM(COALESCE(u.legacy_type, ''))) IN ('admin', 'viewer', 'user')
              )
              AND COALESCE(res.legacy_faculty_id, parent_fac.legacy_faculty_id, grandparent_fac.legacy_faculty_id, fby_res.id) IS NOT NULL
              ${uraFacultyCond}
          ),
          per_user_faculty AS (
            SELECT
              user_id,
              faculty_id,
              CASE
                WHEN BOOL_OR(user_type = 'admin') THEN 'admin'
                ELSE MAX(user_type)
              END AS user_type,
              MIN(user_created_at) AS user_created_at,
              MIN(assignment_at) AS first_assignment_at,
              MAX(assignment_at) AS last_assignment_at
            FROM ura_scoped
            GROUP BY user_id, faculty_id
          ),
          per_user_faculty_dated AS (
            SELECT
              user_id,
              faculty_id,
              user_type,
              COALESCE(first_assignment_at, user_created_at) AS first_trained_at,
              COALESCE(last_assignment_at, user_created_at) AS last_trained_at
            FROM per_user_faculty
          ),
          per_faculty AS (
            SELECT
              faculty_id,
              COUNT(DISTINCT user_id)::int AS cnt,
              COUNT(DISTINCT user_id) FILTER (WHERE user_type = 'admin')::int AS admins,
              COUNT(DISTINCT user_id) FILTER (WHERE user_type IN ('viewer', 'user'))::int AS viewers,
              MIN(first_trained_at) AS first_trained_at,
              MAX(last_trained_at) AS last_trained_at
            FROM per_user_faculty_dated
            GROUP BY faculty_id
          )
          SELECT
            COALESCE(NULLIF(TRIM(tf.faculty_name), ''), 'Faculty #' || pf.faculty_id::text) AS faculty,
            pf.faculty_id AS faculty_id,
            pf.cnt,
            pf.admins,
            pf.viewers,
            pf.first_trained_at,
            pf.last_trained_at
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
              LOWER(TRIM(COALESCE(u.type, ''))) IN ('admin', 'viewer', 'user')
              OR LOWER(TRIM(COALESCE(u.legacy_type, ''))) IN ('admin', 'viewer', 'user')
            )
            AND COALESCE(res.legacy_faculty_id, parent_fac.legacy_faculty_id, grandparent_fac.legacy_faculty_id, fby_res.id) IS NOT NULL
            ${uraFacultyCond}
        ),
        uaa_pairs AS (
          SELECT DISTINCT
            u.id AS user_id,
            COALESCE(uaa.faculty_id, fby.id) AS faculty_id
          FROM public.user_access_assignments uaa
          INNER JOIN public.users u ON u.id = uaa.userid
          LEFT JOIN public.tbl_faculties fby ON uaa.faculty_id IS NULL
            AND LENGTH(TRIM(COALESCE(uaa.faculty_name, ''))) > 0
            AND LOWER(TRIM(fby.faculty_name)) = LOWER(TRIM(uaa.faculty_name))
          WHERE COALESCE(uaa.faculty_id, fby.id) IS NOT NULL
            AND COALESCE(u.blocked, false) = false
            AND (
              LOWER(TRIM(COALESCE(u.type, ''))) IN ('admin', 'viewer', 'user')
              OR LOWER(TRIM(COALESCE(u.legacy_type, ''))) IN ('admin', 'viewer', 'user')
            )
            ${uaaFacultyResolvedCond}
        ),
        pairs AS (
          SELECT user_id, faculty_id FROM ura_pairs
          UNION
          SELECT user_id, faculty_id FROM uaa_pairs
        ),
        scoped_users AS (
          SELECT DISTINCT user_id FROM pairs
        ),
        user_roles AS (
          SELECT
            u.id AS user_id,
            LOWER(TRIM(COALESCE(NULLIF(TRIM(u.type), ''), NULLIF(TRIM(u.legacy_type), ''), ''))) AS user_type
          FROM public.users u
          INNER JOIN scoped_users s ON s.user_id = u.id
          WHERE COALESCE(u.blocked, false) = false
        )
        SELECT
          COUNT(DISTINCT user_id)::int AS c,
          COUNT(DISTINCT user_id) FILTER (WHERE user_type = 'admin')::int AS admins_total,
          COUNT(DISTINCT user_id) FILTER (WHERE user_type IN ('viewer', 'user'))::int AS viewers_total
        FROM user_roles
      `;
      const byFacultyMerged = await sql/* sql */`
        WITH ura_scoped AS (
          SELECT
            u.id AS user_id,
            COALESCE(
              res.legacy_faculty_id,
              parent_fac.legacy_faculty_id,
              grandparent_fac.legacy_faculty_id,
              fby_res.id
            ) AS faculty_id,
            CASE
              WHEN LOWER(TRIM(COALESCE(ura.access_level, ''))) IN ('write', 'admin') THEN 'admin'
              WHEN LOWER(TRIM(COALESCE(ura.access_level, ''))) = 'read' THEN 'viewer'
              WHEN LOWER(TRIM(COALESCE(NULLIF(TRIM(u.type), ''), NULLIF(TRIM(u.legacy_type), ''), ''))) = 'admin' THEN 'admin'
              WHEN LOWER(TRIM(COALESCE(NULLIF(TRIM(u.type), ''), NULLIF(TRIM(u.legacy_type), ''), ''))) IN ('viewer', 'user') THEN 'viewer'
              ELSE 'viewer'
            END AS user_type,
            ura.created_at AS assignment_at,
            u.created_at AS user_created_at
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
              LOWER(TRIM(COALESCE(u.type, ''))) IN ('admin', 'viewer', 'user')
              OR LOWER(TRIM(COALESCE(u.legacy_type, ''))) IN ('admin', 'viewer', 'user')
            )
            AND COALESCE(res.legacy_faculty_id, parent_fac.legacy_faculty_id, grandparent_fac.legacy_faculty_id, fby_res.id) IS NOT NULL
            ${uraFacultyCond}
        ),
        uaa_scoped AS (
          SELECT
            u.id AS user_id,
            COALESCE(uaa.faculty_id, fby.id) AS faculty_id,
            CASE
              WHEN LOWER(TRIM(COALESCE(NULLIF(TRIM(u.type), ''), NULLIF(TRIM(u.legacy_type), ''), ''))) = 'admin' THEN 'admin'
              ELSE 'viewer'
            END AS user_type,
            uaa.created_at AS assignment_at,
            u.created_at AS user_created_at
          FROM public.user_access_assignments uaa
          INNER JOIN public.users u ON u.id = uaa.userid
          LEFT JOIN public.tbl_faculties fby ON uaa.faculty_id IS NULL
            AND LENGTH(TRIM(COALESCE(uaa.faculty_name, ''))) > 0
            AND LOWER(TRIM(fby.faculty_name)) = LOWER(TRIM(uaa.faculty_name))
          WHERE COALESCE(uaa.faculty_id, fby.id) IS NOT NULL
            AND COALESCE(u.blocked, false) = false
            AND (
              LOWER(TRIM(COALESCE(u.type, ''))) IN ('admin', 'viewer', 'user')
              OR LOWER(TRIM(COALESCE(u.legacy_type, ''))) IN ('admin', 'viewer', 'user')
            )
            ${uaaFacultyResolvedCond}
        ),
        per_user_faculty AS (
          SELECT
            user_id,
            faculty_id,
            CASE
              WHEN BOOL_OR(user_type = 'admin') THEN 'admin'
              ELSE MAX(user_type)
            END AS user_type,
            MIN(user_created_at) AS user_created_at,
            MIN(assignment_at) AS first_assignment_at,
            MAX(assignment_at) AS last_assignment_at
          FROM (
            SELECT user_id, faculty_id, user_type, assignment_at, user_created_at FROM ura_scoped
            UNION ALL
            SELECT user_id, faculty_id, user_type, assignment_at, user_created_at FROM uaa_scoped
          ) combined
          GROUP BY user_id, faculty_id
        ),
        per_user_faculty_dated AS (
          SELECT
            user_id,
            faculty_id,
            user_type,
            COALESCE(first_assignment_at, user_created_at) AS first_trained_at,
            COALESCE(last_assignment_at, user_created_at) AS last_trained_at
          FROM per_user_faculty
        ),
        per_faculty AS (
          SELECT
            faculty_id,
            COUNT(DISTINCT user_id)::int AS cnt,
            COUNT(DISTINCT user_id) FILTER (WHERE user_type = 'admin')::int AS admins,
            COUNT(DISTINCT user_id) FILTER (WHERE user_type IN ('viewer', 'user'))::int AS viewers,
            MIN(first_trained_at) AS first_trained_at,
            MAX(last_trained_at) AS last_trained_at
          FROM per_user_faculty_dated
          GROUP BY faculty_id
        )
        SELECT
          COALESCE(NULLIF(TRIM(tf.faculty_name), ''), 'Faculty #' || pf.faculty_id::text) AS faculty,
          pf.faculty_id AS faculty_id,
          pf.cnt,
          pf.admins,
          pf.viewers,
          pf.first_trained_at,
          pf.last_trained_at
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
          WITH scoped_users AS (
            SELECT DISTINCT u.id AS user_id
            FROM public.user_access_assignments uaa
            INNER JOIN public.users u ON u.id = uaa.userid
            WHERE COALESCE(uaa.faculty_id, (
              SELECT f2.id FROM public.tbl_faculties f2
              WHERE LENGTH(TRIM(COALESCE(uaa.faculty_name, ''))) > 0
                AND LOWER(TRIM(f2.faculty_name)) = LOWER(TRIM(uaa.faculty_name))
              LIMIT 1
            )) IS NOT NULL
              AND COALESCE(u.blocked, false) = false
              AND (
                LOWER(TRIM(COALESCE(u.type, ''))) IN ('admin', 'viewer', 'user')
                OR LOWER(TRIM(COALESCE(u.legacy_type, ''))) IN ('admin', 'viewer', 'user')
              )
              ${uaaFacultyResolvedCond}
          ),
          user_roles AS (
            SELECT
              u.id AS user_id,
              LOWER(TRIM(COALESCE(NULLIF(TRIM(u.type), ''), NULLIF(TRIM(u.legacy_type), ''), ''))) AS user_type
            FROM public.users u
            INNER JOIN scoped_users s ON s.user_id = u.id
            WHERE COALESCE(u.blocked, false) = false
          )
          SELECT
            COUNT(DISTINCT user_id)::int AS c,
            COUNT(DISTINCT user_id) FILTER (WHERE user_type = 'admin')::int AS admins_total,
            COUNT(DISTINCT user_id) FILTER (WHERE user_type IN ('viewer', 'user'))::int AS viewers_total
          FROM user_roles
        `;
        const byFacultyUaaOnly = await sql/* sql */`
          WITH uaa_scoped AS (
            SELECT
              u.id AS user_id,
              COALESCE(uaa.faculty_id, fby.id) AS faculty_id,
              CASE
                WHEN LOWER(TRIM(COALESCE(NULLIF(TRIM(u.type), ''), NULLIF(TRIM(u.legacy_type), ''), ''))) = 'admin' THEN 'admin'
                ELSE 'viewer'
              END AS user_type,
              uaa.created_at AS assignment_at,
              u.created_at AS user_created_at
            FROM public.user_access_assignments uaa
            INNER JOIN public.users u ON u.id = uaa.userid
            LEFT JOIN public.tbl_faculties fby ON uaa.faculty_id IS NULL
              AND LENGTH(TRIM(COALESCE(uaa.faculty_name, ''))) > 0
              AND LOWER(TRIM(fby.faculty_name)) = LOWER(TRIM(uaa.faculty_name))
            WHERE COALESCE(uaa.faculty_id, fby.id) IS NOT NULL
              AND COALESCE(u.blocked, false) = false
              AND (
                LOWER(TRIM(COALESCE(u.type, ''))) IN ('admin', 'viewer', 'user')
                OR LOWER(TRIM(COALESCE(u.legacy_type, ''))) IN ('admin', 'viewer', 'user')
              )
              ${uaaFacultyResolvedCond}
          ),
          per_user_faculty AS (
            SELECT
              user_id,
              faculty_id,
              CASE
                WHEN BOOL_OR(user_type = 'admin') THEN 'admin'
                ELSE MAX(user_type)
              END AS user_type,
              MIN(user_created_at) AS user_created_at,
              MIN(assignment_at) AS first_assignment_at,
              MAX(assignment_at) AS last_assignment_at
            FROM uaa_scoped
            GROUP BY user_id, faculty_id
          ),
          per_user_faculty_dated AS (
            SELECT
              user_id,
              faculty_id,
              user_type,
              COALESCE(first_assignment_at, user_created_at) AS first_trained_at,
              COALESCE(last_assignment_at, user_created_at) AS last_trained_at
            FROM per_user_faculty
          ),
          per_faculty AS (
            SELECT
              faculty_id,
              COUNT(DISTINCT user_id)::int AS cnt,
              COUNT(DISTINCT user_id) FILTER (WHERE user_type = 'admin')::int AS admins,
              COUNT(DISTINCT user_id) FILTER (WHERE user_type IN ('viewer', 'user'))::int AS viewers,
              MIN(first_trained_at) AS first_trained_at,
              MAX(last_trained_at) AS last_trained_at
            FROM per_user_faculty_dated
            GROUP BY faculty_id
          )
          SELECT
            COALESCE(NULLIF(TRIM(tf.faculty_name), ''), 'Faculty #' || pf.faculty_id::text) AS faculty,
            pf.faculty_id AS faculty_id,
            pf.cnt,
            pf.admins,
            pf.viewers,
            pf.first_trained_at,
            pf.last_trained_at
          FROM per_faculty pf
          LEFT JOIN public.tbl_faculties tf ON tf.id = pf.faculty_id
          ORDER BY pf.cnt DESC, faculty ASC
        `;
        applyTrainedAdminRows(totalRowsUaaOnly as Array<{ c?: number }>, byFacultyUaaOnly);
      } catch (e2) {
        trainedFacultyAdminsDebug.uaaOnlyError = e2 instanceof Error ? e2.message : String(e2);
        trainedFacultyAdmins = {
          total: null,
          superadminsTotal: null,
          adminsTotal: null,
          viewersTotal: null,
          byFaculty: [],
        };
      }
    }

    const hasNoTrainedData =
      (trainedFacultyAdmins.adminsTotal ?? 0) + (trainedFacultyAdmins.viewersTotal ?? 0) === 0 &&
      (trainedFacultyAdmins.byFaculty?.length ?? 0) === 0;

    if (hasNoTrainedData) {
      try {
        const totalRowsLegacy = await sql/* sql */`
          WITH scoped_users AS (
            SELECT DISTINCT tu.userid AS user_id
            FROM public.user_access_assignments uaa
            INNER JOIN public.tbl_users tu ON tu.userid = uaa.userid
            WHERE (uaa.faculty_id IS NOT NULL OR LENGTH(TRIM(COALESCE(uaa.faculty_name, ''))) > 0)
              AND COALESCE(tu.blocked, false) = false
              AND LOWER(TRIM(COALESCE(tu.type, ''))) IN ('admin', 'viewer', 'user')
              ${selectedFacultyId && Number.isFinite(selectedFacultyId) ? sql` AND uaa.faculty_id = ${selectedFacultyId}` : sql``}
          ),
          user_roles AS (
            SELECT
              tu.userid AS user_id,
              LOWER(TRIM(COALESCE(tu.type, ''))) AS user_type
            FROM public.tbl_users tu
            INNER JOIN scoped_users s ON s.user_id = tu.userid
            WHERE COALESCE(tu.blocked, false) = false
          )
          SELECT
            COUNT(DISTINCT user_id)::int AS c,
            COUNT(DISTINCT user_id) FILTER (WHERE user_type = 'admin')::int AS admins_total,
            COUNT(DISTINCT user_id) FILTER (WHERE user_type IN ('viewer', 'user'))::int AS viewers_total
          FROM user_roles
        `;
        const byFacultyRowsLegacy = await sql/* sql */`
          WITH legacy_scoped AS (
            SELECT
              tu.userid AS user_id,
              COALESCE(uaa.faculty_id, fby.id) AS faculty_id,
              CASE
                WHEN LOWER(TRIM(COALESCE(tu.type, ''))) = 'admin' THEN 'admin'
                ELSE 'viewer'
              END AS user_type,
              uaa.created_at AS assignment_at
            FROM public.user_access_assignments uaa
            INNER JOIN public.tbl_users tu ON tu.userid = uaa.userid
            LEFT JOIN public.tbl_faculties fby ON uaa.faculty_id IS NULL
              AND LENGTH(TRIM(COALESCE(uaa.faculty_name, ''))) > 0
              AND LOWER(TRIM(fby.faculty_name)) = LOWER(TRIM(uaa.faculty_name))
            WHERE (uaa.faculty_id IS NOT NULL OR LENGTH(TRIM(COALESCE(uaa.faculty_name, ''))) > 0)
              AND COALESCE(tu.blocked, false) = false
              AND LOWER(TRIM(COALESCE(tu.type, ''))) IN ('admin', 'viewer', 'user')
              ${selectedFacultyId && Number.isFinite(selectedFacultyId) ? sql` AND uaa.faculty_id = ${selectedFacultyId}` : sql``}
          ),
          per_user_faculty AS (
            SELECT
              user_id,
              faculty_id,
              CASE
                WHEN BOOL_OR(user_type = 'admin') THEN 'admin'
                ELSE MAX(user_type)
              END AS user_type,
              MIN(assignment_at) AS first_assignment_at,
              MAX(assignment_at) AS last_assignment_at
            FROM legacy_scoped
            GROUP BY user_id, faculty_id
          ),
          per_user_faculty_dated AS (
            SELECT
              user_id,
              faculty_id,
              user_type,
              first_assignment_at AS first_trained_at,
              last_assignment_at AS last_trained_at
            FROM per_user_faculty
          ),
          per_faculty AS (
            SELECT
              faculty_id,
              COUNT(DISTINCT user_id)::int AS cnt,
              COUNT(DISTINCT user_id) FILTER (WHERE user_type = 'admin')::int AS admins,
              COUNT(DISTINCT user_id) FILTER (WHERE user_type IN ('viewer', 'user'))::int AS viewers,
              MIN(first_trained_at) AS first_trained_at,
              MAX(last_trained_at) AS last_trained_at
            FROM per_user_faculty_dated
            GROUP BY faculty_id
          )
          SELECT
            COALESCE(
              NULLIF(TRIM(tf.faculty_name), ''),
              'Faculty #' || pf.faculty_id::text
            ) AS faculty,
            pf.faculty_id AS faculty_id,
            pf.cnt,
            pf.admins,
            pf.viewers,
            pf.first_trained_at,
            pf.last_trained_at
          FROM per_faculty pf
          LEFT JOIN public.tbl_faculties tf ON tf.id = pf.faculty_id
          ORDER BY pf.cnt DESC, faculty ASC
        `;
        applyTrainedAdminRows(totalRowsLegacy as Array<{ c?: number }>, byFacultyRowsLegacy);
      } catch (e3) {
        trainedFacultyAdminsDebug.legacyError = e3 instanceof Error ? e3.message : String(e3);
        /* tbl_users may not exist */
      }
    }

    let superadminsTotal = 0;
    try {
      const userTables = await sql/* sql */`
        SELECT
          to_regclass('public.users') AS users_tbl,
          to_regclass('public.tbl_users') AS legacy_users_tbl
      `;
      const ut = (userTables as unknown as Array<{ users_tbl?: string | null; legacy_users_tbl?: string | null }>)?.[0];
      if (ut?.users_tbl) {
        const superRow = await sql/* sql */`
          SELECT COUNT(*)::int AS c
          FROM public.users u
          WHERE COALESCE(u.blocked, false) = false
            AND (
              LOWER(TRIM(COALESCE(u.type, ''))) = 'superadmin'
              OR LOWER(TRIM(COALESCE(u.legacy_type, ''))) = 'superadmin'
            )
        `;
        superadminsTotal = Number((superRow[0] as { c?: number } | undefined)?.c ?? 0);
      } else if (ut?.legacy_users_tbl) {
        const superRow = await sql/* sql */`
          SELECT COUNT(*)::int AS c
          FROM public.tbl_users tu
          WHERE COALESCE(tu.blocked, false) = false
            AND LOWER(TRIM(COALESCE(tu.type, ''))) = 'superadmin'
        `;
        superadminsTotal = Number((superRow[0] as { c?: number } | undefined)?.c ?? 0);
      }
    } catch {
      superadminsTotal = 0;
    }
    const adminsTotal = trainedFacultyAdmins.adminsTotal ?? 0;
    const viewersTotal = trainedFacultyAdmins.viewersTotal ?? 0;
    trainedFacultyAdmins = {
      ...trainedFacultyAdmins,
      superadminsTotal,
      total: superadminsTotal + adminsTotal + viewersTotal,
    };

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

    const facultyPublicationRows = await sql/* sql */`
      SELECT
        COALESCE(NULLIF(TRIM(f.faculty_name), ''), NULLIF(TRIM(a.facultyname), ''), 'Under Processing') AS faculty,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE s.createdat >= ${qStart}::timestamp${qEndStory})::int AS quarter,
        COUNT(*) FILTER (WHERE s.createdat >= ${yStart}::timestamp${qEndStory})::int AS ytd
      FROM public.tblalumnistories s
      INNER JOIN public.tbl_alumni a ON a.alumniid = s.alumniid
      LEFT JOIN public.tbl_faculties f ON f.id = a.faculty
      WHERE s.alumnistories IS NOT NULL
        AND TRIM(s.alumnistories) <> ''
        AND (s.status IS NULL OR LOWER(TRIM(s.status)) NOT IN ('rejected', 'declined', 'draft'))
        ${accessFilterCondition}
        ${facultyFilterCondition}
      GROUP BY 1
      ORDER BY total DESC, faculty ASC
    `;

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

    const facultyDiscountRows = await sql/* sql */`
      SELECT
        COALESCE(NULLIF(TRIM(f.faculty_name), ''), NULLIF(TRIM(a.facultyname), ''), 'Under Processing') AS faculty,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (
          WHERE LOWER(COALESCE(s.discount_type,'')) LIKE '%dining%'
            OR LOWER(COALESCE(s.discount_type,'')) LIKE '%café%'
            OR LOWER(COALESCE(s.discount_type,'')) LIKE '%cafe%'
        )::int AS dining,
        COUNT(*) FILTER (
          WHERE LOWER(COALESCE(s.discount_type,'')) LIKE '%retail%'
            OR LOWER(COALESCE(s.discount_type,'')) LIKE '%shop%'
        )::int AS retail,
        COUNT(*) FILTER (
          WHERE LOWER(COALESCE(s.discount_type,'')) LIKE '%travel%'
            OR LOWER(COALESCE(s.discount_type,'')) LIKE '%leisure%'
        )::int AS travel,
        COUNT(*) FILTER (
          WHERE LOWER(COALESCE(s.discount_type,'')) LIKE '%health%'
            OR LOWER(COALESCE(s.discount_type,'')) LIKE '%wellness%'
        )::int AS health,
        COUNT(*) FILTER (
          WHERE LOWER(COALESCE(s.discount_type,'')) LIKE '%professional%'
            OR LOWER(COALESCE(s.discount_type,'')) LIKE '%education%'
        )::int AS professional,
        COUNT(*) FILTER (WHERE LOWER(COALESCE(s.discount_type,'')) LIKE '%financ%')::int AS financial
      FROM public.alumni_scholarships s
      JOIN public.tbl_alumni a ON a.alumniid = s.id
      LEFT JOIN public.tbl_faculties f ON f.id = a.faculty
      WHERE 1=1
      ${accessFilterCondition}
      ${facultyFilterCondition}
      ${scholarshipPeriodCond}
      GROUP BY 1
      ORDER BY total DESC, faculty ASC
    `;

    const discountCatRows = await sql/* sql */`
      SELECT
        COUNT(*)::int AS total_count,
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
    const nm = (nationalMembersRows[0] ?? {}) as { national_members?: number };
    const im = (internationalMembersRows[0] ?? {}) as { international_members?: number };
    const cd = (cardsRows[0] ?? {}) as Record<string, number | undefined>;
    const vcd = (verifiedCardsRows[0] ?? {}) as Record<string, number | undefined>;
    const tk = (talksRows[0] ?? {}) as Record<string, number | undefined>;
    const ce = (chapterEventsRows[0] ?? {}) as { quarter_count?: number; ytd_count?: number; total_count?: number };
    const em = (eventsMeetupsSummaryRows[0] ?? {}) as {
      events_total?: number;
      events_quarter?: number;
      events_ytd?: number;
      meetups_total?: number;
      meetups_quarter?: number;
      meetups_ytd?: number;
    };
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

    const verifiedTotalWithOcc = Number(oc.verified_with_status ?? 0);
    const verifiedOccOther = Math.max(
      0,
      verifiedTotalWithOcc -
        Number(oc.verified_employed ?? 0) -
        Number(oc.verified_self_employed ?? 0) -
        Number(oc.verified_unemployed_searching ?? 0) -
        Number(oc.verified_unemployed_choice ?? 0)
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

    const verifiedProvinceSumKnown =
      Number(pr.verified_punjab ?? 0) +
      Number(pr.verified_islamabad ?? 0) +
      Number(pr.verified_kpk ?? 0) +
      Number(pr.verified_sindh ?? 0) +
      Number(pr.verified_ajk ?? 0) +
      Number(pr.verified_gb ?? 0) +
      Number(pr.verified_balochistan ?? 0) +
      Number(pr.verified_overseas ?? 0);
    const verifiedProvinceOther = Math.max(0, Number(pr.verified_total_rows ?? 0) - verifiedProvinceSumKnown);

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
        quarterMonthLabel: formatQuarterMonthLabel(quarterStart),
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
        verifiedCategory: {
          aPlus: ah.verified_category_a_plus ?? null,
          a: ah.verified_category_a ?? null,
          b: ah.verified_category_b ?? null,
          c: ah.verified_category_c ?? null,
          d: ah.verified_category_d ?? null,
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
        scholarshipsApproved: sc.approved ?? null,
        scholarshipsApplied: sc.total_applied ?? null,
        activeBenefitsDiscounts: mb.active_benefits ?? null,
      },
      sectionA: {
        facultyRows: facultyRows.map((r) => r as {
          faculty: string;
          registrations: number;
          verified: number;
          active: number;
        }),
        facultyCategoryRows: facultyCategoryRows.map((r) => {
          const row = r as {
            faculty: string;
            a_plus: number;
            a: number;
            b: number;
            c: number;
            d: number;
          };
          return {
            faculty: row.faculty,
            aPlus: row.a_plus ?? 0,
            a: row.a ?? 0,
            b: row.b ?? 0,
            c: row.c ?? 0,
            d: row.d ?? 0,
          };
        }),
        facultyOccupationRows: facultyOccupationRows.map((r) => {
          const row = r as {
            faculty: string;
            employed: number;
            self_employed: number;
            unemployed_searching: number;
            unemployed_choice: number;
            with_status: number;
          };
          const withStatus = row.with_status ?? 0;
          const other = Math.max(
            0,
            withStatus -
              (row.employed ?? 0) -
              (row.self_employed ?? 0) -
              (row.unemployed_searching ?? 0) -
              (row.unemployed_choice ?? 0)
          );
          return {
            faculty: row.faculty,
            employed: row.employed ?? 0,
            selfEmployed: row.self_employed ?? 0,
            unemployedSearching: row.unemployed_searching ?? 0,
            unemployedByChoice: row.unemployed_choice ?? 0,
            other,
          };
        }),
        facultyTransitionRows: facultyTransitionRows.map((r) => {
          const row = r as {
            faculty: string;
            before_graduation: number;
            immediate: number;
            within_3: number;
            within_6: number;
            after_6: number;
            unknown_bucket: number;
          };
          return {
            faculty: row.faculty,
            beforeGraduation: row.before_graduation ?? 0,
            immediateAfterGraduation: row.immediate ?? 0,
            within3Months: row.within_3 ?? 0,
            within6Months: row.within_6 ?? 0,
            after6Months: row.after_6 ?? 0,
            unknown: row.unknown_bucket ?? 0,
          };
        }),
        facultyLocationRows: facultyLocationRows.map((r) => {
          const row = r as {
            faculty: string;
            punjab: number;
            islamabad: number;
            kpk: number;
            sindh: number;
            ajk: number;
            gb: number;
            balochistan: number;
            overseas: number;
            verified_total: number;
          };
          const sumKnown =
            (row.punjab ?? 0) +
            (row.islamabad ?? 0) +
            (row.kpk ?? 0) +
            (row.sindh ?? 0) +
            (row.ajk ?? 0) +
            (row.gb ?? 0) +
            (row.balochistan ?? 0) +
            (row.overseas ?? 0);
          return {
            faculty: row.faculty,
            punjab: row.punjab ?? 0,
            islamabad: row.islamabad ?? 0,
            kpk: row.kpk ?? 0,
            sindh: row.sindh ?? 0,
            ajk: row.ajk ?? 0,
            gb: row.gb ?? 0,
            balochistan: row.balochistan ?? 0,
            overseas: row.overseas ?? 0,
            other: Math.max(0, (row.verified_total ?? 0) - sumKnown),
          };
        }),
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
        provinceLocationRows: (provinceDistinctRows as unknown as Array<{ region: string; count: number | string | bigint }>).map((row) => ({
          region: row.region,
          count: Number(row.count || 0),
        })),
        verifiedProvinceLocationRows: (verifiedProvinceDistinctRows as unknown as Array<{ region: string; count: number | string | bigint }>).map((row) => ({
          region: row.region,
          count: Number(row.count || 0),
        })),
        verifiedTransitionVelocity: {
          beforeGraduation: tr.verified_before_graduation ?? null,
          immediateAfterGraduation: tr.verified_immediate ?? null,
          within3Months: tr.verified_within_3 ?? null,
          within6Months: tr.verified_within_6 ?? null,
          after6Months: tr.verified_after_6 ?? null,
          unknown: tr.verified_unknown_bucket ?? null,
        },
        verifiedCurrentOccupation: {
          employed: oc.verified_employed ?? null,
          selfEmployed: oc.verified_self_employed ?? null,
          unemployedSearching: oc.verified_unemployed_searching ?? null,
          unemployedByChoice: oc.verified_unemployed_choice ?? null,
          other: verifiedOccOther > 0 ? verifiedOccOther : null,
        },
        verifiedProvinceLocation: {
          punjab: pr.verified_punjab ?? null,
          islamabad: pr.verified_islamabad ?? null,
          kpk: pr.verified_kpk ?? null,
          sindh: pr.verified_sindh ?? null,
          ajk: pr.verified_ajk ?? null,
          gb: pr.verified_gb ?? null,
          balochistan: pr.verified_balochistan ?? null,
          overseas: pr.verified_overseas ?? null,
          other: verifiedProvinceOther > 0 ? verifiedProvinceOther : null,
        },
      },
      sectionB: {
        chaptersAssociations: {
          nationalChapters: ca.national_chapters ?? null,
          internationalChapters: ca.international_chapters ?? null,
          nationalMembers: nm.national_members ?? null,
          internationalMembers: im.international_members ?? null,
          nationalChapterRows: nationalChapterMemberRows.map((r) => {
            const row = r as { chapter: string; members: number };
            return { chapter: row.chapter, members: Number(row.members ?? 0) };
          }),
          internationalChapterRows: internationalChapterMemberRows.map((r) => {
            const row = r as { chapter: string; members: number };
            return { chapter: row.chapter, members: Number(row.members ?? 0) };
          }),
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
        verifiedCardsStatus: {
          totalCards: vcd.card_total ?? null,
          applied: vcd.applied ?? null,
          review: vcd.review ?? null,
          onHold: vcd.on_hold ?? null,
          underPrinting: vcd.under_printing ?? null,
          readyForDelivery: vcd.ready_for_delivery ?? null,
          delivered: vcd.delivered ?? null,
        },
        facultyHonorCardRows: facultyHonorCardRows.map((r) => {
          const row = r as {
            faculty: string;
            applied: number;
            review: number;
            on_hold: number;
            under_printing: number;
            ready_for_delivery: number;
            delivered: number;
          };
          return {
            faculty: row.faculty,
            applied: row.applied ?? 0,
            review: row.review ?? 0,
            onHold: row.on_hold ?? 0,
            underPrinting: row.under_printing ?? 0,
            readyForDelivery: row.ready_for_delivery ?? 0,
            delivered: row.delivered ?? 0,
          };
        }),
        activities: {
          mentorshipSessions: { quarter: tk.mentorship_quarter ?? 0, ytd: tk.mentorship_ytd ?? 0 },
          seminarsParticipation: { quarter: tk.seminars_quarter ?? 0, ytd: tk.seminars_ytd ?? 0 },
          conferencesParticipation: { quarter: tk.conferences_quarter ?? 0, ytd: tk.conferences_ytd ?? 0 },
          alumniTalks: { quarter: tk.quarter_count ?? 0, ytd: tk.ytd_count ?? 0 },
          highAchieversRecognition: { quarter: tk.high_achievers_quarter ?? 0, ytd: tk.high_achievers_ytd ?? 0 },
          wellbeingSupport: { quarter: tk.wellbeing_quarter ?? 0, ytd: tk.wellbeing_ytd ?? 0 },
          chapterEvents: { quarter: ce.quarter_count ?? 0, ytd: ce.ytd_count ?? 0, total: ce.total_count ?? 0 },
        },
        eventsMeetups: {
          events: {
            total: em.events_total ?? null,
            ytd: em.events_ytd ?? null,
            quarter: em.events_quarter ?? null,
          },
          meetups: {
            total: em.meetups_total ?? null,
            ytd: em.meetups_ytd ?? null,
            quarter: em.meetups_quarter ?? null,
          },
          eventsChapterRows: eventsByChapterRows.map((r) => {
            const row = r as { chapter: string; total: number; ytd: number; quarter: number };
            return {
              chapter: row.chapter,
              total: Number(row.total ?? 0),
              ytd: Number(row.ytd ?? 0),
              quarter: Number(row.quarter ?? 0),
            };
          }),
          meetupsChapterRows: meetupsByChapterRows.map((r) => {
            const row = r as { chapter: string; total: number; ytd: number; quarter: number };
            return {
              chapter: row.chapter,
              total: Number(row.total ?? 0),
              ytd: Number(row.ytd ?? 0),
              quarter: Number(row.quarter ?? 0),
            };
          }),
        },
        publications: {
          successStoriesPublished: storiesPub,
          successStoriesQuarter: storiesQ,
          successStoriesYtd: storiesY,
          newslettersIssued: nlTotal,
          newslettersQuarter: nlQ,
          newslettersYtd: nlY,
          surveysConducted: null,
          facultyPublicationRows: facultyPublicationRows.map((r) => {
            const row = r as { faculty: string; total: number; quarter: number; ytd: number };
            return {
              faculty: row.faculty,
              total: Number(row.total ?? 0),
              quarter: Number(row.quarter ?? 0),
              ytd: Number(row.ytd ?? 0),
            };
          }),
        },
      },
      sectionC: {
        jobs: {
          total: jb.all_total ?? null,
          uol: jb.uol_total ?? null,
          other: jb.other_total ?? null,
          quarter: jb.quarter_total ?? null,
          ytd: jb.ytd_total ?? null,
          categoryRows: jobsCategoryRows.map((r) => {
            const row = r as {
              category: string;
              total: number;
              uol: number;
              other: number;
              quarter: number;
              ytd: number;
            };
            return {
              category: row.category,
              total: Number(row.total ?? 0),
              uol: Number(row.uol ?? 0),
              other: Number(row.other ?? 0),
              quarter: Number(row.quarter ?? 0),
              ytd: Number(row.ytd ?? 0),
            };
          }),
        },
        facultyScholarshipRows: facultyScholarshipRows.map((r) => {
          const row = r as {
            faculty: string;
            applied: number;
            approved: number;
            processed: number;
            kinship_applied: number;
            kinship_approved: number;
            kinship_processed: number;
            masters_applied: number;
            masters_approved: number;
            masters_processed: number;
            iq_applied: number;
            iq_approved: number;
            iq_processed: number;
          };
          return {
            faculty: row.faculty,
            applied: Number(row.applied ?? 0),
            approved: Number(row.approved ?? 0),
            processed: Number(row.processed ?? 0),
            kinshipApplied: Number(row.kinship_applied ?? 0),
            kinshipApproved: Number(row.kinship_approved ?? 0),
            kinshipProcessed: Number(row.kinship_processed ?? 0),
            mastersApplied: Number(row.masters_applied ?? 0),
            mastersApproved: Number(row.masters_approved ?? 0),
            mastersProcessed: Number(row.masters_processed ?? 0),
            iqApplied: Number(row.iq_applied ?? 0),
            iqApproved: Number(row.iq_approved ?? 0),
            iqProcessed: Number(row.iq_processed ?? 0),
          };
        }),
        career: {
          recruitmentDrives: { quarter: cr.recruitment_quarter ?? 0, ytd: cr.recruitment_ytd ?? 0 },
          jobsPostedUol: { quarter: jb.uol_quarter ?? null, ytd: jb.uol_ytd ?? null },
          jobsPostedOtherEmployers: { quarter: jb.other_quarter ?? null, ytd: jb.other_ytd ?? null },
          startupsSupport: { quarter: cr.startups_quarter ?? 0, ytd: cr.startups_ytd ?? 0 },
          upskillCourses: { quarter: cr.upskill_quarter ?? 0, ytd: cr.upskill_ytd ?? 0 },
        },
        scholarships: {
          kinship: {
            applied: sc.kinship_applied ?? null,
            approved: sc.kinship_approved ?? null,
            processed: sc.kinship_processed ?? null,
          },
          mastersPhd: {
            applied: sc.masters_phd_applied ?? null,
            approved: sc.masters_phd_approved ?? null,
            processed: sc.masters_phd_processed ?? null,
          },
          iqPrograms: {
            applied: sc.iq_applied ?? null,
            approved: sc.iq_approved ?? null,
            processed: sc.iq_processed ?? null,
          },
        },
        giveBackFinancialAssistance: null,
      },
      sectionD: {
        memberships: {
          totalMemberships: mb.total_count ?? null,
          totalApproved: mb.active_benefits ?? null,
          gymDiscountActive: mb.gym_count ?? null,
          gymApproved: mb.gym_approved ?? null,
          swimmingPoolDiscountActive: mb.swimming_count ?? null,
          swimmingPoolApproved: mb.swimming_approved ?? null,
          freeGymThreeMonth: mb.free_gym_hint ?? null,
          freePoolThreeMonth: mb.free_pool_hint ?? null,
          qalanderClub: mb.qalander_hint ?? null,
          qalanderApproved: mb.qalander_approved ?? null,
          healthcareDiscounts: mb.healthcare_hint ?? null,
          vehicleStickers: mb.vehicle_hint ?? null,
        },
        facultyMembershipRows: facultyMembershipRows.map((r) => {
          const row = r as {
            faculty: string;
            total: number;
            gym: number;
            gym_approved: number;
            pool: number;
            pool_approved: number;
            qalander: number;
            qalander_approved: number;
          };
          return {
            faculty: row.faculty,
            total: Number(row.total ?? 0),
            gym: Number(row.gym ?? 0),
            gymApproved: Number(row.gym_approved ?? 0),
            pool: Number(row.pool ?? 0),
            poolApproved: Number(row.pool_approved ?? 0),
            qalander: Number(row.qalander ?? 0),
            qalanderApproved: Number(row.qalander_approved ?? 0),
          };
        }),
        discountCategories: {
          totalApplications: dc.total_count ?? null,
          diningAndCafes: dc.dining ?? null,
          retailAndShopping: dc.retail ?? null,
          travelAndLeisure: dc.travel ?? null,
          healthAndWellness: dc.health ?? null,
          professionalServices: dc.professional ?? null,
          financialServices: dc.financial ?? null,
        },
        facultyDiscountRows: facultyDiscountRows.map((r) => {
          const row = r as {
            faculty: string;
            total: number;
            dining: number;
            retail: number;
            travel: number;
            health: number;
            professional: number;
            financial: number;
          };
          return {
            faculty: row.faculty,
            total: Number(row.total ?? 0),
            dining: Number(row.dining ?? 0),
            retail: Number(row.retail ?? 0),
            travel: Number(row.travel ?? 0),
            health: Number(row.health ?? 0),
            professional: Number(row.professional ?? 0),
            financial: Number(row.financial ?? 0),
          };
        }),
        merchants: [...MANAGEMENT_DASHBOARD_MERCHANT_SEED],
      },
    };

    const systemHealth = await collectSystemHealth();

    return NextResponse.json(
      {
        ...payload,
        ...(debug ? { debug: { trainedFacultyAdmins: trainedFacultyAdminsDebug } } : {}),
        scopeNotes: MANAGEMENT_DASHBOARD_SCOPE_NOTES,
        systemHealth,
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
