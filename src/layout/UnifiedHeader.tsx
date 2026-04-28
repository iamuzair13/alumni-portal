
"use client"

import type { FC, ReactNode } from "react";
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "motion/react";

import UserDropdown from "@/components/header/UserDropdown";
import ComponentCard from "@/components/common/ComponentCard";
import { ThemeToggleButton } from "@/components/common/ThemeToggleButton";
import { useSidebar } from "@/context/SidebarContext";

import { AlumniTabs } from "@/components/alumni/Alumni-tabs";
import { AlumniCards } from "@/components/alumni/Alumini-cards";
import { AlumniTalksTab } from "@/components/alumni/AlumniTalksTab";
import { AlumniChaptersTab } from "@/components/alumni/AlumniChaptersTab";
import { AlumniAssociationTab } from "@/components/alumni/AlumniAssociationTab";
import { AlumniScholarshipsTab } from "@/components/alumni/AlumniScholarshipsTab";
import { AlumniMembershipsTab } from "@/components/alumni/AlumniMembershipsTab";
import { JobsTab } from "@/components/alumni/JobsTab";
import AlumniSqlForm from "@/components/forms/AlumniSqlForm";

/* ═══════════════════════════════════════════════════════════════
   TYPES & INTERFACES
   ═══════════════════════════════════════════════════════════════ */

export type UnifiedHeaderVariant = "topbar" | "tabs";

type Props = {
  variant: UnifiedHeaderVariant;
  showTabsContent?: boolean;
};

type MenuKey =
  | "AlumniTabs"
  | "AlumniCards"
  | "AlumniTalks"
  | "AlumniChapters"
  | "AlumniAssociation"
  | "AlumniScholarships"
  | "AlumniMemberships"
  | "Jobs"
  | "Leadership"
  | "AadAlumni";

interface TabConfig {
  key: MenuKey;
  label: string;
  urlTab: string;
  icon?: ReactNode;
  showCounter: boolean;
}

interface PairCounts {
  all: number;
  secondary: number;
}

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════ */

const MENU_TABS: TabConfig[] = [
  { key: "AlumniTabs", label: "Dashboard", urlTab: "dashboard", showCounter: false },
  { key: "AlumniCards", label: "Alumni Cards", urlTab: "alumni-cards", showCounter: true },
  { key: "AlumniTalks", label: "Alumni Talks", urlTab: "alumni-talks", showCounter: true },
  { key: "AlumniChapters", label: "Alumni Chapters", urlTab: "alumni-chapters", showCounter: false },
  { key: "AlumniAssociation", label: "Alumni Association", urlTab: "alumni-association", showCounter: false },
  { key: "AlumniScholarships", label: "Alumni Scholarships", urlTab: "alumni-scholarships", showCounter: true },
  { key: "AlumniMemberships", label: "Alumni Memberships", urlTab: "alumni-memberships", showCounter: true },
  { key: "Leadership", label: "Leadership", urlTab: "leadership", showCounter: true },
  { key: "Jobs", label: "Jobs", urlTab: "jobs", showCounter: false },
];

const BRAND_COLOR = "#183D32";
const BRAND_COLOR_DARK = "#142e26";

/* ═══════════════════════════════════════════════════════════════
   URL MAPPINGS
   ═══════════════════════════════════════════════════════════════ */

const urlTabToMenuKey: Record<string, MenuKey> = {
  dashboard: "AlumniTabs",
  "alumni-cards": "AlumniCards",
  "alumni-talks": "AlumniTalks",
  "alumni-chapters": "AlumniChapters",
  "alumni-association": "AlumniAssociation",
  "alumni-scholarships": "AlumniScholarships",
  "alumni-memberships": "AlumniMemberships",
  jobs: "Jobs",
  "add-alumni": "AadAlumni",
  leadership: "Leadership",
};

const menuKeyToUrlTab: Record<MenuKey, string> = {
  AlumniTabs: "dashboard",
  AlumniCards: "alumni-cards",
  AlumniTalks: "alumni-talks",
  AlumniChapters: "alumni-chapters",
  AlumniAssociation: "alumni-association",
  AlumniScholarships: "alumni-scholarships",
  AlumniMemberships: "alumni-memberships",
  Jobs: "jobs",
  AadAlumni: "add-alumni",
  Leadership: "leadership",
};

