"use client";

import React, { Suspense, useEffect } from "react";
import { SessionProvider, useSession, signOut } from "next-auth/react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { SidebarProvider } from "@/context/SidebarContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { Toaster } from "react-hot-toast";
import { ProgressProvider } from "@bprogress/react";
import ProgressBar from "@/components/ProgressBar";
import { useRouter } from "next/navigation";

// Component to handle session expiration and 401 errors
function SessionExpirationHandler({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    // Check if session is unauthenticated
    if (status === "unauthenticated" && typeof window !== "undefined") {
      // Only redirect if we're not already on the signin page
      if (window.location.pathname !== "/signin") {
        // Clear all React Query cache
        queryClient.clear();
        
        // Clear any stored data
        localStorage.clear();
        sessionStorage.clear();
        
        // Redirect to signin
        router.replace("/signin");
      }
    }
  }, [status, router, queryClient]);

  // Intercept fetch calls to handle 401 errors
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Store original fetch
    const originalFetch = window.fetch;

    // Override fetch to handle 401 errors
    window.fetch = async function(...args: Parameters<typeof fetch>): Promise<Response> {
      const response = await originalFetch(...args);

      // Handle 401 Unauthorized errors
      if (response.status === 401 && window.location.pathname !== "/signin") {
        // Clear all caches
        queryClient.clear();
        localStorage.clear();
        sessionStorage.clear();
        
        // Sign out and redirect
        signOut({ redirect: false }).then(() => {
          // Use window.location for reliable redirect on Plesk server
          window.location.href = "/signin";
        }).catch(() => {
          // If signOut fails, force redirect
          window.location.href = "/signin";
        });
      }

      return response;
    };

    // Cleanup: restore original fetch on unmount
    return () => {
      window.fetch = originalFetch;
    };
  }, [queryClient]);

  return <>{children}</>;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 2 * 60 * 1000, // 2 minutes
            gcTime: 30 * 60 * 1000, // 30 minutes
            refetchOnWindowFocus: false, // Don't refetch on window focus by default
            refetchOnReconnect: true, // Refetch when network reconnects
            refetchOnMount: false, // Don't refetch just because component remounts
            retry: (failureCount, error: unknown) => {
              // Don't retry on 401 errors
              const err = error as { status?: number; response?: { status?: number } } | null;
              if (err?.status === 401 || err?.response?.status === 401) {
                return false;
              }
              return failureCount < 1; // Retry once for other errors
            },
            retryDelay: 1000, // Wait 1 second before retry
          },
          mutations: {
            retry: (failureCount, error: unknown) => {
              // Don't retry on 401 errors
              const err = error as { status?: number; response?: { status?: number } } | null;
              if (err?.status === 401 || err?.response?.status === 401) {
                return false;
              }
              return failureCount < 1;
            },
          },
        },
      })
  );

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <SessionExpirationHandler>
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
        </SessionExpirationHandler>
      </QueryClientProvider>
    </SessionProvider>
  );
}