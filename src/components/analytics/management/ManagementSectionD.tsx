"use client";

import React from "react";
import type { ManagementDashboardPayload, ManagementDashboardSectionD } from "@/lib/analytics/management-dashboard";
import BarChartComponent from "@/components/analytics/BarChartComponent";
import ChartTableToggle from "./ChartTableToggle";
import AnalyticsDataTable from "./AnalyticsDataTable";
import { DashboardIcons } from "./DashboardPrimitives";
import { fmtCell } from "./dashboardFormat";
import { AnalyticsPanel, AnalyticsSubheading } from "@/components/analytics/v2/layout/AnalyticsPanel";
import { AnalyticsGrid, AnalyticsGridItem } from "@/components/analytics/v2/layout/AnalyticsGrid";
import { CompactMetricChip } from "@/components/analytics/v2/primitives/CompactMetricChip";

type Props = {
  data: ManagementDashboardPayload | undefined;
  isLoading: boolean;
};

const CHART_PROPS = { compact: true, height: 150 } as const;

export default function ManagementSectionD({ data, isLoading }: Props) {
  const d = data?.sectionD;
  const membershipSource: Partial<ManagementDashboardSectionD["memberships"]> = d?.memberships ?? {};
  const discountCategories: Partial<ManagementDashboardSectionD["discountCategories"]> = d?.discountCategories ?? {};
  const merchantSource = d?.merchants ?? [];

  const perksRows = [
    { membership: "Gym (active / discount)", active: fmtCell(membershipSource.gymDiscountActive) },
    { membership: "Swimming pool", active: fmtCell(membershipSource.swimmingPoolDiscountActive) },
    { membership: "Free gym (3 mo) — reason match", active: fmtCell(membershipSource.freeGymThreeMonth) },
    { membership: "Free pool (3 mo) — reason match", active: fmtCell(membershipSource.freePoolThreeMonth) },
    { membership: "Qalander club — reason match", active: fmtCell(membershipSource.qalanderClub) },
    { membership: "Healthcare — reason match", active: fmtCell(membershipSource.healthcareDiscounts) },
    { membership: "Vehicle stickers — reason match", active: fmtCell(membershipSource.vehicleStickers) },
  ];

  const merchantRows =
    merchantSource.length > 0 ? merchantSource : [{ merchant: "No data available", discount: "—", reference: "—" }];

  const discLabels = ["Dining", "Retail", "Travel", "Health", "Professional", "Financial"];
  const discData = [
    Number(discountCategories.diningAndCafes ?? 0),
    Number(discountCategories.retailAndShopping ?? 0),
    Number(discountCategories.travelAndLeisure ?? 0),
    Number(discountCategories.healthAndWellness ?? 0),
    Number(discountCategories.professionalServices ?? 0),
    Number(discountCategories.financialServices ?? 0),
  ];

  return (
    <AnalyticsPanel
      id="section-d"
      title="Perks & Benefits"
      subtitle="Memberships, merchant partnerships, and discount categories"
      icon={DashboardIcons.gift}
      className="mt-3 mb-3"
    >
      <AnalyticsGrid>
        <AnalyticsGridItem span={4}>
          <AnalyticsSubheading dotColor="bg-emerald-500">Memberships & perks</AnalyticsSubheading>
          <ChartTableToggle
            widgetId="mgmt-memberships"
            defaultView="table"
            table={
              <AnalyticsDataTable
                isLoading={isLoading}
                columns={[
                  { key: "membership", label: "Type" },
                  { key: "active", label: "Count / hint", align: "right" },
                ]}
                rows={perksRows}
              />
            }
            chart={
              <BarChartComponent
                title="Membership-related counts"
                labels={perksRows.map((r) => r.membership)}
                data={perksRows.map((r) => (typeof r.active === "number" ? r.active : 0))}
                {...CHART_PROPS}
              />
            }
          />
        </AnalyticsGridItem>

        <AnalyticsGridItem span={4}>
          <AnalyticsSubheading dotColor="bg-amber-500">Discount categories</AnalyticsSubheading>
          <ChartTableToggle
            widgetId="mgmt-discount-cats"
            defaultView="chart"
            table={
              <div className="grid grid-cols-2 gap-2">
                <CompactMetricChip label="Dining & Cafés" value={fmtCell(discountCategories.diningAndCafes)} color="amber" />
                <CompactMetricChip label="Retail & Shopping" value={fmtCell(discountCategories.retailAndShopping)} color="indigo" />
                <CompactMetricChip label="Travel & Leisure" value={fmtCell(discountCategories.travelAndLeisure)} color="sky" />
                <CompactMetricChip label="Health & Wellness" value={fmtCell(discountCategories.healthAndWellness)} color="emerald" />
                <CompactMetricChip label="Professional" value={fmtCell(discountCategories.professionalServices)} color="violet" />
                <CompactMetricChip label="Financial" value={fmtCell(discountCategories.financialServices)} color="rose" />
              </div>
            }
            chart={<BarChartComponent title="Discount type mentions" labels={discLabels} data={discData} {...CHART_PROPS} />}
          />
        </AnalyticsGridItem>

        <AnalyticsGridItem span={4}>
          <AnalyticsSubheading dotColor="bg-indigo-500">Merchant details</AnalyticsSubheading>
          <AnalyticsDataTable
            isLoading={isLoading}
            columns={[
              { key: "merchant", label: "Merchant" },
              { key: "discount", label: "Discount" },
              { key: "reference", label: "Reference" },
            ]}
            rows={merchantRows}
          />
        </AnalyticsGridItem>
      </AnalyticsGrid>
    </AnalyticsPanel>
  );
}
