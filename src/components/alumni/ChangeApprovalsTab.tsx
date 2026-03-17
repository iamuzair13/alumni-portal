"use client";

import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import Pagination from "@/components/tables/Pagination";
import Badge from "@/components/ui/badge/Badge";
import { Modal } from "@/components/ui/modal";
import Button from "@/components/ui/button/Button";

type ChangeApprovalListItem = {
  alumniid: number;
  alumniname: string | null;
  sapid: string | null;
  registrationno: string | null;
  email: string | null;
  submitted_at: string | null;
  request_id: number | null;
};

type ChangeApprovalDetail = {
  request: {
    id: number;
    alumni_id: number;
    status: string;
    created_at: string;
    approved_by: number | null;
    approved_at: string | null;
    alumni: {
      alumniname: string | null;
      sapid: string | null;
      registrationno: string | null;
      email: string | null;
    };
    old_data: Record<string, unknown>;
    new_data: Record<string, unknown>;
  };
  changes: Array<{ field: string; oldValue: string; newValue: string }>;
};

function formatDateTime(v: string | null): string {
  if (!v) return "-";
  try {
    return new Date(v).toLocaleString();
  } catch {
    return v;
  }
}

export function ChangeApprovalsTab() {
  const qc = useQueryClient();
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRequestId, setSelectedRequestId] = useState<number | null>(null);

  const listQuery = useQuery<{ items: ChangeApprovalListItem[]; total: number; limit: number; offset: number }, Error>({
    queryKey: ["admin", "change-approvals", currentPage, pageSize],
    queryFn: async ({ signal }) => {
      const offset = (currentPage - 1) * pageSize;
      const res = await fetch(`/api/admin/change-approvals?limit=${pageSize}&offset=${offset}`, {
        signal,
        headers: { accept: "application/json" },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to load change approvals");
      return data as { items: ChangeApprovalListItem[]; total: number; limit: number; offset: number };
    },
    staleTime: 0,
    gcTime: 2 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const detailQuery = useQuery<ChangeApprovalDetail, Error>({
    queryKey: ["admin", "change-approvals", "detail", selectedRequestId],
    enabled: selectedRequestId !== null,
    queryFn: async ({ signal }) => {
      if (!selectedRequestId) throw new Error("Missing id");
      const res = await fetch(`/api/admin/change-approvals/${selectedRequestId}`, { signal, headers: { accept: "application/json" } });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to load request");
      return data as ChangeApprovalDetail;
    },
    staleTime: 0,
    gcTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const actionMutation = useMutation({
    mutationFn: async (payload: { id: number; action: "accept" | "reject" }) => {
      const res = await fetch(`/api/admin/change-approvals/${payload.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: payload.action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Action failed");
      return data as { ok: boolean };
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin", "change-approvals"] });
      await qc.invalidateQueries({ queryKey: ["admin", "change-approvals", "detail"] });
      setSelectedRequestId(null);
    },
  });

  const items = listQuery.data?.items ?? [];
  const total = listQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const detail = detailQuery.data;
  const changes = useMemo(() => detail?.changes ?? [], [detail]);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="flex items-center justify-between gap-4 border-b border-gray-200 px-5 py-4 dark:border-gray-800">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white/90">Change Approvals</h3>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Pending alumni profile change requests</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-500 dark:text-gray-400" htmlFor="change-approvals-page-size">Items:</label>
          <select
            id="change-approvals-page-size"
            className="rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm text-gray-700 shadow-theme-xs focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table className="min-w-full">
          <TableHeader className="bg-white whitespace-nowrap border-b border-gray-200 dark:border-white/[0.06]">
            <TableRow>
              <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">Name</TableCell>
              <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">SAP ID</TableCell>
              <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">Registration No</TableCell>
              <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">Email</TableCell>
              <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">Submitted</TableCell>
              <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">Actions</TableCell>
            </TableRow>
          </TableHeader>
          <TableBody className="whitespace-nowrap divide-y divide-gray-200 dark:divide-white/[0.06]">
            {listQuery.isLoading && (
              <TableRow>
                <TableCell className="px-5 py-6 text-gray-600 dark:text-gray-400" colSpan={6}>Loading…</TableCell>
              </TableRow>
            )}
            {!listQuery.isLoading && listQuery.isError && (
              <TableRow>
                <TableCell className="px-5 py-6 text-red-600" colSpan={6}>{listQuery.error?.message ?? "Failed to load"}</TableCell>
              </TableRow>
            )}
            {!listQuery.isLoading && !listQuery.isError && items.length === 0 && (
              <TableRow>
                <TableCell className="px-5 py-6 text-gray-600 dark:text-gray-400" colSpan={6}>No pending change requests.</TableCell>
              </TableRow>
            )}
            {items.map((r) => (
              <TableRow key={String(r.request_id ?? r.alumniid)} className="hover:bg-gray-50 dark:hover:bg-white/[0.04]">
                <TableCell className="px-5 py-4 text-start text-sm text-gray-800 dark:text-white/90">{r.alumniname ?? "-"}</TableCell>
                <TableCell className="px-5 py-4 text-start text-sm text-gray-700 dark:text-gray-300 font-mono">{r.sapid ?? "-"}</TableCell>
                <TableCell className="px-5 py-4 text-start text-sm text-gray-700 dark:text-gray-300 font-mono">{r.registrationno ?? "-"}</TableCell>
                <TableCell className="px-5 py-4 text-start text-sm text-gray-700 dark:text-gray-300">{r.email ?? "-"}</TableCell>
                <TableCell className="px-5 py-4 text-start text-sm text-gray-700 dark:text-gray-300">{formatDateTime(r.submitted_at)}</TableCell>
                <TableCell className="px-5 py-4 text-start">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                      disabled={!r.request_id}
                      onClick={() => setSelectedRequestId(r.request_id ?? null)}
                    >
                      View Changes
                    </button>
                    <Badge size="sm" color="warning">Pending</Badge>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between gap-4 px-5 py-4 border-t border-gray-200 dark:border-gray-800">
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {total ? `Showing ${(currentPage - 1) * pageSize + 1}-${Math.min(currentPage * pageSize, total)} of ${total}` : ""}
        </span>
        <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={(p) => setCurrentPage(Math.max(1, Math.min(totalPages, p)))} />
      </div>

      <Modal isOpen={selectedRequestId !== null} onClose={() => setSelectedRequestId(null)} className="max-w-4xl">
        <div className="flex max-h-[80vh] flex-col">
          <div className="p-6 overflow-y-auto">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white/90">Change Comparison</h3>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {detail?.request?.alumni?.alumniname ? `${detail.request.alumni.alumniname} • ` : ""}
                  {detail?.request?.alumni?.sapid ?? detail?.request?.alumni?.registrationno ?? ""}
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
              <Table className="min-w-full">
                <TableHeader className="bg-gray-50 dark:bg-gray-900/20">
                  <TableRow>
                    <TableCell isHeader className="px-4 py-3 text-start text-xs font-semibold text-gray-600 dark:text-gray-300">Field</TableCell>
                    <TableCell isHeader className="px-4 py-3 text-start text-xs font-semibold text-gray-600 dark:text-gray-300">Current Value</TableCell>
                    <TableCell isHeader className="px-4 py-3 text-start text-xs font-semibold text-gray-600 dark:text-gray-300">New Value</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-gray-200 dark:divide-white/[0.06]">
                  {detailQuery.isLoading && (
                    <TableRow>
                      <TableCell className="px-4 py-4 text-gray-600 dark:text-gray-400" colSpan={3}>Loading…</TableCell>
                    </TableRow>
                  )}
                  {!detailQuery.isLoading && detailQuery.isError && (
                    <TableRow>
                      <TableCell className="px-4 py-4 text-red-600" colSpan={3}>{detailQuery.error?.message ?? "Failed"}</TableCell>
                    </TableRow>
                  )}
                  {!detailQuery.isLoading && !detailQuery.isError && changes.length === 0 && (
                    <TableRow>
                      <TableCell className="px-4 py-4 text-gray-600 dark:text-gray-400" colSpan={3}>No changed fields.</TableCell>
                    </TableRow>
                  )}
                  {changes.map((c) => (
                    <TableRow key={c.field} className="bg-yellow-50/40 dark:bg-yellow-900/10">
                      <TableCell className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white/90">{c.field}</TableCell>
                      <TableCell className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{c.oldValue || "-"}</TableCell>
                      <TableCell className="px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300 font-semibold">{c.newValue || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {actionMutation.isError && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
                {actionMutation.error instanceof Error ? actionMutation.error.message : "Action failed"}
              </div>
            )}
          </div>

          <div className="px-6 pb-6 pt-4 flex items-center justify-end gap-2 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
            <Button
              variant="outline"
              disabled={!selectedRequestId || actionMutation.isPending}
              onClick={() => selectedRequestId && actionMutation.mutate({ id: selectedRequestId, action: "reject" })}
            >
              Reject
            </Button>
            <Button
              disabled={!selectedRequestId || actionMutation.isPending}
              onClick={() => selectedRequestId && actionMutation.mutate({ id: selectedRequestId, action: "accept" })}
            >
              Accept
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
