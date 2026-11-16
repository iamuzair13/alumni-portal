# Performance Baseline Procedure (T0.2)

Two measurement layers:

1. **Query plans** — `scripts/explain-baseline.ts` runs `EXPLAIN (ANALYZE, BUFFERS)`
   on the real SQL emitted by the heaviest routes and writes `docs/perf/baseline.md`.
2. **End-to-end** — `scripts/measure-endpoints.ts` times HTTP requests and reads
   the per-request DB query count from the dev-only `DB_QUERY_STATS` counter
   (`src/lib/dbconnect.ts`, surfaced by `/api/dev/perf-stats`), writing
   `docs/perf/endpoint-baseline.md`.

## Prerequisites

- `.env.local` with `DATABASE_URL` pointing at a **local** database.
- At least ~50k alumni rows:
  ```bash
  npx tsx scripts/seed-perf-data.ts            # inserts 50,000 PERF_SEED rows
  npx tsx scripts/seed-perf-data.ts --cleanup  # removes them again
  ```

## Run

```powershell
# 1) query plans (runs ANALYZE — executes the queries against the local DB)
Get-Content .env.local | ForEach-Object { if ($_ -match '^([^=]+)=(.*)$') { [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim()) } }
npx tsx scripts/explain-baseline.ts
# plan-only (no execution): set EXPLAIN_ONLY=1 first

# 2) wall-clock per endpoint — needs the dev server with the stats flag
$env:DB_QUERY_STATS="1"; npm run dev          # terminal A
npx tsx scripts/measure-endpoints.ts          # terminal B
# optional authenticated run: $env:PERF_COOKIE="next-auth.session-token=..."
```

## Notes / limitations

- Endpoints requiring a session return 401 anonymous — their wall-clock is
  skipped; measure their SQL via the EXPLAIN script, or pass `PERF_COOKIE`.
- `sql.unsafe` calls are timed only when the flag was set at pool init
  (`DB_QUERY_STATS=1` before the first query).
- The counter is process-global: run measurements serially (the script does).
- Seed rows are tagged `datasource='PERF_SEED'` — never run the seed against
  production.
