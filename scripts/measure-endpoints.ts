/**
 * T0.2 — Wall-clock + DB-query-count measurement per endpoint.
 *
 * Requires `next dev` running with DB_QUERY_STATS=1:
 *   $env:DB_QUERY_STATS="1"; npm run dev
 *   npx tsx scripts/measure-endpoints.ts
 *
 * For each endpoint: resets the in-process query counter via
 * /api/dev/perf-stats?reset=1, times the request, then reads the counter.
 * Endpoints that need an authenticated session will return 401 — they are
 * recorded but excluded from the summary (measure their SQL via
 * scripts/explain-baseline.ts instead, or supply a Cookie header via
 * PERF_COOKIE env).
 */
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.PERF_BASE_URL ?? "http://localhost:3000";
const COOKIE = process.env.PERF_COOKIE; // optional "next-auth.session-token=..." header

const ENDPOINTS: { name: string; path: string; needsAuth?: boolean }[] = [
  { name: "alumni-list-default", path: "/api/alumni?page=1&limit=100" },
  {
    name: "alumni-search-3filters",
    path: "/api/alumni?search=zafar&gender=Male&homeCountry=Pakistan&campusname=Lahore&page=1&limit=100",
  },
  { name: "alumni-counts", path: "/api/alumni/counts" },
  { name: "filter-options-employers", path: "/api/alumni/employers", needsAuth: true },
  { name: "alumni-cards-applicants", path: "/api/alumni-cards/applicants" },
  { name: "realtime-dashboard", path: "/api/analytics/realtime-dashboard", needsAuth: true },
  { name: "alumni-full-details", path: `/api/alumni/1/full-details`, needsAuth: true },
];

async function getJson(url: string) {
  const res = await fetch(url, { headers: COOKIE ? { cookie: COOKIE } : {} });
  return { status: res.status, body: res.status === 404 ? null : await res.json().catch(() => null) };
}

async function main() {
  // sanity check the counter endpoint exists
  const sanity = await getJson(`${BASE}/api/dev/perf-stats`);
  if (sanity.status === 404) {
    console.error(
      "perf-stats endpoint returned 404 — start dev server with DB_QUERY_STATS=1 (and NODE_ENV!=production)"
    );
    process.exit(1);
  }

  const rows: {
    endpoint: string;
    status: number;
    wallMs: number;
    dbQueries: number | null;
    dbMs: number | null;
  }[] = [];

  for (const ep of ENDPOINTS) {
    await getJson(`${BASE}/api/dev/perf-stats?reset=1`);
    const t0 = performance.now();
    const res = await fetch(`${BASE}${ep.path}`, {
      headers: COOKIE ? { cookie: COOKIE } : {},
    });
    const wallMs = performance.now() - t0;
    await res.arrayBuffer();
    const stats = await getJson(`${BASE}/api/dev/perf-stats`);
    rows.push({
      endpoint: `${ep.name} ${ep.path}`,
      status: res.status,
      wallMs: Math.round(wallMs),
      // subtract the perf-stats call itself (1 request, 0 queries typically)
      dbQueries: stats.body?.count ?? null,
      dbMs: stats.body?.totalMs ?? null,
    });
    console.log(`${ep.name}: ${res.status} ${Math.round(wallMs)}ms q=${stats.body?.count ?? "?"}`);
  }

  const outDir = path.resolve(process.cwd(), "docs/perf");
  fs.mkdirSync(outDir, { recursive: true });
  const md = [
    `# Endpoint wall-clock + DB query counts`,
    ``,
    `Generated: ${new Date().toISOString()} against ${BASE}`,
    `Auth: ${COOKIE ? "PERF_COOKIE supplied" : "anonymous (401/403 rows excluded from perf conclusions)"}`,
    ``,
    `| Endpoint | Status | Wall ms | DB queries | DB ms |`,
    `| --- | --- | --- | --- | --- |`,
    ...rows.map(
      (r) =>
        `| ${r.endpoint} | ${r.status} | ${r.wallMs} | ${r.dbQueries ?? "n/a"} | ${r.dbMs ?? "n/a"} |`
    ),
    ``,
  ].join("\n");
  const outFile = path.join(outDir, "endpoint-baseline.md");
  fs.writeFileSync(outFile, md, "utf8");
  console.log(`Wrote ${outFile}`);
}

main().catch((e) => {
  console.error("ERR", e.message);
  process.exit(1);
});
