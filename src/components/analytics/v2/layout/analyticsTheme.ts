/** Shared design tokens for analytics v2 UI */

export const analyticsCard =
  "rounded-xl border border-gray-200/70 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900/90";

export const analyticsHeroCard =
  "rounded-xl border border-gray-200/70 bg-white p-4 dark:border-gray-800 dark:bg-gray-900/90";

export const analyticsSectionTitle = "text-sm font-semibold text-gray-900 dark:text-white";

export const analyticsSectionDesc = "text-xs text-gray-500 dark:text-gray-400";

export const analyticsPageHeader =
  "shrink-0 border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-950";

export const analyticsFilterBar =
  "shrink-0 border-b border-gray-200/80 bg-gray-50/80 px-4 py-2 dark:border-gray-800 dark:bg-gray-900/50";

export const analyticsTopBar = analyticsPageHeader;

export const analyticsViewport =
  "flex min-h-0 flex-1 flex-col overflow-hidden";

export const analyticsSplitContainer =
  "flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row";

export const analyticsNavPanel =
  "grid min-h-0 flex-1 grid-cols-2 content-start gap-2 overflow-y-auto p-3 lg:w-[38%] lg:shrink-0 lg:border-r lg:border-gray-200/80 dark:lg:border-gray-800";

export const analyticsNavClusterCard =
  "flex min-h-[148px] flex-col";

export const analyticsDetailPanel =
  "min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-3 md:p-4";

export const analyticsDetailGrid =
  "grid grid-cols-1 gap-3 md:grid-cols-2";

export const analyticsInsightBadge =
  "inline-flex items-center rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300";

/** Executive command-center sidebar: two equal columns (50% width each). */
export const executiveSidebarGrid = "grid min-w-0 grid-cols-2 gap-2";

export const executiveSidebarColumn = "min-w-0 w-full";

export const analyticsExpandHint = "text-xs font-medium text-indigo-600 dark:text-indigo-400";

export const CHART_HEIGHT_NAV = 72;
export const CHART_HEIGHT_COMPACT = 96;
export const CHART_HEIGHT_FULL = 240;
export const CHART_HEIGHT_HERO = 200;
export const CHART_HEIGHT_MAP_COMPACT = 120;
export const CHART_HEIGHT_MAP_FULL = 220;

export const ANALYTICS_TOOLBAR_HEIGHT = 56;

export const BENTO_WIDE_SECTION_IDS = new Set([
  "faculty-registrations",
  "engagement-activities",
  "current-occupation",
]);

export function bentoSectionClass(expanded: boolean, groupId: string): string {
  if (expanded) return "col-span-full";
  if (BENTO_WIDE_SECTION_IDS.has(groupId)) return "md:col-span-2 xl:col-span-2";
  return "";
}
