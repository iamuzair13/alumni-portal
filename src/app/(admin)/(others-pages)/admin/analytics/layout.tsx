"use client";

import React, { useEffect, useRef } from "react";
import { useTheme } from "@/context/ThemeContext";

export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  const { setTheme } = useTheme();
  const previousTheme = useRef<"light" | "dark">("light");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("theme");
      previousTheme.current = stored === "light" ? "light" : "dark";
    } catch {
      previousTheme.current = "light";
    }

    setTheme("light");

    return () => {
      setTheme(previousTheme.current);
    };
  }, [setTheme]);

  return <>{children}</>;
}