/* ═══════════════════════════════════════════════════════════════
   DATA FETCHING
   ═══════════════════════════════════════════════════════════════ */

async function fetchTabCounts(): Promise<Partial<Record<MenuKey, PairCounts>>> {
  const [cardsRes, talksRes, scholarshipsRes, membershipsRes, leadershipRes] = await Promise.all([
    fetch("/api/alumni-cards/counts", { headers: { accept: "application/json" } }),
    fetch("/api/alumni/talks", { headers: { accept: "application/json" } }),
    fetch("/api/alumni/scholarships?limit=1&page=1", { headers: { accept: "application/json" } }),
    fetch("/api/alumni/memberships?limit=1&page=1", { headers: { accept: "application/json" } }),
    fetch("/api/leadership/counts", { headers: { accept: "application/json" } }),
  ]);

  const next: Partial<Record<MenuKey, PairCounts>> = {};

  const asRecord = (v: unknown): Record<string, unknown> =>
    typeof v === "object" && v !== null ? (v as Record<string, unknown>) : {};
  const asNumber = (v: unknown): number => {
    const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
    return Number.isFinite(n) ? n : 0;
  };

  if (cardsRes.ok) {
    const j = (await cardsRes.json()) as {
      all?: number;
      "under-review"?: number;
      underprinting?: number;
      active?: number;
      onhold?: number;
      delivered?: number;
    };
    const jr = asRecord(j);
    const underReview = asNumber(jr["under-review"]);
    const underPrinting = asNumber(jr.underprinting);
    const readyForDelivery = asNumber(jr.active);
    const onHold = asNumber(jr.onhold);
    next.AlumniCards = {
      all: Number(j.all || 0),
      secondary: underReview + underPrinting + readyForDelivery + onHold,
    };
  }

  if (talksRes.ok) {
    const j = (await talksRes.json()) as {
      counts?: { all?: number; pending?: number; pendingConfirmation?: number; confirmed?: number };
    };
    const pending = Number(j.counts?.pending || 0);
    const cr = asRecord(j.counts);
    const pendingConfirmation = asNumber(cr.pendingConfirmation);
    const confirmed = asNumber(cr.confirmed);
    next.AlumniTalks = {
      all: Number(j.counts?.all || 0),
      secondary: pending + pendingConfirmation + confirmed,
    };
  }

  if (scholarshipsRes.ok) {
    const j = (await scholarshipsRes.json()) as { counts?: { pending?: number; approved?: number; notApproved?: number } };
    const pending = Number(j.counts?.pending || 0);
    const approved = Number(j.counts?.approved || 0);
    const cr = asRecord(j.counts);
    const notApproved = asNumber(cr.notApproved);
    next.AlumniScholarships = { all: pending + approved + notApproved, secondary: pending };
  }

  if (membershipsRes.ok) {
    const j = (await membershipsRes.json()) as { counts?: { pending?: number; approved?: number; notApproved?: number } };
    const pending = Number(j.counts?.pending || 0);
    const approved = Number(j.counts?.approved || 0);
    const cr = asRecord(j.counts);
    const notApproved = asNumber(cr.notApproved);
    next.AlumniMemberships = { all: pending + approved + notApproved, secondary: pending };
  }

  if (leadershipRes.ok) {
    const j = (await leadershipRes.json()) as { counts?: { all?: number; pending?: number } };
    next.Leadership = {
      all: Number(j.counts?.all || 0),
      secondary: Number(j.counts?.pending || 0),
    };
  }

  return next;
}

/* ═══════════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════════ */

/** Animated counter badge with shimmer effect */
const CounterBadge: FC<{
  value: number;
  variant: "primary" | "secondary";
  isSelected: boolean;
}> = ({ value, variant, isSelected }) => {
  const baseClasses =
    "inline-flex items-center justify-center rounded-md text-[10px] font-bold leading-none tabular-nums transition-all duration-300";

  const variantClasses =
    variant === "primary"
      ? isSelected
        ? "bg-white/20 text-white"
        : "bg-[#183D32] text-white"
      : isSelected
        ? "bg-white/10 text-white/80 border border-white/20"
        : "bg-[#183D32]/10 text-[#183D32] border border-[#183D32]/20 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30";

  return (
    <motion.span
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className={`${baseClasses} ${variantClasses} min-w-[1.25rem] px-1.5 py-0.5`}
    >
      {value > 99 ? "99+" : value}
    </motion.span>
  );
};

