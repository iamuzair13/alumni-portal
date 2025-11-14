"use client";
import React from "react";
import Link from "next/link";
import ComponentCard from "@/components/common/ComponentCard";
import { useAlumniStories, type AlumniStoryItem } from "@/app/queries/fetch-alumni-stories";

type SuccessStory = {
  id: string;
  title: string;
  short: string;
  imageUrl?: string;
};

function sanitizeText(input: string): string {
  return String(input || "")
    .replace(/<script[^>]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export default function Page() {
  const { data, isLoading, isFetching, isError, error } = useAlumniStories();
  const items: SuccessStory[] = (data ?? []).map((s: AlumniStoryItem) => ({
    id: s.id,
    title: sanitizeText(s.name).slice(0, 50),
    short: sanitizeText(s.shortDescription).slice(0, 150),
    imageUrl: s.imageUrl,
  }));

  return (
    <ComponentCard title="Alumni Success Stories">
      <div className="flex items-center justify-end mb-4">
        <Link href="/alumni-success/new" className="inline-flex items-center px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
          Add Story
        </Link>
      </div>
      {(isLoading || isFetching) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-40 rounded-xl bg-gray-200 animate-pulse dark:bg-white/10" />
          ))}
        </div>
      )}
      {isError && (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-red-700">
          {error?.message || "Failed to load stories"}
        </div>
      )}
      {!isLoading && !isError && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((c) => (
            <div key={c.id} className="bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden">
              <div className="flex items-center justify-center bg-slate-100 h-32">
                <svg role="img" aria-label="Story" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-14 h-14 text-blue-600">
                  <path className="fill-current" d="M4 3h12a2 2 0 012 2v11a2 2 0 01-2 2H9l-5 3V5a2 2 0 012-2zm3 5h8v2H7V8zm0 4h8v2H7v-2z" />
                </svg>
              </div>
              <div className="p-4 text-center">
                <h3 className="text-lg font-semibold text-slate-900" title={c.title}>{c.title}</h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed" title={c.short}>{c.short}</p>
                <Link href={`/alumni-success/${encodeURIComponent(c.id)}`} className="mt-4 inline-flex items-center justify-center px-4 py-2.5 w-full rounded-lg text-white text-sm font-medium bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                  View Story
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </ComponentCard>
  );
}