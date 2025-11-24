"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function BackButtonContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sapId = searchParams.get("sapid");

  const handleBack = () => {
    if (typeof window === "undefined") {
      // Server-side: navigate to profile
      const profileUrl = sapId 
        ? `/alumni-profile?sapid=${encodeURIComponent(sapId)}`
        : "/alumni-profile";
      router.push(profileUrl);
      return;
    }

    // Check if there's a valid referrer from our own domain
    const referrer = document.referrer;
    const currentUrl = window.location.href;
    
    // Check if referrer is from the same domain and is a valid internal page
    const isValidReferrer = referrer && 
      referrer.includes(window.location.hostname) && 
      referrer !== currentUrl &&
      !referrer.includes("/signin") &&
      !referrer.includes("/signup");

    if (isValidReferrer) {
      // Use browser back if we have a valid referrer
      router.back();
    } else {
      // Fallback: navigate to profile page with sapid if available
      const profileUrl = sapId 
        ? `/alumni-profile?sapid=${encodeURIComponent(sapId)}`
        : "/alumni-profile";
      router.push(profileUrl);
    }
  };

  return (
    <button
      onClick={handleBack}
      className="w-12 h-12 flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg transition-all duration-200 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      aria-label="Go back"
      title="Go back"
    >
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
      </svg>
    </button>
  );
}

export default function BackButton() {
  return (
    <Suspense fallback={
      <div className="w-12 h-12 flex items-center justify-center bg-gray-300 rounded-full animate-pulse" />
    }>
      <BackButtonContent />
    </Suspense>
  );
}

