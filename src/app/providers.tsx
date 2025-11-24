"use client";

import React, { Suspense } from "react";
import { SessionProvider } from "next-auth/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SidebarProvider } from "@/context/SidebarContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { Toaster } from "react-hot-toast";
import { ProgressProvider } from "@bprogress/react";
import ProgressBar from "@/components/ProgressBar";

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(() => new QueryClient());

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <ProgressProvider>
          <Suspense fallback={null}>
            <ProgressBar />
          </Suspense>
        <ThemeProvider>
            <SidebarProvider>
              {children}
              <Toaster position="top-center" />
            </SidebarProvider>
        </ThemeProvider>
        </ProgressProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}