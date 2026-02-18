"use client";
// Unused imports removed to satisfy linter
import React from "react";
import UnifiedHeader from "@/layout/UnifiedHeader";

const AppHeader: React.FC = () => {
  return <UnifiedHeader variant="topbar" />;
};

export default AppHeader;

export function shouldShowSidebarToggle(type?: string | null): boolean {
  const t = String(type || "").toLowerCase();
  return t !== "alumni";
}
