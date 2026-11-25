"use client";

import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import Pagination from "@/components/tables/Pagination";
import Badge from "../ui/badge/Badge";
import { AlumniExpandableDetails } from "@/components/alumni/AlumniExpandableDetails";
import { ErpDataDetails } from "@/components/alumni/ErpDataDetails";
import toast from "react-hot-toast";
import { Modal } from "@/components/ui/modal";
import { useModal } from "@/hooks/useModal";
import { SendEmailButton } from "@/components/email/SendEmailButton";
import { EMAIL_ACTION_TYPE, generateAdminActionEmail } from "@/lib/emailTemplates";

type TalkItem = {
  id: number;
  alumniId: number;
  sapid: string;
  registrationNo: string | null;
  name: string;
  department: string | null;
  faculty: string | null;
  program: string | null;
  email: string | null;
  status: string;
  topics: string[];
  areas: string[];
  mode: string | null;
  briefOutline: string | null;
  // Availability dates and timings
  date1: string | null;
  timings1: string | null;
  date2: string | null;
  timings2: string | null;
  date3: string | null;
  timings3: string | null;
  confirmedDate: string | null;
  confirmedTimings: string | null;
  adminProposedDate: string | null;
  adminProposedTimings: string | null;
  adminNote: string | null;
  alumniNote: string | null;
};

type StatusGroup = "pending" | "awaiting" | "confirmed" | "conducted" | "cancelled";

const STATUS_FILTERS: { key: "all" | StatusGroup; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending review" },
  { key: "awaiting", label: "Awaiting alumni" },
  { key: "confirmed", label: "Confirmed" },
  { key: "conducted", label: "Conducted" },
  { key: "cancelled", label: "Cancelled" },
];

function statusGroup(s: string | null | undefined): StatusGroup {
  const v = String(s || "").toLowerCase().trim();
  if (v === "admin_confirmed" || v === "alumni_confirmed") return "confirmed";
  if (v === "admin_proposed" || v === "reschedule_requested") return "awaiting";
  if (v === "conducted") return "conducted";
  if (v === "cancelled") return "cancelled";
  return "pending";
}

const RAIL_CLASS: Record<StatusGroup, string> = {
  pending: "border-l-amber-500",
  awaiting: "border-l-blue-500",
  confirmed: "border-l-emerald-500",
  conducted: "border-l-teal-600",
  cancelled: "border-l-rose-500",
};

const prettyStatus = (s: string | null | undefined) => {
  const v = String(s || "").toLowerCase().trim();
  if (!v) return "Pending";
  if (v === "admin_confirmed" || v === "alumni_confirmed") return "Confirmed";
  if (v === "admin_proposed") return "Pending Confirmation";
  if (v === "reschedule_requested") return "Reschedule Requested";
  if (v === "conducted") return "Conducted";
  if (v === "cancelled") return "Cancelled";
  return v;
};

const statusBadgeColor = (s: string | null | undefined): Parameters<typeof Badge>[0]["color"] => {
  const g = statusGroup(s);
  if (g === "confirmed" || g === "conducted") return "success";
  if (g === "awaiting") return "warning";
  if (g === "cancelled") return "error";
  return "info";
};

/** "2026-10-13" / "2026-10-13T00:00:00.000Z" → { day: "Mon", date: "13 Oct" }; falls back to raw text. */
function splitDateLabel(dateStr: string | null | undefined): { day: string; date: string } {
  const s = String(dateStr || "").trim();
  // API returns full ISO timestamps; take the calendar-date part to avoid TZ shifts.
  const datePart = /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : s;
  const d = datePart ? new Date(`${datePart}T00:00:00`) : null;
  if (!d || Number.isNaN(d.getTime())) return { day: "", date: s || "—" };
  return {
    day: d.toLocaleDateString("en-GB", { weekday: "short" }),
    date: d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
  };
}

/** "10:00-11:00" → "10:00 – 11:00" */
function prettyTimings(t: string | null | undefined): string {
  const s = String(t || "").trim();
  if (!s) return "—";
  const m = s.match(/^(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})$/);
  return m ? `${m[1]} – ${m[2]}` : s;
}

