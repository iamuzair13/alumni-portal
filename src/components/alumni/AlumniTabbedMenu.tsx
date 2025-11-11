"use client";
import React, { useMemo, useState } from "react";
import ComponentCard from "@/components/common/ComponentCard";
import { AlumniTabs } from "@/components/alumni/Alumni-tabs";
import { AlumniCards } from "@/components/alumni/Alumini-cards";
import { AlumniParticipation } from "@/components/alumni/Alumni-participation";

import AlumniSqlForm from "@/components/forms/AlumniSqlForm";


type MenuKey = "AlumniTabs" | "AlumniCards" | "AlumniParticipation" | "AadAlumni";

const MENU_TABS: { key: MenuKey; label: string }[] = [
  { key: "AlumniTabs", label: "Alumni Status" },
  { key: "AlumniCards", label: "Alumni Cards" },
  { key: "AlumniParticipation", label: "Alumni Participation" },
  { key: "AadAlumni", label: "Add Alumni" },
];

export const AlumniTabbedMenu: React.FC = () => {
  const [selected, setSelected] = useState<MenuKey>("AlumniTabs");

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
            className={`rounded-xl border px-4 py-2 cursor-pointer transform scale-100 transform-gpu transition-transform duration-300 ease-in-out hover:scale-[1.02] hover:shadow-sm hover:border-blue-400 ${
              selected === tab.key
                ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-900/20"
                : "border-gray-200 bg-slate-100 text-gray-700 dark:border-gray-800 dark:bg-white/[0.03]"
            }`}
            onClick={() => setSelected(tab.key)}
            role="tab"
            aria-selected={selected === tab.key}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") {
                e.preventDefault();
                const nextIdx = (idx + 1) % MENU_TABS.length;
                setSelected(MENU_TABS[nextIdx].key);
              } else if (e.key === "ArrowLeft") {
                e.preventDefault();
                const prevIdx = (idx - 1 + MENU_TABS.length) % MENU_TABS.length;
                setSelected(MENU_TABS[prevIdx].key);
              } else if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setSelected(tab.key);
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
        {selected === "AlumniParticipation" && <AlumniParticipation />}
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

export const AlumniRegistrationFormComponent: React.FC = () => {
  return <AlumniSqlForm />;
};