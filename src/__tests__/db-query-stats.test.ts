/**
 * T0.2 — DB query-statistics instrumentation.
 *
 * The instrumentation must:
 *  - stay inert unless DB_QUERY_STATS=1 (no driver `debug` hook registered),
 *  - count only queries actually sent to Postgres (via the driver `debug`
 *    option), not composable sql`` fragments,
 *  - expose/reset state via getDbQueryStats()/resetDbQueryStats().
 *
 * `postgres` is mocked: we capture the options object passed to it and drive
 * the `debug` callback directly, so no real database is needed.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

type PgOptions = { debug?: (conn: number, query: string) => void };
const capturedOptions: PgOptions[] = [];

vi.mock("postgres", () => ({
  default: (url: string, options: PgOptions) => {
    capturedOptions.push(options);
    const client = () => Promise.resolve([]);
    return client;
  },
}));

async function freshModule() {
  vi.resetModules();
  capturedOptions.length = 0;
  return await import("@/lib/dbconnect");
}

beforeEach(() => {
  process.env.DATABASE_URL = "postgres://localhost:5433/test";
  delete process.env.DB_QUERY_STATS;
});

describe("dbconnect query stats", () => {
  it("does not register a debug hook when DB_QUERY_STATS is unset", async () => {
    const { sql } = await freshModule();
    await sql`SELECT 1`; // triggers lazy init
    expect(capturedOptions).toHaveLength(1);
    expect(capturedOptions[0].debug).toBeUndefined();
    const { getDbQueryStats } = await import("@/lib/dbconnect");
    expect(getDbQueryStats().count).toBe(0);
  });

  it("registers a debug hook and counts driver-reported queries", async () => {
    process.env.DB_QUERY_STATS = "1";
    const { sql, getDbQueryStats, resetDbQueryStats } = await freshModule();
    await sql`SELECT 1`;
    expect(capturedOptions).toHaveLength(1);
    expect(typeof capturedOptions[0].debug).toBe("function");

    // Simulate the driver firing debug for two sent queries.
    capturedOptions[0].debug!(1, "SELECT * FROM tbl_alumni");
    capturedOptions[0].debug!(1, "SELECT count(*) FROM tblcard");
    const stats = getDbQueryStats();
    expect(stats.count).toBe(2);
    expect(stats.entries).toHaveLength(2);
    expect(stats.entries[0].text).toContain("tbl_alumni");

    resetDbQueryStats();
    expect(getDbQueryStats().count).toBe(0);
    expect(getDbQueryStats().entries).toHaveLength(0);
  });
});
