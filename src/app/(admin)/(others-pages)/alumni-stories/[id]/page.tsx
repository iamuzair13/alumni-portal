"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import ComponentCard from "@/components/common/ComponentCard";

type FacultyOption =
  | "Engineering"
  | "Business"
  | "Sciences"
  | "Arts"
  | "Law"
  | "Medicine";

type StoryForm = {
  imageUrl: string;
  name: string;
  degreeSession: string;
  faculty: FacultyOption | "";
  company: string;
  designation: string;
  cityCountry: string;
  shortStories: string;
  descriptionHtml: string;
  showHome: boolean;
  date: string; // YYYY-MM-DD
};

type ApiStory = {
  id: string;
  date: string;
  name: string;
  program: string;
  session: string;
  shortDescription: string;
  imageUrl: string;
};

const CITY_COUNTRY_SUGGESTIONS: string[] = [
  "Lahore, Pakistan",
  "Karachi, Pakistan",
  "Islamabad, Pakistan",
  "Faisalabad, Pakistan",
  "Multan, Pakistan",
  "Rawalpindi, Pakistan",
  "Peshawar, Pakistan",
  "Quetta, Pakistan",
];

function sanitizeHtml(input: string): string {
  try {
    // Basic sanitization: remove script/style tags and on* attributes
    let s = input.replace(/<\/(script|style)>/gi, "").replace(/<(script|style)[^>]*>/gi, "");
    s = s.replace(/ on[a-z]+="[^"]*"/gi, "");
    // Allow only basic tags
    const allowed = ["b", "i", "u", "strong", "em", "p", "br", "ul", "ol", "li", "a"];
    return s.replace(/<([^\s>\/]+)([^>]*)>/g, (m, tag) => (allowed.includes(String(tag).toLowerCase()) ? m : ""));
  } catch {
    return "";
  }
}

