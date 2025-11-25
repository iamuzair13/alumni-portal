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
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 2 * 60 * 1000, // 2 minutes - data is fresh for 2 minutes
            gcTime: 10 * 60 * 1000, // 10 minutes - cache data for 10 minutes
            refetchOnWindowFocus: false, // Don't refetch on window focus by default
            refetchOnReconnect: true, // Refetch when network reconnects
            refetchOnMount: true, // Refetch on mount if data is stale
            retry: 1, // Retry failed requests once
            retryDelay: 1000, // Wait 1 second before retry
          },
        },
      })
  );

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