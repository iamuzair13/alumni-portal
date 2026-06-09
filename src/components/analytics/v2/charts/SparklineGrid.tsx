"use client";

import React from "react";
import { SparklineKpiCard } from "../primitives/SparklineKpiCard";
import type { KpiConfigItem } from "../utils/kpiConfig";

export function SparklineGrid({ items, compact }: { items: KpiConfigItem[]; compact?: boolean }) {
  return (
    <div
      className={`grid gap-3 ${
        compact ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6"
      }`}
    >
      {items.map((item) => (
        <SparklineKpiCard
          key={item.title}
          title={item.title}
          value={item.value}
          subtitle={item.subtitle}
          icon={item.icon}
          color={item.color}
          trend={item.trend}
          sparkline={item.sparkline}
        />
      ))}
    </div>
  );
}
