"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/ui/modal";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import SyncedTableScroll from "@/components/tables/SyncedTableScroll";
import { PencilIcon, TrashBinIcon } from "@/icons";
import toast from "react-hot-toast";
import { useSession } from "next-auth/react";
import { isAdminUser, isSuperAdminUser } from "@/lib/alumniProfile";

type Merchant = {
  id: number;
  business_name: string;
  discount_type: string;
  start_date: string;
  end_date: string;
  discount_pct: number;
  status: "active" | "expired";
  created_at: string;
  updated_at: string;
};

type MerchantFormDraft = {
  businessName: string;
  discountType: string;
  startDate: string;
  endDate: string;
  discountPct: string;
  status: "active" | "expired";
};

const EMPTY_DRAFT: MerchantFormDraft = {
  businessName: "",
  discountType: "",
  startDate: "",
  endDate: "",
  discountPct: "",
  status: "active",
};

function formatDate(iso: string): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

function deriveStatus(endDate: string): "active" | "expired" {
  if (!endDate) return "active";
  return new Date(endDate) < new Date(new Date().toDateString()) ? "expired" : "active";
}

async function fetchMerchants(): Promise<Merchant[]> {
  const res = await fetch("/api/merchants");
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as any).error || "Failed to fetch merchants");
  }
  const data = await res.json();
  return Array.isArray(data.items) ? data.items : [];
}

async function createMerchant(draft: MerchantFormDraft): Promise<Merchant> {
  const res = await fetch("/api/merchants", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      businessName: draft.businessName,
      discountType: draft.discountType,
      startDate: draft.startDate,
      endDate: draft.endDate,
      discountPct: Number(draft.discountPct),
      status: draft.status,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any).error || "Failed to create merchant");
  return (data as any).item as Merchant;
}

async function updateMerchant(id: number, draft: MerchantFormDraft): Promise<Merchant> {
  const res = await fetch("/api/merchants", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id,
      businessName: draft.businessName,
      discountType: draft.discountType,
      startDate: draft.startDate,
      endDate: draft.endDate,
      discountPct: Number(draft.discountPct),
      status: draft.status,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any).error || "Failed to update merchant");
  return (data as any).item as Merchant;
}

async function deleteMerchant(id: number): Promise<void> {
  const res = await fetch(`/api/merchants?id=${id}`, { method: "DELETE" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any).error || "Failed to delete merchant");
}

type SortField = "business_name" | "discount_type" | "start_date" | "end_date" | "discount_pct" | "status";

function SortIcon({ field, active, dir }: { field: SortField; active: boolean; dir: "asc" | "desc" }) {
  if (!active) {
    return (
      <span className="ml-1 text-gray-400 inline-block">
        <svg width="10" height="14" viewBox="0 0 10 14" fill="none"><path d="M5 1v12M1 5l4-4 4 4M1 9l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </span>
    );
  }
  return dir === "asc" ? (
    <span className="ml-1 text-blue-600 inline-block">
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 7l4-6 4 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
    </span>
  ) : (
    <span className="ml-1 text-blue-600 inline-block">
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 3l4 6 4-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
    </span>
  );
}

function StatusBadge({ status }: { status: "active" | "expired" }) {
  if (status === "active") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
        Active
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
      <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
      Expired
    </span>
  );
}

