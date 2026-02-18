import React, { Suspense } from "react";

export default function AlumniStoriesLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={null}>{children}</Suspense>;
}
