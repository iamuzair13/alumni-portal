"use client";

import {
  BadgeCheck,
  Medal,
  CreditCard,
  GraduationCap,
  Dumbbell,
  Crown,
  Store,
} from "lucide-react";
import { useCountUp } from "./useCountUp";

export type KpiValues = {
  verified: number | null;
  medalists: number | null;
  cards: number | null;
  scholarships: number | null;
  memberships: number | null;
  leaderships: number | null;
  merchants: number | null;
};

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
}: {
  icon: React.ReactNode;
  tone: Tone;
  label: string;
  value: number | null;
  sub?: string;
}) {
  const animated = useCountUp(value ?? 0, 550);
  return (
    <div
      role="group"
      aria-label={`${label}: ${value === null ? "unavailable" : value}`}
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
      <p className="mt-1.5 text-xl font-bold tabular-nums text-content sm:text-2xl">
        {value === null ? (
          <span className="text-content-muted" title="Temporarily unavailable">—</span>
        ) : (
          animated.toLocaleString()
        )}
      </p>
      {sub && <p className="mt-0.5 truncate text-[11px] text-content-muted">{sub}</p>}
    </div>
  );
}

export default function KpiStrip({ data }: { data: KpiValues }) {
  return (
    <section aria-label="Portal metrics" className="mb-5">
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 xl:grid-cols-7">
        <KpiCard icon={<BadgeCheck />} tone="emerald" label="Verified Alumni" value={data.verified} />
        <KpiCard icon={<Medal />} tone="amber" label="Medalists" value={data.medalists} sub="Gold + Silver + Bronze" />
        <KpiCard icon={<CreditCard />} tone="brand" label="Alumni Cards" value={data.cards} sub="Active + Delivered" />
        <KpiCard icon={<GraduationCap />} tone="sky" label="Scholarships" value={data.scholarships} sub="Approved only" />
        <KpiCard icon={<Dumbbell />} tone="violet" label="Memberships" value={data.memberships} sub="All statuses" />
        <KpiCard icon={<Crown />} tone="rose" label="Leaderships" value={data.leaderships} sub="Chapters + Associations" />
        <KpiCard icon={<Store />} tone="orange" label="Merchants" value={data.merchants} sub="Offering discounts" />
      </div>
    </section>
  );
}
