"use client";

import React from "react";
import Link from "next/link";

export default function AlumniTalksCard({ sapId }: { sapId?: string }) {
  const href = sapId ? `/alumni-profile/talks?sapid=${encodeURIComponent(sapId)}` : "/alumni-profile/talks";

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5 md:p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h4 className="text-lg font-bold text-slate-900 dark:text-gray-100">Alumni Talks</h4>
          <p className="text-xs text-slate-600 dark:text-gray-400">View your talk applications and apply for a new talk.</p>
        </div>
        <Link
          href={href}
          className="inline-flex items-center justify-center rounded-lg bg-[#183D32] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0e241d]"
        >
          View
        </Link>
      </div>
    </div>
  );
}
