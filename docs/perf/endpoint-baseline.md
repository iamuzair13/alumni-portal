# Endpoint wall-clock + DB query counts

Generated: 2026-11-05T12:57:46.413Z against http://localhost:3100
Auth: PERF_COOKIE supplied

## RUN INVALID — DATABASE UNREACHABLE

Every request below returned 500 with `{"error":""}` and **0 DB queries**:
the `postgres` driver raised `AggregateError: ECONNREFUSED` before any SQL
was sent to the server. `DATABASE_URL` points at `localhost:5433`, which was
a forwarded/tunneled connection that dropped between the EXPLAIN run (which
succeeded — see `baseline.md`) and this run.

These numbers measure connection failure, not endpoint performance.
**Regenerate once the local DB is reachable:**

```powershell
$env:DB_QUERY_STATS="1"; npx next dev -p 3100          # terminal A
$env:PERF_COOKIE=(npx tsx scripts/make-session.ts superadmin)
$env:PERF_BASE_URL="http://localhost:3100"
npx tsx scripts/measure-endpoints.ts                   # terminal B
```

| Endpoint | Status | Wall ms | DB queries | DB ms |
| --- | --- | --- | --- | --- |
| alumni-list-default /api/alumni?page=1&limit=100 | 500 | 1101 | 0 | 0 |
| alumni-search-3filters /api/alumni?search=zafar&gender=Male&homeCountry=Pakistan&campusname=Lahore&page=1&limit=100 | 500 | 42 | 0 | 0 |
| alumni-counts /api/alumni/counts | 500 | 417 | 0 | 0 |
| filter-options-employers /api/alumni/employers | 500 | 288 | 0 | 0 |
| alumni-cards-applicants /api/alumni-cards/applicants | 500 | 452 | 0 | 0 |
| realtime-dashboard /api/analytics/realtime-dashboard | 500 | 1140 | 0 | 0 |
| alumni-full-details /api/alumni/1/full-details | 500 | 1784 | 0 | 0 |
