import { ThemeProvider } from "@/context/ThemeContext";

import React from "react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="primaryBackground h-full w-full">
      <ThemeProvider>
        <div className="min-h-screen flex w-full flex-col items-center justify-start p-6 sm:px-0 sm:py-8">{children}</div>
      </ThemeProvider>
    </div>
  );
}
