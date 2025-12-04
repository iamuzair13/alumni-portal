"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import LoadingSpinner from "./LoadingSpinner";

type LoadingLinkProps = {
  href: string;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  [key: string]: unknown;
};

export default function LoadingLink({ href, children, className = "", onClick, ...props }: LoadingLinkProps) {
  const [isNavigating, setIsNavigating] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    // Reset loading state when pathname changes (navigation completed)
    setIsNavigating(false);
  }, [pathname]);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (isNavigating) {
      e.preventDefault();
      return;
    }
    
    // Only show loading if navigating to a different page
    const targetPath = href.split('?')[0]; // Remove query params for comparison
    const currentPath = pathname;
    
    if (targetPath !== currentPath) {
      setIsNavigating(true);
      // Use router.push for programmatic navigation to ensure loading state persists
      e.preventDefault();
      router.push(href);
    }
    
    if (onClick) {
      onClick();
    }
  };

  return (
    <Link
      href={href}
      onClick={handleClick}
      className={`${className} ${isNavigating ? "opacity-70 pointer-events-none" : ""}`}
      {...props}
    >
      {isNavigating ? (
        <span className="inline-flex items-center gap-2">
          <LoadingSpinner size="sm" />
          {children}
        </span>
      ) : (
        children
      )}
    </Link>
  );
}

