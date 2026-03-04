"use client";

import type { FC } from "react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import UserDropdown from "@/components/header/UserDropdown";
import ComponentCard from "@/components/common/ComponentCard";
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

const MENU_TABS: { key: MenuKey; label: string; urlTab: string }[] = [
  { key: "AlumniTabs", label: "Dashboard", urlTab: "dashboard" },
  { key: "AlumniCards", label: "Alumni Cards", urlTab: "alumni-cards" },
  { key: "AlumniTalks", label: "Alumni Talks", urlTab: "alumni-talks" },
  { key: "AlumniChapters", label: "Alumni Chapters", urlTab: "alumni-chapters" },
  { key: "AlumniAssociation", label: "Alumni Association", urlTab: "alumni-association" },
  { key: "AlumniScholarships", label: "Alumni Scholarships", urlTab: "alumni-scholarships" },
  { key: "AlumniMemberships", label: "Alumni Memberships", urlTab: "alumni-memberships" },
  { key: "Leadership", label: "Leadership", urlTab: "leadership" },
  { key: "Jobs", label: "Jobs", urlTab: "jobs" },
  { key: "AadAlumni", label: "Add Alumni", urlTab: "add-alumni" },
];

type PairCounts = { all: number; secondary: number };

async function fetchTabCounts(): Promise<Partial<Record<MenuKey, PairCounts>>> {
  const [cardsRes, talksRes, scholarshipsRes, membershipsRes, leadershipRes] = await Promise.all([
    fetch("/api/alumni-cards/counts", { headers: { accept: "application/json" } }),
    fetch("/api/alumni/talks", { headers: { accept: "application/json" } }),
    fetch("/api/alumni/scholarships?limit=1&page=1", { headers: { accept: "application/json" } }),
    fetch("/api/alumni/memberships?limit=1&page=1", { headers: { accept: "application/json" } }),
    fetch("/api/leadership/counts", { headers: { accept: "application/json" } }),
  ]);

  const next: Partial<Record<MenuKey, PairCounts>> = {};

  const asRecord = (v: unknown): Record<string, unknown> => (typeof v === "object" && v !== null ? (v as Record<string, unknown>) : {});
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

const UnifiedHeader: FC<Props> = ({ variant, showTabsContent = true }) => {
  return variant === "tabs" ? <UnifiedHeaderTabs showTabsContent={showTabsContent} /> : <UnifiedHeaderTopbar />;
};

const UnifiedHeaderTabs: FC<{ showTabsContent: boolean }> = ({ showTabsContent }) => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const safeSearchParams = searchParams ?? new URLSearchParams();

  const getTabFromUrl = () => {
    const p = String(pathname ?? "");
    if (p === "/leadership" || p.startsWith("/leadership/")) {
      return "Leadership";
    }

    const tabFromUrl = safeSearchParams.get("tab");
    if (tabFromUrl && urlTabToMenuKey[tabFromUrl]) {
      return urlTabToMenuKey[tabFromUrl];
    }
    return "AlumniTabs";
  };

  const [selected, setSelected] = useState<MenuKey>(getTabFromUrl());

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

  const handleTabChange = (tab: MenuKey) => {
    setSelected(tab);
    if (tab === "Leadership") {
      router.push("/leadership", { scroll: false });
      return;
    }
    const urlTab = menuKeyToUrlTab[tab];
    router.push(`/dashboard?tab=${urlTab}`, { scroll: false });
  };

  useEffect(() => {
    const validTab = getTabFromUrl();
    setSelected(validTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeSearchParams, pathname]);

  const renderCounterPair = (key: MenuKey, isSelected: boolean) => {
    const c = tabCounts[key];
    const showLoader = (tabCountsLoading || tabCountsFetching) && !c;
    if (!c && !showLoader) return null;

    const allCls = "bg-[#183D32] text-white";
    const secondaryCls = "bg-[#183D32] text-white border border-white/40";

    return (
      <span className="ml-2 inline-flex items-center gap-1 align-middle">
        {showLoader ? (
          <span className="inline-flex items-center justify-center FMENUh-4 w-8">
            <span className="h-3 w-3 rounded-full border-2 border-[#183D32]/30 border-t-[#183D32] animate-spin" />
          </span>
        ) : (
          <>
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none ${allCls}`}>{c!.all}</span>
            <span className={isSelected ? "text-[#183D32]/60 text-[10px]" : "text-[#183D32]/60 text-[10px]"}>/</span>
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none ${secondaryCls}`}>{c!.secondary}</span>
          </>
        )}
      </span>
    );
  };

  return (
    <>
      <header className="sticky top-0 flex shadow-[0px_0px_16px_rgba(17,_17,_26,_0.1)] py-4 px-4 sm:px-6 bg-white min-h-[70px] tracking-wide relative z-[60]">
        <div className="w-full mx-auto flex items-center justify-start flex-wrap  gap-4">
          

          <nav className="flex-1 min-w-0 ">
            <div
              className="w-full  bg-gray-50/60 p-1"
              role="tablist"
              aria-label="Alumni sections"
            >
              <div className="flex items-start gap-2 flex-wrap  justify-start overflow-x-auto whitespace-nowrap [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:justify-start">
                {MENU_TABS.map((tab, idx) => {
                  const isSelected = selected === tab.key;
                  return (
                    <button
                      key={tab.key}
                      className={
                        "inline-flex items-center rounded-full border px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#183D32]/20 " +
                        (isSelected
                          ? "bg-[#183D32] text-white border-[#183D32]"
                          : "bg-white text-[#183D32] border-gray-200 hover:border-[#183D32]/40 hover:bg-white")
                      }
                      onClick={() => handleTabChange(tab.key)}
                      role="tab"
                      aria-selected={isSelected}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "ArrowRight") {
                          e.preventDefault();
                          const nextIdx = (idx + 1) % MENU_TABS.length;
                          handleTabChange(MENU_TABS[nextIdx].key);
                        } else if (e.key === "ArrowLeft") {
                          e.preventDefault();
                          const prevIdx = (idx - 1 + MENU_TABS.length) % MENU_TABS.length;
                          handleTabChange(MENU_TABS[prevIdx].key);
                        } else if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleTabChange(tab.key);
                        }
                      }}
                    >
                      <span className="inline-flex items-center">
                        <span>{tab.label}</span>
                        {(tab.key === "AlumniCards" ||
                          tab.key === "AlumniTalks" ||
                          tab.key === "AlumniScholarships" ||
                          tab.key === "AlumniMemberships" ||
                          tab.key === "Leadership") &&
                          renderCounterPair(tab.key, isSelected)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </nav>
        </div>
      </header>

      {showTabsContent && (
        <ComponentCard className="">
          <div className="">
            {selected === "AlumniTabs" && <AlumniTabs />}
            {selected === "AlumniCards" && <AlumniCards />}
            {selected === "AlumniTalks" && <AlumniTalksTab />}
            {selected === "AlumniChapters" && <AlumniChaptersTab />}
            {selected === "AlumniAssociation" && <AlumniAssociationTab />}
            {selected === "AlumniScholarships" && <AlumniScholarshipsTab />}
            {selected === "AlumniMemberships" && <AlumniMembershipsTab />}
            {selected === "Jobs" && <JobsTab />}
            {selected === "AadAlumni" && <AlumniSqlForm />}
          </div>
        </ComponentCard>
      )}
    </>
  );
};

const UnifiedHeaderTopbar: FC = () => {
  const [isApplicationMenuOpen, setApplicationMenuOpen] = useState(false);

  const { isMobileOpen, toggleSidebar, toggleMobileSidebar } = useSidebar();

  const handleToggle = () => {
    if (window.innerWidth >= 1024) {
      toggleSidebar();
    } else {
      toggleMobileSidebar();
    }
  };

  const toggleApplicationMenu = () => {
    setApplicationMenuOpen(!isApplicationMenuOpen);
  };

  const inputRef = useRef<HTMLInputElement>(null);
  const { status, data: session } = useSession();
  const t = String(((session?.user ?? {}) as { type?: string }).type || "").toLowerCase();
  const isAlumni = t === "alumni";

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <header className="sticky top-0 flex shadow-[0px_0px_16px_rgba(17,_17,_26,_0.1)] py-4 px-4 sm:px-6 bg-white min-h-[70px] tracking-wide relative z-10000">
      <div className="w-full mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center justify-between gap-3 ">
          {isAlumni ? (
            <Link href="/" className="flex items-center gap-2">
              <Image
                width={154}
                height={32}
                className="h-8 w-auto dark:hidden"
                src="/images/logo/UOL-Rebrand-ID_Final-01.png"
                alt="UOL Alumni Portal"
                priority
              />
              <Image
                width={154}
                height={32}
                className="hidden h-8 w-auto dark:block"
                src="/images/logo/UOL-Rebrand-ID_Final-01.png"
                alt="UOL Alumni Portal"
                priority
              />
            </Link>
          ) : (
            <div className="flex flex-row justify-center items-center">
              <button
                className="inline-flex items-center justify-center h-10 w-10 rounded-full border border-gray-200 bg-white text-[#183D32] shadow-sm hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#183D32]/20 lg:h-11 lg:w-11"
                onClick={handleToggle}
                aria-label="Toggle Sidebar"
              >
                {isMobileOpen ? (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M6.21967 7.28131C5.92678 6.98841 5.92678 6.51354 6.21967 6.22065C6.51256 5.92775 6.98744 5.92775 7.28033 6.22065L11.999 10.9393L16.7176 6.22078C17.0105 5.92789 17.4854 5.92788 17.7782 6.22078C18.0711 6.51367 18.0711 6.98855 17.7782 7.28144L13.0597 12L17.7782 16.7186C18.0711 17.0115 18.0711 17.4863 17.7782 17.7792C17.4854 18.0721 17.0105 18.0721 16.7176 17.7792L11.999 13.0607L7.28033 17.7794C6.98744 18.0722 6.51256 18.0722 6.21967 17.7794C5.92678 17.4865 5.92678 17.0116 6.21967 16.7187L10.9384 12L6.21967 7.28131Z"
                      fill="currentColor"
                    />
                  </svg>
                ) : (
                  <svg width="16" height="12" viewBox="0 0 16 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M0.583252 1C0.583252 0.585788 0.919038 0.25 1.33325 0.25H14.6666C15.0808 0.25 15.4166 0.585786 15.4166 1C15.4166 1.41421 15.0808 1.75 14.6666 1.75L1.33325 1.75C0.919038 1.75 0.583252 1.41422 0.583252 1ZM0.583252 11C0.583252 10.5858 0.919038 10.25 1.33325 10.25L14.6666 10.25C15.0808 10.25 15.4166 10.5858 15.4166 11C15.4166 11.4142 15.0808 11.75 14.6666 11.75L1.33325 11.75C0.919038 11.75 0.583252 11.4142 0.583252 11ZM1.33325 5.25C0.919038 5.25 0.583252 5.58579 0.583252 6C0.583252 6.41421 0.919038 6.75 1.33325 6.75L7.99992 6.75C8.41413 6.75 8.74992 6.41421 8.74992 6C8.74992 5.58579 8.41413 5.25 7.99992 5.25L1.33325 5.25Z"
                      fill="currentColor"
                    />
                  </svg>
                )}
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleApplicationMenu}
            className="inline-flex items-center justify-center h-10 w-10 rounded-full border border-gray-200 bg-white text-[#183D32] shadow-sm hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#183D32]/20 lg:hidden"
            aria-label="Open menu"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M5.99902 10.4951C6.82745 10.4951 7.49902 11.1667 7.49902 11.9951V12.0051C7.49902 12.8335 6.82745 13.5051 5.99902 13.5051C5.1706 13.5051 4.49902 12.8335 4.49902 12.0051V11.9951C4.49902 11.1667 5.1706 10.4951 5.99902 10.4951ZM17.999 10.4951C18.8275 10.4951 19.499 11.1667 19.499 11.9951V12.0051C19.499 12.8335 18.8275 13.5051 17.999 13.5051C17.1706 13.5051 16.499 12.8335 16.499 12.0051V11.9951C16.499 11.1667 17.1706 10.4951 17.999 10.4951ZM13.499 11.9951C13.499 11.1667 12.8275 10.4951 11.999 10.4951C11.1706 10.4951 10.499 11.1667 10.499 11.9951V12.0051C10.499 12.8335 11.1706 13.5051 11.999 13.5051C12.8275 13.5051 13.499 12.8335 13.499 12.0051V11.9951Z"
                fill="currentColor"
              />
            </svg>
          </button>
        </div>

        {isApplicationMenuOpen && (
          <button
            type="button"
            aria-label="Close menu"
            onClick={toggleApplicationMenu}
            className="fixed inset-0 bg-black/30 backdrop-blur-[1px] lg:hidden"
          />
        )}

        <div
          className={
            "fixed inset-y-0 right-0 w-72 bg-white shadow-xl border-l border-gray-200 p-4 flex flex-col gap-4 transform transition-transform duration-300 z-[60] " +
            (isApplicationMenuOpen ? "translate-x-0" : "translate-x-full") +
            " lg:static lg:inset-auto lg:w-auto lg:translate-x-0 lg:shadow-none lg:border-0 lg:p-0 lg:flex lg:flex-row lg:items-center"
          }
        >
          <div className="flex items-center justify-between lg:hidden">
            <span className="text-sm font-semibold text-[#183D32]">Menu</span>
            <button
              type="button"
              onClick={toggleApplicationMenu}
              className="inline-flex items-center justify-center h-9 w-9 rounded-full border border-gray-200 bg-white text-[#183D32] shadow-sm hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#183D32]/20"
              aria-label="Close menu"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M6.21967 7.28131C5.92678 6.98841 5.92678 6.51354 6.21967 6.22065C6.51256 5.92775 6.98744 5.92775 7.28033 6.22065L11.999 10.9393L16.7176 6.22078C17.0105 5.92789 17.4854 5.92788 17.7782 6.22078C18.0711 6.51367 18.0711 6.98855 17.7782 7.28144L13.0597 12L17.7782 16.7186C18.0711 17.0115 18.0711 17.4863 17.7782 17.7792C17.4854 18.0721 17.0105 18.0721 16.7176 17.7792L11.999 13.0607L7.28033 17.7794C6.98744 18.0722 6.51256 18.0722 6.21967 17.7794C5.92678 17.4865 5.92678 17.0116 6.21967 16.7187L10.9384 12L6.21967 7.28131Z"
                  fill="currentColor"
                />
              </svg>
            </button>
          </div>
          <div className="flex items-center gap-2 2xsm:gap-3" />

          {status === "loading" && (
            <div className="flex items-center gap-3">
              <span className="mr-3 overflow-hidden rounded-full h-11 w-11 bg-gray-200 animate-pulse" />
              <span className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
            </div>
          )}
          {status === "authenticated" && <UserDropdown />}
          {status === "unauthenticated" && (
            <Link href="/signin" className="text-sm text-[#183D32] hover:text-[#183D32]/80 underline-offset-4 hover:underline">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};

export default UnifiedHeader;