export default function StoryDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id as string;

  const [form, setForm] = useState<StoryForm>({
    imageUrl: "",
    name: "",
    degreeSession: "",
    faculty: "",
    company: "",
    designation: "",
    cityCountry: "",
    shortStories: "",
    descriptionHtml: "",
    showHome: false,
    date: "",
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string>("");
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/alumni-stories/${id}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`Failed to load: ${res.status}`);
        const data: ApiStory = await res.json();
        if (!active) return;
        setForm({
          imageUrl: data.imageUrl || "",
          name: data.name || "",
          degreeSession: `${data.program || ""} • ${data.session || ""}`.trim(),
          faculty: "",
          company: "",
          designation: "",
          cityCountry: "",
          shortStories: data.shortDescription || "",
          descriptionHtml: `<p>${(data.shortDescription || "").replace(/</g, "&lt;")}</p>`,
          showHome: false,
          date: (data.date && !Number.isNaN(new Date(data.date).getTime()))
            ? new Date(data.date).toISOString().slice(0, 10)
            : "",
        });
        setImagePreviewUrl(data.imageUrl || "");
      } catch {
        if (active) setError("Unable to load story.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id]);

  const isValid = useMemo(() => {
    const errs: string[] = [];
    if (!form.name.trim() || form.name.length > 100) errs.push("Name is required and must be ≤ 100 chars.");
    if (!form.degreeSession.trim() || form.degreeSession.length > 100) errs.push("Degree & Session is required and must be ≤ 100 chars.");
    if (!form.faculty) errs.push("Faculty is required.");
    if (!form.company.trim() || form.company.length > 100) errs.push("Company is required and must be ≤ 100 chars.");
    if (!form.designation.trim() || form.designation.length > 100) errs.push("Designation is required and must be ≤ 100 chars.");
    if (!form.cityCountry.trim() || form.cityCountry.length > 100) errs.push("City, Country is required and must be ≤ 100 chars.");
    if (!form.shortStories.trim() || form.shortStories.length > 500) errs.push("Short Stories is required and must be ≤ 500 chars.");
    if (!form.descriptionHtml.trim()) errs.push("Description is required.");
    if (!form.date) errs.push("Date is required.");
    if (imageFile) {
      const isImg = ["image/jpeg", "image/png"].includes(imageFile.type);
      if (!isImg) errs.push("Image must be JPG or PNG.");
      if (imageFile.size > 2 * 1024 * 1024) errs.push("Image must be ≤ 2MB.");
    }
    return errs.length === 0;
  }, [form, imageFile]);

  function update<K extends keyof StoryForm>(key: K, value: StoryForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSuccess(null);
    setError(null);
  }

  function onImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null;
    if (!file) {
      setImageFile(null);
      setImagePreviewUrl(form.imageUrl);
      return;
    }
    setImageFile(file);
    if (["image/jpeg", "image/png"].includes(file.type) && file.size <= 2 * 1024 * 1024) {
      const url = URL.createObjectURL(file);
      setImagePreviewUrl(url);
    } else {
      setError("Invalid image. Please use JPG/PNG up to 2MB.");
      setImagePreviewUrl("");
    }
  }

  function execCmd(command: string) {
    try {
      document.execCommand(command);
      const html = editorRef.current?.innerHTML || "";
      update("descriptionHtml", html);
    } catch {}
  }

  async function onSave() {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      if (!isValid) throw new Error("Please fix validation errors.");
      const payload = {
        id,
        imageUrl: imagePreviewUrl || form.imageUrl || "",
        name: form.name.trim(),
        degreeSession: form.degreeSession.trim(),
        faculty: form.faculty,
        company: form.company.trim(),
        designation: form.designation.trim(),
        cityCountry: form.cityCountry.trim(),
        shortStories: form.shortStories.trim(),
        descriptionHtml: sanitizeHtml(form.descriptionHtml),
        showHome: !!form.showHome,
        date: form.date,
      };
      const res = await fetch(`/api/alumni-stories/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Save failed: ${res.status}`);
      setSuccess("Changes saved successfully.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ComponentCard title="Edit Alumni Story" className="">
      {loading && (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-12 rounded-xl bg-gray-200 animate-pulse dark:bg-white/10" />
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="mb-4 rounded-xl border border-red-300 bg-red-50 p-3 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
          {error}
        </div>
      )}
      {!loading && success && (
        <div className="mb-4 rounded-xl border border-green-300 bg-green-50 p-3 text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-200">
          {success}
        </div>
      )}

      {!loading && (
        <form className="grid grid-cols-1 md:grid-cols-3 gap-6" onSubmit={(e) => { e.preventDefault(); onSave(); }}>
          {/* Left column: image upload */}
          <div className="md:col-span-1">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
              <div className="flex flex-col items-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={(function () {
                    const u = (imagePreviewUrl || form.imageUrl || "").trim();
                    if (!u || u === "null") return "https://via.placeholder.com/128";
                    try {
                      // If it's an absolute URL (http/https), use it as is
                      if (/^https?:\/\//i.test(u)) {
                        const t = new URL(u);
                        if (t.protocol === "http:") t.protocol = "https:";
                        return t.toString();
                      }
                      // If it starts with /, use it as is
                      if (u.startsWith('/')) {
                        return u;
                      }
                      // Otherwise, assume it's a filename and prepend /images/
                      return `/images/${u}`;
                    } catch {
                      return "https://via.placeholder.com/128";
                    }
                  })()}
                  alt={`${form.name || "Alumni"}'s image`}
                  className="w-32 h-32 rounded-xl object-cover"
                  onError={(e) => { e.currentTarget.src = "https://via.placeholder.com/128"; }}
                />
                <div className="mt-3 w-full">
                  <label className="text-sm text-gray-600 dark:text-gray-300">Image (JPG/PNG ≤ 2MB)</label>
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    onChange={onImageChange}
                    className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-theme-xs focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right column: form fields */}
          <div className="md:col-span-2">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-sm text-gray-600 dark:text-gray-300">Name *</label>
                  <input
                    value={form.name}
                    onChange={(e) => update("name", e.target.value.slice(0, 100))}
                    className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-theme-xs focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm text-gray-600 dark:text-gray-300">Degree & Session *</label>
                  <input
                    value={form.degreeSession}
                    onChange={(e) => update("degreeSession", e.target.value.slice(0, 100))}
                    className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-theme-xs focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm text-gray-600 dark:text-gray-300">Faculty *</label>
                  <select
                    value={form.faculty}
                    onChange={(e) => update("faculty", e.target.value as FacultyOption)}
                    className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-theme-xs focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                  >
                    <option value="">Select faculty</option>
                    {(["Engineering","Business","Sciences","Arts","Law","Medicine"] as FacultyOption[]).map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm text-gray-600 dark:text-gray-300">Company *</label>
                  <input
                    value={form.company}
                    onChange={(e) => update("company", e.target.value.slice(0, 100))}
                    className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-theme-xs focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm text-gray-600 dark:text-gray-300">Designation *</label>
                  <input
                    value={form.designation}
                    onChange={(e) => update("designation", e.target.value.slice(0, 100))}
                    className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-theme-xs focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm text-gray-600 dark:text-gray-300">City, Country *</label>
                  <input
                    value={form.cityCountry}
                    list="city-country-list"
                    onChange={(e) => update("cityCountry", e.target.value.slice(0, 100))}
                    className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-theme-xs focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                  />
                  <datalist id="city-country-list">
                    {CITY_COUNTRY_SUGGESTIONS.map((opt) => (
                      <option key={opt} value={opt} />
                    ))}
                  </datalist>
                </div>
                <div className="sm:col-span-2 flex flex-col gap-2">
                  <label className="text-sm text-gray-600 dark:text-gray-300">Short Stories *</label>
                  <textarea
                    value={form.shortStories}
                    onChange={(e) => update("shortStories", e.target.value.slice(0, 500))}
                    rows={3}
                    className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-theme-xs focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                  />
                </div>
                <div className="sm:col-span-2 flex flex-col gap-2">
                  <label className="text-sm text-gray-600 dark:text-gray-300">Description *</label>
                  <div className="flex gap-2 mb-2">
                    <button type="button" className="px-2 py-1 rounded border" onClick={() => execCmd("bold")}>B</button>
                    <button type="button" className="px-2 py-1 rounded border italic" onClick={() => execCmd("italic")}>I</button>
                    <button type="button" className="px-2 py-1 rounded border underline" onClick={() => execCmd("underline")}>U</button>
                    <button type="button" className="px-2 py-1 rounded border" onClick={() => execCmd("insertUnorderedList")}>• List</button>
                  </div>
                  <div
                    ref={editorRef}
                    contentEditable
                    onInput={() => update("descriptionHtml", editorRef.current?.innerHTML || "")}
                    className="min-h-[120px] rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                    dangerouslySetInnerHTML={{ __html: form.descriptionHtml }}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="showHome"
                    type="checkbox"
                    checked={form.showHome}
                    onChange={(e) => update("showHome", e.target.checked)}
                  />
                  <label htmlFor="showHome" className="text-sm text-gray-600 dark:text-gray-300">Show Home</label>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm text-gray-600 dark:text-gray-300">Date *</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => update("date", e.target.value)}
                    className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-theme-xs focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                  />
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setForm((p) => ({ ...p, name: "", degreeSession: "", faculty: "", company: "", designation: "", cityCountry: "", shortStories: "", descriptionHtml: "", showHome: false, date: "" }));
                    setImageFile(null);
                    setImagePreviewUrl("");
                    setSuccess(null);
                    setError(null);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-300 bg-white text-gray-700 text-sm font-semibold hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors shadow-sm hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  Reset
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors shadow-sm hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Saving...
                    </>
                  ) : (
                    "Save"
                  )}
                </button>
              </div>
            </div>
          </div>
        </form>
      )}
    </ComponentCard>
  );
}