/** Skeleton loader for counters */
const CounterSkeleton: FC = () => (
  <span className="ml-2 inline-flex h-4 w-12 items-center">
    <span className="h-3.5 w-full animate-pulse rounded-md bg-gray-200 dark:bg-gray-700" />
  </span>
);

/** Individual tab button with rich interactions */
const TabButton: FC<{
  tab: TabConfig;
  isSelected: boolean;
  index: number;
  totalTabs: number;
  counts?: PairCounts;
  showLoader: boolean;
  onSelect: (tab: MenuKey) => void;
}> = ({ tab, isSelected, index, totalTabs, counts, showLoader, onSelect }) => {
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        const nextIdx = (index + 1) % totalTabs;
        onSelect(MENU_TABS[nextIdx].key);
        // Focus next button after state update
        setTimeout(() => {
          const buttons = document.querySelectorAll('[role="tab"]');
          (buttons[nextIdx] as HTMLElement)?.focus();
        }, 0);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        const prevIdx = (index - 1 + totalTabs) % totalTabs;
        onSelect(MENU_TABS[prevIdx].key);
        setTimeout(() => {
          const buttons = document.querySelectorAll('[role="tab"]');
          (buttons[prevIdx] as HTMLElement)?.focus();
        }, 0);
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onSelect(tab.key);
      }
    },
    [index, totalTabs, tab.key, onSelect]
  );

  return (
    <motion.button
      ref={buttonRef}
      layout
      role="tab"
      aria-selected={isSelected}
      tabIndex={isSelected ? 0 : -1}
      onClick={() => onSelect(tab.key)}
      onKeyDown={handleKeyDown}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`
        group relative inline-flex h-11 w-[168px] shrink-0 items-center justify-between gap-2 rounded-xl border px-3 text-sm font-semibold
        sm:w-[184px] sm:px-3.5 lg:w-[200px]
        shadow-sm transition-all duration-300 ease-out
        focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
        ${
          isSelected
            ? "border-transparent bg-[#183D32] text-white shadow-lg shadow-[#183D32]/25 dark:bg-[#1a4d3e] dark:shadow-emerald-900/40 focus-visible:ring-[#183D32]/30"
            : "border-gray-200/80 bg-white/80 text-gray-700 backdrop-blur-sm hover:border-[#183D32]/30 hover:bg-white hover:text-[#183D32] hover:shadow-md dark:border-gray-700/60 dark:bg-gray-800/60 dark:text-gray-300 dark:hover:border-emerald-500/40 dark:hover:bg-gray-800 dark:hover:text-emerald-300 focus-visible:ring-[#183D32]/20"
        }
      `}
    >
      {/* Active indicator dot */}
      {isSelected && (
        <motion.span
          layoutId="activeTabIndicator"
          className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-white dark:ring-gray-900"
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        />
      )}

      <span className="relative z-10 min-w-0 flex-1 truncate text-left leading-none">
        {tab.label}
      </span>

      {/* Counter badges */}
      {tab.showCounter && (
        <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap">
          {showLoader ? (
            <CounterSkeleton />
          ) : counts ? (
            <>
              <CounterBadge value={counts.all} variant="primary" isSelected={isSelected} />
              <span
                className={
                  isSelected
                    ? "text-[10px] text-white/40"
                    : "text-[10px] text-gray-400 dark:text-gray-500"
                }
              >
                /
              </span>
              <CounterBadge value={counts.secondary} variant="secondary" isSelected={isSelected} />
            </>
          ) : null}
        </span>
      )}

      {/* Hover glow effect for selected */}
      {isSelected && (
        <span className="absolute inset-0 rounded-xl bg-gradient-to-r from-emerald-500/0 via-emerald-500/5 to-emerald-500/0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      )}

      {/* Selected underline (anchored to the actual tab button) */}
      {isSelected && (
        <motion.span
          layoutId="tabUnderline"
          className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full bg-white/70 dark:bg-emerald-300/70"
          transition={{ type: "spring", stiffness: 500, damping: 40 }}
        />
      )}
    </motion.button>
  );
};

