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
    <ComponentCard title="Activity logs" desc="Super Admin view to determine activities and logins.">
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
            <input
              value={action}
              onChange={(e) => setAction(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm dark:text-gray-300 dark:bg-gray-900"
              placeholder="users.create"
              disabled={mainTab !== "activity"}
            />
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
                    <TableCell className="px-4 py-3 text-sm font-mono dark:text-gray-300 dark:bg-gray-900">
                      {row.action}
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
