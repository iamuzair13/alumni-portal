"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { AlumniTrendFilter, AlumniTrendPoint } from "@/services/dashboardService";

type Props = {
  initialPeriod?: "monthly" | "yearly";
};

const FILTER_OPTIONS: { value: AlumniTrendFilter | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "verified", label: "Verified" },
  { value: "unverified", label: "Unverified" },
  { value: "active", label: "Active" },
  { value: "distinguished", label: "Distinguished" },
  { value: "A_plus", label: "A+ Category" },
  { value: "A", label: "A Category" },
  { value: "B", label: "B Category" },
  { value: "C", label: "C Category" },
  { value: "D", label: "D Category" },
];

const LINES: { key: keyof AlumniTrendPoint; label: string; color: string }[] = [
  { key: "total", label: "Total Alumni", color: "#2563EB" },
  { key: "verified", label: "Verified", color: "#16A34A" },
  { key: "unverified", label: "Unverified", color: "#DC2626" },
  { key: "active", label: "Active", color: "#EA580C" },
  { key: "distinguished", label: "Distinguished", color: "#7C3AED" },
  { key: "A_plus", label: "A+ Category", color: "#0EA5E9" },
  { key: "A", label: "A Category", color: "#8B5CF6" },
  { key: "B", label: "B Category", color: "#22C55E" },
  { key: "C", label: "C Category", color: "#EAB308" },
  { key: "D", label: "D Category", color: "#F97316" },
];

export default function AlumniTrendsChart({ initialPeriod = "monthly" }: Props) {
  const [period, setPeriod] = useState<"monthly" | "yearly">(initialPeriod);
  const [filter, setFilter] = useState<AlumniTrendFilter | "all">("all");
  const [data, setData] = useState<AlumniTrendPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set("period", period);
        const res = await fetch(`/api/dashboard/alumni-trends?${params.toString()}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error || "Failed to load alumni trends");
        }
        const json = (await res.json()) as AlumniTrendPoint[];
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load alumni trends");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    // Lazy-load on first visibility
    void load();
    return () => {
      cancelled = true;
    };
  }, [period]);

  const filteredLines = useMemo(() => {
    if (filter === "all") return LINES;
    if (filter === "verified" || filter === "unverified" || filter === "active" || filter === "distinguished") {
      return LINES.filter((l) => l.key === "total" || l.key === filter);
    }
    if (filter === "A_plus" || filter === "A" || filter === "B" || filter === "C" || filter === "D") {
      return LINES.filter((l) => l.key === "total" || l.key === filter);
    }
    return LINES;
  }, [filter]);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">Trends &amp; Growth Across System Modules</h3>
          <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
            Alumni trends over time by verification, status, and category.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            className="h-9 rounded-lg border border-gray-300 bg-transparent px-3 text-xs shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-2 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
            value={period}
            onChange={(e) => setPeriod(e.target.value === "yearly" ? "yearly" : "monthly")}
          >
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
          <select
            className="h-9 rounded-lg border border-gray-300 bg-transparent px-3 text-xs shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-2 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
            value={filter}
            onChange={(e) => setFilter(e.target.value as AlumniTrendFilter | "all")}
          >
            {FILTER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="py-10 text-center text-sm text-gray-600 dark:text-gray-400">Loading alumni trends…</div>
      ) : error ? (
        <div className="py-10 text-center text-sm text-red-600 dark:text-red-400">{error}</div>
      ) : !data.length ? (
        <div className="py-10 text-center text-sm text-gray-600 dark:text-gray-400">No alumni data found for this period.</div>
      ) : (
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="period" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ fontSize: 12 }}
                formatter={(value: any, name: any) => [value, name as string]}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {filteredLines.map((line) => (
                <Line
                  key={line.key}
                  type="monotone"
                  dataKey={line.key}
                  name={line.label}
                  stroke={line.color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

