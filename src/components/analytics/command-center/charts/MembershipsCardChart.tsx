"use client";

import React from "react";
import { KPI_COLOR_HEX } from "@/components/analytics/v2/charts/chartColors";
import { ChartEmpty } from "./ChartEmpty";
import { SimpleBarList } from "./SimpleBarList";

type MembershipRow = {
  label: string;
  approved: number;
  applied: number;
  color: string;
};

export function MembershipsCardChart({
  gymApproved,
  gymApplied,
  poolApproved,
  poolApplied,
  qalanderApproved,
  qalanderApplied,
}: {
  gymApproved: number;
  gymApplied: number;
  poolApproved: number;
  poolApplied: number;
  qalanderApproved: number;
  qalanderApplied: number;
}) {
  const rows: MembershipRow[] = [
    {
      label: "Gym",
      approved: gymApproved,
      applied: gymApplied,
      color: KPI_COLOR_HEX.indigo,
    },
    {
      label: "Swimming Pool",
      approved: poolApproved,
      applied: poolApplied,
      color: KPI_COLOR_HEX.sky,
    },
    {
      label: "Qalandars Club",
      approved: qalanderApproved,
      applied: qalanderApplied,
      color: KPI_COLOR_HEX.amber,
    },
  ];

  const totalApproved = gymApproved + poolApproved + qalanderApproved;
  const totalApplied = gymApplied + poolApplied + qalanderApplied;

  if (totalApproved === 0 && totalApplied === 0) {
    return <ChartEmpty height={100} variant="premium" message="No memberships yet" />;
  }

  return (
    <SimpleBarList
      items={rows.map((row) => ({
        label: row.label,
        detail: `${row.applied.toLocaleString()} applied`,
        value: row.approved,
        color: row.color,
      }))}
      compact
    />
  );
}
