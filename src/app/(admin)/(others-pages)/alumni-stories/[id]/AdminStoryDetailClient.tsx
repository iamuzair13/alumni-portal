"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import SuccessStoryDetail from "@/components/alumni/SuccessStoryDetail";
import StoryReviewActions from "@/components/alumni/StoryReviewActions";
import { canModify } from "@/lib/alumniProfile";
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
  alumniId?: number;
  email?: string | null;
  criteriaHighlight?: string | null;
  criteriaInspires?: string | null;
  criteriaReplicable?: boolean | null;
  signatureConfirmed?: boolean | null;
  signatureConfirmedAt?: string | null;
};

export default function AdminStoryDetailClient({ id }: { id: string }) {
  const router = useRouter();
  const { data: session } = useSession();
  const canReview = canModify(session?.user);
  const [story, setStory] = useState<DetailItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/alumni-stories/${encodeURIComponent(id)}`, { cache: "no-store" });
        if (!res.ok) {
          if (!cancelled) setError("Failed to load story.");
          return;
        }
        const data = (await res.json()) as DetailItem;
        if (!cancelled) {
          setStory(data);
          setError(null);
        }
      } catch {
        if (!cancelled) setError("Failed to load story.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, reloadKey]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="h-96 animate-pulse rounded-2xl bg-gray-200 dark:bg-gray-800" />
      </div>
    );
  }

  if (error || !story) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-red-700 mb-4">
          {error || "Failed to load story."}
        </div>
        <Link
          href="/alumni-stories?tab=viewStories"
          className="inline-flex items-center px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
        >
          Back to Stories
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <SuccessStoryDetail
        story={story}
        backHref="/alumni-stories?tab=viewStories"
        backLabel="Back to Stories"
        showSubmissionCriteria
        editHref={canReview ? `/alumni-stories/${id}/edit` : null}
        editLabel="Edit Story"
        adminActions={
          canReview ? (
            <StoryReviewActions
              storyId={story.id}
              status={story.status}
              rejectionReason={story.rejectionReason}
              alumniId={story.alumniId}
              recipientEmail={story.email}
              alumniName={story.name}
              storyTitle={story.title}
              onReviewed={() => {
                setReloadKey((k) => k + 1);
                router.refresh();
              }}
            />
          ) : undefined
        }
      />
    </div>
  );
}
