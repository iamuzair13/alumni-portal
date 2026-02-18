"use client";

import React, { Suspense } from "react";
import UnifiedHeader from "@/layout/UnifiedHeader";

export default function LeadershipLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense fallback={null}>
        <UnifiedHeader variant="tabs" showTabsContent={false} />
      </Suspense>
      {children}
    </>
  );
}