function MerchantForm({
  mode,
  initial,
  onCancel,
  onSubmit,
  saving,
}: {
  mode: "add" | "edit";
  initial?: MerchantFormDraft;
  onCancel: () => void;
  onSubmit: (draft: MerchantFormDraft) => void;
  saving: boolean;
}) {
  const [draft, setDraft] = useState<MerchantFormDraft>(initial ?? EMPTY_DRAFT);
  const [errors, setErrors] = useState<Partial<Record<keyof MerchantFormDraft, string>>>({});

  const autoStatus = deriveStatus(draft.endDate);

  const set = <K extends keyof MerchantFormDraft>(key: K, val: MerchantFormDraft[K]) => {
    setDraft((d) => {
      const next = { ...d, [key]: val };
      if (key === "endDate") {
        next.status = deriveStatus(String(val));
      }
      return next;
    });
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const validate = (): boolean => {
    const e: Partial<Record<keyof MerchantFormDraft, string>> = {};
    if (!draft.businessName.trim() || draft.businessName.trim().length < 2) {
      e.businessName = "Business name must be at least 2 characters";
    }
    if (!draft.discountType.trim()) {
      e.discountType = "Discount type is required";
    }
    if (!draft.startDate) {
      e.startDate = "Start date is required";
    }
    if (!draft.endDate) {
      e.endDate = "End date is required";
    }
    if (draft.startDate && draft.endDate && new Date(draft.endDate) < new Date(draft.startDate)) {
      e.endDate = "End date must be after start date";
    }
    const pct = Number(draft.discountPct);
    if (draft.discountPct === "" || !Number.isFinite(pct) || pct < 0 || pct > 100) {
      e.discountPct = "Discount must be between 0 and 100";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    onSubmit({ ...draft, status: autoStatus });
  };

  return (
    <div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <Label>Business Name <span className="text-red-500">*</span></Label>
          <Input
            value={draft.businessName}
            onChange={(e) => set("businessName", e.target.value)}
            placeholder="e.g., Starbucks, Nike, Local Cafe"
            disabled={saving}
          />
          {errors.businessName && (
            <p className="mt-1 text-xs text-red-500">{errors.businessName}</p>
          )}
        </div>

        <div className="md:col-span-2">
          <Label>Discount Type <span className="text-red-500">*</span></Label>
          <Input
            value={draft.discountType}
            onChange={(e) => set("discountType", e.target.value)}
            placeholder="e.g., Percentage Off, Buy One Get One, Student Discount"
            disabled={saving}
          />
          {errors.discountType && (
            <p className="mt-1 text-xs text-red-500">{errors.discountType}</p>
          )}
        </div>

        <div>
          <Label>Discount Start Date <span className="text-red-500">*</span></Label>
          <input
            type="date"
            value={draft.startDate}
            onChange={(e) => set("startDate", e.target.value)}
            disabled={saving}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 shadow-theme-xs focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 disabled:opacity-50"
          />
          {errors.startDate && (
            <p className="mt-1 text-xs text-red-500">{errors.startDate}</p>
          )}
        </div>

        <div>
          <Label>Discount End Date <span className="text-red-500">*</span></Label>
          <input
            type="date"
            value={draft.endDate}
            onChange={(e) => set("endDate", e.target.value)}
            disabled={saving}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 shadow-theme-xs focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 disabled:opacity-50"
          />
          {errors.endDate && (
            <p className="mt-1 text-xs text-red-500">{errors.endDate}</p>
          )}
        </div>

        <div>
          <Label>Applicable Discount (%) <span className="text-red-500">*</span></Label>
          <div className="relative">
            <Input
              type="number"
              min={0}
              max={100}
              value={draft.discountPct}
              onChange={(e) => set("discountPct", e.target.value)}
              placeholder="e.g., 15"
              disabled={saving}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 pointer-events-none">%</span>
          </div>
          {errors.discountPct && (
            <p className="mt-1 text-xs text-red-500">{errors.discountPct}</p>
          )}
        </div>

        <div>
          <Label>Discount Status</Label>
          <div className="mt-2 flex items-center gap-3">
            <StatusBadge status={autoStatus} />
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {autoStatus === "expired"
                ? "Auto-set to Expired (end date has passed)"
                : "Auto-calculated from end date"}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
        <Button size="sm" variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleSubmit} disabled={saving}>
          {saving ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Saving...
            </span>
          ) : mode === "add" ? (
            "Save Merchant"
          ) : (
            "Save Changes"
          )}
        </Button>
      </div>
    </div>
  );
}

