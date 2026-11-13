"use client";

import { useQuery } from "@tanstack/react-query";
import {
  BadgeCheck,
  Medal,
  CreditCard,
  GraduationCap,
  Dumbbell,
  Crown,
  Store,
  RefreshCw,
} from "lucide-react";
import { useCountUp } from "./useCountUp";

type KpiValues = {
  verified: number | null;
  medalists: number | null;
  cards: number | null;
  scholarships: number | null;
  memberships: number | null;
  leaderships: number | null;
  merchants: number | null;
};

async function fetchJson(url: string): Promise<Record<string, unknown>> {
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`${res.status}`);
  return (await res.json()) as Record<string, unknown>;
}

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

async function fetchKpis(): Promise<KpiValues> {
  const [alumni, cards, scholarships, memberships, leadership, merchants] =
    await Promise.allSettled([
      fetchJson("/api/alumni/counts"),
      fetchJson("/api/alumni-cards/counts"),
      fetchJson("/api/alumni/scholarships?limit=1&page=1"),
      fetchJson("/api/alumni/memberships?limit=1&page=1"),
      fetchJson("/api/leadership/counts"),
      fetchJson("/api/merchants/counts"),
    ]);

  const ok = (r: PromiseSettledResult<Record<string, unknown>>) =>
    r.status === "fulfilled" ? r.value : null;

  const a = ok(alumni);
  const c = ok(cards);
  const s = ok(scholarships);
  const m = ok(memberships);
  const l = ok(leadership);
  const mc = ok(merchants);

  const medal = (a?.medal ?? null) as { gold?: number; silver?: number; bronze?: number } | null;
  const sCounts = (s?.counts ?? null) as { approved?: number } | null;
  const mCounts = (m?.counts ?? null) as
    | { pending?: number; approved?: number; notApproved?: number }
    | null;
  const lCounts = (l?.counts ?? null) as { all?: number } | null;

  return {
    verified: a ? num(a.verified) : null,
    medalists: a
      ? (num(medal?.gold) ?? 0) + (num(medal?.silver) ?? 0) + (num(medal?.bronze) ?? 0)
      : null,
    cards: c ? (num(c.active) ?? 0) + (num(c.delivered) ?? 0) : null,
    scholarships: s ? num(sCounts?.approved) : null,
    memberships: m
      ? (num(mCounts?.pending) ?? 0) +
        (num(mCounts?.approved) ?? 0) +
        (num(mCounts?.notApproved) ?? 0)
      : null,
    leaderships: l ? num(lCounts?.all) : null,
    merchants: mc ? num(mc.active) : null,
  };
}

type Tone = "brand" | "amber" | "sky" | "violet" | "emerald" | "orange" | "rose";
const TONES: Record<Tone, string> = {
  brand: "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300",
  amber: "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
  sky: "bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300",
  violet: "bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300",
  emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
  orange: "bg-orange-50 text-orange-600 dark:bg-orange-500/15 dark:text-orange-300",
  rose: "bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300",
};

function KpiCard({
  icon,
  tone,
  label,
  value,
  sub,
  loading,
}: {
  icon: React.ReactNode;
  tone: Tone;
  label: string;
  value: number | null;
  sub?: string;
  loading: boolean;
}) {
  const animated = useCountUp(value ?? 0, 550);
  return (
    <div
      role="group"
      aria-label={loading ? `${label} loading` : `${label}: ${value === null ? "unavailable" : value}`}
      className="flex flex-col rounded-2xl border border-border-subtle bg-surface p-3 shadow-sm sm:p-3.5"
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg [&>svg]:h-4 [&>svg]:w-4 ${TONES[tone]}`}
        >
          {icon}
        </span>
        <p className="min-w-0 truncate text-[11px] font-semibold uppercase tracking-wide text-content-muted">
          {label}
        </p>
      </div>
      {loading ? (
        <div className="mt-2.5 h-7 w-16 animate-pulse rounded bg-surface-raised" aria-hidden />
      ) : (
        <p className="mt-1.5 text-xl font-bold tabular-nums text-content sm:text-2xl">
          {value === null ? (
            <span className="text-content-muted" title="Temporarily unavailable">—</span>
          ) : (
            animated.toLocaleString()
          )}
        </p>
      )}
      {!loading && sub && (
        <p className="mt-0.5 truncate text-[11px] text-content-muted">{sub}</p>
      )}
    </div>
  );
}

export default function KpiStrip() {
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["alumni-profile-kpis"],
    queryFn: fetchKpis,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const allFailed =
    !isLoading &&
    data != null &&
    Object.values(data).every((v) => v === null);

  if (isError || allFailed) {
    return (
      <section aria-label="Portal metrics" className="mb-5">
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-error-200 bg-error-50 px-4 py-3 dark:border-error-500/30 dark:bg-error-500/10">
          <p className="text-sm font-semibold text-error-700 dark:text-error-300">
            Couldn’t load portal metrics.
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-1.5 rounded-lg border border-error-200 bg-surface px-3 py-1.5 text-xs font-semibold text-error-700 hover:bg-error-50 disabled:opacity-60 dark:border-error-500/30 dark:text-error-300 dark:hover:bg-error-500/10"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} aria-hidden />
            Retry
          </button>
        </div>
      </section>
    );
  }

  const d = data ?? {
    verified: null,
    medalists: null,
    cards: null,
    scholarships: null,
    memberships: null,
    leaderships: null,
    merchants: null,
  };

  return (
    <section aria-label="Portal metrics" className="mb-5">
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 xl:grid-cols-7">
        <KpiCard icon={<BadgeCheck />} tone="emerald" label="Verified Alumni" value={d.verified} loading={isLoading} />
        <KpiCard icon={<Medal />} tone="amber" label="Medalists" value={d.medalists} sub="Gold + Silver + Bronze" loading={isLoading} />
        <KpiCard icon={<CreditCard />} tone="brand" label="Alumni Cards" value={d.cards} sub="Active + Delivered" loading={isLoading} />
        <KpiCard icon={<GraduationCap />} tone="sky" label="Scholarships" value={d.scholarships} sub="Approved only" loading={isLoading} />
        <KpiCard icon={<Dumbbell />} tone="violet" label="Memberships" value={d.memberships} sub="All statuses" loading={isLoading} />
        <KpiCard icon={<Crown />} tone="rose" label="Leaderships" value={d.leaderships} sub="Chapters + Associations" loading={isLoading} />
        <KpiCard icon={<Store />} tone="orange" label="Merchants" value={d.merchants} sub="Offering discounts" loading={isLoading} />
      </div>
    </section>
  );
}
