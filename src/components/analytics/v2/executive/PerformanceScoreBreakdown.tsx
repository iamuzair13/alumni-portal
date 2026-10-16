"use client";

import React, { useState } from "react";
import { motion } from "motion/react";
import {
  Award,
  Briefcase,
  ChevronDown,
  Info,
  Network,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  PERFORMANCE_SCORE_METHODOLOGY,
  type PerformanceFactor,
  type PerformanceResult,
} from "../utils/derivePerformanceScore";

const FACTOR_META: Record<
  string,
  { icon: LucideIcon; accent: string; bg: string; ring: string }
> = {
  verification: {
    icon: ShieldCheck,
    accent: "text-sky-600 dark:text-sky-400",
    bg: "bg-sky-50 dark:bg-sky-500/10",
    ring: "ring-sky-200/80 dark:ring-sky-500/20",
  },
  active: {
    icon: Users,
    accent: "text-brand-600 dark:text-brand-400",
    bg: "bg-brand-50 dark:bg-brand-500/10",
    ring: "ring-brand-200/80 dark:ring-brand-500/20",
  },
  placement: {
    icon: Briefcase,
    accent: "text-success-600 dark:text-success-400",
    bg: "bg-success-50 dark:bg-success-500/10",
    ring: "ring-success-200/80 dark:ring-success-500/20",
  },
  engagement: {
    icon: TrendingUp,
    accent: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-50 dark:bg-violet-500/10",
    ring: "ring-violet-200/80 dark:ring-violet-500/20",
  },
  honorCards: {
    icon: Award,
    accent: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-500/10",
    ring: "ring-amber-200/80 dark:ring-amber-500/20",
  },
  chapters: {
    icon: Network,
    accent: "text-cyan-600 dark:text-cyan-400",
    bg: "bg-cyan-50 dark:bg-cyan-500/10",
    ring: "ring-cyan-200/80 dark:ring-cyan-500/20",
  },
};

function statusTheme(label: PerformanceResult["label"]) {
  if (label === "Strong") {
    return {
      gradient: "from-success-500/10 via-success-500/5 to-transparent dark:from-success-500/15 dark:via-success-500/5",
      border: "border-success-200/70 dark:border-success-500/25",
      badge: "bg-success-100 text-success-800 ring-success-200/80 dark:bg-success-500/15 dark:text-success-300 dark:ring-success-500/30",
      score: "text-success-700 dark:text-success-300",
      bar: "from-success-500 to-success-400",
      insight: "bg-success-50/80 ring-success-100 dark:bg-success-500/10 dark:ring-success-500/20",
      dot: "bg-success-500",
    };
  }
  if (label === "Stable") {
    return {
      gradient: "from-amber-500/10 via-amber-500/5 to-transparent dark:from-amber-500/15 dark:via-amber-500/5",
      border: "border-amber-200/70 dark:border-amber-500/25",
      badge: "bg-amber-100 text-amber-800 ring-amber-200/80 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30",
      score: "text-amber-700 dark:text-amber-300",
      bar: "from-amber-500 to-amber-400",
      insight: "bg-amber-50/80 ring-amber-100 dark:bg-amber-500/10 dark:ring-amber-500/20",
      dot: "bg-amber-500",
    };
  }
  return {
    gradient: "from-error-500/10 via-error-500/5 to-transparent dark:from-error-500/15 dark:via-error-500/5",
    border: "border-error-200/70 dark:border-error-500/25",
    badge: "bg-error-100 text-error-800 ring-error-200/80 dark:bg-error-500/15 dark:text-error-300 dark:ring-error-500/30",
    score: "text-error-700 dark:text-error-300",
    bar: "from-error-500 to-error-400",
    insight: "bg-error-50/80 ring-error-100 dark:bg-error-500/10 dark:ring-error-500/20",
    dot: "bg-error-500",
  };
}

function factorBarTone(score: number) {
  if (score >= 65) return "from-success-500 to-teal-400";
  if (score >= 45) return "from-amber-500 to-orange-400";
  return "from-error-500 to-pink-400";
}

function parseWeight(weight: string): number {
  return Number.parseFloat(weight.replace("%", "")) / 100;
}

function weightedContribution(factor: PerformanceFactor): number {
  return Math.round(factor.score * parseWeight(factor.weight));
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <span className="h-px flex-1 bg-gradient-to-r from-gray-200 to-transparent dark:from-gray-700" />
      <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400 dark:text-gray-500">
        {children}
      </span>
      <span className="h-px flex-1 bg-gradient-to-l from-gray-200 to-transparent dark:from-gray-700" />
    </div>
  );
}

function DriverCard({ factor, index }: { factor: PerformanceFactor; index: number }) {
  const meta = FACTOR_META[factor.id] ?? FACTOR_META.verification;
  const Icon = meta.icon;
  const contribution = weightedContribution(factor);
  const rounded = Math.round(factor.score);

  return (
    <motion.li
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.25 }}
      className={`rounded-xl border border-gray-100/90 bg-white/80 p-2.5 ring-1 ring-inset ${meta.ring} dark:border-gray-800/80 dark:bg-gray-900/40`}
    >
      <div className="flex items-start gap-2.5">
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ${meta.bg} ${meta.ring}`}
        >
          <Icon className={`h-4 w-4 ${meta.accent}`} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-gray-900 dark:text-gray-100">
                {factor.label}
              </p>
              <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-gray-500 dark:text-gray-400">
                {factor.detail}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-base font-bold tabular-nums leading-none text-gray-900 dark:text-white">
                {rounded}
              </p>
              <p className="mt-0.5 text-[9px] font-medium text-gray-400 dark:text-gray-500">
                {factor.weight} wt
              </p>
            </div>
          </div>
          <div className="mt-2">
            <div className="flex items-center justify-between gap-2 text-[9px] text-gray-400 dark:text-gray-500">
              <span>Driver score</span>
              <span className="font-semibold tabular-nums text-gray-600 dark:text-gray-300">
                +{contribution} pts to composite
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${rounded}%` }}
                transition={{ delay: 0.1 + index * 0.04, duration: 0.5, ease: "easeOut" }}
                className={`h-full rounded-full bg-gradient-to-r ${factorBarTone(rounded)}`}
              />
            </div>
          </div>
        </div>
      </div>
    </motion.li>
  );
}

