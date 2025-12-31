"use client";
import type { FC } from "react";
import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import ComponentCard from "@/components/common/ComponentCard";
import { AlumniTabs } from "@/components/alumni/Alumni-tabs";
import { AlumniCards } from "@/components/alumni/Alumini-cards";
import { AlumniTalksTab } from "@/components/alumni/AlumniTalksTab";
import { AlumniChaptersTab } from "@/components/alumni/AlumniChaptersTab";
import { AlumniAssociationTab } from "@/components/alumni/AlumniAssociationTab";

import AlumniSqlForm from "@/components/forms/AlumniSqlForm";


type MenuKey = "AlumniTabs" | "AlumniCards" | "AlumniTalks" | "AlumniChapters" | "AlumniAssociation" | "AadAlumni";

const MENU_TABS: { key: MenuKey; label: string; urlTab: string }[] = [
  { key: "AlumniTabs", label: "Dashboard", urlTab: "dashboard" },
  { key: "AlumniCards", label: "Alumni Cards", urlTab: "alumni-cards" },
  { key: "AlumniTalks", label: "Alumni Talks", urlTab: "alumni-talks" },
  { key: "AlumniChapters", label: "Alumni Chapters", urlTab: "alumni-chapters" },
  { key: "AlumniAssociation", label: "Alumni Association", urlTab: "alumni-association" },
  { key: "AadAlumni", label: "Add Alumni", urlTab: "add-alumni" },
];

// Map URL tab values to MenuKey
const urlTabToMenuKey: Record<string, MenuKey> = {
  "dashboard": "AlumniTabs",
  "alumni-cards": "AlumniCards",
  "alumni-talks": "AlumniTalks",
  "alumni-chapters": "AlumniChapters",
  "alumni-association": "AlumniAssociation",
  "add-alumni": "AadAlumni",
};

// Map MenuKey to URL tab values
const menuKeyToUrlTab: Record<MenuKey, string> = {
  "AlumniTabs": "dashboard",
  "AlumniCards": "alumni-cards",
  "AlumniTalks": "alumni-talks",
  "AlumniChapters": "alumni-chapters",
  "AlumniAssociation": "alumni-association",
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

  return (
    <ComponentCard className="">
      <div
        className="tab-list  flex flex-wrap gap-3 lg:gap-4 justify-start"
        role="tablist"
        aria-label="Alumni sections"
      >
        {MENU_TABS.map((tab, idx) => (
          <button
            key={tab.key}
            className={`rounded-lg bg-white border px-4 py-2 cursor-pointer transform scale-100 transform-gpu transition-transform duration-300 ease-in-out hover:scale-[1.02] hover:shadow-sm hover:border-blue-400 ${
              selected === tab.key
                ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-900/20"
                : "border-gray-200 bg-slate-100 text-gray-700 dark:border-gray-800 dark:bg-white/[0.03]"
            }`}
            onClick={() => handleTabChange(tab.key)}
            role="tab"
            aria-selected={selected === tab.key}
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
            {tab.label}
          </button>
        ))}
      </div>

      <div className=" ">
        {selected === "AlumniTabs" && <AlumniTabs />}
        {selected === "AlumniCards" && <AlumniCards />}
        {selected === "AlumniTalks" && <AlumniTalksTab />}
        {selected === "AlumniChapters" && <AlumniChaptersTab />}
        {selected === "AlumniAssociation" && <AlumniAssociationTab />}
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
      `}</style>
    </ComponentCard>
  );
};

export const AlumniRegistrationFormComponent: FC = () => {
  return <AlumniSqlForm />;
};