export const ENTRANCE = {
  y: 20,
  duration: 0.5,
  ease: [0.16, 1, 0.3, 1] as const,
  staggerMs: 80,
  alumniCardCount: 6,
  sidebarDelay: 0.5 + 6 * 0.08,
  facultyBarDelay: 0.5 + 6 * 0.08 + 0.08,
} as const;

export const COUNT_UP = {
  duration: 1.2,
  ease: "easeOut" as const,
};

export const HOVER_CARD = {
  y: -4,
  duration: 0.2,
  ease: "easeOut" as const,
};

export const CHART = {
  bar: { duration: 400, staggerMs: 50, easing: "ease-out" as const },
  donut: { duration: 600, staggerMs: 100, easing: "ease-out" as const },
  radar: { duration: 800, easing: "ease-out" as const },
  progress: { duration: 0.7, staggerMs: 50 },
} as const;

export const FLASH = {
  durationMs: 800,
} as const;

export const DEMO_DRIFT = {
  intervalMs: 30_000,
  minPct: 0.01,
  maxPct: 0.03,
} as const;
