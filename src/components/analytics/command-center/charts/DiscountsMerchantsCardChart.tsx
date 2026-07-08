"use client";

import React, { useMemo } from "react";
import { KPI_COLOR_HEX } from "@/components/analytics/v2/charts/chartColors";
import { ChartEmpty } from "./ChartEmpty";
import { SimpleBarList } from "./SimpleBarList";

const CATEGORY_COLORS: Record<string, string> = {
  dining: KPI_COLOR_HEX.amber,
  retail: KPI_COLOR_HEX.indigo,
  travel: KPI_COLOR_HEX.sky,
  health: KPI_COLOR_HEX.emerald,
  professional: KPI_COLOR_HEX.violet,
  financial: KPI_COLOR_HEX.rose,
};

type BarItem = {
  label: string;
  value: number;
  color: string;
  detail?: string;
};

function buildFallbackBars(
  total: number,
  merchantCount: number,
  merchants: Array<{ merchant: string }>
): BarItem[] {
  const fallback: BarItem[] = [];

  if (total > 0) {
    fallback.push({
      label: "Applications",
      value: total,
      color: KPI_COLOR_HEX.violet,
    });
  }

  if (merchants.length > 0) {
    const merchantColors = [KPI_COLOR_HEX.emerald, KPI_COLOR_HEX.sky, KPI_COLOR_HEX.amber, KPI_COLOR_HEX.indigo];
    merchants.slice(0, 3).forEach((m, i) => {
      const name = m.merchant.trim();
      if (!name) return;
      fallback.push({
        label: name,
        value: 1,
        color: merchantColors[i % merchantColors.length],
      });
    });
    if (merchantCount > merchants.slice(0, 3).length) {
      const remaining = merchantCount - Math.min(merchants.length, 3);
      if (remaining > 0) {
        fallback.push({
          label: "More partners",
          value: remaining,
          color: KPI_COLOR_HEX.slate,
        });
      }
    }
  } else if (merchantCount > 0) {
    fallback.push({
      label: "Partners",
      value: merchantCount,
      color: KPI_COLOR_HEX.emerald,
    });
  }

  return fallback;
}

export function DiscountsMerchantsCardChart({
  categories,
  total,
  merchantCount,
  merchants = [],
}: {
  categories: Array<{ key: string; label: string; value: number }>;
  total: number;
  merchantCount: number;
  merchants?: Array<{ merchant: string; discount?: string; reference?: string }>;
}) {
  const bars = useMemo(() => {
    const categoryBars = categories
      .filter((c) => c.value > 0)
      .map((c) => ({
        label: c.label,
        value: c.value,
        color: CATEGORY_COLORS[c.key] ?? KPI_COLOR_HEX.slate,
      }));

    if (categoryBars.length > 0) return categoryBars;
    return buildFallbackBars(total, merchantCount, merchants);
  }, [categories, total, merchantCount, merchants]);

  if (bars.length === 0) {
    return <ChartEmpty height={100} variant="premium" message="No discounts or merchants yet" />;
  }

  return (
    <SimpleBarList items={bars} compact={bars.length > 3} />
  );
}