/** Content area with smooth transitions */
const TabContent: FC<{ selected: MenuKey }> = ({ selected }) => {
  const contentMap: Record<MenuKey, ReactNode> = {
    AlumniTabs: <AlumniTabs />,
    AlumniCards: <AlumniCards />,
    AlumniTalks: <AlumniTalksTab />,
    AlumniChapters: <AlumniChaptersTab />,
    AlumniAssociation: <AlumniAssociationTab />,
    AlumniScholarships: <AlumniScholarshipsTab />,
    AlumniMemberships: <AlumniMembershipsTab />,
    Jobs: <JobsTab />,
    AadAlumni: <AlumniSqlForm />,
    Leadership: <AlumniTabs />, // Fallback - adjust as needed
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={selected}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.25, ease: "easeInOut" }}
      >
        {contentMap[selected] || <AlumniTabs />}
      </motion.div>
    </AnimatePresence>
  );
};

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT — UnifiedHeader
   ═══════════════════════════════════════════════════════════════ */

const UnifiedHeader: FC<Props> = ({ variant, showTabsContent = true }) => {
  return variant === "tabs" ? (
    <UnifiedHeaderTabs showTabsContent={showTabsContent} />
  ) : (
    <UnifiedHeaderTopbar />
  );
};

/* ─────────────── Tabs Variant ─────────────── */

const UnifiedHeaderTabs: FC<{ showTabsContent: boolean }> = ({ showTabsContent }) => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const safeSearchParams = searchParams ?? new URLSearchParams();

  const getTabFromUrl = useCallback((): MenuKey => {
    const p = String(pathname ?? "");
    if (p === "/leadership" || p.startsWith("/leadership/")) {
      return "Leadership";
    }
    const tabFromUrl = safeSearchParams.get("tab");
    if (tabFromUrl && urlTabToMenuKey[tabFromUrl]) {
      return urlTabToMenuKey[tabFromUrl];
    }
    return "AlumniTabs";
  }, [pathname, safeSearchParams]);

  const [selected, setSelected] = useState<MenuKey>(getTabFromUrl);
  const [isScrolled, setIsScrolled] = useState(false);

  // Track scroll for header elevation
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Tab counts query
  const {
    data: tabCountsData,
    isLoading: tabCountsLoading,
    isFetching: tabCountsFetching,
  } = useQuery({
    queryKey: ["dashboard-tab-counts"],
    queryFn: fetchTabCounts,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    refetchOnMount: false,
  });

  const tabCounts = useMemo(() => tabCountsData ?? {}, [tabCountsData]);

  const handleTabChange = useCallback(
    (tab: MenuKey) => {
      setSelected(tab);
      if (tab === "Leadership") {
        router.push("/leadership", { scroll: false });
        return;
      }
      const urlTab = menuKeyToUrlTab[tab];
      router.push(`/dashboard?tab=${urlTab}`, { scroll: false });
    },
    [router]
  );

  // Sync with URL changes
  useEffect(() => {
    const validTab = getTabFromUrl();
    setSelected(validTab);
  }, [getTabFromUrl]);

  return (
    <>
      {/* ── Sticky Header ── */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className={`
          sticky top-0 z-[600] flex min-h-[72px] items-center border-b bg-white/95 px-4 py-3
          backdrop-blur-xl transition-all duration-300
          ${
            isScrolled
              ? "border-gray-200/80 shadow-lg shadow-gray-900/5 dark:border-gray-700/60 dark:shadow-black/20"
              : "border-transparent shadow-[0_1px_3px_rgba(0,0,0,0.04)] dark:shadow-none"
          }
          dark:bg-gray-900/95 dark:backdrop-blur-xl sm:px-6 lg:px-8
        `}
      >
        <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-3">
          {/* Section title */}
          <div className="flex items-center justify-between  py-2 px-2 ">
            <div className="flex items-center gap-3 ">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#183D32]/10 dark:bg-emerald-500/15">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="text-[#183D32] dark:text-emerald-400"
                >
                  <path
                    d="M12 2L2 7L12 12L22 7L12 2Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M2 17L12 22L22 17"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M2 12L12 17L22 12"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div>
                <h1 className="text-base font-bold text-gray-900 dark:text-white">
                  Alumni Portal
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Manage alumni records, events, and engagement
                </p>
              </div>
            </div>

            {/* Quick actions */}
            <div className="hidden items-center gap-2 sm:flex  py-2 px-2">
              <button
                onClick={() => handleTabChange("AadAlumni")}
                className="inline-flex items-center gap-2 rounded-lg bg-[#183D32] px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-[#1a4d3e] hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#183D32]/30 active:scale-[0.98] dark:bg-emerald-600 dark:hover:bg-emerald-500"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                </svg>
                Add Alumni
              </button>
            </div>
          </div>

          {/* Tab Navigation */}
          <nav className="relative py-2 px-4" role="tablist" aria-label="Alumni sections">
            <div className="flex flex-wrap items-stretch gap-2 pb-1">
              {MENU_TABS.map((tab, idx) => {
                const isSelected = selected === tab.key;
                const counts = tab.showCounter ? tabCounts[tab.key] : undefined;
                const showLoader = (tabCountsLoading || tabCountsFetching) && tab.showCounter && !counts;

                return (
                  <TabButton
                    key={tab.key}
                    tab={tab}
                    isSelected={isSelected}
                    index={idx}
                    totalTabs={MENU_TABS.length}
                    counts={counts}
                    showLoader={showLoader}
                    onSelect={handleTabChange}
                  />
                );
              })}
            </div>

            {/* Underline is rendered inside the selected tab */}
          </nav>
        </div>
      </motion.header>

      {/* ── Tab Content ── */}
      {showTabsContent && (
        <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
          <ComponentCard className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <TabContent selected={selected} />
          </ComponentCard>
        </div>
      )}
    </>
  );
};

