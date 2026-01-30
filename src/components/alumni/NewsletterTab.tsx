"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { isSuperAdminUser } from "@/lib/alumniProfile";
import SyncedTableScroll from "@/components/tables/SyncedTableScroll";
import Pagination from "@/components/tables/Pagination";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";

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

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export const NewsletterTab: React.FC = () => {
  const { data: session } = useSession();
  const canAccess = useMemo(() => {
    return isSuperAdminUser(session?.user);
  }, [session?.user]);

  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [image, setImage] = useState("");
  const [link, setLink] = useState("");

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(25);
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [data, setData] = useState<NewsletterResponse>({ items: [], total: 0, limit: 25, offset: 0 });

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil((data.total || 0) / limit));
  }, [data.total, limit]);

  useEffect(() => {
    if (!canAccess) return;

    const controller = new AbortController();
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set("limit", String(limit));
        params.set("offset", String((page - 1) * limit));
        if (q.trim()) params.set("q", q.trim());

        const res = await fetch(`/api/admin/newsletters?${params.toString()}`, { signal: controller.signal });
        const json = (await res.json()) as any;
        if (!res.ok) {
          throw new Error(String(json?.error || "Failed to fetch newsletters"));
        }
        setData(json as NewsletterResponse);
      } catch (e) {
        if ((e as any)?.name === "AbortError") return;
        setError(e instanceof Error ? e.message : "Failed to fetch newsletters");
      } finally {
        setLoading(false);
      }
    };

    run();
    return () => controller.abort();
  }, [canAccess, limit, page, q]);

  useEffect(() => {
    setPage(1);
  }, [limit, q]);

  const handleCreate = async () => {
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch("/api/admin/newsletters", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          title,
          date,
          image,
          link,
        }),
      });
      const json = (await res.json()) as any;
      if (!res.ok) {
        throw new Error(String(json?.error || "Failed to create newsletter"));
      }

      setTitle("");
      setDate("");
      setImage("");
      setLink("");
      setSuccessMsg("Newsletter published.");

      // refresh list
      setPage(1);
      const params = new URLSearchParams();
      params.set("limit", String(limit));
      params.set("offset", "0");
      if (q.trim()) params.set("q", q.trim());
      const refreshRes = await fetch(`/api/admin/newsletters?${params.toString()}`);
      const refreshJson = (await refreshRes.json()) as any;
      if (refreshRes.ok) {
        setData(refreshJson as NewsletterResponse);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create newsletter");
    } finally {
      setSaving(false);
    }
  };

  const handleUploadImage = async () => {
    if (!imageFile) {
      setError("Please choose an image first.");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", imageFile);
      const res = await fetch("/api/admin/newsletters/upload", {
        method: "POST",
        body: fd,
      });
      const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok) {
        throw new Error(String(json?.error || "Failed to upload image"));
      }
      const url = String(json?.url || "");
      setImage(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to upload image");
    } finally {
      setUploading(false);
    }
  };

  if (!canAccess) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-8 dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white/90 mb-2">Forbidden</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">Only Super Admin can manage newsletters.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
          <div className="lg:col-span-2">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              placeholder="Newsletter title"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Link (redirect)</label>
            <input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              placeholder="https://..."
            />
          </div>

          <div className="lg:col-span-3">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Image</label>
            <div className="flex flex-col gap-2">
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={handleUploadImage}
                  disabled={uploading || !imageFile}
                  className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  {uploading ? "Uploading..." : "Upload"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setImage("");
                    setImageFile(null);
                  }}
                  className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  Clear
                </button>
              </div>

              {image ? (
                <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                  <div className="h-16 w-24 overflow-hidden rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={image} alt="Newsletter" className="h-full w-full object-cover" />
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 break-all">
                    Stored URL: <span className="font-mono">{image}</span>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-gray-500 dark:text-gray-400">No image uploaded.</div>
              )}
            </div>
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={handleCreate}
              disabled={saving}
              className="inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Publishing..." : "Publish"}
            </button>
          </div>
        </div>

        {successMsg && (
          <div className="mt-3 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800">
            {successMsg}
          </div>
        )}

        {error && (
          <div className="mt-3 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Search</label>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              placeholder="title, link, image"
            />
          </div>

          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-600 dark:text-gray-400">Rows</label>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-2 text-sm"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={(p) => setPage(Math.max(1, Math.min(totalPages, p)))}
            />
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-lg border border-gray-200 bg-white shadow dark:border-gray-700 dark:bg-gray-800/50">
          <SyncedTableScroll minWidth={1200} maxHeight={650}>
            <Table className="min-w-full">
              <TableHeader className="bg-gray-50 dark:bg-gray-900/50 sticky top-0 z-10">
                <TableRow className="border-b border-gray-200 dark:border-gray-700">
                  <TableCell className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300">Created</TableCell>
                  <TableCell className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300">Title</TableCell>
                  <TableCell className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300">Date</TableCell>
                  <TableCell className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300">Image</TableCell>
                  <TableCell className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300">Link</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
                {loading && (
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={`s-${i}`}>
                      <TableCell className="px-4 py-4"><div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" /></TableCell>
                      <TableCell className="px-4 py-4"><div className="h-4 w-64 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" /></TableCell>
                      <TableCell className="px-4 py-4"><div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" /></TableCell>
                      <TableCell className="px-4 py-4"><div className="h-4 w-64 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" /></TableCell>
                      <TableCell className="px-4 py-4"><div className="h-4 w-64 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" /></TableCell>
                    </TableRow>
                  ))
                )}

                {!loading && data.items.length === 0 && (
                  <TableRow>
                    <TableCell className="px-4 py-10 text-center text-gray-500" colSpan={5}>
                      No newsletters found.
                    </TableCell>
                  </TableRow>
                )}

                {!loading && data.items.map((row) => (
                  <TableRow key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <TableCell className="px-4 py-3 text-sm whitespace-nowrap">
                      {formatDateTime(row.created_at)}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white/90">
                      {row.title || "-"}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm whitespace-nowrap">
                      {row.date || "-"}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm">
                      {row.image ? (
                        <a
                          href={row.image}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-700 dark:text-blue-400 underline"
                        >
                          Open
                        </a>
                      ) : "-"}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm">
                      {row.link ? (
                        <a
                          href={row.link}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-700 dark:text-blue-400 underline"
                        >
                          Open
                        </a>
                      ) : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </SyncedTableScroll>
        </div>
      </div>
    </div>
  );
};
