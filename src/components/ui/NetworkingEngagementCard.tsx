"use client";
import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import LoadingSpinner from "./LoadingSpinner";

type NetworkingCardProps = {
  title: string;
  description: string;
  action: string;
  href: string;
  disabled?: boolean;
  disabledText?: string;
};

export default function NetworkingEngagementCard({
  action,
  href,
  disabled = false,
  disabledText,
}: NetworkingCardProps) {
  const [isNavigating, setIsNavigating] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    setIsNavigating(false);
  }, [pathname]);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (disabled || isNavigating) {
      e.preventDefault();
      return;
    }

    const targetPath = href.split('?')[0];
    const currentPath = pathname;

    if (targetPath !== currentPath) {
      setIsNavigating(true);
      e.preventDefault();
      router.push(href);
    }
  };

  if (disabled) {
    return (
      <button
        type="button"
        disabled
        aria-disabled
        className="mt-3 sm:mt-4 inline-flex items-center justify-center px-3 sm:px-4 py-2 sm:py-2.5 w-full rounded-lg text-white text-xs sm:text-sm font-medium bg-gray-300 cursor-not-allowed"
      >
        {disabledText || action}
      </button>
    );
  }

  return (
    <Link
      href={href}
      onClick={handleClick}
      className={`mt-3 sm:mt-4 inline-flex items-center justify-center px-3 sm:px-4 py-2 sm:py-2.5 w-full rounded-lg text-white text-xs sm:text-sm font-medium bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors ${isNavigating ? "opacity-70 pointer-events-none" : ""}`}
    >
      {isNavigating ? (
        <>
          <LoadingSpinner size="sm" className="text-white mr-2" />
          {action}
        </>
      ) : (
        action
      )}
    </Link>
  );
}

