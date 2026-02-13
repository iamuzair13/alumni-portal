"use client";
import type { FC, CSSProperties } from "react";
import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import ComponentCard from "@/components/common/ComponentCard";
import { AlumniTabs } from "@/components/alumni/Alumni-tabs";
import { AlumniCards } from "@/components/alumni/Alumini-cards";
import { AlumniTalksTab } from "@/components/alumni/AlumniTalksTab";
import { AlumniChaptersTab } from "@/components/alumni/AlumniChaptersTab";
import { AlumniAssociationTab } from "@/components/alumni/AlumniAssociationTab";
import { AlumniScholarshipsTab } from "@/components/alumni/AlumniScholarshipsTab";
import { AlumniMembershipsTab } from "@/components/alumni/AlumniMembershipsTab";
import { JobsTab } from "@/components/alumni/JobsTab";
import { useQuery } from "@tanstack/react-query";

import AlumniSqlForm from "@/components/forms/AlumniSqlForm";


type MenuKey =
  | "AlumniTabs"
  | "AlumniCards"
  | "AlumniTalks"
  | "AlumniChapters"
  | "AlumniAssociation"
  | "AlumniScholarships"
  | "AlumniMemberships"
  | "Jobs"
  | "AadAlumni";

const MENU_TABS: { key: MenuKey; label: string; urlTab: string }[] = [
  { key: "AlumniTabs", label: "Dashboard", urlTab: "dashboard" },
  { key: "AlumniCards", label: "Alumni Cards", urlTab: "alumni-cards" },
  { key: "AlumniTalks", label: "Alumni Talks", urlTab: "alumni-talks" },
  { key: "AlumniChapters", label: "Alumni Chapters", urlTab: "alumni-chapters" },
  { key: "AlumniAssociation", label: "Alumni Association", urlTab: "alumni-association" },
  { key: "AlumniScholarships", label: "Alumni Scholarships", urlTab: "alumni-scholarships" },
  { key: "AlumniMemberships", label: "Alumni Memberships", urlTab: "alumni-memberships" },
  { key: "Jobs", label: "Jobs", urlTab: "jobs" },
  { key: "AadAlumni", label: "Add Alumni", urlTab: "add-alumni" },
];

type PairCounts = { all: number; secondary: number };

async function fetchTabCounts(): Promise<Partial<Record<MenuKey, PairCounts>>> {
  const [cardsRes, talksRes, scholarshipsRes, membershipsRes] = await Promise.all([
    fetch("/api/alumni-cards/counts", { headers: { accept: "application/json" } }),
    fetch("/api/alumni/talks", { headers: { accept: "application/json" } }),
    fetch("/api/alumni/scholarships?limit=1&page=1", { headers: { accept: "application/json" } }),
    fetch("/api/alumni/memberships?limit=1&page=1", { headers: { accept: "application/json" } }),
  ]);

  const next: Partial<Record<MenuKey, PairCounts>> = {};

  if (cardsRes.ok) {
    const j = (await cardsRes.json()) as {
      all?: number;
      "under-review"?: number;
      underprinting?: number;
      active?: number;
      onhold?: number;
      delivered?: number;
    };
    const underReview = Number((j as any)["under-review"] || 0);
    const underPrinting = Number((j as any).underprinting || 0);
    const readyForDelivery = Number((j as any).active || 0);
    const onHold = Number((j as any).onhold || 0);
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
    const pendingConfirmation = Number((j.counts as any)?.pendingConfirmation || 0);
    const confirmed = Number((j.counts as any)?.confirmed || 0);
    next.AlumniTalks = {
      all: Number(j.counts?.all || 0),
      secondary: pending + pendingConfirmation + confirmed,
    };
  }

  if (scholarshipsRes.ok) {
    const j = (await scholarshipsRes.json()) as { counts?: { pending?: number; approved?: number; notApproved?: number } };
    const pending = Number(j.counts?.pending || 0);
    const approved = Number(j.counts?.approved || 0);
    const notApproved = Number((j.counts as any)?.notApproved || 0);
    next.AlumniScholarships = { all: pending + approved + notApproved, secondary: pending };
  }

  if (membershipsRes.ok) {
    const j = (await membershipsRes.json()) as { counts?: { pending?: number; approved?: number; notApproved?: number } };
    const pending = Number(j.counts?.pending || 0);
    const approved = Number(j.counts?.approved || 0);
    const notApproved = Number((j.counts as any)?.notApproved || 0);
    next.AlumniMemberships = { all: pending + approved + notApproved, secondary: pending };
  }

  return next;
}

// Map URL tab values to MenuKey
const urlTabToMenuKey: Record<string, MenuKey> = {
  "dashboard": "AlumniTabs",
  "alumni-cards": "AlumniCards",
  "alumni-talks": "AlumniTalks",
  "alumni-chapters": "AlumniChapters",
  "alumni-association": "AlumniAssociation",
  "alumni-scholarships": "AlumniScholarships",
  "alumni-memberships": "AlumniMemberships",
  "jobs": "Jobs",
  "add-alumni": "AadAlumni",
};

