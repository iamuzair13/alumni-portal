import { sql } from "@/lib/dbconnect";

export type AlumniTrendPoint = {
  period: string;
  total: number;
  verified: number;
  unverified: number;
  active: number;
  distinguished: number;
  A_plus: number;
  A: number;
  B: number;
  C: number;
  D: number;
};

export type AlumniTrendFilter =
  | "all"
  | "verified"
  | "unverified"
  | "active"
  | "distinguished"
  | "A_plus"
  | "A"
  | "B"
  | "C"
  | "D";

export async function getAlumniTrends(period: "monthly" | "yearly" = "monthly"): Promise<AlumniTrendPoint[]> {
  // Use tbl_alumni.todaydate as the creation timestamp for trends
  const bucketExpr =
    period === "yearly"
      ? sql`to_char(todaydate, 'YYYY')`
      : sql`to_char(todaydate, 'YYYY-MM')`;

  const rows = await sql<{
    period: string;
    total: number;
    verified: number;
    unverified: number;
    active: number;
    distinguished: number;
    A_plus: number;
    A: number;
    B: number;
    C: number;
    D: number;
  }[]>`
    SELECT
      ${bucketExpr} AS period,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE LOWER(TRIM(COALESCE(verify, ''))) IN ('y', 'yes', 'verified')) AS verified,
      COUNT(*) FILTER (WHERE verify IS NULL OR LOWER(TRIM(COALESCE(verify, ''))) NOT IN ('y', 'yes', 'verified')) AS unverified,
      COUNT(*) FILTER (WHERE LOWER(TRIM(COALESCE(alumnistatus, ''))) = 'active') AS active,
      COUNT(*) FILTER (WHERE 1 = 0) AS distinguished,
      COUNT(*) FILTER (WHERE category = 'A+') AS "A_plus",
      COUNT(*) FILTER (WHERE category = 'A') AS "A",
      COUNT(*) FILTER (WHERE category = 'B') AS "B",
      COUNT(*) FILTER (WHERE category = 'C') AS "C",
      COUNT(*) FILTER (WHERE category = 'D') AS "D"
    FROM public.tbl_alumni
    WHERE todaydate IS NOT NULL
    GROUP BY period
    ORDER BY period ASC;
  `;

  return rows.map((r) => ({
    period: r.period,
    total: Number(r.total ?? 0),
    verified: Number(r.verified ?? 0),
    unverified: Number(r.unverified ?? 0),
    active: Number(r.active ?? 0),
    distinguished: Number(r.distinguished ?? 0),
    A_plus: Number(r.A_plus ?? 0),
    A: Number(r.A ?? 0),
    B: Number(r.B ?? 0),
    C: Number(r.C ?? 0),
    D: Number(r.D ?? 0),
  }));
}