export function PerformanceScoreBreakdown({
  result,
  variant = "default",
}: {
  result: PerformanceResult;
  variant?: "default" | "command";
}) {
  const [methodologyOpen, setMethodologyOpen] = useState(false);
  const theme = statusTheme(result.label);
  const isCommand = variant === "command";

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
      className={`overflow-hidden rounded-2xl border bg-white shadow-2xl shadow-gray-900/10 ring-1 ring-black/5 dark:bg-gray-950 dark:shadow-black/40 dark:ring-white/10 ${theme.border} ${
        isCommand ? "max-h-[min(78vh,640px)]" : ""
      }`}
      role="region"
      aria-label="Performance score breakdown"
    >
      {/* Hero header */}
      <div className={`relative border-b px-4 py-3.5 ${theme.border} bg-gradient-to-br ${theme.gradient}`}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500" />
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                Portal Performance
              </p>
            </div>
            <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
              Executive score breakdown
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="text-right">
              <p className={`text-2xl font-bold tabular-nums leading-none ${theme.score}`}>
                {result.score}
              </p>
              <p className="mt-0.5 text-[9px] font-medium uppercase tracking-wider text-gray-400">
                / 100
              </p>
            </div>
            <span
              className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset ${theme.badge}`}
            >
              {result.label}
            </span>
          </div>
        </div>
      </div>

      <div className={`space-y-4 overflow-y-auto px-4 py-3.5 ${isCommand ? "max-h-[calc(min(78vh,640px)-88px)]" : ""}`}>
        {/* Insights */}
        <section>
          <SectionLabel>{result.headline}</SectionLabel>
          <ul className="space-y-2">
            {result.reasons.map((reason, i) => (
              <motion.li
                key={reason}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`flex gap-2.5 rounded-xl px-3 py-2.5 ring-1 ring-inset ${theme.insight}`}
              >
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${theme.dot}`} />
                <p className="text-[12px] leading-relaxed text-gray-700 dark:text-gray-300">{reason}</p>
              </motion.li>
            ))}
          </ul>
        </section>

        {/* Score drivers */}
        <section>
          <SectionLabel>Score drivers</SectionLabel>
          <ul className="space-y-2">
            {result.factors.map((factor, index) => (
              <DriverCard key={factor.id} factor={factor} index={index} />
            ))}
          </ul>
        </section>

        {/* Methodology */}
        <section className="rounded-xl border border-gray-100 bg-gray-50/80 dark:border-gray-800 dark:bg-gray-900/50">
          <button
            type="button"
            onClick={() => setMethodologyOpen((o) => !o)}
            className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left transition-colors hover:bg-gray-100/60 dark:hover:bg-gray-800/60"
            aria-expanded={methodologyOpen}
          >
            <span className="flex items-center gap-2">
              <Info className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500" />
              <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400">
                How it&apos;s calculated
              </span>
            </span>
            <ChevronDown
              className={`h-4 w-4 text-gray-400 transition-transform dark:text-gray-500 ${
                methodologyOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {methodologyOpen ? (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              transition={{ duration: 0.2 }}
              className="border-t border-gray-200/80 px-3 pb-3 pt-2 dark:border-gray-700/60"
            >
              <p className="text-[11px] leading-relaxed text-gray-600 dark:text-gray-400">
                {PERFORMANCE_SCORE_METHODOLOGY.summary}
              </p>

              <div className="mt-2.5 space-y-1.5">
                {PERFORMANCE_SCORE_METHODOLOGY.drivers.map((driver) => (
                  <div
                    key={driver.label}
                    className="flex items-start gap-2 rounded-lg bg-white/70 px-2 py-1.5 dark:bg-gray-950/40"
                  >
                    <span className="shrink-0 rounded-md bg-gray-100 px-1.5 py-0.5 text-[9px] font-bold tabular-nums text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                      {driver.weight}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold text-gray-800 dark:text-gray-200">
                        {driver.label}
                      </p>
                      <p className="text-[10px] leading-snug text-gray-500 dark:text-gray-400">
                        {driver.detail}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {PERFORMANCE_SCORE_METHODOLOGY.ratings.map((rating) => {
                  const pillTheme =
                    rating.label === "Strong"
                      ? "bg-success-50 text-success-700 ring-success-200/80 dark:bg-success-500/10 dark:text-success-300 dark:ring-success-500/25"
                      : rating.label === "Stable"
                        ? "bg-amber-50 text-amber-700 ring-amber-200/80 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/25"
                        : "bg-error-50 text-error-700 ring-error-200/80 dark:bg-error-500/10 dark:text-error-300 dark:ring-error-500/25";
                  return (
                    <span
                      key={rating.label}
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${pillTheme}`}
                    >
                      {rating.label}
                      <span className="font-normal opacity-80">{rating.range}</span>
                    </span>
                  );
                })}
              </div>
            </motion.div>
          ) : null}
        </section>
      </div>
    </motion.div>
  );
}