/** Squared timetable cell — the schedule's planner-grid vernacular. */
function SlotCell(props: {
  date: string | null;
  timings: string | null;
  caption?: string | null;
  tone: "offered" | "booked" | "counter";
  selected?: boolean;
  onSelect?: () => void;
  optionValue?: number;
}) {
  const { date, timings, caption, tone, selected, onSelect, optionValue } = props;
  const { day, date: dateLabel } = splitDateLabel(date);

  const toneClasses =
    tone === "booked"
      ? "bg-emerald-700 border-emerald-700 dark:bg-emerald-800 dark:border-emerald-800"
      : tone === "counter"
        ? "bg-amber-50 border-dashed border-amber-400 dark:bg-amber-950/30 dark:border-amber-600"
        : selected
          ? "bg-blue-50 border-blue-500 dark:bg-blue-950/40 dark:border-blue-500"
          : "bg-white border-gray-300 dark:bg-gray-950 dark:border-gray-700";

  const textClasses =
    tone === "booked"
      ? { caption: "text-emerald-200", day: "text-emerald-100", date: "text-white", timings: "text-emerald-50" }
      : tone === "counter"
        ? {
            caption: "text-amber-600 dark:text-amber-400",
            day: "text-amber-700 dark:text-amber-300",
            date: "text-amber-900 dark:text-amber-100",
            timings: "text-amber-800 dark:text-amber-200",
          }
        : {
            caption: "text-gray-400 dark:text-gray-500",
            day: "text-gray-500 dark:text-gray-400",
            date: "text-gray-900 dark:text-gray-100",
            timings: "text-gray-600 dark:text-gray-300",
          };

  const inner = (
    <>
      {caption ? (
        <div className={`text-[10px] font-medium leading-tight ${textClasses.caption}`}>{caption}</div>
      ) : null}
      <div className={`text-xs font-medium ${textClasses.day}`}>{day || "—"}</div>
      <div className={`text-lg font-semibold leading-tight ${textClasses.date}`}>{dateLabel}</div>
      <div className={`mt-1 text-sm tabular-nums ${textClasses.timings}`}>{prettyTimings(timings)}</div>
      {optionValue != null && onSelect ? (
        <div className={`mt-1.5 text-[11px] font-medium ${selected ? "text-blue-700 dark:text-blue-300" : textClasses.caption}`}>
          Option {optionValue}
        </div>
      ) : null}
    </>
  );

  const base =
    "w-full border-2 px-3 py-2.5 text-left leading-none transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500";

  if (onSelect) {
    return (
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={`${base} ${toneClasses} ${selected ? "" : "hover:border-gray-400 dark:hover:border-gray-500"}`}
      >
        {inner}
      </button>
    );
  }
  return <div className={`${base} ${toneClasses} cursor-default`}>{inner}</div>;
}

