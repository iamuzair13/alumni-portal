"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import ComponentCard from "@/components/common/ComponentCard";
import SyncedTableScroll from "@/components/tables/SyncedTableScroll";
import Pagination from "@/components/tables/Pagination";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { isSuperAdminUser } from "@/lib/alumniProfile";

type LogRow = {
  id: number;
  created_at: string;
  actor_user_id: number | null;
  actor_email: string | null;
  actor_type: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  success: boolean;
  error_message: string | null;
  ip: string | null;
  user_agent: string | null;
  request_path: string | null;
  metadata: unknown;
};

type LogsResponse = {
  items: LogRow[];
  total: number;
  limit: number;
  offset: number;
};

// Friendly label map for action strings shown in the logs table.
// Falls back to the raw action string if no mapping is found.
const ACTION_LABELS: Record<string, string> = {
  // Alumni
  "alumni.update": "Update Alumni Profile",
  "alumni.update_fields": "Update Alumni Fields",
  "alumni.delete": "Delete Alumni Record",
  "alumni.create": "Create / Register Alumni",
  "alumni.change_password": "Change Password",
  "alumni.send_credentials": "Send Login Credentials",
  "alumni.upload_medal_document": "Upload Medal Document",
  "alumni.update_profile_picture": "Update Profile Picture",
  "alumni.update_social_links": "Update Social Media Links",
  "alumni.verify_image": "Verify Alumni Image",
  ALUMNI_VERIFY: "Verify Alumni (Approve)",
  ALUMNI_UNVERIFY: "Unverify Alumni (Reject)",
  // Alumni Cards
  "alumni_cards.create": "Create Alumni Card",
  "alumni_cards.update": "Update Alumni Card",
  "alumni_cards.update_status": "Change Card Status",
  "alumni_cards.update_image": "Update Card Image",
  "alumni_cards.submit_revision": "Submit Card Revision",
  "alumni_cards.delete": "Delete Alumni Card",
  CARD_EXISTS: "Card Exists (Block Delete)",
  // Users
  "users.create": "Create User",
  "users.update": "Update User",
  "users.delete": "Delete User",
  "users.self_update": "Update Own Profile",
  // Stories
  "stories.create": "Submit Story",
  "stories.update": "Update Story",
  "stories.delete": "Delete Story",
  "stories.review": "Approve / Reject Story",
  // Scholarships
  "scholarships.apply": "Submit Scholarship Application",
  "scholarships.update_status": "Update Scholarship Status",
  "scholarships.delete": "Delete Scholarship Application",
  // Memberships
  "memberships.update_status": "Update Membership Status",
  "memberships.delete": "Delete Membership",
  "memberships.gym_submit": "Submit Gym Membership",
  "memberships.swimming_pool_submit": "Submit Swimming Pool Membership",
  "memberships.cricket_submit": "Submit Cricket Membership",
  // Talks
  "talks.submit": "Submit Talk Session",
  "talks.update_status": "Update Talk Status",
  "talks.delete": "Delete Talk Session",
  // Events
  "events.create": "Create Event",
  "events.update": "Update Event",
  "events.delete": "Delete Event",
  // Jobs
  "jobs.create": "Post Job",
  "jobs.update": "Update Job Posting",
  "jobs.delete": "Delete Job Posting",
  // Admin
  "admin.change_approval": "Approve / Reject Profile Change Request",
  "admin.fix_access_assignments": "Fix Access Assignments",
};

