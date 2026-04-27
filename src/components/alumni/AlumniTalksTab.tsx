"use client";

import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { Table, TableHeader, TableBody, TableCell, TableRow } from "@/components/ui/table";
import Pagination from "@/components/tables/Pagination";
import Badge from "../ui/badge/Badge";
import SyncedTableScroll from "@/components/tables/SyncedTableScroll";
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
    const v = String(s || "").toLowerCase().trim();
    if (v === "conducted") return "success";
    if (v === "admin_confirmed" || v === "alumni_confirmed") return "success";
    if (v === "admin_proposed") return "warning";
    if (v === "cancelled") return "error";
    if (v === "reschedule_requested") return "warning";
    return "info";
  };

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

  const filteredItems = useMemo(() => {
    const q = debouncedQuery.toLowerCase();
    if (!q) return items;
    return items.filter((item) =>
      item.sapid?.toLowerCase().includes(q) ||
      item.name?.toLowerCase().includes(q) ||
      item.email?.toLowerCase().includes(q) ||
      item.department?.toLowerCase().includes(q) ||
      item.faculty?.toLowerCase().includes(q)
    );
  }, [items, debouncedQuery]);

  const total = filteredItems.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const start = (safePage - 1) * pageSize;
  const end = start + pageSize;
  const pageItems = filteredItems.slice(start, end);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [debouncedQuery, pageSize]);

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
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Delete alumni talk</h3>
          <p className="text-sm text-slate-600">This action cannot be undone.</p>
          {pendingDelete?.alumniName ? <p className="text-sm text-slate-700 dark:text-slate-300">Alumni: {pendingDelete.alumniName}</p> : null}
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
              className="rounded-lg px-4 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-60"
              disabled={busyId !== null || !pendingDelete}
            >
              Delete
            </button>
          </div>
        </div>
      </Modal>

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Alumni Talks</h3>
        <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 dark:text-gray-400" htmlFor="talks-search">Search:</label>
          <input
            id="talks-search"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, SAP ID, email..."
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border-2 border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <SyncedTableScroll minWidth={1300} maxHeight={700}>
          <Table className="min-w-full">
            <TableHeader className="sticky top-0 z-10 border-b-2 border-gray-300 bg-gradient-to-r from-slate-50 to-slate-100 dark:border-gray-700 dark:from-gray-800 dark:to-gray-900">
              <TableRow>
                <TableCell isHeader className="px-4 py-3 text-left text-xs font-semibold text-slate-700 w-12">{null}</TableCell>
                <TableCell className="px-4 py-3 text-left text-xs font-semibold text-slate-700">SAP ID / Reg No</TableCell>
                <TableCell className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Full Name</TableCell>
                <TableCell className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Email</TableCell>
                <TableCell className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Faculty</TableCell>
                <TableCell className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Department</TableCell>
                <TableCell className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Status</TableCell>
                <TableCell className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Topic</TableCell>
                <TableCell className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Mode</TableCell>
                <TableCell className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Availability</TableCell>
                <TableCell className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Actions</TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={`skeleton-${i}`}>
                    <TableCell className="px-2 py-3"><div className="h-4 w-4 bg-gray-200 animate-pulse rounded" /></TableCell>
                    <TableCell className="px-4 py-3"><div className="h-4 w-24 bg-gray-200 animate-pulse rounded" /></TableCell>
                    <TableCell className="px-4 py-3"><div className="h-4 w-32 bg-gray-200 animate-pulse rounded" /></TableCell>
                    <TableCell className="px-4 py-3"><div className="h-4 w-40 bg-gray-200 animate-pulse rounded" /></TableCell>
                    <TableCell className="px-4 py-3"><div className="h-4 w-28 bg-gray-200 animate-pulse rounded" /></TableCell>
                    <TableCell className="px-4 py-3"><div className="h-4 w-32 bg-gray-200 animate-pulse rounded" /></TableCell>
                    <TableCell className="px-4 py-3"><div className="h-4 w-20 bg-gray-200 animate-pulse rounded" /></TableCell>
                    <TableCell className="px-4 py-3"><div className="h-4 w-40 bg-gray-200 animate-pulse rounded" /></TableCell>
                    <TableCell className="px-4 py-3"><div className="h-4 w-20 bg-gray-200 animate-pulse rounded" /></TableCell>
                    <TableCell className="px-4 py-3"><div className="h-4 w-32 bg-gray-200 animate-pulse rounded" /></TableCell>
                    <TableCell className="px-4 py-3"><div className="h-4 w-28 bg-gray-200 animate-pulse rounded" /></TableCell>
                  </TableRow>
                ))
              )}
              {!isLoading && isError && (
                <TableRow>
                  <TableCell colSpan={11} className="px-5 py-6 text-center text-red-600">
                    {error?.message || "Failed to load data"}
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && !isError && pageItems.length === 0 && (
                <TableRow>
                  <TableCell colSpan={11} className="px-5 py-8 text-center text-gray-600">
                    No alumni talks found
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && !isError && pageItems.map((item, idx) => {
                const rowId = String(item.id);
                const isExpanded = expandedRows.has(rowId);
                const isBusy = busyId === item.id;
                
                // Build availability options
                const availabilityOptions = [];
                if (item.date1 && item.timings1) {
                  availabilityOptions.push({ date: item.date1, timings: item.timings1, label: "Option 1" });
                }
                if (item.date2 && item.timings2) {
                  availabilityOptions.push({ date: item.date2, timings: item.timings2, label: "Option 2" });
                }
                if (item.date3 && item.timings3) {
                  availabilityOptions.push({ date: item.date3, timings: item.timings3, label: "Option 3" });
                }
                
                return (
                  <React.Fragment key={rowId}>
                    <TableRow className="odd:bg-white even:bg-gray-50/50 hover:bg-blue-50/50 dark:odd:bg-gray-900 dark:even:bg-gray-800/70 dark:hover:bg-blue-900/20">
                      <TableCell className="px-2 py-3">
                        <button
                          type="button"
                          onClick={() => {
                            setExpandedRows(prev => {
                              const next = new Set(prev);
                              if (next.has(rowId)) {
                                next.delete(rowId);
                              } else {
                                next.add(rowId);
                              }
                              return next;
                            });
                          }}
                          className="p-1 hover:bg-gray-200 rounded transition-colors"
                          aria-label={isExpanded ? "Collapse" : "Expand"}
                        >
                          <svg
                            className={`w-4 h-4 text-gray-600 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-xs font-mono text-slate-700">
                        {item.sapid || item.registrationNo || "-"}
                        {item.sapid && item.registrationNo && (
                          <span className="block text-xs text-gray-500">{item.registrationNo}</span>
                        )}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-xs font-semibold text-slate-900">{item.name}</TableCell>
                      <TableCell className="px-4 py-3 text-xs">
                        <a href={item.email ? `mailto:${item.email}` : "#"} className="text-blue-600 hover:underline truncate block max-w-[200px]">
                          {item.email || "-"}
                        </a>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-xs text-slate-700">{item.faculty || "-"}</TableCell>
                      <TableCell className="px-4 py-3 text-xs text-slate-700">{item.department || "-"}</TableCell>
                      <TableCell className="px-4 py-3 text-xs">
                        <Badge size="sm" color={statusBadgeColor(item.status)}>
                          {prettyStatus(item.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-xs">
                        {item.topics.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {item.topics.slice(0, 2).map((topic, i) => (
                              <Badge key={i} size="sm" color="info">{topic}</Badge>
                            ))}
                            {item.topics.length > 2 && <span className="text-xs text-gray-500">+{item.topics.length - 2}</span>}
                          </div>
                        ) : "-"}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-xs text-slate-700">{item.mode || "-"}</TableCell>
                      <TableCell className="px-4 py-3 text-xs">
                        {availabilityOptions.length > 0 ? (
                          <select className="text-xs border border-gray-300 rounded px-2 py-1 bg-white">
                            {availabilityOptions.map((opt, i) => (
                              <option key={i} value={i}>
                                {opt.date} ({opt.timings})
                              </option>
                            ))}
                          </select>
                        ) : "-"}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-xs">
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-2">
                            <select
                              className="text-xs border border-gray-300 rounded px-2 py-1 bg-white"
                              value={confirmOptionById[item.id] ?? ""}
                              onChange={(e) => setConfirmOptionById((p) => ({ ...p, [item.id]: Number(e.target.value) }))}
                            >
                              <option value="">Confirm option</option>
                              <option value={1}>Option 1</option>
                              <option value={2}>Option 2</option>
                              <option value={3}>Option 3</option>
                            </select>
                            <button
                              type="button"
                              disabled={isBusy || !confirmOptionById[item.id]}
                              onClick={() =>
                                openConfirm({
                                  item,
                                  title: "Confirm Talk Session",
                                  body: { action: "confirm_option", option: confirmOptionById[item.id] },
                                  emailActionType: EMAIL_ACTION_TYPE.ALUMNI_TALK_CONFIRM,
                                })
                              }
                              className="rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                            >
                              Confirm
                            </button>
                          </div>

                          <div className="flex items-center gap-2">
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
                              className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                            >
                              Mark Conducted
                            </button>
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
                              className="rounded-md border border-rose-300 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => openDelete(item)}
                              className="rounded-md border border-rose-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow className="bg-blue-50/30 dark:bg-blue-900/10">
                        <TableCell colSpan={11} className="px-4 py-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                            {/* Basic Info */}
                            <div className="space-y-2">
                              <h4 className="mb-2 font-semibold text-slate-700 dark:text-slate-200">Basic Information</h4>
                              <div><span className="font-medium">Status:</span> {prettyStatus(item.status)}</div>
                              {item.alumniNote ? (
                                <div className="mt-2">
                                  <span className="font-medium">Alumni Note:</span>
                                  <p className="mt-1 text-gray-600 whitespace-pre-wrap">{item.alumniNote}</p>
                                </div>
                              ) : null}
                              {item.briefOutline && (
                                <div className="mt-2">
                                  <span className="font-medium">Brief Outline:</span>
                                  <p className="mt-1 text-gray-600 whitespace-pre-wrap">{item.briefOutline}</p>
                                </div>
                              )}
                            </div>
                            
                            {/* Availability Dates */}
                            <div className="space-y-2">
                              <h4 className="mb-2 font-semibold text-slate-700 dark:text-slate-200">Availability Dates</h4>
                              {availabilityOptions.length > 0 ? (
                                availabilityOptions.map((opt, i) => (
                                  <div key={i} className="rounded border border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-800">
                                    <div className="font-medium">{opt.label}:</div>
                                    <div>Date: {opt.date || "-"}</div>
                                    <div>Timings: {opt.timings || "-"}</div>
                                  </div>
                                ))
                              ) : (
                                <div className="text-gray-500">No availability dates</div>
                              )}
                            </div>
                            
                            {/* Variations */}
                            <div className="space-y-2">
                              <h4 className="mb-2 font-semibold text-slate-700 dark:text-slate-200">Schedule</h4>
                              {(item.confirmedDate || item.confirmedTimings) ? (
                                <div className="p-2 bg-white rounded border border-emerald-200">
                                  <div className="font-medium text-emerald-800">Confirmed</div>
                                  <div className="text-gray-700">{item.confirmedDate || "-"} {item.confirmedTimings ? `(${item.confirmedTimings})` : ""}</div>
                                </div>
                              ) : (
                                <div className="text-gray-500">No confirmed schedule</div>
                              )}
                              {(item.adminProposedDate || item.adminProposedTimings) ? (
                                <div className="p-2 bg-white rounded border border-blue-200">
                                  <div className="font-medium text-blue-800">Admin Proposed</div>
                                  <div className="text-gray-700">{item.adminProposedDate || "-"} {item.adminProposedTimings ? `(${item.adminProposedTimings})` : ""}</div>
                                  {item.adminNote ? <div className="mt-1 text-gray-700 whitespace-pre-wrap">{item.adminNote}</div> : null}
                                </div>
                              ) : null}

                                <div className="rounded border border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-800">
                                <div className="mb-2 font-medium text-slate-700 dark:text-slate-200">Propose new slot</div>
                                <div className="grid grid-cols-1 gap-2">
                                  <input
                                    type="date"
                                    value={proposeDateById[item.id] ?? ""}
                                    onChange={(e) => setProposeDateById((p) => ({ ...p, [item.id]: e.target.value }))}
                                    className="text-xs border border-gray-300 rounded px-2 py-1 bg-white"
                                  />
                                  <div className="grid grid-cols-2 gap-2">
                                    <input
                                      type="time"
                                      value={proposeStartById[item.id] ?? ""}
                                      onChange={(e) => setProposeStartById((p) => ({ ...p, [item.id]: e.target.value }))}
                                      className="text-xs border border-gray-300 rounded px-2 py-1 bg-white"
                                    />
                                    <input
                                      type="time"
                                      value={proposeEndById[item.id] ?? ""}
                                      onChange={(e) => setProposeEndById((p) => ({ ...p, [item.id]: e.target.value }))}
                                      className="text-xs border border-gray-300 rounded px-2 py-1 bg-white"
                                    />
                                  </div>
                                  <textarea
                                    rows={2}
                                    value={proposeNoteById[item.id] ?? ""}
                                    onChange={(e) => setProposeNoteById((p) => ({ ...p, [item.id]: e.target.value }))}
                                    className="text-xs border border-gray-300 rounded px-2 py-1 bg-white"
                                    placeholder="Optional note"
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
                                    className="rounded-md bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                                  >
                                    Propose
                                  </button>
                                </div>
                              </div>
                            </div>
                            
                            {/* Areas */}
                            {item.areas.length > 0 && (
                              <div className="space-y-2">
                                <h4 className="font-semibold text-slate-700 mb-2">Areas</h4>
                                <div className="flex flex-wrap gap-1">
                                  {item.areas.map((area, i) => (
                                    <Badge key={i} size="sm" color="success">{area}</Badge>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Alumni Profile & ERP */}
                            <div className="space-y-2 md:col-span-3">
                              <h4 className="font-semibold text-slate-700 mb-2">Alumni Profile & ERP</h4>
                              <div className="flex flex-row justify-start">
                                <AlumniExpandableDetails
                                  sapId={item.sapid || item.registrationNo || ""}
                                  onClose={() => setExpandedRows(prev => {
                                    const next = new Set(prev);
                                    next.delete(rowId);
                                    return next;
                                  })}
                                />
                                <ErpDataDetails
                                  sapId={item.sapid || undefined}
                                  registrationNo={item.registrationNo || undefined}
                                  onClose={() => setExpandedRows(prev => {
                                    const next = new Set(prev);
                                    next.delete(rowId);
                                    return next;
                                  })}
                                />
                              </div>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </SyncedTableScroll>
        <div className="flex items-center justify-between p-4 border-t">
          <span className="text-sm text-gray-500">
            Showing {pageItems.length ? start + 1 : 0}-{pageItems.length ? start + pageItems.length : 0} of {total}
          </span>
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-500" htmlFor="talks-page-size">Items per page:</label>
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
      </div>

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
            <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
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