function ViewModal({
  merchant,
  onClose,
  onEdit,
}: {
  merchant: Merchant;
  onClose: () => void;
  onEdit: () => void;
}) {
  const fields: { label: string; value: React.ReactNode }[] = [
    { label: "Business Name", value: merchant.business_name },
    { label: "Discount Type", value: merchant.discount_type },
    { label: "Start Date", value: formatDate(merchant.start_date) },
    { label: "End Date", value: formatDate(merchant.end_date) },
    { label: "Discount", value: `${merchant.discount_pct}%` },
    { label: "Status", value: <StatusBadge status={merchant.status} /> },
  ];

  return (
    <div>
      <dl className="divide-y divide-gray-100 dark:divide-gray-700">
        {fields.map((f) => (
          <div key={f.label} className="flex items-start gap-4 py-3">
            <dt className="w-36 flex-shrink-0 text-sm font-medium text-gray-600 dark:text-gray-400">
              {f.label}
            </dt>
            <dd className="text-sm text-gray-900 dark:text-gray-100">{f.value}</dd>
          </div>
        ))}
      </dl>
      <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
        <Button size="sm" variant="outline" onClick={onClose}>
          Close
        </Button>
        <Button size="sm" onClick={onEdit}>
          Edit
        </Button>
      </div>
    </div>
  );
}

const PAGE_SIZE = 10;

