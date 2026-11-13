"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, SectionHeader } from "@/components/alumni/profile/hub-ui";

type NewsletterRow = {
  id: number;
  created_at: string;
  title: string | null;
  date: string | null;
  image: string | null;
  link: string | null;
};

type NewsletterResponse = {
  items: NewsletterRow[];
  total: number;
  limit: number;
  offset: number;
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleDateString();
  } catch {
    return String(iso);
  }
}

export default function UpdatesTab() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<NewsletterResponse>({ items: [], total: 0, limit: 10, offset: 0 });

  const fetchNewsletters = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/alumni/newsletters?limit=10&offset=0", { cache: "no-store" });
      const json = (await res.json()) as NewsletterResponse & { error?: string };
      if (!res.ok) {
        throw new Error(String(json?.error || "Failed to load newsletters"));
      }
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load newsletters");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNewsletters();
  }, [fetchNewsletters]);

  const content = useMemo(() => {
    const items = data.items ?? [];
    const hasItems = items.length > 0;
    if (loading) {
      return (
        <div className="space-y-3" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-surface-raised" />
          ))}
        </div>
      );
    }

    if (error) {
      return (
        <div className="rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 dark:border-error-900 dark:bg-error-950/40 dark:text-error-300">
          {error}
        </div>
      );
    }

    if (!hasItems) {
      return <div className="rounded-xl border border-dashed border-border-subtle bg-surface-raised px-4 py-8 text-center text-sm text-content-muted">No newsletters yet.</div>;
    }

    return (
      <div className="grid grid-cols-1 gap-3">
        {items.map((n) => (
          <div key={n.id} className="rounded-xl border border-border-subtle bg-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate font-semibold text-content">{n.title || "Untitled"}</div>
                <div className="mt-1 text-xs text-content-muted">{n.date || formatDate(n.created_at)}</div>
              </div>
              <div className="flex items-center gap-2">
                {n.link ? (
                  <a
                    href={n.link}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-700 dark:bg-brand-500 dark:text-accent-950 dark:hover:bg-brand-400"
                  >
                    View
                  </a>
                ) : (
                  <span className="text-xs text-content-muted">No link</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }, [data.items, error, loading]);

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <SectionHeader
          title="Newsletters"
          description="Read-only. Tap View to open the newsletter link."
          action={
            <button
              type="button"
              onClick={fetchNewsletters}
              disabled={loading}
              className="inline-flex items-center justify-center rounded-lg border border-border-subtle px-3 py-2 text-xs font-medium text-content-secondary hover:bg-surface-raised disabled:opacity-50"
            >
              Refresh
            </button>
          }
        />
        <div aria-live="polite">{content}</div>
      </Card>
    </div>
  );
}
