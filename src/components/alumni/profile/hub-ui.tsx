import Link from "next/link";
import { ArrowRight } from "lucide-react";
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
          className={`inline-flex h-9 w-9 items-center justify-center rounded-lg [&>svg]:h-5 [&>svg]:w-5 ${TONE_STYLES[tone]}`}
        >
          {icon}
        </span>
        {badge}
      </div>
      <p className="mt-3 text-sm font-semibold text-content">
        {label}
      </p>
      {headline ? (
        <p className="mt-0.5 text-lg font-bold text-content leading-snug">{headline}</p>
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