export default function MerchantsComponent() {
  const { data: session } = useSession();
  const canModify = isAdminUser(session?.user) || isSuperAdminUser(session?.user);

  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "expired">("all");
  const [sortField, setSortField] = useState<SortField>("business_name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);

  const [addOpen, setAddOpen] = useState(false);
  const [viewMerchant, setViewMerchant] = useState<Merchant | null>(null);
  const [editMerchant, setEditMerchant] = useState<Merchant | null>(null);
  const [deleteMerchantTarget, setDeleteMerchantTarget] = useState<Merchant | null>(null);

  const { data: merchants = [], isLoading } = useQuery({
    queryKey: ["merchants"],
    queryFn: fetchMerchants,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const createMutation = useMutation({
    mutationFn: (draft: MerchantFormDraft) => createMerchant(draft),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["merchants"] });
      setAddOpen(false);
      toast.success("Merchant added successfully");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, draft }: { id: number; draft: MerchantFormDraft }) =>
      updateMerchant(id, draft),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["merchants"] });
      setEditMerchant(null);
      toast.success("Merchant updated successfully");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteMerchant(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["merchants"] });
      setDeleteMerchantTarget(null);
      toast.success("Merchant deleted");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortField(field);
        setSortDir("asc");
      }
    },
    [sortField]
  );

  const filtered = useMemo(() => {
    let list = merchants.map((m) => ({
      ...m,
      status: deriveStatus(m.end_date) === "expired" ? ("expired" as const) : m.status,
    }));

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (m) =>
          m.business_name.toLowerCase().includes(q) ||
          m.discount_type.toLowerCase().includes(q)
      );
    }

    if (statusFilter !== "all") {
      list = list.filter((m) => m.status === statusFilter);
    }

    list = [...list].sort((a, b) => {
      let aVal: string | number = "";
      let bVal: string | number = "";
      switch (sortField) {
        case "business_name":
          aVal = a.business_name.toLowerCase();
          bVal = b.business_name.toLowerCase();
          break;
        case "discount_type":
          aVal = a.discount_type.toLowerCase();
          bVal = b.discount_type.toLowerCase();
          break;
        case "start_date":
          aVal = a.start_date;
          bVal = b.start_date;
          break;
        case "end_date":
          aVal = a.end_date;
          bVal = b.end_date;
          break;
        case "discount_pct":
          return sortDir === "asc" ? a.discount_pct - b.discount_pct : b.discount_pct - a.discount_pct;
        case "status":
          aVal = a.status;
          bVal = b.status;
          break;
      }
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return list;
  }, [merchants, search, statusFilter, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = useMemo(
    () => filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filtered, safePage]
  );

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const thClass =
    "px-4 py-3 text-left text-[13px] font-medium text-slate-600 border-r border-gray-200 dark:text-gray-300 cursor-pointer select-none whitespace-nowrap hover:bg-gray-50 dark:hover:bg-gray-800/60";

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Merchants &amp; Business Partners
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Manage discount partnerships and promotional offers
          </p>
        </div>
        {canModify && (
          <Button size="sm" onClick={() => setAddOpen(true)}>
            + Add Merchant
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          type="text"
          placeholder="Search by business name or discount type..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-theme-xs focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "all" | "active" | "expired")}
          className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-theme-xs focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="expired">Expired</option>
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-gray-300 dark:border-gray-700 rounded-2xl">
          <svg className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" fill="none" viewBox="0 0 48 48">
            <rect x="8" y="14" width="32" height="24" rx="3" stroke="currentColor" strokeWidth="2" />
            <path d="M16 14v-2a8 8 0 0116 0v2" stroke="currentColor" strokeWidth="2" />
            <path d="M20 26h8M24 22v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
            {search || statusFilter !== "all" ? "No merchants match your filters" : "No merchants added yet"}
          </p>
          {!search && statusFilter === "all" && canModify && (
            <Button size="sm" className="mt-3" onClick={() => setAddOpen(true)}>
              Add your first merchant
            </Button>
          )}
        </div>
      ) : (
        <>
          <SyncedTableScroll minWidth={900}>
            <table
              className="min-w-full overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800"
              role="table"
              aria-label="Merchants table"
            >
              <thead className="whitespace-nowrap border-b border-gray-200 bg-white dark:border-white/[0.06] dark:bg-gray-900/80">
                <tr className="border-b border-gray-200 dark:border-white/[0.06]">
                  <th
                    scope="col"
                    className={thClass}
                    onClick={() => handleSort("business_name")}
                    aria-sort={sortField === "business_name" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                  >
                    Business Name
                    <SortIcon field="business_name" active={sortField === "business_name"} dir={sortDir} />
                  </th>
                  <th
                    scope="col"
                    className={thClass}
                    onClick={() => handleSort("discount_type")}
                    aria-sort={sortField === "discount_type" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                  >
                    Discount Type
                    <SortIcon field="discount_type" active={sortField === "discount_type"} dir={sortDir} />
                  </th>
                  <th
                    scope="col"
                    className={thClass}
                    onClick={() => handleSort("start_date")}
                    aria-sort={sortField === "start_date" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                  >
                    Start Date
                    <SortIcon field="start_date" active={sortField === "start_date"} dir={sortDir} />
                  </th>
                  <th
                    scope="col"
                    className={thClass}
                    onClick={() => handleSort("end_date")}
                    aria-sort={sortField === "end_date" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                  >
                    End Date
                    <SortIcon field="end_date" active={sortField === "end_date"} dir={sortDir} />
                  </th>
                  <th
                    scope="col"
                    className={thClass}
                    onClick={() => handleSort("discount_pct")}
                    aria-sort={sortField === "discount_pct" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                  >
                    Discount %
                    <SortIcon field="discount_pct" active={sortField === "discount_pct"} dir={sortDir} />
                  </th>
                  <th
                    scope="col"
                    className={thClass}
                    onClick={() => handleSort("status")}
                    aria-sort={sortField === "status" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                  >
                    Status
                    <SortIcon field="status" active={sortField === "status"} dir={sortDir} />
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-right text-[13px] font-medium text-slate-600 dark:text-gray-300 whitespace-nowrap"
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="whitespace-nowrap divide-y divide-gray-200 dark:divide-white/[0.06]">
                {paginated.map((m) => (
                  <tr
                    key={m.id}
                    className="odd:bg-gray-50 dark:odd:bg-gray-800/70 dark:text-gray-300 dark:bg-gray-900"
                  >
                    <td className="px-4 py-3 border-r border-gray-200 text-[13px] text-slate-900 dark:text-gray-100 font-medium">
                      {m.business_name}
                    </td>
                    <td className="px-4 py-3 border-r border-gray-200 text-[13px] text-slate-700 dark:text-gray-300">
                      {m.discount_type}
                    </td>
                    <td className="px-4 py-3 border-r border-gray-200 text-[13px] text-slate-700 dark:text-gray-300">
                      {formatDate(m.start_date)}
                    </td>
                    <td className="px-4 py-3 border-r border-gray-200 text-[13px] text-slate-700 dark:text-gray-300">
                      {formatDate(m.end_date)}
                    </td>
                    <td className="px-4 py-3 border-r border-gray-200 text-[13px] text-slate-700 dark:text-gray-300 text-center">
                      <span className="font-semibold">{m.discount_pct}%</span>
                    </td>
                    <td className="px-4 py-3 border-r border-gray-200 text-[13px]">
                      <StatusBadge status={m.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex gap-1 justify-end">
                        <button
                          onClick={() => setViewMerchant(m)}
                          aria-label={`View ${m.business_name}`}
                          title="View"
                          className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-blue-600 dark:hover:bg-gray-700 dark:text-gray-400 dark:hover:text-blue-400 transition-colors"
                        >
                          <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
                            <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
                          </svg>
                        </button>
                        {canModify && (
                          <>
                            <button
                              onClick={() => setEditMerchant(m)}
                              aria-label={`Edit ${m.business_name}`}
                              title="Edit"
                              className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-blue-600 dark:hover:bg-gray-700 dark:text-gray-400 dark:hover:text-blue-400 transition-colors"
                            >
                              <PencilIcon />
                            </button>
                            <button
                              onClick={() => setDeleteMerchantTarget(m)}
                              aria-label={`Delete ${m.business_name}`}
                              title="Delete"
                              className="p-1.5 rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:text-gray-400 dark:hover:text-red-400 transition-colors"
                            >
                              <TrashBinIcon />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </SyncedTableScroll>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Showing {(safePage - 1) * PAGE_SIZE + 1}–
                {Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Add Merchant Modal */}
      <Modal
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        className="max-w-[640px] p-5 lg:p-8 dark:text-gray-300 dark:bg-gray-900"
      >
        <div className="mb-5 pb-4 border-b border-gray-200 dark:border-gray-700">
          <h4 className="text-xl font-bold text-gray-900 dark:text-white">Add New Merchant</h4>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Register a new business partner and their discount configuration.
          </p>
        </div>
        <MerchantForm
          mode="add"
          onCancel={() => setAddOpen(false)}
          onSubmit={(draft) => createMutation.mutate(draft)}
          saving={createMutation.isPending}
        />
      </Modal>

      {/* View Merchant Modal */}
      {viewMerchant && (
        <Modal
          isOpen={!!viewMerchant}
          onClose={() => setViewMerchant(null)}
          className="max-w-[520px] p-5 lg:p-8 dark:text-gray-300 dark:bg-gray-900"
        >
          <div className="mb-5 pb-4 border-b border-gray-200 dark:border-gray-700">
            <h4 className="text-xl font-bold text-gray-900 dark:text-white">Merchant Details</h4>
          </div>
          <ViewModal
            merchant={viewMerchant}
            onClose={() => setViewMerchant(null)}
            onEdit={() => {
              setEditMerchant(viewMerchant);
              setViewMerchant(null);
            }}
          />
        </Modal>
      )}

      {/* Edit Merchant Modal */}
      {editMerchant && (
        <Modal
          isOpen={!!editMerchant}
          onClose={() => setEditMerchant(null)}
          className="max-w-[640px] p-5 lg:p-8 dark:text-gray-300 dark:bg-gray-900"
        >
          <div className="mb-5 pb-4 border-b border-gray-200 dark:border-gray-700">
            <h4 className="text-xl font-bold text-gray-900 dark:text-white">Edit Merchant</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Update the details for <span className="font-medium">{editMerchant.business_name}</span>.
            </p>
          </div>
          <MerchantForm
            mode="edit"
            initial={{
              businessName: editMerchant.business_name,
              discountType: editMerchant.discount_type,
              startDate: editMerchant.start_date,
              endDate: editMerchant.end_date,
              discountPct: String(editMerchant.discount_pct),
              status: editMerchant.status,
            }}
            onCancel={() => setEditMerchant(null)}
            onSubmit={(draft) =>
              updateMutation.mutate({ id: editMerchant.id, draft })
            }
            saving={updateMutation.isPending}
          />
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {deleteMerchantTarget && (
        <Modal
          isOpen={!!deleteMerchantTarget}
          onClose={() => setDeleteMerchantTarget(null)}
          className="max-w-[480px] p-5 lg:p-8 dark:text-gray-300 dark:bg-gray-900"
        >
          <div className="mb-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <TrashBinIcon />
              </div>
              <h4 className="text-lg font-bold text-gray-900 dark:text-white">Delete Merchant?</h4>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 leading-6">
              Are you sure you want to remove{" "}
              <span className="font-semibold text-gray-900 dark:text-white">
                {deleteMerchantTarget.business_name}
              </span>
              ? This action cannot be undone.
            </p>
          </div>
          <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setDeleteMerchantTarget(null)}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <button
              onClick={() => deleteMutation.mutate(deleteMerchantTarget.id)}
              disabled={deleteMutation.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            >
              {deleteMutation.isPending ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
