import { sql } from "@/lib/dbconnect";
import { PERIODS } from "./constants";
import { moduleRegistry, MODULES } from "./registry";
import type { AnalyticsModule, AnalyticsPeriod, AnalyticsSeries, DashboardAnalytics } from "./types";
import { buildPreviousTotalQuery, buildSeriesQuery } from "./sql";
import { formatBucketLabel } from "./format";
import { computeGrowth } from "./growth";

function isPeriod(input: string): input is AnalyticsPeriod {
  return (PERIODS as ReadonlyArray<string>).includes(input);
}

function isModule(input: string): input is AnalyticsModule {
  const allowed: AnalyticsModule[] = ["dashboard", ...MODULES];
  return allowed.includes(input as AnalyticsModule);
}

export function parseAnalyticsParams(params: { module?: string | null; period?: string | null }): {
  module: AnalyticsModule;
  period: AnalyticsPeriod;
} {
  const moduleRaw = String(params.module ?? "").trim().toLowerCase();
  const periodRaw = String(params.period ?? "").trim().toLowerCase();

  const module = moduleRaw ? moduleRaw : "dashboard";
  const period = periodRaw ? periodRaw : "monthly";

  if (!isModule(module)) {
    throw Object.assign(new Error("Invalid module"), { status: 400, code: "INVALID_MODULE" });
  }
  if (!isPeriod(period)) {
    throw Object.assign(new Error("Invalid period"), { status: 400, code: "INVALID_PERIOD" });
  }
  return { module, period };
}

export async function getModuleAnalytics(module: Exclude<AnalyticsModule, "dashboard">, period: AnalyticsPeriod): Promise<AnalyticsSeries> {
  const source = moduleRegistry[module];
  if (!source) {
    throw Object.assign(new Error("Invalid module"), { status: 400, code: "INVALID_MODULE" });
  }
  if (source.kind === "table") {
    const existsRows = await sql/* sql */`
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = ${source.table.schema}
        AND table_name = ${source.table.table}
        AND column_name = ${source.timestampColumn}
      LIMIT 1
    `;
    if (!existsRows[0]) {
      throw Object.assign(
        new Error(`Timestamp column not found for module '${module}'`),
        { status: 400, code: "MISSING_TIMESTAMP_COLUMN" }
      );
    }
  }

  const rows = await buildSeriesQuery(source, period);
  const prevRows = await buildPreviousTotalQuery(source, period);
  const previousTotal = Number(prevRows?.[0]?.total ?? 0);

  const labels = rows.map((r) => formatBucketLabel(period, new Date(r.bucket)));
  const data = rows.map((r) => Number(r.count ?? 0));
  const total = data.reduce((acc, n) => acc + (Number.isFinite(n) ? n : 0), 0);
  const growth = computeGrowth(total, previousTotal);

  return { labels, data, total, growth };
}

export async function getDashboardAnalytics(period: AnalyticsPeriod): Promise<DashboardAnalytics> {
  // Module totals + growth (for pie + top performer)
  const settled = await Promise.all(
    MODULES.map(async (m) => {
      try {
        const res = await getModuleAnalytics(m, period);
        return { module: m, total: res.total, growth: res.growth };
      } catch {
        return null;
      }
    })
  );
  const moduleTotals = settled.filter((x): x is { module: (typeof MODULES)[number]; total: number; growth: number } => Boolean(x));

  // Overall time series = union all timestamps from available modules (except dashboard itself).
  const unionParts = MODULES
    .filter((m) => moduleTotals.some((x) => x.module === m))
    .map((m) => {
      const src = moduleRegistry[m];
      if (src.kind === "union") return `SELECT ts FROM ${src.unionSql} u`;
      const schema = src.table.schema;
      const table = src.table.table;
      const col = src.timestampColumn;
      const where = src.whereSql ? ` AND (${src.whereSql})` : "";
      return `SELECT ${col} AS ts FROM ${schema}.${table} WHERE ${col} IS NOT NULL${where}`;
    });

  const unionSql = unionParts.length
    ? `(${unionParts.join("\n    UNION ALL\n    ")})`
    : `(SELECT NULL::timestamptz AS ts WHERE FALSE)`;

  const overall = await getModuleAnalyticsFromCustomUnion(unionSql, period);

  return { ...overall, moduleTotals };
}

async function getModuleAnalyticsFromCustomUnion(unionSql: string, period: AnalyticsPeriod): Promise<AnalyticsSeries> {
  // Use the same query builder by temporarily providing a union source.
  const source = { kind: "union" as const, unionSql };
  const rows = await buildSeriesQuery(source, period);
  const prevRows = await buildPreviousTotalQuery(source, period);
  const previousTotal = Number(prevRows?.[0]?.total ?? 0);

  const labels = rows.map((r) => formatBucketLabel(period, new Date(r.bucket)));
  const data = rows.map((r) => Number(r.count ?? 0));
  const total = data.reduce((acc, n) => acc + (Number.isFinite(n) ? n : 0), 0);
  const growth = computeGrowth(total, previousTotal);
  return { labels, data, total, growth };
}

