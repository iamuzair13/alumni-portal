"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useEffect } from "react";
import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-border-subtle bg-surface shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-lg font-bold text-content sm:text-xl">{title}</h2>
        {description ? <p className="mt-1 text-sm text-content-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

type TileTone = "brand" | "amber" | "sky" | "violet" | "rose" | "emerald" | "orange";

const TONE_STYLES: Record<TileTone, string> = {
  brand: "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300",
  amber: "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
  sky: "bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300",
  violet: "bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300",
  rose: "bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300",
  emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
  orange: "bg-orange-50 text-orange-600 dark:bg-orange-500/15 dark:text-orange-300",
};

export function HubTile({
  href,
  icon,
  tone = "brand",
  label,
  headline,
  subline,
  badge,
  cta,
  disabled = false,
}: {
  href: string;
  icon: ReactNode;
  tone?: TileTone;
  label: string;
  headline?: ReactNode;
  subline?: ReactNode;
  badge?: ReactNode;
  cta: string;
  disabled?: boolean;
  disabledText?: string;
}) {
  const inner = (
    <>
      <div className="flex items-start justify-between">
        <span
          aria-hidden
          className={`inline-flex h-10 w-10 items-center justify-center rounded-xl [&>svg]:h-5 [&>svg]:w-5 ${TONE_STYLES[tone]}`}
        >
          {icon}
        </span>
        {badge}
      </div>
      <p className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-content-muted">
        {label}
      </p>
      {headline ? (
        <p className="mt-0.5 text-lg font-bold text-content leading-snug sm:text-xl">{headline}</p>
      ) : null}
      {subline ? (
        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-content-secondary">{subline}</p>
      ) : null}
      <p className="mt-auto pt-3 flex items-center gap-1 text-sm font-semibold text-brand-600 group-hover:text-brand-700 dark:text-brand-400 dark:group-hover:text-brand-300">
        {cta}
        {!disabled && (
          <ArrowRight
            className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none"
            aria-hidden
          />
        )}
      </p>
    </>
  );

  if (disabled) {
    return (
      <div
        aria-disabled="true"
        className="relative flex cursor-not-allowed flex-col rounded-2xl border border-border-subtle bg-surface p-4 opacity-70 shadow-sm"
      >
        {inner}
      </div>
    );
  }

  return (
    <Link
      href={href}
      className="group relative flex flex-col rounded-2xl border border-border-subtle bg-surface p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
    >
      {inner}
    </Link>
  );
}

export function Notice({
  variant = "info",
  icon,
  children,
  action,
}: {
  variant?: "info" | "success" | "warning" | "error";
  icon?: ReactNode;
  children: ReactNode;
  action?: ReactNode;
}) {
  const styles = {
    info: "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300",
    success:
      "border-success-200 bg-success-50 text-success-800 dark:border-success-500/30 dark:bg-success-500/10 dark:text-success-300",
    warning:
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300",
    error:
      "border-error-200 bg-error-50 text-error-800 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300",
  }[variant];
  return (
    <div
      role="status"
      className={`flex items-center gap-2.5 rounded-2xl border px-4 py-2.5 text-sm font-semibold ${styles}`}
    >
      {icon ? <span className="shrink-0 [&>svg]:h-4 [&>svg]:w-4" aria-hidden>{icon}</span> : null}
      <span className="min-w-0 flex-1">{children}</span>
      {action}
    </div>
  );
}

export function Chip({
  children,
  tone = "brand",
}: {
  children: ReactNode;
  tone?: "brand" | "sky" | "amber" | "neutral";
}) {
  const tones: Record<string, string> = {
    brand:
      "border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300",
    sky: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300",
    amber:
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300",
    neutral:
      "border-border-subtle bg-surface-raised text-content-secondary",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export const BTN =
  "inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500";

export const BTN_PRIMARY = `${BTN} bg-brand-600 text-white hover:bg-brand-700 dark:bg-brand-500 dark:text-accent-950 dark:hover:bg-brand-400`;

export const BTN_SECONDARY = `${BTN} border border-border-subtle bg-surface text-content-secondary hover:bg-surface-raised`;

/** Small count/status pill used inside tiles and list items. */
export const PILL_TONES: Record<TileTone | "neutral", string> = {
  brand: "border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300",
  amber: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300",
  sky: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300",
  violet: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300",
  rose: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300",
  orange: "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-300",
  neutral: "border-border-subtle bg-surface-raised text-content-secondary",
};

export function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: TileTone | "neutral";
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${PILL_TONES[tone]}`}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border-subtle bg-surface-raised px-4 py-10 text-center">
      {icon ? (
        <span aria-hidden className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-surface text-content-muted [&>svg]:h-5 [&>svg]:w-5">
          {icon}
        </span>
      ) : null}
      <p className="text-sm font-semibold text-content">{title}</p>
      {description ? <p className="mt-1 max-w-sm text-xs text-content-muted">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ListSkeleton({ rows = 4, height = "h-14" }: { rows?: number; height?: string }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={`${height} animate-pulse rounded-xl bg-surface-raised`} />
      ))}
    </div>
  );
}

/** Token-styled dialog: centered on sm+, bottom sheet on mobile.
 *  Handles Escape, backdrop click and body scroll lock. */
export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[90vh] w-full overflow-y-auto rounded-t-2xl border border-border-subtle bg-surface p-5 shadow-xl sm:max-w-md sm:rounded-2xl sm:p-6"
      >
        <h3 className="text-lg font-semibold text-content">{title}</h3>
        <div className="mt-4">{children}</div>
        {footer ? <div className="mt-6 flex items-center justify-end gap-3">{footer}</div> : null}
      </div>
    </div>
  );
}
