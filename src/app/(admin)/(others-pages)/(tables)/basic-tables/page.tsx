import ComponentCard from "@/components/common/ComponentCard";
import BasicTableOne from "@/components/tables/BasicTableOne";
import { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Next.js Basic Table | TailAdmin - Next.js Dashboard Template",
  description:
    "This is Next.js Basic Table  page for TailAdmin  Tailwind CSS Admin Dashboard Template",
  // other metadata
};

export default function BasicTables() {
  return (
    <ComponentCard title="Basic Table" className="">
      <div className="space-y-6">
        <ComponentCard title="Basic Table 1" className="!bg-transparent !py-0 !min-h-0">
          <BasicTableOne />
        </ComponentCard>
      </div>
    </ComponentCard>
  );
}
