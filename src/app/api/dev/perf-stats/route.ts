import { NextResponse } from "next/server";
import { getDbQueryStats, resetDbQueryStats } from "@/lib/dbconnect";

export const dynamic = "force-dynamic";

/**
 * Dev-only DB query-statistics endpoint (T0.2 perf baseline).
 *
 * Exists only when DB_QUERY_STATS=1 AND NODE_ENV !== "production" — otherwise
 * returns 404. Usage:
 *   GET /api/dev/perf-stats?reset=1   -> resets counters, returns zeros
 *   GET /api/some/endpoint            -> exercise a route
 *   GET /api/dev/perf-stats?detail=1  -> { count, totalMs, entries[] }
 */
export async function GET(req: Request) {
  if (process.env.DB_QUERY_STATS !== "1" || process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const url = new URL(req.url);
  const snapshot = { ...getDbQueryStats(), entries: [...getDbQueryStats().entries] };
  if (url.searchParams.get("reset") === "1") resetDbQueryStats();
  const detail = url.searchParams.get("detail") === "1";
  return NextResponse.json({
    count: snapshot.count,
    totalMs: Math.round(snapshot.totalMs * 100) / 100,
    ...(detail ? { entries: snapshot.entries } : {}),
  });
}
