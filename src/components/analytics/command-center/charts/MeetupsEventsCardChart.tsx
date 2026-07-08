"use client";

import React from "react";
import { KPI_COLOR_HEX } from "@/components/analytics/v2/charts/chartColors";
import { ChartEmpty } from "./ChartEmpty";
import { SimpleBarList } from "./SimpleBarList";

type StatGroup = {
  total: number;
  quarter: number;
};

const MEETUP_META = [
  { key: "events", label: "Events", color: KPI_COLOR_HEX.violet },
  { key: "meetups", label: "Meetups", color: KPI_COLOR_HEX.emerald },
] as const;

export function MeetupsEventsCardChart({
  events,
  meetups,
}: {
  events: StatGroup;
  meetups: StatGroup;
}) {
  const stats = { events, meetups };
  const bars = MEETUP_META.map(({ key, label, color }) => ({
    label,
    total: stats[key].total,
    quarter: stats[key].quarter,
    color,
  }));

  const hasData =
    events.total > 0 || events.quarter > 0 || meetups.total > 0 || meetups.quarter > 0;
  if (!hasData) return <ChartEmpty height={88} variant="premium" />;

  return (
    <SimpleBarList
      items={bars.map((bar) => ({
        label: bar.label,
        detail: `${bar.quarter.toLocaleString()} this quarter`,
        value: bar.total,
        color: bar.color,
      }))}
      className="justify-center"
    />
  );
}
