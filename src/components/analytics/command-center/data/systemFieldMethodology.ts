export const TRAINED_ADMINS_METHODOLOGY = {
  summary:
    "Counts distinct admin/viewer users who have faculty-scoped access in the RBAC tables. Each user is counted once in the headline total; faculty pills show how many scoped assignments fall under each faculty.",
  source: "GET /api/analytics/realtime-dashboard → sectionA.trainedFacultyAdmins",
  calculations: [
    {
      label: "Total",
      detail:
        "COUNT(DISTINCT user_id) across merged faculty-scope pairs from user_resource_access (resources tree) and, when present, user_access_assignments.",
    },
    {
      label: "By faculty",
      detail:
        "Same scoped pairs grouped by resolved faculty_id / faculty name. A user with multiple faculty scopes can appear in more than one faculty row.",
    },
    {
      label: "Eligible users",
      detail:
        "Non-blocked users whose type is admin, viewer, superadmin, or legacy user; scoped to faculty, department, or program resources with a resolvable faculty.",
    },
  ],
  refresh: "Refetched with the command center dashboard every 30 seconds (React Query).",
} as const;

export const SYSTEM_HEALTH_METHODOLOGY = {
  summary:
    "Live operational probes collected server-side on each dashboard refresh. Status dots use green / amber / red thresholds per metric.",
  source: "GET /api/analytics/realtime-dashboard → systemHealth (collectSystemHealth)",
  planned: [
    {
      label: "API Latency",
      detail:
        "PostgreSQL round-trip time for SELECT 1 (milliseconds). Healthy < 100 ms, warning 100–299 ms, critical ≥ 300 ms or offline.",
    },
    {
      label: "Database",
      detail: "Online when SELECT 1 succeeds; Offline when the connection probe throws.",
    },
    {
      label: "Storage",
      detail:
        "Uploads folder disk usage as % of server-allocated storage (60 GB default; override with UPLOADS_STORAGE_QUOTA_GB). Scans public/images (or UPLOADS_IMAGES_DIR). Warning ≥ 60%, critical ≥ 85%.",
    },
    {
      label: "Error Rate",
      detail:
        "Failed email_logs ÷ total email_logs in the last 24 hours (%). Warning ≥ 1%, critical ≥ 5%. Returns 0% when no log rows exist.",
    },
    {
      label: "Activity log",
      detail: "Latest rows from public.email_logs (newest first), shown in the System Health drawer.",
    },
  ],
  statusRules: [
    { label: "Healthy", detail: "Within target thresholds (green indicator)." },
    { label: "Warning", detail: "Approaching threshold (amber indicator)." },
    { label: "Critical", detail: "Outage or threshold breach (red indicator)." },
  ],
} as const;

export const OTHER_SYSTEM_METHODOLOGY = {
  summary:
    "Summarizes dashboard data-scope caveats and period metadata so admins know which KPIs are org-wide vs faculty-filtered.",
  source: "GET /api/analytics/realtime-dashboard → scopeNotes + payload.meta",
  calculations: [
    {
      label: "Headline count",
      detail: "Number of scope notes returned (length of MANAGEMENT_DASHBOARD_SCOPE_NOTES). Currently fixed at build time, not user-editable.",
    },
    {
      label: "Scope notes",
      detail:
        "Static list describing metrics that ignore the faculty filter (chapters, association members, events, job-board scans, etc.).",
    },
    {
      label: "Period metadata",
      detail:
        "From payload.meta: timeRange label, active facultyId filter, and periodType (all / year / month / range) chosen in the command center header.",
    },
    {
      label: "Logs · Backups · Config",
      detail:
        "Quick links to related operational context. Live email activity is under System Health → Activity log.",
    },
  ],
} as const;
