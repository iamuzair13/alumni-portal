"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Merchant } from "@/app/api/merchants/route";

function formatDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function deriveStatus(endDate: string): "active" | "expired" {
  if (!endDate) return "active";
  return new Date(endDate) < new Date(new Date().toDateString()) ? "expired" : "active";
}

function StatusBadge({ status }: { status: "active" | "expired" }) {
  if (status === "active") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Active
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 ring-1 ring-inset ring-red-600/20 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/20">
      <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
      Expired
    </span>
  );
}

function DiscountBadge({ pct }: { pct: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-lg bg-orange-50 px-2.5 py-1 text-sm font-bold text-orange-600 ring-1 ring-inset ring-orange-500/20 dark:bg-orange-500/10 dark:text-orange-400 dark:ring-orange-500/20">
      {pct}% OFF
    </span>
  );
}

async function fetchMerchants(): Promise<Merchant[]> {
  const res = await fetch("/api/merchants", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load promotions");
  const data = await res.json();
  return Array.isArray(data.items) ? data.items : [];
}

export function MerchantPromotionsTable() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "expired">("all");

  const { data: merchants = [], isLoading, isError } = useQuery({
    queryKey: ["merchants-public"],
    queryFn: fetchMerchants,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const filtered = merchants
    .map((m) => ({ ...m, status: deriveStatus(m.end_date) }))
    .filter((m) => {
      if (statusFilter !== "all" && m.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return m.business_name.toLowerCase().includes(q) || m.discount_type.toLowerCase().includes(q);
      }
      return true;
    })
    .sort((a, b) => {
      if (a.status === b.status) return a.business_name.localeCompare(b.business_name);
      return a.status === "active" ? -1 : 1;
    });

  const activeCount = merchants.filter((m) => deriveStatus(m.end_date) === "active").length;
  const expiredCount = merchants.length - activeCount;

  return (
    <div className="space-y-6">

      {/* Header strip */}
      <div className="rounded-2xl bg-gradient-to-r from-orange-600 to-orange-500 p-6 text-white shadow-md">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold tracking-tight">Partner Merchant Discounts</h3>
            <p className="mt-1 text-sm text-orange-100">
              Exclusive offers available to UOL alumni with a valid Alumni Card.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="rounded-xl bg-white/15 px-4 py-2 text-center backdrop-blur-sm">
              <p className="text-2xl font-bold">{activeCount}</p>
              <p className="text-[11px] font-medium text-orange-100">Active Offers</p>
            </div>
            <div className="rounded-xl bg-white/10 px-4 py-2 text-center backdrop-blur-sm">
              <p className="text-2xl font-bold">{expiredCount}</p>
              <p className="text-[11px] font-medium text-orange-100">Expired</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search merchants or offers…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-4 text-sm text-gray-800 shadow-sm placeholder:text-gray-400 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-400/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:placeholder:text-gray-500 dark:focus:border-orange-500"
          />
        </div>

        <div className="flex items-center rounded-xl border border-gray-200 bg-white p-1 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          {(["all", "active", "expired"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold capitalize transition-all ${
                statusFilter === f
                  ? "bg-orange-500 text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        {isLoading ? (
          <div className="flex items-center justify-center gap-3 py-20 text-gray-400">
            <svg className="h-5 w-5 animate-spin text-orange-500" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <span className="text-sm font-medium">Loading merchant offers…</span>
          </div>
        ) : isError ? (
          <div className="py-16 text-center text-sm text-red-500">
            Failed to load promotions. Please refresh the page.
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              {search || statusFilter !== "all" ? "No merchants match your filter." : "No partner merchants listed yet."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-800">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/60">
                  <th className="whitespace-nowrap px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    #
                  </th>
                  <th className="whitespace-nowrap px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Business / Partner
                  </th>
                  <th className="whitespace-nowrap px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Offer / Discount Type
                  </th>
                  <th className="whitespace-nowrap px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Discount
                  </th>
                  <th className="whitespace-nowrap px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Valid From
                  </th>
                  <th className="whitespace-nowrap px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Valid Until
                  </th>
                  <th className="whitespace-nowrap px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filtered.map((m, idx) => (
                  <tr
                    key={m.id}
                    className={`transition-colors ${
                      m.status === "expired"
                        ? "opacity-60 hover:opacity-80"
                        : "hover:bg-orange-50/40 dark:hover:bg-orange-500/5"
                    }`}
                  >
                    <td className="px-5 py-4 text-sm tabular-nums text-gray-400 dark:text-gray-600">
                      {idx + 1}
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{m.business_name}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm text-gray-600 dark:text-gray-400">{m.discount_type}</p>
                    </td>
                    <td className="px-5 py-4">
                      <DiscountBadge pct={m.discount_pct} />
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(m.start_date)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(m.end_date)}
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={m.status as "active" | "expired"} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer note */}
      <p className="text-center text-xs text-gray-400 dark:text-gray-600">
        Present your UOL Alumni Card at the time of purchase to avail the discount.
        Offers are subject to change by individual merchants.
      </p>
    </div>
  );
}
