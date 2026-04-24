"use client";

import React from "react";

type BaseProps = {
  children: React.ReactNode;
  className?: string;
};

export function Card({ children, className = "" }: BaseProps) {
  return (
    <div className={`rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-white/[0.03] ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className = "" }: BaseProps) {
  return <div className={`px-5 pt-5 ${className}`}>{children}</div>;
}

export function CardTitle({ children, className = "" }: BaseProps) {
  return <h3 className={`text-base font-bold text-gray-900 dark:text-white ${className}`}>{children}</h3>;
}

export function CardDescription({ children, className = "" }: BaseProps) {
  return <p className={`mt-1 text-sm text-gray-600 dark:text-gray-400 ${className}`}>{children}</p>;
}

export function CardContent({ children, className = "" }: BaseProps) {
  return <div className={`px-5 py-4 ${className}`}>{children}</div>;
}

export function CardFooter({ children, className = "" }: BaseProps) {
  return <div className={`px-5 pb-5 ${className}`}>{children}</div>;
}

