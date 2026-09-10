import { Suspense } from "react";
import AppHeader from "@/layout/AppHeader";
import PageBanner from "@/components/ui/PageBanner";
import { CardApplicationContent } from "./CardApplicationContent";

// This page uses useSearchParams() which requires dynamic rendering.
export const dynamic = "force-dynamic";

export default function CardApplicationPage() {
  return (
    <Suspense
      fallback={
        <>
          <AppHeader />
          <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            <PageBanner title="Apply for Alumni Card" />
            <div className="container mx-auto px-4 py-8">
              <div className="max-w-4xl mx-auto">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8">
                  <p className="text-center text-gray-600 dark:text-gray-400">Loading...</p>
                </div>
              </div>
            </div>
          </div>
        </>
      }
    >
      <CardApplicationContent />
    </Suspense>
  );
}