/* ─────────────── Topbar Variant ─────────────── */

const UnifiedHeaderTopbar: FC = () => {
  const [isApplicationMenuOpen, setApplicationMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  const { isMobileOpen, toggleSidebar, toggleMobileSidebar } = useSidebar();

  const handleToggle = useCallback(() => {
    if (window.innerWidth >= 1024) {
      toggleSidebar();
    } else {
      toggleMobileSidebar();
    }
  }, [toggleSidebar, toggleMobileSidebar]);

  const toggleApplicationMenu = useCallback(() => {
    setApplicationMenuOpen((prev) => !prev);
  }, []);

  const inputRef = useRef<HTMLInputElement>(null);
  const { status, data: session } = useSession();
  const t = String(((session?.user ?? {}) as { type?: string }).type || "").toLowerCase();
  const isAlumni = t === "alumni";

  // Track scroll
  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Keyboard shortcut: Cmd/Ctrl + K for search
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={`
        sticky top-0 z-[500] flex min-h-[68px] items-center border-b bg-white/95
        backdrop-blur-xl transition-all duration-300
        ${
          isScrolled
            ? "border-gray-200/80 shadow-lg shadow-gray-900/5 dark:border-gray-700/60 dark:shadow-black/20"
            : "border-transparent shadow-[0_1px_3px_rgba(0,0,0,0.04)] dark:shadow-none"
        }
        dark:bg-gray-900/95 dark:backdrop-blur-xl
      `}
    >
      <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        {/* Left section: Logo / Toggle */}
        <div className="flex items-center gap-3">
          {isAlumni ? (
            <Link href="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-80">
              <Image
                width={154}
                height={32}
                className="h-7 w-auto dark:hidden"
                src="/images/logo/UOL-Rebrand-ID_Final-01.png"
                alt="UOL Alumni Portal"
                priority
              />
              <Image
                width={154}
                height={32}
                className="hidden h-7 w-auto dark:block"
                src="/images/logo/UOL-Rebrand-ID_Final-01.png"
                alt="UOL Alumni Portal"
                priority
              />
            </Link>
          ) : (
            <button
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-[#183D32] shadow-sm transition-all hover:bg-gray-50 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#183D32]/20 active:scale-95 dark:border-gray-700 dark:bg-gray-800 dark:text-emerald-300 dark:hover:bg-gray-700 dark:focus-visible:ring-emerald-400/30 lg:h-10 lg:w-10"
              onClick={handleToggle}
              aria-label={isMobileOpen ? "Close sidebar" : "Open sidebar"}
            >
              <AnimatePresence mode="wait">
                {isMobileOpen ? (
                  <motion.svg
                    key="close"
                    initial={{ rotate: -90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: 90, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  >
                    <path d="M18 6L6 18M6 6l12 12" />
                  </motion.svg>
                ) : (
                  <motion.svg
                    key="menu"
                    initial={{ rotate: 90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: -90, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  >
                    <path d="M3 12h18M3 6h18M3 18h18" />
                  </motion.svg>
                )}
              </AnimatePresence>
            </button>
          )}
        </div>

       
        {/* Right section: Actions & User */}
        <div className="flex items-center gap-2">
          {/* Mobile menu toggle */}
          <button
            onClick={toggleApplicationMenu}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-[#183D32] shadow-sm transition-all hover:bg-gray-50 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#183D32]/20 active:scale-95 dark:border-gray-700 dark:bg-gray-800 dark:text-emerald-300 dark:hover:bg-gray-700 dark:focus-visible:ring-emerald-400/30 lg:hidden"
            aria-label="Open menu"
            aria-expanded={isApplicationMenuOpen}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="1" />
              <circle cx="19" cy="12" r="1" />
              <circle cx="5" cy="12" r="1" />
            </svg>
          </button>

          {/* Desktop actions */}
          <div className="hidden items-center gap-2 lg:flex">
            <ThemeToggleButton />

            

            {/* Divider */}
            <div className="mx-1 h-6 w-px bg-gray-200 dark:bg-gray-700" />

            {/* Auth states */}
            {status === "loading" && (
              <div className="flex items-center gap-3">
                <span className="h-10 w-10 animate-pulse overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700" />
                <span className="hidden h-4 w-24 animate-pulse rounded bg-gray-200 dark:bg-gray-700 xl:block" />
              </div>
            )}
            {status === "authenticated" && <UserDropdown />}
            {status === "unauthenticated" && (
              <Link
                href="/signin"
                className="inline-flex items-center gap-2 rounded-xl bg-[#183D32] px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-[#1a4d3e] hover:shadow-md active:scale-[0.98] dark:bg-emerald-600 dark:hover:bg-emerald-500"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Mobile overlay */}
      <AnimatePresence>
        {isApplicationMenuOpen && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            type="button"
            aria-label="Close menu"
            onClick={toggleApplicationMenu}
            className="fixed inset-0 z-[55] bg-black/30 backdrop-blur-[2px] dark:bg-black/50 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Mobile slide-out panel */}
      <AnimatePresence>
        {isApplicationMenuOpen && (
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed inset-y-0 right-0 z-[60] flex w-80 flex-col gap-4 border-l border-gray-200 bg-white p-5 shadow-2xl dark:border-gray-800 dark:bg-gray-900 lg:hidden"
          >
            {/* Panel header */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-[#183D32] dark:text-emerald-300">
                Menu
              </span>
              <button
                type="button"
                onClick={toggleApplicationMenu}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white text-[#183D32] shadow-sm transition-all hover:bg-gray-50 hover:shadow-md active:scale-95 dark:border-gray-700 dark:bg-gray-800 dark:text-emerald-300 dark:hover:bg-gray-700"
                aria-label="Close menu"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Mobile search */}
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" strokeLinecap="round" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search..."
                className="h-10 w-full rounded-xl border border-gray-200 bg-gray-50 py-2 pl-10 pr-4 text-sm text-gray-700 placeholder-gray-400 outline-none focus:border-[#183D32]/40 focus:ring-2 focus:ring-[#183D32]/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:placeholder-gray-500 dark:focus:border-emerald-500/40"
              />
            </div>

            {/* Mobile actions */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50/50 p-3 dark:border-gray-800 dark:bg-gray-800/50">
                <span className="text-sm text-gray-600 dark:text-gray-400">Theme</span>
                <ThemeToggleButton />
              </div>
            </div>

            {/* Mobile auth */}
            <div className="mt-auto border-t border-gray-100 pt-4 dark:border-gray-800">
              {status === "loading" && (
                <div className="flex items-center gap-3">
                  <span className="h-10 w-10 animate-pulse rounded-full bg-gray-200 dark:bg-gray-700" />
                  <span className="h-4 w-24 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                </div>
              )}
              {status === "authenticated" && <UserDropdown />}
              {status === "unauthenticated" && (
                <Link
                  href="/signin"
                  className="flex w-full items-center justify-center rounded-xl bg-[#183D32] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-[#1a4d3e] active:scale-[0.98] dark:bg-emerald-600 dark:hover:bg-emerald-500"
                >
                  Sign in
                </Link>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
};

export default UnifiedHeader;
