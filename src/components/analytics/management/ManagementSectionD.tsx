"use client";

import React from "react";
import type { ManagementDashboardPayload, ManagementDashboardSectionD } from "@/lib/analytics/management-dashboard";
import BarChartComponent from "@/components/analytics/BarChartComponent";
import ChartTableToggle from "./ChartTableToggle";
import AnalyticsDataTable from "./AnalyticsDataTable";
import { SectionWrapper, StatCard, DashboardIcons } from "./DashboardPrimitives";
import { fmtCell } from "./dashboardFormat";

type Props = {
  data: ManagementDashboardPayload | undefined;
  isLoading: boolean;
};

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
    <div className="mt-6 mb-8">
      <SectionWrapper
        id="section-d"
        title="Perks & Benefits"
        subtitle="Memberships, merchant partnerships, and scholarship discount categories"
        icon={DashboardIcons.gift}
      >
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div>
            <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-white">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Memberships & perks
            </h3>
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
              chart={<BarChartComponent title="Membership-related counts" labels={perksRows.map((r) => r.membership)} data={perksRows.map((r) => (typeof r.active === "number" ? r.active : 0))} />}
            />
          </div>

          <div>
            <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-white">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              Discount categories (scholarship applications)
            </h3>
            <ChartTableToggle
              widgetId="mgmt-discount-cats"
              defaultView="chart"
              table={
                <div className="grid grid-cols-2 gap-3">
                  <StatCard label="Dining & Cafés" value={fmtCell(discountCategories.diningAndCafes)} color="amber" />
                  <StatCard label="Retail & Shopping" value={fmtCell(discountCategories.retailAndShopping)} color="indigo" />
                  <StatCard label="Travel & Leisure" value={fmtCell(discountCategories.travelAndLeisure)} color="sky" />
                  <StatCard label="Health & Wellness" value={fmtCell(discountCategories.healthAndWellness)} color="emerald" />
                  <StatCard label="Professional" value={fmtCell(discountCategories.professionalServices)} color="violet" />
                  <StatCard label="Financial" value={fmtCell(discountCategories.financialServices)} color="rose" />
                </div>
              }
              chart={<BarChartComponent title="Discount type mentions" labels={discLabels} data={discData} />}
            />
          </div>

          <div>
            <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-white">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
              Merchant details
            </h3>
            <AnalyticsDataTable
              isLoading={isLoading}
              columns={[
                { key: "merchant", label: "Merchant" },
                { key: "discount", label: "Discount" },
                { key: "reference", label: "Reference" },
              ]}
              rows={merchantRows}
            />
          </div>
        </div>
      </SectionWrapper>
    </div>
  );
}
