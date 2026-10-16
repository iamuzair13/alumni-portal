import React from "react";
import { twMerge } from "tailwind-merge";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      aria-hidden
      className={twMerge(
        "animate-pulse rounded-lg bg-gray-200 dark:bg-gray-800",
        className,
      )}
    />
  );
}

interface SkeletonCardProps {
  rows?: number;
  className?: string;
}

export function SkeletonCard({ rows = 3, className }: SkeletonCardProps) {
  return (
    <div className={twMerge("card space-y-4 p-5 sm:p-6", className)}>
      <Skeleton className="h-5 w-40" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>
      ))}
    </div>
  );
}

export default Skeleton;
