import type { Metadata } from "next";
import React from "react";
import MonthlySalesChart from "@/components/alumni/MonthlySalesChart";

import { AlumniTabbedMenu } from "@/components/alumni/AlumniTabbedMenu";

export const metadata: Metadata = {
  title:
    "Next.js E-commerce Dashboard | TailAdmin - Next.js Dashboard Template",
  description: "This is Next.js Home for TailAdmin Dashboard Template",
};

export default function Ecommerce() {
  return (
    <div className="grid grid-cols-12 ">
      <div className="col-span-12  xl:col-span-12 ">
        <AlumniTabbedMenu />

        <MonthlySalesChart />
      </div>
    </div>
  );
}
