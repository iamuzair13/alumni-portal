"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/modal";

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

export default function NewslettersCard() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<NewsletterResponse>({ items: [], total: 0, limit: 10, offset: 0 });

  const items = data.items ?? [];
  const hasItems = items.length > 0;

  const fetchNewsletters = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/alumni/newsletters?limit=10&offset=0", { cache: "no-store" });
      const json = (await res.json()) as any;
      if (!res.ok) {
        throw new Error(String(json?.error || "Failed to load newsletters"));
      }
      setData(json as NewsletterResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load newsletters");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    fetchNewsletters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const content = useMemo(() => {
    if (loading) {
      return (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 rounded-lg bg-gray-100 animate-pulse" />
          ))}
        </div>
      );
    }

    if (error) {
      return (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      );
    }

    if (!hasItems) {
      return <div className="text-sm text-gray-600">No newsletters yet.</div>;
    }

    return (
      <div className="grid grid-cols-1 gap-3">
        {items.map((n) => (
          <div key={n.id} className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold text-gray-900 truncate">{n.title || "Untitled"}</div>
                <div className="mt-1 text-xs text-gray-600">{n.date || formatDate(n.created_at)}</div>
              </div>
              <div className="flex items-center gap-2">
                {n.link ? (
                  <a
                    href={n.link}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                  >
                    View
                  </a>
                ) : (
                  <span className="text-xs text-gray-400">No link</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }, [error, hasItems, items, loading]);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5 md:p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h4 className="text-lg font-bold text-slate-900">Newsletters</h4>
          <p className="text-xs text-slate-600">Read-only. Tap View to see all newsletters.</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center justify-center rounded-lg bg-[#183D32] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0e241d]"
        >
          View
        </button>
      </div>

      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        className="w-[95vw] max-w-[720px]"
      >
        <div className="p-4 sm:p-6">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-lg font-bold text-gray-900">Newsletters</h3>
              <p className="text-xs text-gray-600">Tap View to open the newsletter link.</p>
            </div>
            <button
              type="button"
              onClick={fetchNewsletters}
              disabled={loading}
              className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Refresh
            </button>
          </div>

          <div className="max-h-[75vh] overflow-auto pr-1">
            {content}
          </div>
        </div>
      </Modal>
    </div>
  );
}
