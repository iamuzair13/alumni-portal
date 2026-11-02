"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";
import {
  Cake,
  Trash2,
  Search,
  Gift,
  Linkedin,
  Loader2,
  ShieldAlert,
} from "lucide-react";
import { isAdminUser, isSuperAdminUser } from "@/lib/alumniProfile";
import Field from "@/components/ui/form/Field";
import Input from "@/components/ui/form/Input";
import FileInput from "@/components/ui/form/FileInput";
import EmptyState from "@/components/ui/EmptyState";

/* ── Types ─────────────────────────────────────────────── */

type LookupAlumni = {
  alumniId: number;
  name: string;
  sapId: string | null;
  registrationNo: string | null;
  program: string | null;
  passingOutYear: number | null;
  association: string | null;
  chapters: Array<{ id: number; title: string }>;
  image: string | null;
};

type BirthdayEntry = {
  id: number;
  alumniId: number;
  name: string;
  sapId: string | null;
  registrationNo: string | null;
  program: string | null;
  passingOutYear: number | null;
  image: string | null;
  linkedinPostUrl: string | null;
  giftImageUrl: string | null;
  createdAt: string | null;
};

/* ── Helpers ───────────────────────────────────────────── */

function imageSrc(raw: string | null): string | null {
  const s = String(raw ?? "").trim();
  if (!s || s === "null") return null;
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith("/")) return s;
  return `/images/${s}`;
}

function formatDate(raw: string | null): string {
  if (!raw) return "—";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-PK", { year: "numeric", month: "short", day: "numeric" });
}

function Avatar({ src, name }: { src: string | null; name: string }) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  const resolved = imageSrc(src);
  if (!resolved) {
    return (
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
        {initial}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={resolved}
      alt={name}
      className="h-12 w-12 shrink-0 rounded-full object-cover ring-2 ring-white dark:ring-gray-800"
    />
  );
}

/* ── Component ─────────────────────────────────────────── */