// Map MenuKey to URL tab values
const menuKeyToUrlTab: Record<MenuKey, string> = {
  "AlumniTabs": "dashboard",
  "AlumniCards": "alumni-cards",
  "AlumniTalks": "alumni-talks",
  "AlumniChapters": "alumni-chapters",
  "AlumniAssociation": "alumni-association",
  "AlumniScholarships": "alumni-scholarships",
  "AlumniMemberships": "alumni-memberships",
  "Jobs": "jobs",
  "AadAlumni": "add-alumni",
};

export const AlumniTabbedMenu: FC = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  // Get initial tab from URL search params, default to "dashboard"
  const getTabFromUrl = () => {
    const tabFromUrl = searchParams.get("tab");
    if (tabFromUrl && urlTabToMenuKey[tabFromUrl]) {
      return urlTabToMenuKey[tabFromUrl];
    }
    // Default to Dashboard tab
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

  // Update URL when tab changes
  const handleTabChange = (tab: MenuKey) => {
    setSelected(tab);
    const urlTab = menuKeyToUrlTab[tab];
    router.push(`/dashboard?tab=${urlTab}`, { scroll: false });
  };

  // Sync with URL on mount or when URL changes
  useEffect(() => {
    const validTab = getTabFromUrl();
    setSelected(validTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const renderCounterPair = (key: MenuKey, isSelected: boolean) => {
    const c = tabCounts[key];
    const showLoader = (tabCountsLoading || tabCountsFetching) && !c;
    if (!c && !showLoader) return null;

    const allCls = "bg-[#183D32] text-white";
    const secondaryCls = "bg-[#183D32] text-white border border-white/40";

    return (
      <span className="ml-2 inline-flex items-center gap-1 align-middle">
        {showLoader ? (
          <span className="inline-flex items-center justify-center h-4 w-8">
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
    <ComponentCard className="">
      <div
        className="tab-list mt-4 flex shadow-lg flex-wrap gap-3 lg:gap-4 justify-start py-4 bg-[#183D32]/10 px-4 rounded-2xl border border-b-[#183D32] sticky top-22 transition-all duration-300 ease-in-out backdrop-blur-sm bg-opacity-95 z-100  animate-[slideDown_0.3s_ease-in-out]"
        role="tablist"
        aria-label="Alumni sections"
      >
        {MENU_TABS.map((tab, idx) => {
          const isSelected = selected === tab.key;
          return (
            <button
              key={tab.key}
              className={`button group ${isSelected ? "is-selected" : ""}`}
              style={{ "--clr": isSelected ? "#183D32" : "#183D32" } as CSSProperties}
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
              <span className="button-decor" />
              <span className="button-content">
                <span className="button__text">
                  <span className="inline-flex items-center">
                    {tab.label}
                    {(tab.key === "AlumniCards" ||
                      tab.key === "AlumniTalks" ||
                      tab.key === "AlumniScholarships" ||
                      tab.key === "AlumniMemberships") &&
                      renderCounterPair(tab.key, isSelected)}
                  </span>
                </span>
              </span>
            </button>
          );
        })}
      </div>

            <div className=" ">
              {selected === "AlumniTabs" && <AlumniTabs />}
              {selected === "AlumniCards" && <AlumniCards />}
              {selected === "AlumniTalks" && <AlumniTalksTab />}
              {selected === "AlumniChapters" && <AlumniChaptersTab />}
              {selected === "AlumniAssociation" && <AlumniAssociationTab />}
              {selected === "AlumniScholarships" && <AlumniScholarshipsTab />}
              {selected === "AlumniMemberships" && <AlumniMembershipsTab />}
              {selected === "Jobs" && <JobsTab />}
              {selected === "AadAlumni" && <AlumniRegistrationFormComponent />}
            </div>

      <style jsx>{`
        .tab-list {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
        }
        @media (min-width: 1024px) {
          .tab-list { gap: 1rem; }
        }

        .button {
          text-decoration: none;
          line-height: 1;
          border-radius: 1.5rem;
          overflow: hidden;
          position: relative;
          box-shadow: 10px 10px 20px rgba(0,0,0,.05);
          background-color: #c9fff1ff;
          color: #121212;
          border: none;
          cursor: pointer;
          padding: 0.6rem 1.25rem;
          border-bottom: 2px solid #183D32;
        }

        .button-decor {
          position: absolute;
          inset: 0;
          background-color: var(--clr);
          transform: translateX(-100%);
          transition: transform .3s;
          z-index: 0;
        }

        .button-content {
          display: flex;
          align-items: center;
          font-weight: 600;
          position: relative;
          overflow: hidden;
          z-index: 1;
        }

        .button__text {
          display: inline-block;
          transition: color .2s;
          padding: 2px 0;
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
          max-width: 220px;
        }

        .button:hover .button__text {
          color: #fff;
        }

        .button:hover .button-decor {
          transform: translate(0);
        }

        .button.is-selected .button-decor {
          transform: translate(0);
        }

        .button.is-selected .button__text {
          color: #fff;
        }
      `}</style>
    </ComponentCard>
  );
};

export const AlumniRegistrationFormComponent: FC = () => {
  return <AlumniSqlForm />;
};