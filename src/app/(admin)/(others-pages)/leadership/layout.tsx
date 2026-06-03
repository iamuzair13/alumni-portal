"use client";

import React, { Suspense } from "react";
import UnifiedHeader from "@/layout/UnifiedHeader";

export default function LeadershipLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense fallback={null}>
        <UnifiedHeader variant="tabs" showTabsContent={false} />
      </Suspense>
      <Suspense fallback={<div className="min-h-[40vh] flex items-center justify-center text-sm text-gray-500">Loading…</div>}>
        {children}
      </Suspense>
    </>
  );
}