export function AlumniBirthdaysTab() {
  const { data: session } = useSession();
  const canManage = isSuperAdminUser(session?.user) || isAdminUser(session?.user);

  const [identifier, setIdentifier] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [alumni, setAlumni] = useState<LookupAlumni | null>(null);

  const [linkedinPostUrl, setLinkedinPostUrl] = useState("");
  const [giftFile, setGiftFile] = useState<File | null>(null);
  const [giftPreview, setGiftPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [entries, setEntries] = useState<BirthdayEntry[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadEntries = useCallback(async () => {
    setListLoading(true);
    try {
      const res = await fetch("/api/admin/birthdays", { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as { items?: BirthdayEntry[]; error?: string };
      if (!res.ok) throw new Error(data.error || "Failed to load birthdays");
      setEntries(data.items ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load birthdays");
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canManage) void loadEntries();
    else setListLoading(false);
  }, [canManage, loadEntries]);

  async function handleLookup() {
    const id = identifier.trim();
    if (!id) {
      setLookupError("Enter a SAP ID or registration number.");
      return;
    }
    setLookupLoading(true);
    setLookupError(null);
    setAlumni(null);
    try {
      const res = await fetch(`/api/admin/birthdays/lookup?identifier=${encodeURIComponent(id)}`);
      const data = (await res.json().catch(() => ({}))) as {
        found?: boolean;
        alumni?: LookupAlumni;
        error?: string;
      };
      if (res.status === 404) {
        setLookupError("No alumni record found for this ID.");
        return;
      }
      if (!res.ok) throw new Error(data.error || "Lookup failed");
      if (!data.found || !data.alumni) {
        setLookupError("No alumni record found for this ID.");
        return;
      }
      setAlumni(data.alumni);
      toast.success("Alumni record found");
    } catch (e) {
      setLookupError(e instanceof Error ? e.message : "Lookup failed");
    } finally {
      setLookupLoading(false);
    }
  }

  function handleGiftChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setGiftFile(file);
    setGiftPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return file ? URL.createObjectURL(file) : null;
    });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!alumni) return;

    const url = linkedinPostUrl.trim();
    if (!url) {
      toast.error("LinkedIn post URL is required");
      return;
    }

    setSaving(true);
    try {
      let giftImageUrl: string | null = null;
      if (giftFile) {
        const fd = new FormData();
        fd.append("image", giftFile);
        const up = await fetch("/api/admin/birthdays/upload-image", { method: "POST", body: fd });
        const upData = (await up.json().catch(() => ({}))) as { filename?: string; error?: string };
        if (!up.ok || !upData.filename) {
          throw new Error(upData.error || "Gift image upload failed");
        }
        giftImageUrl = upData.filename;
      }

      const res = await fetch("/api/admin/birthdays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alumniid: alumni.alumniId, linkedinPostUrl: url, giftImageUrl }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Failed to save birthday");

      toast.success("Birthday entry saved");
      setLinkedinPostUrl("");
      setGiftFile(null);
      setGiftPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      if (fileRef.current) fileRef.current.value = "";
      void loadEntries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save birthday");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/birthdays?id=${id}`, { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Failed to delete");
      setEntries((prev) => prev.filter((x) => x.id !== id));
      toast.success("Entry removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setDeletingId(null);
    }
  }

  if (!canManage) {
    return (
      <EmptyState
        icon={<ShieldAlert className="h-5 w-5" aria-hidden />}
        title="Admins only"
        description="Birthday management is restricted to admin and superadmin users."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* ── Left: add form ── */}
        <div className="space-y-6 xl:col-span-5">
          {/* Step 1: lookup */}
          <section className="card p-5 sm:p-6" aria-labelledby="birthday-lookup-h">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
                <Search className="h-4 w-4" aria-hidden />
              </span>
              <div>
                <h2 id="birthday-lookup-h" className="text-base font-semibold text-gray-900 dark:text-gray-100">
                  Step 1 — Find Alumni
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Enter a SAP ID or registration number to fetch the alumni record.
                </p>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <Field htmlFor="birthdayIdentifier" label="SAP ID / Registration No" required className="flex-1" error={lookupError}>
                <Input
                  id="birthdayIdentifier"
                  placeholder="e.g. 2015-CSE-1234"
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value);
                    setLookupError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void handleLookup();
                    }
                  }}
                />
              </Field>
            </div>
            <button
              type="button"
              onClick={handleLookup}
              disabled={lookupLoading || !identifier.trim()}
              className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
            >
              {lookupLoading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              Fetch Alumni Details
            </button>
          </section>

          {/* Fetched profile */}
          {alumni && (
            <section className="card overflow-hidden" aria-labelledby="birthday-profile-h">
              <div className="border-b border-gray-100 bg-gradient-to-r from-brand-50/60 to-transparent px-5 py-4 dark:border-gray-800 dark:from-brand-500/5">
                <h3 id="birthday-profile-h" className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Alumni Profile
                </h3>
              </div>
              <div className="p-5">
                <div className="flex items-start gap-4">
                  <Avatar src={alumni.image} name={alumni.name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-semibold text-gray-900 dark:text-gray-100">{alumni.name}</p>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      {alumni.sapId ?? alumni.registrationNo ?? "—"}
                    </p>
                    <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">Program</dt>
                        <dd className="mt-0.5 truncate text-gray-800 dark:text-gray-200">{alumni.program ?? "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">Passing Out</dt>
                        <dd className="mt-0.5 text-gray-800 dark:text-gray-200">{alumni.passingOutYear ?? "—"}</dd>
                      </div>
                      <div className="sm:col-span-2">
                        <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">Association</dt>
                        <dd className="mt-0.5 text-gray-800 dark:text-gray-200">{alumni.association ?? "—"}</dd>
                      </div>
                    </dl>
                    {alumni.chapters.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Chapters</p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {alumni.chapters.map((c) => (
                            <span
                              key={c.id}
                              className="rounded-full border border-brand-200 bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300"
                            >
                              {c.title}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Step 2: details */}
          {alumni && (
            <form onSubmit={handleSave} className="card p-5 sm:p-6" aria-labelledby="birthday-details-h">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
                  <Gift className="h-4 w-4" aria-hidden />
                </span>
                <div>
                  <h2 id="birthday-details-h" className="text-base font-semibold text-gray-900 dark:text-gray-100">
                    Step 2 — Birthday Details
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Add the LinkedIn post and an optional gift image.
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-4">
                <Field
                  htmlFor="linkedinPostUrl"
                  label="LinkedIn Post URL"
                  required
                  hint="Direct link to the birthday post on LinkedIn."
                >
                  <Input
                    id="linkedinPostUrl"
                    type="url"
                    placeholder="https://www.linkedin.com/posts/…"
                    value={linkedinPostUrl}
                    onChange={(e) => setLinkedinPostUrl(e.target.value)}
                    required
                  />
                </Field>

                <Field
                  htmlFor="giftImage"
                  label="Gift Image"
                  hint="JPEG / PNG / WebP, max 5MB. Optional."
                >
                  <FileInput
                    id="giftImage"
                    ref={fileRef}
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    onChange={handleGiftChange}
                  />
                </Field>

                {giftPreview && (
                  <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={giftPreview}
                      alt="Gift preview"
                      className="h-14 w-14 rounded-lg object-cover"
                    />
                    <span className="min-w-0 truncate text-xs text-gray-500 dark:text-gray-400">
                      {giftFile?.name}
                    </span>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={saving || !linkedinPostUrl.trim()}
                className="mt-6 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                Save Birthday Entry
              </button>
            </form>
          )}
        </div>

        {/* ── Right: entries list ── */}
        <section className="xl:col-span-7" aria-labelledby="birthday-list-h">
          <div className="card overflow-hidden">
            <div className="flex items-center gap-2.5 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
                <Cake className="h-4 w-4" aria-hidden />
              </span>
              <h2 id="birthday-list-h" className="text-base font-semibold text-gray-900 dark:text-gray-100">
                Birthday List
              </h2>
              <span className="ml-auto rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                {entries.length}
              </span>
            </div>

            {listLoading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading…
              </div>
            ) : entries.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={<Cake className="h-5 w-5" aria-hidden />}
                  title="No birthdays yet"
                  description="Look up an alumni on the left and save the first birthday entry."
                />
              </div>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                {entries.map((entry) => (
                  <li key={entry.id} className="flex items-center gap-4 px-5 py-4">
                    <Avatar src={entry.image} name={entry.name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {entry.name}
                      </p>
                      <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                        {[entry.sapId, entry.program, entry.passingOutYear]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {entry.linkedinPostUrl && (
                          <a
                            href={entry.linkedinPostUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-full bg-[#0a66c2]/10 px-2.5 py-1 text-xs font-medium text-[#0a66c2] transition hover:bg-[#0a66c2]/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0a66c2]/40"
                          >
                            <Linkedin className="h-3 w-3" aria-hidden /> LinkedIn
                          </a>
                        )}
                        {entry.giftImageUrl && (
                          <a
                            href={imageSrc(entry.giftImageUrl) ?? "#"}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 transition hover:bg-brand-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 dark:bg-brand-500/10 dark:text-brand-300"
                          >
                            <Gift className="h-3 w-3" aria-hidden /> Gift
                          </a>
                        )}
                        <span className="text-xs text-gray-400">{formatDate(entry.createdAt)}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDelete(entry.id)}
                      disabled={deletingId === entry.id}
                      aria-label={`Remove ${entry.name} from birthdays`}
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-400 transition hover:bg-error-50 hover:text-error-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-error-500/40 disabled:opacity-50 dark:hover:bg-error-500/10"
                    >
                      {deletingId === entry.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      ) : (
                        <Trash2 className="h-4 w-4" aria-hidden />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
