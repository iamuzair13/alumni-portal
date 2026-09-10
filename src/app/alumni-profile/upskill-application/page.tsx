import { Suspense } from "react";
import AppHeader from "@/layout/AppHeader";
import { UpskillApplicationContent } from "./UpskillApplicationContent";

// This page uses useSearchParams() which requires dynamic rendering.
export const dynamic = "force-dynamic";

export default function UpskillApplicationPage() {
  return (
    <Suspense
      fallback={
        <>
          <AppHeader />
          <div className="min-h-screen bg-gray-50">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <div className="bg-white rounded-lg shadow-sm p-8">
                <div className="flex items-center justify-center py-12">
                  <div className="flex flex-col items-center gap-4">
                    <svg className="animate-spin h-12 w-12 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p className="text-sm text-gray-600">Loading...</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      }
    >
      <UpskillApplicationContent />
    </Suspense>
  );
}
