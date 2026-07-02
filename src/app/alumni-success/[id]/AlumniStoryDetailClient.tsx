"use client";

import Link from "next/link";
import AppHeader from "@/layout/AppHeader";
import SuccessStoryDetail from "@/components/alumni/SuccessStoryDetail";
import { normalizeStoryStatus } from "@/lib/alumniStories";
import { useEffect, useState } from "react";

type DetailItem = {
  id: string;
  date: string;
  title: string;
  name: string;
  program: string;
  session: string;
  shortDescription: string;
  imageUrl: string;
  status: string;
  rejectionReason?: string | null;
};

export default function AlumniStoryDetailClient({
  id,
  isOwner,
}: {
  id: string;
  isOwner: boolean;
}) {
  const [story, setStory] = useState<DetailItem | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/alumni-stories/${encodeURIComponent(id)}`, { cache: "no-store" });
        if (!res.ok) {
          if (!cancelled) setError(true);
          return;
        }
        const data = (await res.json()) as DetailItem;
        if (!cancelled) setStory(data);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <>
        <div className="bg-slate-100 overflow-x-hidden min-h-screen">
          <div className="border bg-white relative z-50">
            <AppHeader />
          </div>
          <div className="max-w-5xl mx-auto px-4 py-8">
            <div className="h-96 animate-pulse rounded-2xl bg-gray-200" />
          </div>
        </div>
      </>
    );
  }

  if (error || !story) {
    return (
      <>
        <div className="bg-slate-100 overflow-x-hidden min-h-screen">
          <div className="border bg-white relative z-50">
            <AppHeader />
          </div>
          <div className="max-w-4xl mx-auto px-4 sm:px-6 md:px-8 lg:px-10 py-8">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 md:p-8">
              <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-red-700 mb-4">
                Failed to load story.
              </div>
              <Link
                href="/alumni-success"
                className="inline-flex items-center px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
              >
                Back to Stories
              </Link>
            </div>
          </div>
        </div>
      </>
    );
  }

  const showStatusBanner =
    isOwner && normalizeStoryStatus(story.status) !== "approved";

  return (
    <>
      <div className="bg-slate-100 overflow-x-hidden min-h-screen dark:bg-gray-900">
        <div className="border bg-white relative z-50 dark:bg-gray-900 dark:border-gray-700">
          <AppHeader />
        </div>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 md:px-8 lg:px-10 py-8">
          <SuccessStoryDetail
            story={story}
            backHref="/alumni-success"
            backLabel="Back to Stories"
            editHref={isOwner ? `/alumni-success/${encodeURIComponent(id)}/edit` : null}
            showStatusBanner={showStatusBanner}
          />
        </div>
      </div>
    </>
  );
}