// Returns a friendly label for an action string. Handles dynamic action
// prefixes (e.g. "organization.faculty_create", "settings.scholarship_update",
// "admin.newsletter_create") by mapping the prefix to a category label.
function friendlyAction(action: string): string {
  if (ACTION_LABELS[action]) return ACTION_LABELS[action];
  // Organization actions: organization.faculty_create / _update / _delete etc.
  if (action.startsWith("organization.")) {
    const rest = action.slice("organization.".length);
    const [entity, verb] = rest.split("_");
    const entityLabel = entity
      ? entity.charAt(0).toUpperCase() + entity.slice(1)
      : "Organization";
    const verbLabel =
      verb === "create"
        ? "Create"
        : verb === "update"
        ? "Update"
        : verb === "delete"
        ? "Delete"
        : verb
        ? verb.charAt(0).toUpperCase() + verb.slice(1)
        : "Action";
    return `${verbLabel} ${entityLabel}`;
  }
  // Settings actions: settings.scholarship_update, settings.cgpa_tier_create, etc.
  if (action.startsWith("settings.")) {
    const rest = action.slice("settings.".length);
    const parts = rest.split("_");
    // Find the verb (last token: create/update/delete)
    const verb = parts[parts.length - 1];
    const subject = parts.slice(0, -1).join(" ");
    const verbLabel =
      verb === "create"
        ? "Create"
        : verb === "update"
        ? "Update"
        : verb === "delete"
        ? "Delete"
        : verb.charAt(0).toUpperCase() + verb.slice(1);
    const subjectLabel = subject
      ? subject.replace(/\b\w/g, (c) => c.toUpperCase())
      : "Settings";
    return `${verbLabel} ${subjectLabel} (Settings)`;
  }
  // Newsletter actions: admin.newsletter_create / _upload_image
  if (action.startsWith("admin.newsletter")) {
    if (action.includes("upload")) return "Upload Newsletter Image";
    if (action.includes("create")) return "Create Newsletter";
    if (action.includes("update")) return "Update Newsletter";
    if (action.includes("delete")) return "Delete Newsletter";
    return "Newsletter Action";
  }
  // Distinguished alumni
  if (action.startsWith("distinguished_alumni.")) {
    const verb = action.split(".").pop();
    const verbLabel =
      verb === "create"
        ? "Create"
        : verb === "update"
        ? "Update"
        : verb === "delete"
        ? "Delete"
        : "Action";
    return `${verbLabel} Distinguished Alumni`;
  }
  // Merchants
  if (action.startsWith("merchants.")) {
    const verb = action.split(".").pop();
    const verbLabel =
      verb === "create"
        ? "Create"
        : verb === "update"
        ? "Update"
        : verb === "delete"
        ? "Delete"
        : "Action";
    return `${verbLabel} Merchant`;
  }
  // Email
  if (action.startsWith("email.")) {
    if (action.includes("send_credentials")) return "Send Login Credentials";
    if (action.includes("send")) return "Send Email";
    return "Email Action";
  }
  // Auth
  if (action.startsWith("auth.")) {
    if (action.includes("login")) return "Login";
    if (action.includes("logout")) return "Logout";
    return "Auth Action";
  }
  // Leadership
  if (action.startsWith("leadership")) return "Leadership Action";
  // Fallback: prettify dots and underscores
  return action
    .replace(/[._]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

type LoginLogRow = {
  id: number;
  created_at: string;
  actor_type: string | null;
  actor_user_id: number | null;
  actor_email: string | null;
  identifier: string | null;
  success: boolean;
  error_message: string | null;
  ip: string | null;
  user_agent: string | null;
  metadata: unknown;
};

type LoginLogsResponse = {
  items: LoginLogRow[];
  total: number;
  limit: number;
  offset: number;
};

type MainTab = "activity" | "login";
type SubTab = "alumni" | "admin";

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function stringifyMeta(v: unknown): string {
  if (v === null || v === undefined) return "";
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

export default function ActivityLogsPage() {
  const { data: session } = useSession();
  const isSuperAdmin = isSuperAdminUser(session?.user);

  const [mainTab, setMainTab] = useState<MainTab>("activity");
  const [subTab, setSubTab] = useState<SubTab>("admin");

  const [action, setAction] = useState("");
  const [actorUserId, setActorUserId] = useState("");
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [limit, setLimit] = useState(50);
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activityData, setActivityData] = useState<LogsResponse>({ items: [], total: 0, limit: 50, offset: 0 });
  const [loginData, setLoginData] = useState<LoginLogsResponse>({ items: [], total: 0, limit: 50, offset: 0 });

  const totalPages = useMemo(() => {
    const total = mainTab === "activity" ? activityData.total : loginData.total;
    return Math.max(1, Math.ceil((total || 0) / limit));
  }, [activityData.total, limit, loginData.total, mainTab]);

  useEffect(() => {
    if (!isSuperAdmin) return;

    const controller = new AbortController();
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set("limit", String(limit));
        params.set("offset", String((page - 1) * limit));
        if (q.trim()) params.set("q", q.trim());
        if (actorUserId.trim()) params.set("actorUserId", actorUserId.trim());
        if (from) params.set("from", from);
        if (to) params.set("to", to);

        const actorTypeParam = subTab === "alumni" ? "alumni" : "staff";
        params.set("actorType", actorTypeParam);

        if (mainTab === "activity") {
          if (action.trim()) params.set("action", action.trim());
          const res = await fetch(`/api/admin/activity-logs?${params.toString()}`, { signal: controller.signal });
          const json = (await res.json()) as any;
          if (!res.ok) {
            throw new Error(String(json?.error || "Failed to fetch logs"));
          }
          setActivityData(json as LogsResponse);
        } else {
          const res = await fetch(`/api/admin/login-logs?${params.toString()}`, { signal: controller.signal });
          const json = (await res.json()) as any;
          if (!res.ok) {
            throw new Error(String(json?.error || "Failed to fetch logs"));
          }
          setLoginData(json as LoginLogsResponse);
        }
      } catch (e) {
        if ((e as any)?.name === "AbortError") return;
        setError(e instanceof Error ? e.message : "Failed to fetch logs");
      } finally {
        setLoading(false);
      }
    };

    run();
    return () => controller.abort();
  }, [isSuperAdmin, action, actorUserId, q, from, to, limit, mainTab, page, subTab]);

  useEffect(() => {
    setPage(1);
  }, [action, actorUserId, q, from, to, limit, mainTab, subTab]);

  if (!isSuperAdmin) {
    return (
      <ComponentCard title="Activity Logs">
        <div className="rounded-2xl border border-gray-200 bg-white p-8 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white/90 mb-2">Forbidden</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">Only Super Admin can view activity logs.</p>
          </div>
        </div>
      </ComponentCard>
    );
  }

    return (
    <ComponentCard title="Activity logs" description="Super Admin view to determine activities and logins.">
      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-300 dark:bg-gray-900">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <div className="overflow-x-auto">
              <div className="inline-flex min-w-full  rounded-xl border border-gray-200 bg-gray-200 p-1 dark:border-gray-800 dark:bg-gray-900/40 dark:text-gray-300 dark:bg-gray-900">
                <button
                  type="button"
                  onClick={() => setMainTab("activity")}
                  className={`flex-1 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${
                    mainTab === "activity"
                      ? "bg-white text-slate-900 shadow-sm dark:bg-gray-900 dark:text-white"
                      : "text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white dark:text-gray-300 dark:bg-gray-900"
                  }`}
                >
                  Activity Logs
                </button>
                <button
                  type="button"
                  onClick={() => setMainTab("login")}
                  className={`flex-1 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${
                    mainTab === "login"
                      ? "bg-white text-slate-900 shadow-sm dark:bg-gray-900 dark:text-white"
                      : "text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white dark:text-gray-300 dark:bg-gray-900"
                  }`}
                >
                  Login Logs
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <div className="inline-flex min-w-full rounded-xl border border-gray-200 bg-white p-1 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-300 dark:bg-gray-900">
                <button
                  type="button"
                  onClick={() => setSubTab("alumni")}
                  className={`flex-1 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/25 ${
                    subTab === "alumni"
                      ? "bg-emerald-50 text-emerald-800 shadow-sm dark:bg-emerald-900/20 dark:text-emerald-200"
                      : "text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white dark:text-gray-300 dark:bg-gray-900"
                  }`}
                >
                  {mainTab === "activity" ? "Alumni Activity Logs" : "Alumni Login"}
                </button>
                <button
                  type="button"
                  onClick={() => setSubTab("admin")}
                  className={`flex-1 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/25 ${
                    subTab === "admin"
                      ? "bg-emerald-50 text-emerald-800 shadow-sm dark:bg-emerald-900/20 dark:text-emerald-200"
                      : "text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white dark:text-gray-300 dark:bg-gray-900"
                  }`}
                >
                  {mainTab === "activity" ? "Admin Activity Logs" : "Admin Login"}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-6 gap-3">
          <div className="lg:col-span-2">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 dark:text-gray-300 dark:bg-gray-900">Search</label>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm dark:text-gray-300 dark:bg-gray-900"
              placeholder="email, action, entity, ip..."
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 dark:text-gray-300 dark:bg-gray-900">Action</label>
            <select
              value={action}
              onChange={(e) => setAction(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm dark:text-gray-300 dark:bg-gray-900"
              disabled={mainTab !== "activity"}
            >
              <option value="">All actions</option>
              <optgroup label="Alumni">
                <option value="alumni.update">Update Alumni Profile</option>
                <option value="alumni.update_fields">Update Alumni Fields</option>
                <option value="alumni.delete">Delete Alumni Record</option>
                <option value="alumni.create">Create / Register Alumni</option>
                <option value="alumni.change_password">Change Password</option>
                <option value="alumni.send_credentials">Send Login Credentials</option>
                <option value="alumni.upload_medal_document">Upload Medal Document</option>
                <option value="alumni.update_profile_picture">Update Profile Picture</option>
                <option value="alumni.update_social_links">Update Social Media Links</option>
                <option value="alumni.verify_image">Verify Alumni Image</option>
                <option value="ALUMNI_VERIFY">Verify Alumni (Approve)</option>
                <option value="ALUMNI_UNVERIFY">Unverify Alumni (Reject)</option>
              </optgroup>
              <optgroup label="Alumni Cards">
                <option value="alumni_cards.create">Create Alumni Card</option>
                <option value="alumni_cards.update">Update Alumni Card</option>
                <option value="alumni_cards.update_status">Change Card Status</option>
                <option value="alumni_cards.update_image">Update Card Image</option>
                <option value="alumni_cards.submit_revision">Submit Card Revision</option>
                <option value="alumni_cards.delete">Delete Alumni Card</option>
              </optgroup>
              <optgroup label="Users (Admin / Staff)">
                <option value="users.create">Create User</option>
                <option value="users.update">Update User</option>
                <option value="users.delete">Delete User</option>
                <option value="users.self_update">Update Own Profile</option>
              </optgroup>
              <optgroup label="Leadership">
                <option value="leadership">All Leadership Actions</option>
              </optgroup>
              <optgroup label="Success Stories">
                <option value="stories.create">Submit Story</option>
                <option value="stories.update">Update Story</option>
                <option value="stories.delete">Delete Story</option>
                <option value="stories.review">Approve / Reject Story</option>
              </optgroup>
              <optgroup label="Scholarships">
                <option value="scholarships.apply">Submit Scholarship Application</option>
                <option value="scholarships.update_status">Update Scholarship Status</option>
                <option value="scholarships.delete">Delete Scholarship Application</option>
              </optgroup>
              <optgroup label="Memberships">
                <option value="memberships.update_status">Update Membership Status</option>
                <option value="memberships.delete">Delete Membership</option>
                <option value="memberships.gym_submit">Submit Gym Membership</option>
                <option value="memberships.swimming_pool_submit">Submit Swimming Pool Membership</option>
                <option value="memberships.cricket_submit">Submit Cricket Membership</option>
              </optgroup>
              <optgroup label="Mentorship / Talks">
                <option value="talks.submit">Submit Talk Session</option>
                <option value="talks.update_status">Update Talk Status</option>
                <option value="talks.delete">Delete Talk Session</option>
              </optgroup>
              <optgroup label="Events">
                <option value="events.create">Create Event</option>
                <option value="events.update">Update Event</option>
                <option value="events.delete">Delete Event</option>
              </optgroup>
              <optgroup label="Jobs">
                <option value="jobs.create">Post Job</option>
                <option value="jobs.update">Update Job Posting</option>
                <option value="jobs.delete">Delete Job Posting</option>
              </optgroup>
              <optgroup label="Organization (Faculties / Departments / Programs)">
                <option value="organization.faculty">All Faculty Actions</option>
                <option value="organization.department">All Department Actions</option>
                <option value="organization.program">All Program Actions</option>
                <option value="organization.course">All Course Actions</option>
                <option value="organization.chapter">All Chapter Actions</option>
              </optgroup>
              <optgroup label="Settings & Configuration">
                <option value="settings.">All Settings Changes</option>
              </optgroup>
              <optgroup label="Admin Actions">
                <option value="admin.change_approval">Approve / Reject Profile Change Request</option>
                <option value="admin.newsletter">All Newsletter Actions</option>
                <option value="admin.fix_access_assignments">Fix Access Assignments</option>
              </optgroup>
              <optgroup label="Distinguished Alumni">
                <option value="distinguished_alumni.">All Distinguished Alumni Actions</option>
              </optgroup>
              <optgroup label="Merchants (Discount Partners)">
                <option value="merchants.">All Merchant Actions</option>
              </optgroup>
              <optgroup label="Email">
                <option value="email.">All Email Actions</option>
              </optgroup>
              <optgroup label="Authentication">
                <option value="auth.">All Auth Actions</option>
              </optgroup>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 dark:text-gray-300 dark:bg-gray-900">Actor User ID</label>
            <input
              value={actorUserId}
              onChange={(e) => setActorUserId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm dark:text-gray-300 dark:bg-gray-900"
              placeholder="123"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 dark:text-gray-300 dark:bg-gray-900">From</label>
            <input
              type="datetime-local"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm dark:text-gray-300 dark:bg-gray-900 dark:text-gray-300 dark:bg-gray-900"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 dark:text-gray-300 dark:bg-gray-900">To</label>
            <input
              type="datetime-local"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm dark:text-gray-300 dark:bg-gray-900 dark:text-gray-300 dark:bg-gray-900"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="text-sm text-gray-600 dark:text-gray-400 dark:text-gray-300 dark:bg-gray-900">
            {(() => {
              const shown = mainTab === "activity" ? activityData.items.length : loginData.items.length;
              const total = mainTab === "activity" ? activityData.total : loginData.total;
              return loading ? "Loading..." : `Showing ${shown.toLocaleString()} of ${total.toLocaleString()}`;
            })()}
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-600 dark:text-gray-400 dark:text-gray-300 dark:bg-gray-900">Rows</label>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-2 text-sm dark:text-gray-300 dark:bg-gray-900"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={(p) => setPage(Math.max(1, Math.min(totalPages, p)))}
            />
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:text-gray-300 dark:bg-gray-900">
            {error}
          </div>
        )}

        <div className="mt-4 overflow-hidden rounded-lg border border-gray-200 bg-white shadow dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-300 dark:bg-gray-900">
          <SyncedTableScroll minWidth={1400} maxHeight={750}>
            <Table className="min-w-full">
              <TableHeader className="bg-gray-50 dark:bg-gray-900/50 sticky top-0 z-10 dark:text-gray-300 dark:bg-gray-900">
                <TableRow className="border-b border-gray-200 dark:border-gray-700">
                  <TableCell className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 dark:bg-gray-900">Time</TableCell>
                  <TableCell className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 dark:bg-gray-900">Actor</TableCell>
                  {mainTab === "activity" ? (
                    <>
                      <TableCell className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 dark:bg-gray-900">Action</TableCell>
                      <TableCell className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 dark:bg-gray-900">Entity</TableCell>
                    </>
                  ) : (
                    <TableCell className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 dark:bg-gray-900">Identifier</TableCell>
                  )}
                  <TableCell className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 dark:bg-gray-900">Success</TableCell>
                  <TableCell className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 dark:bg-gray-900">IP</TableCell>
                  {mainTab === "activity" ? (
                    <TableCell className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 dark:bg-gray-900">Path</TableCell>
                  ) : (
                    <TableCell className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 dark:bg-gray-900">User Agent</TableCell>
                  )}
                  <TableCell className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 dark:bg-gray-900">Metadata</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
                {loading && (
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={`s-${i}`} className="dark:text-gray-300 dark:bg-gray-900">
                      <TableCell className="px-4 py-4 dark:text-gray-300 dark:bg-gray-900"><div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" /></TableCell>
                      <TableCell className="px-4 py-4 dark:text-gray-300 dark:bg-gray-900"><div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" /></TableCell>
                      <TableCell className="px-4 py-4 dark:text-gray-300 dark:bg-gray-900"><div className="h-4 w-40 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" /></TableCell>
                      <TableCell className="px-4 py-4 dark:text-gray-300 dark:bg-gray-900"><div className="h-4 w-40 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" /></TableCell>
                      <TableCell className="px-4 py-4 dark:text-gray-300 dark:bg-gray-900"><div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" /></TableCell>
                      <TableCell className="px-4 py-4 dark:text-gray-300 dark:bg-gray-900"><div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" /></TableCell>
                      <TableCell className="px-4 py-4 dark:text-gray-300 dark:bg-gray-900"><div className="h-4 w-40 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" /></TableCell>
                      <TableCell className="px-4 py-4 dark:text-gray-300 dark:bg-gray-900"><div className="h-4 w-56 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" /></TableCell>
                    </TableRow>
                  ))
                )}

                {!loading && (mainTab === "activity" ? activityData.items.length : loginData.items.length) === 0 && (
                  <TableRow>
                    <TableCell className="px-4 py-10 text-center text-gray-500 dark:text-gray-300 dark:bg-gray-900" colSpan={8}>
                      No logs found.
                    </TableCell>
                  </TableRow>
                )}

                {!loading && mainTab === "activity" && activityData.items.map((row) => (
                  <TableRow key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 dark:text-gray-300 dark:bg-gray-900">
                    <TableCell className="px-4 py-3 text-sm whitespace-nowrap">
                      {formatDateTime(row.created_at)}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm dark:text-gray-300 dark:bg-gray-900">
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-900 dark:text-white/90">
                          {row.actor_email || "-"}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {row.actor_type || "-"}{row.actor_user_id ? ` • #${row.actor_user_id}` : ""}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm dark:text-gray-300 dark:bg-gray-900">
                      <span title={row.action}>{friendlyAction(row.action)}</span>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm dark:text-gray-300 dark:bg-gray-900">
                      <span className="font-medium">{row.entity_type || "-"}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">{row.entity_id ? ` • ${row.entity_id}` : ""}</span>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm dark:text-gray-300 dark:bg-gray-900">
                      <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${row.success ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                        {row.success ? "Yes" : "No"}
                      </span>
                      {!row.success && row.error_message && (
                        <div className="text-xs text-rose-700 mt-1">{row.error_message}</div>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm font-mono text-xs dark:text-gray-300 dark:bg-gray-900">
                      {row.ip || "-"}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm font-mono text-xs dark:text-gray-300 dark:bg-gray-900">
                      {row.request_path || "-"}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-xs dark:text-gray-300 dark:bg-gray-900">
                      <details>
                        <summary className="cursor-pointer text-blue-700 dark:text-blue-400">View</summary>
                        <pre className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-gray-50 dark:bg-gray-900/60 p-3 border border-gray-200 dark:border-gray-700">
{stringifyMeta(row.metadata)}
                        </pre>
                      </details>
                    </TableCell>
                  </TableRow>
                ))}

                {!loading && mainTab === "login" && loginData.items.map((row) => (
                  <TableRow key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 dark:text-gray-300 dark:bg-gray-900">
                    <TableCell className="px-4 py-3 text-sm whitespace-nowrap">
                      {formatDateTime(row.created_at)}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm dark:text-gray-300 dark:bg-gray-900">
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-900 dark:text-white/90">
                          {row.actor_email || "-"}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 dark:bg-gray-900">
                          {row.actor_type || "-"}{row.actor_user_id ? ` • #${row.actor_user_id}` : ""}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm font-mono dark:text-gray-300 dark:bg-gray-900">
                      {row.identifier || "-"}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm dark:text-gray-300 dark:bg-gray-900">
                      <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${row.success ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                        {row.success ? "Yes" : "No"}
                      </span>
                      {!row.success && row.error_message && (
                        <div className="text-xs text-rose-700 mt-1">{row.error_message}</div>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm font-mono text-xs dark:text-gray-300 dark:bg-gray-900">
                      {row.ip || "-"}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm font-mono text-xs dark:text-gray-300 dark:bg-gray-900">
                      {row.user_agent || "-"}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-xs dark:text-gray-300 dark:bg-gray-900">
                      <details>
                        <summary className="cursor-pointer text-blue-700 dark:text-blue-400 dark:text-gray-300 dark:bg-gray-900">View</summary>
                        <pre className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-gray-50 dark:bg-gray-900/60 p-3 border border-gray-200 dark:border-gray-700 dark:text-gray-300 dark:bg-gray-900">
{stringifyMeta(row.metadata)}
                        </pre>
                      </details>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </SyncedTableScroll>
        </div>
      </div>
    </ComponentCard>
  );
}
