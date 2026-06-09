"use client";

import React from "react";
import { AnalyticsChartRenderer } from "../charts/AnalyticsChartRenderer";
import type { KpiConfigGroup } from "../utils/kpiConfig";
import {
  analyticsCard,
  analyticsSectionDesc,
  analyticsSectionTitle,
  BENTO_WIDE_SECTION_IDS,
} from "../layout/analyticsTheme";

export function CollapsibleKpiSection({ group }: { group: KpiConfigGroup }) {
  const spanFull = BENTO_WIDE_SECTION_IDS.has(group.id);

  return (
    <div className={`${analyticsCard} flex flex-col ${spanFull ? "md:col-span-2" : ""}`}>
      <div className="mb-3 shrink-0">
        <h4 className={analyticsSectionTitle}>{group.label}</h4>
        {group.description ? (
          <p className={`mt-0.5 ${analyticsSectionDesc}`}>{group.description}</p>
        ) : null}
      </div>
      <div className="min-h-0 flex-1">
        <AnalyticsChartRenderer group={group} compact={false} showLabels />
      </div>
    </div>
  );
}
