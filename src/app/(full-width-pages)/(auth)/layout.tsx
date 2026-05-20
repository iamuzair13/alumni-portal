import { ThemeProvider } from "@/context/ThemeContext";

import React from "react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="primaryBackground   w-full">
      <ThemeProvider>
        <div className="flex w-full  flex-col items-center justify-start">{children}</div>
      </ThemeProvider>
    </div>
  );
}
