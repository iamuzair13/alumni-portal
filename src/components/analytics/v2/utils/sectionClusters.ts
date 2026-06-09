import type { KpiConfigGroup } from "./kpiConfig";

export type AnalyticsSectionClusterDef = {
  id: string;
  label: string;
  groupIds: string[];
};

export const ANALYTICS_SECTION_CLUSTERS: AnalyticsSectionClusterDef[] = [
  {
    id: "section-1",
    label: "Alumni & Outcomes",
    groupIds: [
      "alumni-overview",
      "alumni-categories",
      "transition-velocity",
      "current-occupation",
      "honor-cards",
    ],
  },
  {
    id: "section-2",
    label: "Engagement & Career",
    groupIds: [
      "engagement-chapters",
      "career-benefits",
      "chapters-associations",
      "engagement-activities",
      "development-employment",
      "perks-benefits",
    ],
  },
  {
    id: "section-3",
    label: "Operations & System",
    groupIds: ["admin-trained", "system-information"],
  },
];

export type ResolvedSectionCluster = AnalyticsSectionClusterDef & {
  groups: KpiConfigGroup[];
  insight?: string;
};

export function resolveSectionClusters(groups: KpiConfigGroup[]): ResolvedSectionCluster[] {
  const byId = new Map(groups.map((g) => [g.id, g]));

  return ANALYTICS_SECTION_CLUSTERS.map((cluster) => {
    const resolvedGroups = cluster.groupIds
      .map((id) => byId.get(id))
      .filter((g): g is KpiConfigGroup => g != null);

    const insight = resolvedGroups.find((g) => g.insight)?.insight;

    return { ...cluster, groups: resolvedGroups, insight };
  });
}

/** Pick the best group to render as the compact cluster preview chart. */
export function pickPreviewGroup(cluster: ResolvedSectionCluster): KpiConfigGroup | undefined {
  return pickDiversePreviewGroups(cluster, 1)[0];
}

/** Pick up to `max` groups preferring different chart types for visual variety. */
export function pickDiversePreviewGroups(
  cluster: ResolvedSectionCluster,
  max = 2,
  excludeChartTypes: string[] = []
): KpiConfigGroup[] {
  const hasData = (g: KpiConfigGroup) =>
    (g.chartSeries?.some((p) => p.value > 0) ?? false) || g.chartType === "geo";

  const excluded = new Set(excludeChartTypes);
  const withData = cluster.groups.filter(hasData);
  const pool = (withData.length ? withData : cluster.groups).filter(
    (g) => !excluded.has(g.chartType ?? "")
  );
  const fallbackPool = withData.length ? withData : cluster.groups;

  const picked: KpiConfigGroup[] = [];
  const seenTypes = new Set<string>();

  for (const group of pool) {
    if (seenTypes.has(group.chartType ?? "")) continue;
    seenTypes.add(group.chartType ?? "");
    picked.push(group);
    if (picked.length >= max) return picked;
  }

  for (const group of pool) {
    if (picked.includes(group)) continue;
    picked.push(group);
    if (picked.length >= max) break;
  }

  if (picked.length < max) {
    for (const group of fallbackPool) {
      if (picked.includes(group)) continue;
      picked.push(group);
      if (picked.length >= max) break;
    }
  }

  return picked;
}
