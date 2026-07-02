import { normalizeStoryStatus, type StoryStatus } from "@/lib/alumniStories";

type Props = {
  status: string | null | undefined;
  className?: string;
  size?: "sm" | "md";
};

const STYLES: Record<StoryStatus, string> = {
  pending: "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:ring-amber-800/50",
  approved: "bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:ring-emerald-800/50",
  "not-approved": "bg-rose-50 text-rose-800 ring-rose-200 dark:bg-rose-900/30 dark:text-rose-200 dark:ring-rose-800/50",
};

const LABELS: Record<StoryStatus, string> = {
  pending: "Pending Review",
  approved: "Approved",
  "not-approved": "Not Approved",
};

export default function StoryStatusBadge({ status, className = "", size = "md" }: Props) {
  const normalized = normalizeStoryStatus(status);
  const sizeClass = size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs";

  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold ring-1 ring-inset ${sizeClass} ${STYLES[normalized]} ${className}`}
    >
      {LABELS[normalized]}
    </span>
  );
}
