
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
import { isSuperAdminUser } from "@/lib/alumniProfile";
import { TabBar } from "@/components/design-system/TabBar";
import { BarChart3 } from "lucide-react";

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
  | "AlumniStories"
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
  { key: "AlumniStories", label: "Success Stories", urlTab: "alumni-stories", showCounter: true },
  { key: "AlumniChapters", label: "Alumni Chapters", urlTab: "alumni-chapters", showCounter: false },
  { key: "AlumniAssociation", label: "Alumni Association", urlTab: "alumni-association", showCounter: false },
  { key: "AlumniScholarships", label: "Alumni Scholarships", urlTab: "alumni-scholarships", showCounter: true },
  { key: "AlumniMemberships", label: "Alumni Memberships", urlTab: "alumni-memberships", showCounter: true },
  { key: "Leadership", label: "Leadership", urlTab: "leadership", showCounter: true },
  { key: "Jobs", label: "Jobs", urlTab: "jobs", showCounter: false },
];

/* ═══════════════════════════════════════════════════════════════
   URL MAPPINGS
   ═══════════════════════════════════════════════════════════════ */

const urlTabToMenuKey: Record<string, MenuKey> = {
  dashboard: "AlumniTabs",
  "alumni-cards": "AlumniCards",
  "alumni-talks": "AlumniTalks",
  "alumni-stories": "AlumniStories",
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
  AlumniStories: "alumni-stories",
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
  const [cardsRes, talksRes, storiesRes, scholarshipsRes, membershipsRes, leadershipRes] =
    await Promise.all([
      fetch("/api/alumni-cards/counts", { headers: { accept: "application/json" } }),
      fetch("/api/alumni/talks", { headers: { accept: "application/json" } }),
      fetch("/api/alumni-stories/counts", { headers: { accept: "application/json" } }),
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

  if (storiesRes.ok) {
    const j = (await storiesRes.json()) as { pending?: number; approved?: number };
    next.AlumniStories = {
      all: Number(j.pending || 0),
      secondary: Number(j.approved || 0),
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

/** Content area with smooth transitions */
const TabContent: FC<{ selected: MenuKey }> = ({ selected }) => {
  const contentMap: Record<MenuKey, ReactNode> = {
    AlumniTabs: <AlumniTabs />,
    AlumniCards: <AlumniCards />,
    AlumniTalks: <AlumniTalksTab />,
    AlumniStories: <AlumniTabs />,
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
    if (p === "/alumni-stories" || p.startsWith("/alumni-stories/")) {
      return "AlumniStories";
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
      if (tab === "AlumniStories") {
        router.push("/alumni-stories?tab=viewStories", { scroll: false });
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

  const isSecondaryNav = !showTabsContent;

  return (
    <>
      {/* Sits below AppHeader (sticky topbar). Secondary mode is nav-only on pages like /leadership. */}
      <div
        className={`
          sticky top-[var(--app-header-height,4.25rem)] z-40 w-full max-w-full border-b bg-white/95 backdrop-blur-xl transition-shadow duration-300
          dark:bg-gray-900/95
          ${
            isScrolled
              ? "border-gray-200/80 shadow-md shadow-gray-900/5 dark:border-gray-700/60 dark:shadow-black/20"
              : "border-gray-200/60 dark:border-gray-800/80"
          }
        `}
      >
        <div className="mx-auto w-full max-w-[1600px] px-4 sm:px-6 lg:px-8">
          <div className={`flex flex-col gap-3 ${isSecondaryNav ? "py-2" : "py-3"}`}>
            {showTabsContent ? (
              <div className="flex items-center justify-between gap-3">
                <div className="hidden min-w-0 items-center gap-3 sm:flex">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-500/10 dark:bg-accent-500/15">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      className="text-accent-600 dark:text-accent-300"
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
                  <div className="min-w-0">
                    <h1 className="text-sm font-bold text-gray-900 dark:text-white">Alumni Portal</h1>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Manage alumni records, events, and engagement
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleTabChange("AadAlumni")}
                  className="ml-auto inline-flex shrink-0 items-center gap-2 rounded-lg bg-accent-500 px-4 py-2 text-sm font-medium text-white shadow-theme-sm transition-all hover:bg-accent-600 hover:shadow-theme-md focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/30 active:scale-[0.98] dark:bg-accent-600 dark:hover:bg-accent-500"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                  </svg>
                  <span className="hidden sm:inline">Add Alumni</span>
                  <span className="sm:hidden">Add</span>
                </button>
              </div>
            ) : null}

            <nav className="min-w-0 w-full">
              <TabBar
                items={MENU_TABS.map((tab) => ({
                  key: tab.key,
                  label: tab.label,
                  count: tab.showCounter
                    ? tabCounts[tab.key]
                      ? tabCounts[tab.key]!.all
                      : undefined
                    : undefined,
                }))}
                selected={selected}
                onSelect={(key) => handleTabChange(key as MenuKey)}
              />
            </nav>
          </div>
        </div>
      </div>

      {showTabsContent && (
        <div className="relative z-0 mx-auto w-full max-w-[1600px] scroll-mt-4 px-4 pt-4 pb-6 sm:px-6 sm:pt-6 lg:px-8">
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

  const pathname = usePathname();
  const { isExpanded, isMobileOpen, toggleSidebar, toggleMobileSidebar } = useSidebar();

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
  const isSuperAdmin = isSuperAdminUser(session?.user);
  const isAnalyticsRoute = pathname === "/admin/analytics";

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
      style={{ ["--app-header-height" as string]: "4.25rem" }}
      className={`
        sticky top-0 z-50 flex min-h-[4.25rem] w-full max-w-full items-center overflow-visible border-b bg-white/95 
        backdrop-blur-xl transition-all duration-300 
        ${
          isScrolled
            ? "border-gray-200/80 shadow-lg shadow-gray-900/5 dark:border-gray-700/60 dark:shadow-black/20"
            : "border-transparent shadow-[0_1px_3px_rgba(0,0,0,0.04)] dark:shadow-none"
        }
        dark:bg-gray-900/95 dark:backdrop-blur-xl
      `}
    >
      <div
        className={`mx-auto w-full max-w-[1600px] border-b px-4 py-3 sm:px-6 lg:px-8 ${
          isAnalyticsRoute
            ? "grid grid-cols-[auto_1fr_auto] items-center gap-3 sm:grid-cols-3 sm:gap-4"
            : "flex items-center justify-between gap-3"
        }`}
      >
        {/* Left section: Logo / Toggle */}
        <div className={`flex min-w-0 items-center ${isAnalyticsRoute ? "justify-self-start" : "gap-3 sm:gap-4"}`}>
          {isAlumni ? (
            <Link href="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-80">
              <Image
                width={254}
                height={80}
                className="h-7 w-auto dark:hidden"
                src="/images/logo/UOL-Rebrand-ID_Final-01.png"
                alt="UOL Alumni Portal"
                priority
              />
              <Image
                width={254}
                height={80}
                className="hidden h-7 w-auto dark:block"
                src="/images/logo/UOL-Rebrand-ID_Final-01.png"
                alt="UOL Alumni Portal"
                priority
              />
            </Link>
          ) : isAnalyticsRoute ? (
            <Link href="/dashboard" className="flex shrink-0 items-center transition-opacity hover:opacity-80">
              <Image
                width={308}
                height={64}
                className="h-12 w-auto sm:h-14 dark:hidden"
                src="/images/logo/UOL-Rebrand-ID_Final-01.png"
                alt="UOL Alumni Portal"
                priority
                sizes="(max-width: 640px) 192px, 224px"
              />
              <Image
                width={308}
                height={64}
                className="hidden h-12 w-auto sm:h-14 dark:block"
                src="/images/logo/UOL-Rebrand-ID_Final-01.png"
                alt="UOL Alumni Portal"
                priority
                sizes="(max-width: 640px) 192px, 224px"
              />
            </Link>
          ) : (
            <button
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-accent-600 shadow-sm transition-all hover:bg-gray-50 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/20 active:scale-95 dark:border-gray-700 dark:bg-gray-800 dark:text-accent-300 dark:hover:bg-gray-700 dark:focus-visible:ring-accent-400/30 lg:h-10 lg:w-10"
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
        {/* Super Admin Actions */}

        {isAnalyticsRoute ? (
          <h1 className="min-w-0 truncate px-2 text-center text-base font-bold tracking-tight text-accent-700 dark:text-accent-300 sm:text-lg lg:text-xl">
            Portal Analytics
          </h1>
        ) : null}

        {/* Right section: Actions & User */}
        <div
          className={`flex items-center gap-2 ${isAnalyticsRoute ? "justify-self-end justify-end" : ""}`}
        >
          {isSuperAdmin && !isAnalyticsRoute ? (
            <Link
              target="_blank"
              href="/admin/analytics"
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 shadow-theme-xs transition-all hover:bg-gray-50 hover:text-accent-700 hover:shadow-theme-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-accent-300"
              aria-label="View Analytics"
              title="View Analytics"
            >
              <BarChart3 className="h-4 w-4" strokeWidth={1.75} />
            </Link>
          ) : null}

          {/* Mobile menu toggle */}
          <button
            onClick={toggleApplicationMenu}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-accent-600 shadow-sm transition-all hover:bg-gray-50 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/20 active:scale-95 dark:border-gray-700 dark:bg-gray-800 dark:text-accent-300 dark:hover:bg-gray-700 dark:focus-visible:ring-accent-400/30 lg:hidden"
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
          <div className="relative z-10 hidden items-center gap-2 overflow-visible lg:flex">
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
                className="inline-flex items-center gap-2 rounded-xl bg-accent-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-accent-600 hover:shadow-md active:scale-[0.98] dark:bg-accent-600 dark:hover:bg-accent-500"
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
              <span className="text-sm font-bold text-accent-700 dark:text-accent-300">
                Menu
              </span>
              <button
                type="button"
                onClick={toggleApplicationMenu}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white text-accent-600 shadow-sm transition-all hover:bg-gray-50 hover:shadow-md active:scale-95 dark:border-gray-700 dark:bg-gray-800 dark:text-accent-300 dark:hover:bg-gray-700"
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
                className="h-10 w-full rounded-xl border border-gray-200 bg-gray-50 py-2 pl-10 pr-4 text-sm text-gray-700 placeholder-gray-400 outline-none focus:border-accent-500/40 focus:ring-2 focus:ring-accent-500/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:placeholder-gray-500 dark:focus:border-accent-400/40"
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
                  className="flex w-full items-center justify-center rounded-xl bg-accent-500 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-accent-600 active:scale-[0.98] dark:bg-accent-600 dark:hover:bg-accent-500"
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
