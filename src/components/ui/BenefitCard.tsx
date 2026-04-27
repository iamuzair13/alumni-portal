"use client";
import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import LoadingSpinner from "./LoadingSpinner";

type BenefitCardProps = {
  title: string;
  description: string;
  slug: string;
  gradient: string;
  borderColor: string;
  iconBg: string;
  icon: React.ReactNode;
};

export default function BenefitCard({
  title,
  description,
  slug,
  gradient,
  borderColor,
  iconBg,
  icon,
}: BenefitCardProps) {
  const [isNavigating, setIsNavigating] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const href = `/alumni-profile/benefits/${slug}`;

  useEffect(() => {
    setIsNavigating(false);
  }, [pathname]);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (isNavigating) {
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

  return (
    <Link
      href={href}
      onClick={handleClick}
      className={`group bg-white border-2 border-gray-200 shadow-sm rounded-xl overflow-hidden hover:shadow-xl hover:border-gray-300 transition-all duration-300 cursor-pointer transform hover:-translate-y-1 dark:bg-gray-900 dark:border-gray-700 dark:hover:border-gray-600 ${isNavigating ? "opacity-70 pointer-events-none" : ""}`}
    >
      <div className={`flex items-center bg-gradient-to-br gap-2 ${gradient} p-4 sm:p-5 md:p-6 border-b-2 ${borderColor}`}>
        <div className={`w-4 h-4 sm:w-4 sm:h-4 md:w-6 md:h-6 ${iconBg} rounded-xl flex items-center justify-center mb-3 sm:mb-4 group-hover:scale-110 transition-transform duration-300`}>
          {icon}
        </div>
        <h4 className="text-base sm:text-lg font-bold text-slate-900 mb-2 group-hover:text-slate-700 transition-colors dark:text-gray-900 dark:group-hover:text-gray-900 ">{title}</h4>
      </div>
      <div className="p-4 sm:p-5 md:p-6">
        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed dark:text-gray-400">{description}</p>
        <div className="mt-4 flex items-center text-sm font-semibold text-slate-700 group-hover:text-slate-900 transition-colors dark:text-gray-300 dark:group-hover:text-gray-100">
          {isNavigating ? (
            <>
              <LoadingSpinner size="sm" className="text-slate-700 mr-2" />
              <span>Loading...</span>
            </>
          ) : (
            <>
              <span>Learn more</span>
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}

