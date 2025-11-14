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
        <div className="min-h-screen flex flex-col items-center justify-center p-6 sm:p-0 w-full">{children}</div>
      </ThemeProvider>
    </div>
  );
}
