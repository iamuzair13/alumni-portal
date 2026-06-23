"use client";

import { useSidebar } from "@/context/SidebarContext";
import AppHeader from "@/layout/AppHeader";
import AppSidebar from "@/layout/AppSidebar";
import Backdrop from "@/layout/Backdrop";
import React from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isExpanded, isHovered, isMobileOpen, toggleMobileSidebar } = useSidebar();
  const { data: session } = useSession();
  const pathname = usePathname();
  const t = String(((session?.user ?? {}) as { type?: string }).type || "").toLowerCase();
  const isAlumni = t === "alumni";
  const isAnalyticsRoute = pathname === "/admin/analytics";
  const showSidebar = !isAlumni && !isAnalyticsRoute;

  React.useEffect(() => {
    if (isAnalyticsRoute && isMobileOpen) {
      toggleMobileSidebar();
    }
  }, [isAnalyticsRoute, isMobileOpen, toggleMobileSidebar]);

  // Dynamic class for main content margin based on sidebar state
  const mainContentMargin = isAnalyticsRoute || isAlumni
    ? "ml-0"
    : isMobileOpen
      ? "ml-0"
      : isExpanded || isHovered
        ? "lg:ml-[290px]"
        : "lg:ml-[90px]";

  return (
    <div className="min-h-screen xl:flex">
      {showSidebar ? (
        <>
          <AppSidebar />
          <Backdrop />
        </>
      ) : null}
      {/* Main Content Area */}
      <div className={`min-w-0 flex-1 transition-all duration-300 ease-in-out ${mainContentMargin}`}>
        {/* Header — analytics uses its own unified header inside the dashboard */}
        {!isAnalyticsRoute && <AppHeader />}
        {/* Page Content */}
        <div className="relative z-0 mx-auto min-w-0 max-w-full">{children}</div>
      </div>
    </div>
  );
}
