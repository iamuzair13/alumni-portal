import { Suspense } from "react";
import AppHeader from "@/layout/AppHeader";
import PageBanner from "@/components/ui/PageBanner";
import { ViewApplicationsContent } from "./ViewApplicationsContent";

// This page uses useSearchParams() which requires dynamic rendering.
export const dynamic = "force-dynamic";

export default function ViewApplicationsPage() {
  return (
    <Suspense
      fallback={
        <>
          <AppHeader />
          <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            <PageBanner title="My Applications" />
            <div className="container mx-auto px-4 py-6 sm:py-8">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 sm:p-8">
                <div className="flex items-center justify-center py-12">
                  <div className="h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  <span className="ml-3 text-gray-600 dark:text-gray-400">Loading...</span>
                </div>
              </div>
            </div>
          </div>
        </>
      }
    >
      <ViewApplicationsContent />
    </Suspense>
  );
}
