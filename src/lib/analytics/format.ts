import type { AnalyticsPeriod } from "./types";

function formatMonthShort(d: Date) {
  return new Intl.DateTimeFormat("en", { month: "short" }).format(d);
}

export function formatBucketLabel(period: AnalyticsPeriod, bucket: Date): string {
  // Buckets are returned from Postgres truncated to period start.
  switch (period) {
    case "daily":
      return new Intl.DateTimeFormat("en", { month: "short", day: "2-digit" }).format(bucket);
    case "weekly":
      return `Wk ${new Intl.DateTimeFormat("en", { month: "short", day: "2-digit" }).format(bucket)}`;
    case "monthly":
      return `${formatMonthShort(bucket)}`;
    case "yearly":
      return String(bucket.getUTCFullYear());
    default:
      return bucket.toISOString();
  }
}

