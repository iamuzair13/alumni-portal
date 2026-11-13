"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BadgeCheck,
  Medal,
  CreditCard,
  GraduationCap,
  Dumbbell,
  Crown,
  Store,
  ChevronDown,
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

type KpiKey = keyof KpiValues;
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

type KpiDef = { label: string; sub?: string; icon: React.ReactNode; tone: Tone };
const KPI_DEFS: Record<KpiKey, KpiDef> = {
  verified: { label: "Verified Alumni", icon: <BadgeCheck />, tone: "emerald" },
  medalists: { label: "Medalists", sub: "Gold + Silver + Bronze", icon: <Medal />, tone: "amber" },
  cards: { label: "Alumni Cards", sub: "Active + Delivered", icon: <CreditCard />, tone: "brand" },
  scholarships: { label: "Scholarships", sub: "Approved only", icon: <GraduationCap />, tone: "sky" },
  memberships: { label: "Memberships", sub: "All statuses", icon: <Dumbbell />, tone: "violet" },
  leaderships: { label: "Leaderships", sub: "Chapters + Associations", icon: <Crown />, tone: "rose" },
  merchants: { label: "Merchants", sub: "Offering discounts", icon: <Store />, tone: "orange" },
};

const GROUPS = [
  { key: "people", label: "People", items: ["verified", "medalists"] },
  { key: "programs", label: "Programs", items: ["scholarships", "memberships", "leaderships"] },
  { key: "services", label: "Services", items: ["cards", "merchants"] },
] as const;
type GroupKey = (typeof GROUPS)[number]["key"];

const STORAGE_KEY = "alumni-kpi-groups";
const DEFAULT_OPEN: Record<GroupKey, boolean> = {
  people: true,
  programs: false,
  services: false,
};

function KpiCard({ def, value }: { def: KpiDef; value: number | null }) {
  const animated = useCountUp(value ?? 0, 550);
  return (
    <div
      role="group"
      aria-label={`${def.label}: ${value === null ? "unavailable" : value}`}
      className="flex min-w-0 flex-col rounded-2xl border border-border-subtle bg-surface p-3 shadow-sm sm:p-3.5"
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg [&>svg]:h-4 [&>svg]:w-4 ${TONES[def.tone]}`}
        >
          {def.icon}
        </span>
        <p className="min-w-0 truncate text-[11px] font-semibold uppercase tracking-wide text-content-muted">
          {def.label}
        </p>
      </div>
      <p className="mt-1.5 truncate text-[clamp(1.25rem,2.5vw,1.5rem)] font-bold tabular-nums leading-8 text-content">
        {value === null ? (
          <span className="text-content-muted" title="Temporarily unavailable">—</span>
        ) : (
          animated.toLocaleString()
        )}
      </p>
      {def.sub && (
        <p className="mt-0.5 truncate text-[11px] text-content-muted">{def.sub}</p>
      )}
    </div>
  );
}

function KpiGroup({
  groupKey,
  label,
  items,
  data,
  isOpen,
  onToggle,
}: {
  groupKey: GroupKey;
  label: string;
  items: readonly KpiKey[];
  data: KpiValues;
  isOpen: boolean;
  onToggle: (key: GroupKey) => void;
}) {
  const total = items.reduce<number | null>((acc, k) => {
    const v = data[k];
    return v === null ? acc : (acc ?? 0) + v;
  }, null);
  const bodyId = `kpi-group-${groupKey}`;

  return (
    <div className="md:contents">
      <button
        type="button"
        onClick={() => onToggle(groupKey)}
        aria-expanded={isOpen}
        aria-controls={bodyId}
        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-border-subtle bg-surface px-4 py-2.5 text-left transition-colors hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 md:hidden"
      >
        <span className="text-xs font-bold uppercase tracking-wide text-content-secondary">
          {label}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span className="text-sm font-bold tabular-nums text-content">
            {total === null ? "—" : total.toLocaleString()}
          </span>
          <ChevronDown
            className={`h-4 w-4 text-content-muted transition-transform duration-200 motion-reduce:transition-none ${
              isOpen ? "rotate-180" : ""
            }`}
            aria-hidden
          />
        </span>
      </button>

      <div
        id={bodyId}
        role="region"
        aria-label={label}
        className={`grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none ${
          isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        } md:contents`}
      >
        <div className="min-h-0 overflow-hidden md:contents">
          <div className="grid grid-cols-2 gap-2 md:contents">
            {items.map((k) => (
              <KpiCard key={k} def={KPI_DEFS[k]} value={data[k]} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function KpiStrip({ data }: { data: KpiValues }) {
  const [open, setOpen] = useState<Record<GroupKey, boolean>>(DEFAULT_OPEN);

  // Restore persisted disclosure state after mount — initial render always
  // uses DEFAULT_OPEN so SSR and the first client render agree.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as Partial<Record<GroupKey, boolean>>;
      setOpen((prev) => ({ ...prev, ...saved }));
    } catch {
      // storage unavailable — keep defaults
    }
  }, []);

  const toggle = useCallback((key: GroupKey) => {
    setOpen((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // storage unavailable — in-memory only
      }
      return next;
    });
  }, []);

  return (
    <section aria-label="Portal metrics" className="mb-5">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4 xl:grid-cols-7">
        {GROUPS.map((g) => (
          <KpiGroup
            key={g.key}
            groupKey={g.key}
            label={g.label}
            items={g.items}
            data={data}
            isOpen={open[g.key]}
            onToggle={toggle}
          />
        ))}
      </div>
    </section>
  );
}
