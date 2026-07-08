"use client";

import React from "react";
import { KPI_COLOR_HEX } from "@/components/analytics/v2/charts/chartColors";
import { ChartEmpty } from "./ChartEmpty";
import { SimpleBarList } from "./SimpleBarList";

const PUBLICATION_META = [
  { key: "storiesYtd", label: "Stories", color: KPI_COLOR_HEX.violet },
  { key: "newslettersYtd", label: "Newsletters", color: KPI_COLOR_HEX.indigo },
  { key: "surveys", label: "Surveys", color: KPI_COLOR_HEX.amber },
  { key: "storiesQuarter", label: "Stories This Quarter", color: KPI_COLOR_HEX.sky },
] as const;

export function PublicationsCardChart({
  storiesYtd,
  storiesQuarter,
  newslettersYtd,
  surveys,
}: {
  storiesYtd: number;
  storiesQuarter: number;
  newslettersYtd: number;
  surveys: number;
}) {
  const values = {
    storiesYtd,
    storiesQuarter,
    newslettersYtd,
    surveys,
  };

  const bars = PUBLICATION_META.map(({ key, label, color }) => ({
    label,
    value: values[key],
    color,
  })).filter((b) => b.value > 0);

  if (bars.length === 0) {
    return <ChartEmpty height={100} variant="premium" message="No publications yet" />;
  }

  return (
    <SimpleBarList items={bars} compact={bars.length > 3} />
  );
}
