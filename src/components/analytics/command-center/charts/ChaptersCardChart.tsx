"use client";

import React from "react";
import { KPI_COLOR_HEX } from "@/components/analytics/v2/charts/chartColors";
import { ChartEmpty } from "./ChartEmpty";
import { SimpleBarList } from "./SimpleBarList";

export function ChaptersCardChart({
  nationalCount,
  internationalCount,
  nationalMembers,
  internationalMembers,
}: {
  nationalCount: number;
  internationalCount: number;
  nationalMembers: number;
  internationalMembers: number;
}) {
  const hasData =
    nationalCount > 0 ||
    internationalCount > 0 ||
    nationalMembers > 0 ||
    internationalMembers > 0;

  if (!hasData) {
    return <ChartEmpty height={96} variant="premium" message="No chapter activity yet" />;
  }

  return (
    <SimpleBarList
      items={[
        {
          label: "National",
          detail: `${nationalCount.toLocaleString()} chapters`,
          value: nationalMembers,
          color: KPI_COLOR_HEX.violet,
        },
        {
          label: "International",
          detail: `${internationalCount.toLocaleString()} chapters`,
          value: internationalMembers,
          color: KPI_COLOR_HEX.emerald,
        },
      ]}
    />
  );
}
