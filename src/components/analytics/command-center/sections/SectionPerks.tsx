"use client";

import React from "react";
import { Gift, Store } from "lucide-react";
import type { ManagementDashboardPayload } from "@/lib/analytics/management-dashboard";
import { AnalyticsCard } from "../AnalyticsCard";
import { ExpandDrawer } from "../ExpandDrawer";
import { MasonryGrid } from "../MasonryGrid";
import { MembershipsCardChart } from "../charts/MembershipsCardChart";
import { DiscountsMerchantsCardChart } from "../charts/DiscountsMerchantsCardChart";
import { staggerDelay } from "../animation/useStaggeredEntrance";
import { useExpandable } from "../hooks/useExpandable";
import { ccPerksSubsection, ccPerksSubsectionHeader, ccSectionLabel } from "../theme";
import { mapDiscountsMerchants, mapMembershipsPerks } from "../data/mapPayloadToCards";
import { MembershipsExpandPanel } from "../panels/MembershipsExpandPanel";
import { DiscountsMerchantsExpandPanel } from "../panels/DiscountsMerchantsExpandPanel";

const CARD_IDS = {
  memberships: "memberships-perks",
  merchants: "discounts-merchants",
} as const;

const WIDE_DRAWER_IDS = new Set<string>([CARD_IDS.memberships, CARD_IDS.merchants]);

export function SectionPerks({
  data,
  isLoading,
}: {
  data: ManagementDashboardPayload | undefined;
  isLoading: boolean;
}) {
  const { activeId, open, close } = useExpandable();
  const memberships = mapMembershipsPerks(data);
  const discounts = mapDiscountsMerchants(data);

  const discountSummaryParts = discounts.categories
    .filter((c) => c.value > 0)
    .map((c) => `${c.value} ${c.label.toLowerCase()}`);
  if (discounts.merchantCount > 0) {
    discountSummaryParts.push(`${discounts.merchantCount} merchants`);
  }
  const discountSummary =
    discountSummaryParts.length > 0
      ? discountSummaryParts.join(" · ")
      : "No discounts or merchants yet";

  const drawers: Record<string, { title: string; content: React.ReactNode }> = {
    [CARD_IDS.memberships]: {
      title: "Memberships & Perks",
      content: <MembershipsExpandPanel data={data} isLoading={isLoading} />,
    },
    [CARD_IDS.merchants]: {
      title: "Discounts & Merchants",
      content: <DiscountsMerchantsExpandPanel data={data} isLoading={isLoading} />,
    },
  };

  const active = activeId ? drawers[activeId] : null;
  const perksTotal = memberships.totalApproved;

  return (
    <>
      <section aria-label="Perks & Benefits" className={`mt-3 ${ccPerksSubsection}`}>
        <h3 className={`${ccPerksSubsectionHeader} ${ccSectionLabel}`}>Perks</h3>
        <MasonryGrid columns="narrow" layout="uniform" className="gap-2 lg:gap-1.5">
          <AnalyticsCard
            id={CARD_IDS.memberships}
            title="Memberships & Perks"
            icon={Gift}
            accent="violet"
            variant="premium"
            primaryValue={perksTotal}
            secondaryLabel={`${memberships.total} Applications`}
            masonrySize="md"
            chartFill
            delay={staggerDelay(0, 0.16)}
            onExpand={open}
            chart={
              <MembershipsCardChart
                gymApproved={memberships.gymApproved}
                gymApplied={memberships.gymApplied}
                poolApproved={memberships.poolApproved}
                poolApplied={memberships.poolApplied}
                qalanderApproved={memberships.qalanderApproved}
                qalanderApplied={memberships.qalanderApplied}
              />
            }
          />
          <AnalyticsCard
            id={CARD_IDS.merchants}
            title="Discounts & Merchants"
            icon={Store}
            accent="violet"
            variant="premium"
            primaryValue={discounts.total}
            secondaryLabel={discountSummary}
            masonrySize="md"
            chartFill
            delay={staggerDelay(1, 0.16)}
            onExpand={open}
            chart={
              <DiscountsMerchantsCardChart
                categories={discounts.categories}
                total={discounts.total}
                merchantCount={discounts.merchantCount}
                merchants={discounts.merchants}
              />
            }
          />
        </MasonryGrid>
      </section>

      <ExpandDrawer
        open={!!active}
        title={active?.title ?? ""}
        onClose={close}
        accent="violet"
        maxWidthClass={activeId && WIDE_DRAWER_IDS.has(activeId) ? "max-w-5xl" : "max-w-3xl"}
      >
        {active?.content}
      </ExpandDrawer>
    </>
  );
}
