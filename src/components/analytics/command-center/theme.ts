/** Light/dark tokens aligned with analytics v2 and admin shell */

export const ccPage =
  "bg-gray-50/80 text-gray-900 selection:bg-cyan-500/20 dark:bg-gray-950 dark:text-gray-100 dark:selection:bg-cyan-500/30";

export const ccSection = {
  alumni:
    "rounded-xl border border-emerald-200/80 bg-white/90 p-2 dark:border-emerald-500/10 dark:bg-gray-900/30",
  perks:
    "rounded-xl border border-violet-200/80 bg-white/90 p-2 dark:border-violet-500/10 dark:bg-gray-900/30",
  system:
    "rounded-xl border border-amber-200/80 bg-white/90 p-2 dark:border-amber-500/10 dark:bg-gray-900/30",
  admins:
    "rounded-xl border border-amber-200/80 bg-white/90 p-2 dark:border-amber-500/10 dark:bg-gray-900/30",
} as const;

export const ccCard =
  "rounded-xl border bg-white/95 shadow-sm backdrop-blur-sm dark:bg-gray-900/80";

export const ccCardTitle = "text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400";

export const ccCardValue = "font-bold tabular-nums text-gray-900 dark:text-gray-100";

export const ccCardValueLg = `${ccCardValue} text-sm`;

export const ccCardValueMd = `${ccCardValue} text-sm`;

export const ccCardValueSm = `${ccCardValue} text-xs`;

export const ccCardSub = "text-[11px] text-gray-500 dark:text-gray-400";

export const ccHeaderBorder = "border-b border-gray-200 dark:border-gray-800";

export const ccSelect =
  "rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:focus:border-cyan-500/50 dark:focus:ring-cyan-500/30";

export const ccHeaderShell =
  "rounded-xl border border-gray-200/80 bg-white/80 p-2.5 shadow-sm backdrop-blur-md dark:border-gray-800/80 dark:bg-gray-900/60";

export const ccFilterLabel =
  "text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500";

export const ccDateInput =
  "rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs font-medium text-gray-700 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:[color-scheme:dark] dark:focus:border-cyan-500/50 dark:focus:ring-cyan-500/30";

export const ccPresetChip =
  "rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-semibold text-gray-600 transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 dark:border-gray-700 dark:bg-gray-800/80 dark:text-gray-300 dark:hover:border-cyan-500/40 dark:hover:bg-cyan-500/10 dark:hover:text-cyan-300";

export const ccPresetChipActive =
  "border-indigo-300 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200 dark:border-cyan-500/40 dark:bg-cyan-500/15 dark:text-cyan-300 dark:ring-cyan-500/30";

export const ccTabActive =
  "bg-white text-indigo-700 ring-1 ring-indigo-200 dark:bg-gray-800 dark:text-cyan-300 dark:ring-cyan-500/30";

export const ccTabInactive = "text-gray-500 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-300";

export const ccDrawerBackdrop = "bg-gray-900/50 dark:bg-gray-950/70";

export const ccDrawerPanel =
  "border-gray-200 bg-white dark:border-gray-700/60 dark:bg-gray-900";

export const ccDrawerHeader = "border-gray-200 dark:border-gray-700/60";

export const ccDrawerTitle = "text-base font-semibold text-gray-900 dark:text-gray-100";

export const ccAccent = {
  emerald: {
    border:
      "border-emerald-200/80 hover:border-emerald-300 dark:border-emerald-500/20 dark:hover:border-emerald-400/40",
    glow: "hover:shadow-emerald-500/10",
    icon: "text-emerald-600 dark:text-emerald-400",
    ring: "ring-emerald-500/20",
  },
  violet: {
    border: "border-violet-200/80 hover:border-violet-300 dark:border-violet-500/20 dark:hover:border-violet-400/40",
    glow: "hover:shadow-violet-500/10",
    icon: "text-violet-600 dark:text-violet-400",
    ring: "ring-violet-500/20",
  },
  amber: {
    border: "border-amber-200/80 hover:border-amber-300 dark:border-amber-500/20 dark:hover:border-amber-400/40",
    glow: "hover:shadow-amber-500/10",
    icon: "text-amber-600 dark:text-amber-400",
    ring: "ring-amber-500/20",
  },
} as const;
