"use client";

import React, { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useAlumniTalks, type AlumniTalkItem, alumniTalksKey } from "@/app/queries/fetch-alumni-talks";
import { useQueryClient } from "@tanstack/react-query";

type TabKey = "all" | "pending" | "pending_confirmation" | "confirmed" | "conducted" | "cancelled";

function formatDate(d: string | null | undefined): string {
  if (!d) return "-";
  try {
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return String(d);
    return dt.toLocaleDateString();
  } catch {
    return String(d);
  }
}

function prettyStatus(s: string | null | undefined): string {
  const v = String(s || "").trim();
  if (!v) return "Pending";
  if (v === "admin_confirmed" || v === "alumni_confirmed") return "Confirmed";
  if (v === "admin_proposed") return "Pending Confirmation";
  if (v === "reschedule_requested") return "Reschedule Requested";
  if (v === "conducted") return "Conducted";
  if (v === "cancelled") return "Cancelled";
  return v;
}

function matchesTab(t: AlumniTalkItem, tab: TabKey): boolean {
  const s = String(t.status || "pending");
  if (tab === "all") return true;
  if (tab === "pending") return s === "pending" || s === "reschedule_requested";
  if (tab === "pending_confirmation") return s === "admin_proposed";
  if (tab === "confirmed") return s === "admin_confirmed" || s === "alumni_confirmed";
  if (tab === "conducted") return s === "conducted";
  if (tab === "cancelled") return s === "cancelled";
  return true;
}

export default function AlumniTalksPageClient() {
  const qc = useQueryClient();
  const { data: items = [], isLoading, isError, error, isFetching } = useAlumniTalks();
  const [tab, setTab] = useState<TabKey>("all");
  const [query, setQuery] = useState<string>("");
  const [busyId, setBusyId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((t) => matchesTab(t, tab))
      .filter((t) => {
        if (!q) return true;
        const hay = [
          t.topic,
          t.activity,
          t.mode,
          t.status,
          t.confirmed_date,
          t.confirmed_timings,
          t.admin_proposed_date,
          t.admin_proposed_timings,
        ]
          .map((x) => String(x || ""))
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
  }, [items, query, tab]);

  async function doAction(id: number, action: "confirm_proposed" | "cancel") {
    try {
      setBusyId(id);
      const res = await fetch(`/api/alumni/talks?id=${encodeURIComponent(String(id))}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!res.ok) throw new Error(data?.message || data?.error || `Failed (${res.status})`);
      await qc.invalidateQueries({ queryKey: alumniTalksKey });
      toast.success("Updated successfully");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusyId(null);
    }
  }

  const tabs: Array<{ key: TabKey; label: string }>= [
    { key: "all", label: "All" },
    { key: "pending", label: "Pending" },
    { key: "pending_confirmation", label: "Pending Confirmation" },
    { key: "confirmed", label: "Confirmed" },
    { key: "conducted", label: "Conducted" },
    { key: "cancelled", label: "Cancelled" },
  ];

  return (
    <div className="space-y-5 dark:bg-gray-900 dark:text-gray-100">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`rounded-full border px-4 py-2 text-xs font-semibold ${
                tab === t.key
                  ? "border-[#183D32] bg-[#183D32] text-white"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 dark:text-gray-400" htmlFor="talks-search">Search:</label>
          <input
            id="talks-search"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search topic, status, date..."
            className="w-full sm:w-[320px] rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {(isLoading || isFetching) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-48 rounded-xl bg-gray-200 animate-pulse" />
          ))}
        </div>
      )}

      {isError && !isLoading && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-amber-700">
          {error?.message || "Unable to load talks"}
        </div>
      )}

      {!isLoading && !isError && filtered.length === 0 && (
        <div className="text-center py-10 text-gray-600 dark:text-gray-400">No talks found.</div>
      )}

      {!isLoading && !isError && filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((t) => {
            const statusLabel = prettyStatus(t.status);
            const hasAdminProposal = String(t.status || "") === "admin_proposed";
            const isBusy = busyId === t.id;

            return (
              <div key={t.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 truncate">{t.topic || "Untitled Talk"}</div>
                    <div className="mt-1 text-xs text-gray-600">Submitted: {formatDate(t.created_at)}</div>
                  </div>
                  <span className="shrink-0 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-[11px] font-semibold text-gray-700">
                    {statusLabel}
                  </span>
                </div>

                <div className="mt-3 space-y-2 text-xs text-gray-700">
                  <div><span className="font-semibold">Mode:</span> {t.mode || "-"}</div>
                  <div><span className="font-semibold">Area:</span> {t.activity || "-"}</div>

                  {(t.confirmed_date || t.confirmed_timings) && (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                      <div className="font-semibold text-emerald-800">Confirmed Schedule</div>
                      <div className="text-emerald-800">{formatDate(t.confirmed_date)} {t.confirmed_timings ? `(${t.confirmed_timings})` : ""}</div>
                    </div>
                  )}

                  {hasAdminProposal && (
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                      <div className="font-semibold text-blue-800">Admin Proposed</div>
                      <div className="text-blue-800">{formatDate(t.admin_proposed_date)} {t.admin_proposed_timings ? `(${t.admin_proposed_timings})` : ""}</div>
                      {t.admin_note ? <div className="mt-2 text-blue-800">{t.admin_note}</div> : null}
                    </div>
                  )}

                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <div className="font-semibold text-gray-800">Your Availability</div>
                    <div className="mt-1 space-y-1">
                      <div>1) {formatDate(t.date_1)} {t.timings_1 ? `(${t.timings_1})` : ""}</div>
                      <div>2) {formatDate(t.date_2)} {t.timings_2 ? `(${t.timings_2})` : ""}</div>
                      <div>3) {formatDate(t.date_3)} {t.timings_3 ? `(${t.timings_3})` : ""}</div>
                    </div>
                  </div>
                </div>

                {hasAdminProposal && (
                  <div className="mt-4 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => doAction(t.id, "confirm_proposed")}
                      disabled={isBusy}
                      className="inline-flex flex-1 items-center justify-center rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      onClick={() => doAction(t.id, "cancel")}
                      disabled={isBusy}
                      className="inline-flex flex-1 items-center justify-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
