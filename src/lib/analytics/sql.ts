import { sql } from "@/lib/dbconnect";
import type postgres from "postgres";
import type { AnalyticsPeriod } from "./types";
import { PERIOD_DATE_TRUNC, PERIOD_STEP_INTERVAL, PERIOD_WINDOW_BUCKETS } from "./constants";
import type { ModuleSource } from "./registry";

const IDENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function identOrThrow(name: string, kind: string) {
  if (!IDENT.test(name)) throw new Error(`Invalid ${kind}`);
  return name;
}

function tableSql(schema: string, table: string) {
  const s = identOrThrow(schema, "schema");
  const t = identOrThrow(table, "table");
  return `${s}.${t}`;
}

function columnSql(column: string) {
  const c = identOrThrow(column, "column");
  return c;
}

export type BucketRow = { bucket: Date; count: number };

export function buildSeriesQuery(source: ModuleSource, period: AnalyticsPeriod): postgres.PendingQuery<BucketRow[]> {
  const truncUnit = PERIOD_DATE_TRUNC[period];
  const step = PERIOD_STEP_INTERVAL[period];
  const buckets = PERIOD_WINDOW_BUCKETS[period];

  const sourceCte = (() => {
    if (source.kind === "union") {
      // unionSql yields (SELECT ... AS ts ... UNION ALL SELECT ... AS ts ...)
      return source.unionSql;
    }

    const tbl = tableSql(source.table.schema, source.table.table);
    const tsCol = columnSql(source.timestampColumn);
    const where = source.whereSql ?? null;
    if (where) {
      return `(SELECT ${tsCol} AS ts FROM ${tbl} WHERE ${tsCol} IS NOT NULL AND (${where}))`;
    }
    return `(SELECT ${tsCol} AS ts FROM ${tbl} WHERE ${tsCol} IS NOT NULL)`;
  })();

  const q = `
    WITH bounds AS (
      SELECT
        (date_trunc('${truncUnit}', now()) - (${buckets - 1}) * interval '${step}')::timestamptz AS start_bucket,
        date_trunc('${truncUnit}', now())::timestamptz AS end_bucket,
        interval '${step}' AS step
    ),
    src AS ${sourceCte},
    series AS (
      SELECT generate_series(b.start_bucket, b.end_bucket, b.step) AS bucket
      FROM bounds b
    ),
    agg AS (
      SELECT
        date_trunc('${truncUnit}', ts) AS bucket,
        COUNT(*)::int AS count
      FROM src
      CROSS JOIN bounds b
      WHERE ts >= b.start_bucket
        AND ts < (b.end_bucket + b.step)
      GROUP BY 1
    )
    SELECT
      s.bucket::timestamptz AS bucket,
      COALESCE(a.count, 0)::int AS count
    FROM series s
    LEFT JOIN agg a ON a.bucket = s.bucket
    ORDER BY s.bucket ASC
  `;
  return sql.unsafe(q) as unknown as postgres.PendingQuery<BucketRow[]>;
}

export function buildPreviousTotalQuery(source: ModuleSource, period: AnalyticsPeriod): postgres.PendingQuery<Array<{ total: number }>> {
  const truncUnit = PERIOD_DATE_TRUNC[period];
  const step = PERIOD_STEP_INTERVAL[period];
  const buckets = PERIOD_WINDOW_BUCKETS[period];

  const sourceFrom = (() => {
    if (source.kind === "union") {
      return source.unionSql;
    }
    const tbl = tableSql(source.table.schema, source.table.table);
    const tsCol = columnSql(source.timestampColumn);
    const where = source.whereSql ?? null;
    if (where) {
      return `(SELECT ${tsCol} AS ts FROM ${tbl} WHERE ${tsCol} IS NOT NULL AND (${where}))`;
    }
    return `(SELECT ${tsCol} AS ts FROM ${tbl} WHERE ${tsCol} IS NOT NULL)`;
  })();

  const q = `
    WITH bounds AS (
      SELECT
        (date_trunc('${truncUnit}', now()) - (${(buckets * 2) - 1}) * interval '${step}')::timestamptz AS prev_start,
        (date_trunc('${truncUnit}', now()) - (${buckets - 1}) * interval '${step}')::timestamptz AS curr_start
    ),
    src AS ${sourceFrom}
    SELECT COUNT(*)::int AS total
    FROM src
    CROSS JOIN bounds b
    WHERE ts >= b.prev_start AND ts < b.curr_start
  `;
  return sql.unsafe(q) as unknown as postgres.PendingQuery<Array<{ total: number }>>;
}

