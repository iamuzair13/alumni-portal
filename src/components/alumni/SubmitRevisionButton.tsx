"use client";

import React from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

type Props = {
  sapId: string;
};

const CHANGE_FLAG_PREFIX = "alumni_card_revision_dirty:";
const CHANGE_EVENT = "alumni-card-revision-changed";

export default function SubmitRevisionButton({ sapId }: Props) {
  const router = useRouter();
  const [hasChanges, setHasChanges] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const key = `${CHANGE_FLAG_PREFIX}${sapId}`;
      const stored = window.sessionStorage.getItem(key);
      if (stored === "1") setHasChanges(true);
    } catch {
      // ignore
    }
  }, [sapId]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ sapId?: string }>).detail;
      if (!detail?.sapId || String(detail.sapId) !== String(sapId)) return;
      setHasChanges(true);
      try {
        const key = `${CHANGE_FLAG_PREFIX}${sapId}`;
        window.sessionStorage.setItem(key, "1");
      } catch {
        // ignore
      }
    };

    window.addEventListener(CHANGE_EVENT, handler as EventListener);
    return () => window.removeEventListener(CHANGE_EVENT, handler as EventListener);
  }, [sapId]);

  const submitRevision = async () => {
    if (submitting) return;
    if (!hasChanges) return;

    setSubmitting(true);
    const loading = toast.loading("Submitting revision...");
    try {
      const res = await fetch("/api/alumni-cards/submit-revision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sapId }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(j?.error || `Failed (${res.status})`);
      }

      toast.dismiss(loading);
      toast.success("Revision submitted. Status moved to Under Review.");

      try {
        const key = `${CHANGE_FLAG_PREFIX}${sapId}`;
        window.sessionStorage.removeItem(key);
      } catch {
        // ignore
      }
      setHasChanges(false);

      router.refresh();
    } catch (e) {
      toast.dismiss(loading);
      toast.error(e instanceof Error ? e.message : "Failed to submit revision");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <button
      type="button"
      onClick={submitRevision}
      disabled={!hasChanges || submitting}
      aria-disabled={!hasChanges || submitting}
      className={`inline-flex items-center justify-center px-3 sm:px-4 py-2 sm:py-2.5 w-full rounded-lg text-white text-xs sm:text-sm font-medium transition-colors ${
        !hasChanges || submitting
          ? "bg-gray-300 cursor-not-allowed"
          : "bg-rose-600 hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-500"
      }`}
    >
      {submitting ? "Submitting..." : "Submit Revision"}
    </button>
  );
}