async function getAlumniTalks(): Promise<TalkItem[]> {
  const res = await fetch("/api/alumni/talks", {
    headers: { accept: "application/json" },
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) {
    let details = "";
    try {
      const data = (await res.json()) as { error?: string; message?: string; details?: string };
      details = data?.message || data?.details || data?.error || "";
    } catch {
      try {
        details = await res.text();
      } catch {}
    }
    const msg = details ? `Failed to fetch alumni talks (${res.status}): ${details}` : `Failed to fetch alumni talks (${res.status})`;
    throw new Error(msg);
  }
  const data = (await res.json()) as { items: TalkItem[] };
  // API returns `alumniid` (snake-ish). Map it to `alumniId` for UI + email logging.
  return (data.items ?? []).map((it: any) => ({
    ...it,
    alumniId: Number(it.alumniId ?? it.alumniid ?? 0),
  })) as TalkItem[];
}

export const AlumniTalksTab: React.FC = () => {
  const qc = useQueryClient();
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [query, setQuery] = useState<string>("");
  const [debouncedQuery, setDebouncedQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"all" | StatusGroup>("all");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<number | null>(null);
  const [confirmOptionById, setConfirmOptionById] = useState<Record<number, number>>({});
  const [proposeDateById, setProposeDateById] = useState<Record<number, string>>({});
  const [proposeStartById, setProposeStartById] = useState<Record<number, string>>({});
  const [proposeEndById, setProposeEndById] = useState<Record<number, string>>({});
  const [proposeNoteById, setProposeNoteById] = useState<Record<number, string>>({});

  const confirmModal = useModal();
  const deleteModal = useModal();
  const [pendingAction, setPendingAction] = useState<
    | {
        talkId: number;
        alumniId: number;
        alumniName: string;
        recipientEmail: string | null;
        title: string;
        body: Record<string, unknown>;
        emailActionType: string;
      }
    | null
  >(null);

  const [pendingDelete, setPendingDelete] = useState<
    | {
        talkId: number;
        alumniName: string;
      }
    | null
  >(null);

  async function doDeleteTalk(id: number) {
    try {
      setBusyId(id);
      const res = await fetch(`/api/alumni/talks?id=${encodeURIComponent(String(id))}`, {
        method: "DELETE",
        headers: { accept: "application/json" },
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!res.ok) throw new Error(data?.message || data?.error || `Failed (${res.status})`);
      await qc.invalidateQueries({ queryKey: ["alumni-talks"] });
      toast.success("Deleted successfully");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusyId(null);
    }
  }

  const openDelete = (item: TalkItem) => {
    setPendingDelete({ talkId: item.id, alumniName: item.name });
    deleteModal.openModal();
  };

  async function doAdminAction(id: number, body: Record<string, unknown>) {
    try {
      setBusyId(id);
      const res = await fetch(`/api/alumni/talks?id=${encodeURIComponent(String(id))}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!res.ok) throw new Error(data?.message || data?.error || `Failed (${res.status})`);
      await qc.invalidateQueries({ queryKey: ["alumni-talks"] });
      toast.success("Updated successfully");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusyId(null);
    }
  }

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const { data: items = [], isLoading, isError, error } = useQuery<TalkItem[], Error>({
    queryKey: ["alumni-talks"],
    queryFn: getAlumniTalks,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const openConfirm = (input: {
    item: TalkItem;
    title: string;
    body: Record<string, unknown>;
    emailActionType: string;
  }) => {
    setPendingAction({
      talkId: input.item.id,
      alumniId: input.item.alumniId,
      alumniName: input.item.name,
      recipientEmail: input.item.email ?? null,
      title: input.title,
      body: input.body,
      emailActionType: input.emailActionType,
    });
    confirmModal.openModal();
  };

  const groupCounts = useMemo(() => {
    const counts: Record<"all" | StatusGroup, number> = {
      all: items.length,
      pending: 0,
      awaiting: 0,
      confirmed: 0,
      conducted: 0,
      cancelled: 0,
    };
    for (const item of items) counts[statusGroup(item.status)] += 1;
    return counts;
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = debouncedQuery.toLowerCase();
    return items.filter((item) => {
      if (statusFilter !== "all" && statusGroup(item.status) !== statusFilter) return false;
      if (!q) return true;
      return (
        item.sapid?.toLowerCase().includes(q) ||
        item.registrationNo?.toLowerCase().includes(q) ||
        item.name?.toLowerCase().includes(q) ||
        item.email?.toLowerCase().includes(q) ||
        item.department?.toLowerCase().includes(q) ||
        item.faculty?.toLowerCase().includes(q) ||
        item.topics?.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [items, debouncedQuery, statusFilter]);

  const total = filteredItems.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const start = (safePage - 1) * pageSize;
  const end = start + pageSize;
  const pageItems = filteredItems.slice(start, end);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [debouncedQuery, pageSize, statusFilter]);

  const inputClass =
    "text-xs border border-gray-300 rounded px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100";

  return (
    <div className="space-y-4">
      <Modal
        isOpen={deleteModal.isOpen}
        onClose={() => {
          deleteModal.closeModal();
          setPendingDelete(null);
        }}
        showCloseButton={true}
        className="max-w-md"
      >
        <div className="p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Delete alumni talk</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">This action cannot be undone.</p>
          {pendingDelete?.alumniName ? <p className="text-sm text-gray-700 dark:text-gray-300">Alumni: {pendingDelete.alumniName}</p> : null}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                deleteModal.closeModal();
                setPendingDelete(null);
              }}
              className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
              disabled={busyId !== null}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={async () => {
                if (!pendingDelete) return;
                await doDeleteTalk(pendingDelete.talkId);
                deleteModal.closeModal();
                setPendingDelete(null);
              }}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-white bg-error-600 hover:bg-error-700 disabled:opacity-60"
              disabled={busyId !== null || !pendingDelete}
            >
              Delete
            </button>
          </div>
        </div>
      </Modal>

      {/* Toolbar: status pipeline chips + search */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by status">
          {STATUS_FILTERS.map((f) => {
            const active = statusFilter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setStatusFilter(f.key)}
                aria-pressed={active}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  active
                    ? "border-gray-900 bg-gray-900 text-white dark:border-gray-100 dark:bg-gray-100 dark:text-gray-900"
                    : "border-gray-300 bg-white text-gray-600 hover:border-gray-400 hover:text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:border-gray-500 dark:hover:text-gray-100"
                }`}
              >
                {f.label}
                <span className={`tabular-nums ${active ? "opacity-70" : "text-gray-400 dark:text-gray-500"}`}>
                  {groupCounts[f.key]}
                </span>
              </button>
            );
          })}
        </div>
        <div className="ml-auto">
          <label className="sr-only" htmlFor="talks-search">Search alumni talks</label>
          <input
            id="talks-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, SAP ID, topic…"
            className="w-56 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
      </div>

      {/* Session sheets */}
      <div className="space-y-3" role="list">
        {isLoading &&
          Array.from({ length: 3 }).map((_, i) => (
            <div
              key={`skeleton-${i}`}
              className="rounded-lg border-2 border-l-4 border-gray-200 border-l-gray-300 bg-white p-4 dark:border-gray-800 dark:border-l-gray-600 dark:bg-gray-900"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="h-4 w-44 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                  <div className="h-3 w-64 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
                </div>
                <div className="h-6 w-24 animate-pulse rounded-full bg-gray-200 dark:bg-gray-700" />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 max-w-md">
                {Array.from({ length: 3 }).map((__, j) => (
                  <div key={j} className="h-20 animate-pulse rounded-none bg-gray-100 dark:bg-gray-800" />
                ))}
              </div>
            </div>
          ))}

        {!isLoading && isError && (
          <div className="rounded-lg border-2 border-error-200 bg-error-50 p-6 text-center text-sm text-error-700 dark:border-error-800 dark:bg-error-950/40 dark:text-error-300">
            {error?.message || "Failed to load data"}
          </div>
        )}

        {!isLoading && !isError && pageItems.length === 0 && (
          <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-10 text-center dark:border-gray-700 dark:bg-gray-900">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-200">
              {statusFilter === "all" && !debouncedQuery ? "No talk sessions yet" : "No sessions match this view"}
            </div>
            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {statusFilter === "all" && !debouncedQuery
                ? "Sessions appear here when alumni submit availability."
                : "Try a different status or clear the search."}
            </div>
          </div>
        )}

        {!isLoading && !isError && pageItems.map((item) => {
          const rowId = String(item.id);
          const isExpanded = expandedRows.has(rowId);
          const isBusy = busyId === item.id;
          const group = statusGroup(item.status);

          const availabilityOptions = [
            { option: 1, date: item.date1, timings: item.timings1 },
            { option: 2, date: item.date2, timings: item.timings2 },
            { option: 3, date: item.date3, timings: item.timings3 },
          ].filter((o) => o.date && o.timings);

          const isTerminal = group === "conducted" || group === "cancelled";
          const canConfirm = !isTerminal && availabilityOptions.length > 0;
          const canMarkConducted = group === "confirmed";
          const canCancel = !isTerminal;
          const selectedOption = confirmOptionById[item.id];

          const metaLine = [
            item.sapid || item.registrationNo || null,
            item.faculty,
            item.department,
          ]
            .filter(Boolean)
            .join(" · ");

          return (
            <article
              key={rowId}
              role="listitem"
              className={`rounded-lg border-2 border-l-4 border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 ${RAIL_CLASS[group]} ${isBusy ? "opacity-70" : ""}`}
            >
              {/* Header: speaker + status */}
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-4 pt-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-3">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{item.name}</h3>
                    <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400">
                      {metaLine || "—"}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-600 dark:text-gray-300">
                    {item.topics.length > 0 ? (
                      <span className="font-medium text-gray-800 dark:text-gray-200">
                        {item.topics.join(", ")}
                      </span>
                    ) : null}
                    {item.mode ? (
                      <span className="text-gray-400 dark:text-gray-500">· {item.mode}</span>
                    ) : null}
                    {item.email ? (
                      <a href={`mailto:${item.email}`} className="text-blue-600 hover:underline dark:text-blue-400">
                        {item.email}
                      </a>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge size="sm" color={statusBadgeColor(item.status)}>
                    {prettyStatus(item.status)}
                  </Badge>
                  <button
                    type="button"
                    onClick={() => {
                      setExpandedRows((prev) => {
                        const next = new Set(prev);
                        if (next.has(rowId)) next.delete(rowId);
                        else next.add(rowId);
                        return next;
                      });
                    }}
                    aria-expanded={isExpanded}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                  >
                    Details
                    <svg
                      className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Timetable strip */}
              <div className="px-4 pt-3">
                <div className="grid grid-cols-3 gap-2">
                  {availabilityOptions.length > 0 ? (
                    availabilityOptions.map((o) => (
                      <SlotCell
                        key={o.option}
                        date={o.date}
                        timings={o.timings}
                        tone="offered"
                        optionValue={o.option}
                        selected={selectedOption === o.option}
                        onSelect={
                          canConfirm
                            ? () =>
                                setConfirmOptionById((p) => ({
                                  ...p,
                                  [item.id]: p[item.id] === o.option ? (0 as number) : o.option,
                                }))
                            : undefined
                        }
                      />
                    ))
                  ) : (
                    <div className="col-span-3 border-2 border-dashed border-gray-200 px-3 py-3 text-xs text-gray-400 dark:border-gray-700 dark:text-gray-500">
                      No availability offered
                    </div>
                  )}
                </div>
                {(item.adminProposedDate || item.confirmedDate) && (
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {item.confirmedDate ? (
                      <SlotCell date={item.confirmedDate} timings={item.confirmedTimings} caption="Booked" tone="booked" />
                    ) : null}
                    {item.adminProposedDate ? (
                      <SlotCell
                        date={item.adminProposedDate}
                        timings={item.adminProposedTimings}
                        caption="Admin counter-offer"
                        tone="counter"
                      />
                    ) : null}
                  </div>
                )}
                <div className="pb-1" />
              </div>

              {/* Action row */}
              <div className="flex flex-wrap items-center gap-2 px-4 pb-4">
                {canConfirm ? (
                  <button
                    type="button"
                    disabled={isBusy || !selectedOption}
                    onClick={() =>
                      openConfirm({
                        item,
                        title: "Confirm Talk Session",
                        body: { action: "confirm_option", option: selectedOption },
                        emailActionType: EMAIL_ACTION_TYPE.ALUMNI_TALK_CONFIRM,
                      })
                    }
                    className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                  >
                    {selectedOption ? `Confirm option ${selectedOption}` : "Select a slot to confirm"}
                  </button>
                ) : null}
                {canMarkConducted ? (
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() =>
                      openConfirm({
                        item,
                        title: "Mark Talk as Conducted",
                        body: { action: "mark_conducted" },
                        emailActionType: EMAIL_ACTION_TYPE.ALUMNI_TALK_MARK_CONDUCTED,
                      })
                    }
                    className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
                  >
                    Mark conducted
                  </button>
                ) : null}
                {canCancel ? (
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() =>
                      openConfirm({
                        item,
                        title: "Cancel Talk Session",
                        body: { action: "cancel" },
                        emailActionType: EMAIL_ACTION_TYPE.ALUMNI_TALK_CANCEL,
                      })
                    }
                    className="rounded-md border border-error-300 bg-error-50 px-3 py-1.5 text-xs font-semibold text-error-700 hover:bg-error-100 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-error-500 dark:border-error-700 dark:bg-error-950/40 dark:text-error-300 dark:hover:bg-error-900/40"
                  >
                    Cancel session
                  </button>
                ) : null}
                <div className="ml-auto">
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => openDelete(item)}
                    className="rounded-md px-3 py-1.5 text-xs font-medium text-gray-400 hover:bg-error-50 hover:text-error-700 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-error-500 dark:hover:bg-error-950/40 dark:hover:text-error-300"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Expanded details */}
              {isExpanded ? (
                <div className="border-t border-gray-200 px-4 py-4 dark:border-gray-800">
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <div className="space-y-3 text-xs">
                      <h4 className="font-semibold text-gray-800 dark:text-gray-200">Session detail</h4>
                      {item.briefOutline ? (
                        <div>
                          <div className="font-medium text-gray-700 dark:text-gray-300">Brief outline</div>
                          <p className="mt-1 whitespace-pre-wrap text-gray-600 dark:text-gray-400">{item.briefOutline}</p>
                        </div>
                      ) : null}
                      {item.alumniNote ? (
                        <div>
                          <div className="font-medium text-gray-700 dark:text-gray-300">Alumni note</div>
                          <p className="mt-1 whitespace-pre-wrap text-gray-600 dark:text-gray-400">{item.alumniNote}</p>
                        </div>
                      ) : null}
                      {item.adminNote ? (
                        <div>
                          <div className="font-medium text-gray-700 dark:text-gray-300">Admin note</div>
                          <p className="mt-1 whitespace-pre-wrap text-gray-600 dark:text-gray-400">{item.adminNote}</p>
                        </div>
                      ) : null}
                      {!item.briefOutline && !item.alumniNote && !item.adminNote ? (
                        <div className="text-gray-400 dark:text-gray-500">No outline or notes recorded.</div>
                      ) : null}
                      {item.areas.length > 0 ? (
                        <div>
                          <div className="mb-1 font-medium text-gray-700 dark:text-gray-300">Areas</div>
                          <div className="flex flex-wrap gap-1">
                            {item.areas.map((area, i) => (
                              <Badge key={i} size="sm" color="success">{area}</Badge>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className="space-y-3 text-xs">
                      <h4 className="font-semibold text-gray-800 dark:text-gray-200">Propose a different slot</h4>
                      <div className="space-y-2 rounded-md border border-gray-200 bg-gray-50/60 p-3 dark:border-gray-700 dark:bg-gray-800/50">
                        <label className="sr-only" htmlFor={`propose-date-${item.id}`}>Proposed date</label>
                        <input
                          id={`propose-date-${item.id}`}
                          type="date"
                          value={proposeDateById[item.id] ?? ""}
                          onChange={(e) => setProposeDateById((p) => ({ ...p, [item.id]: e.target.value }))}
                          className={`${inputClass} w-full`}
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="sr-only" htmlFor={`propose-start-${item.id}`}>Start time</label>
                            <input
                              id={`propose-start-${item.id}`}
                              type="time"
                              value={proposeStartById[item.id] ?? ""}
                              onChange={(e) => setProposeStartById((p) => ({ ...p, [item.id]: e.target.value }))}
                              className={`${inputClass} w-full`}
                            />
                          </div>
                          <div>
                            <label className="sr-only" htmlFor={`propose-end-${item.id}`}>End time</label>
                            <input
                              id={`propose-end-${item.id}`}
                              type="time"
                              value={proposeEndById[item.id] ?? ""}
                              onChange={(e) => setProposeEndById((p) => ({ ...p, [item.id]: e.target.value }))}
                              className={`${inputClass} w-full`}
                            />
                          </div>
                        </div>
                        <label className="sr-only" htmlFor={`propose-note-${item.id}`}>Note for alumni</label>
                        <textarea
                          id={`propose-note-${item.id}`}
                          rows={2}
                          value={proposeNoteById[item.id] ?? ""}
                          onChange={(e) => setProposeNoteById((p) => ({ ...p, [item.id]: e.target.value }))}
                          className={`${inputClass} w-full`}
                          placeholder="Optional note for the alumni"
                        />
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => {
                            const d = proposeDateById[item.id] ?? "";
                            const st = proposeStartById[item.id] ?? "";
                            const en = proposeEndById[item.id] ?? "";
                            const timings = st && en ? `${st}-${en}` : "";
                            openConfirm({
                              item,
                              title: "Propose New Slot",
                              body: { action: "propose", date: d, timings, note: proposeNoteById[item.id] ?? "" },
                              emailActionType: EMAIL_ACTION_TYPE.ALUMNI_TALK_PROPOSE_SLOT,
                            });
                          }}
                          className="w-full rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                        >
                          Send counter-offer
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 border-t border-gray-100 pt-4 dark:border-gray-800">
                    <div className="flex flex-row justify-start gap-3">
                      <AlumniExpandableDetails
                        sapId={item.sapid || item.registrationNo || ""}
                        onClose={() =>
                          setExpandedRows((prev) => {
                            const next = new Set(prev);
                            next.delete(rowId);
                            return next;
                          })
                        }
                      />
                      <ErpDataDetails
                        sapId={item.sapid || undefined}
                        registrationNo={item.registrationNo || undefined}
                        onClose={() =>
                          setExpandedRows((prev) => {
                            const next = new Set(prev);
                            next.delete(rowId);
                            return next;
                          })
                        }
                      />
                    </div>
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      {/* Footer */}
      {!isLoading && !isError && total > 0 ? (
        <div className="flex items-center justify-between border-t border-gray-200 pt-3 dark:border-gray-800">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Showing {pageItems.length ? start + 1 : 0}-{pageItems.length ? start + pageItems.length : 0} of {total}
          </span>
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-500 dark:text-gray-400" htmlFor="talks-page-size">Items per page:</label>
            <select
              id="talks-page-size"
              className="rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
          </div>
        </div>
      ) : null}

      <Modal
        isOpen={confirmModal.isOpen}
        onClose={() => {
          confirmModal.closeModal();
          setPendingAction(null);
        }}
        showCloseButton={true}
        className="max-w-xl mx-auto"
      >
        <div className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{pendingAction?.title || "Confirm Action"}</h2>
          <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
            This action will update the talk status for <strong>{pendingAction?.alumniName || "Alumni"}</strong>.
          </p>

          {pendingAction?.recipientEmail ? (
            <div className="mt-5">
              {(() => {
                const tpl = generateAdminActionEmail({
                  actionType: pendingAction.emailActionType as any,
                  alumniName: pendingAction.alumniName,
                });
                return (
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 p-4">
                    <div>
                      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Preview Email</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">Preview and edit before sending</div>
                    </div>
                    <SendEmailButton
                      alumniId={pendingAction.alumniId}
                      recipientEmail={pendingAction.recipientEmail}
                      actionType={pendingAction.emailActionType}
                      initialSubject={tpl.subject}
                      initialBody={tpl.html}
                    />
                  </div>
                );
              })()}
            </div>
          ) : (
            <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              No recipient email found for this alumni. You can still confirm the action, but you cannot send an email.
            </div>
          )}

          <div className="mt-6 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                confirmModal.closeModal();
                setPendingAction(null);
              }}
              className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={async () => {
                if (!pendingAction) return;
                await doAdminAction(pendingAction.talkId, pendingAction.body);
                confirmModal.closeModal();
                setPendingAction(null);
              }}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700"
            >
              Confirm
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
