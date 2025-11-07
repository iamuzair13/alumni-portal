"use client";
import React, { useState } from "react";
import ComponentCard from "@/components/common/ComponentCard";
import { GroupIcon } from "@/icons";

type TabKey = "applied" | "inProcess" | "delivered";

const TABS: { key: TabKey; label: string }[] = [
  { key: "applied", label: "Applied" },
  { key: "inProcess", label: "In Process" },
  { key: "delivered", label: "Delivered" },
];

const MOCK_COUNTS: Record<TabKey, { count: number; delta?: number }> = {
  applied: { count: 1200, delta: 5.2 },
  inProcess: { count: 480, delta: 2.4 },
  delivered: { count: 320, delta: 1.1 },
};

// Per-status color classes to visually distinguish each stage
const STATUS_CLASS_MAP: Record<
  TabKey,
  {
    selectedContainer: string;
    hoverBorder: string;
    iconBg: string;
    iconColor: string;
    labelText: string;
  }
> = {
  applied: {
    selectedContainer:
      "border-blue-500 bg-blue-50 dark:border-blue-500 dark:bg-blue-900/20",
    hoverBorder: "hover:border-blue-400",
    iconBg: "bg-blue-100 dark:bg-blue-800",
    iconColor: "text-blue-700 dark:text-blue-200",
    labelText: "text-blue-600 dark:text-blue-300",
  },
  inProcess: {
    selectedContainer:
      "border-amber-500 bg-amber-50 dark:border-amber-500 dark:bg-amber-900/20",
    hoverBorder: "hover:border-amber-400",
    iconBg: "bg-amber-100 dark:bg-amber-800",
    iconColor: "text-amber-700 dark:text-amber-200",
    labelText: "text-amber-600 dark:text-amber-300",
  },
  delivered: {
    selectedContainer:
      "border-emerald-500 bg-emerald-50 dark:border-emerald-500 dark:bg-emerald-900/20",
    hoverBorder: "hover:border-emerald-400",
    iconBg: "bg-emerald-100 dark:bg-emerald-800",
    iconColor: "text-emerald-700 dark:text-emerald-200",
    labelText: "text-emerald-600 dark:text-emerald-300",
  },
};

export const AlumniCards: React.FC = () => {
  const [selected, setSelected] = useState<TabKey>("applied");

  const stats = MOCK_COUNTS[selected];

  return (
    <ComponentCard title="Alumni Cards" className="">
      <div className=" flex flex-col ">
        <div className="rounded-2xl  dark:bg-white/[0.03]">
         
          <div
            className="tab-list flex flex-wrap gap-4 lg:gap-6 justify-start"
            role="tablist"
            aria-label="Alumni application stages"
          >
            {TABS.map((tab, idx) => {
              const stat = MOCK_COUNTS[tab.key];
              const statusClasses = STATUS_CLASS_MAP[tab.key];
              return (
                <div
                  key={tab.key}
                  className={`tab-item rounded-2xl border p-5 cursor-pointer transform scale-100 transform-gpu transition-transform duration-300 ease-in-out md:p-6 hover:scale-[1.02] hover:shadow-lg ${statusClasses.hoverBorder} ${
                    selected === tab.key
                      ? statusClasses.selectedContainer
                      : "border-gray-200 bg-slate-100 dark:border-gray-800 dark:bg-white/[0.03]"
                  }`}
                  onClick={() => setSelected(tab.key)}
                  role="tab"
                  aria-selected={selected === tab.key}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowRight") {
                      e.preventDefault();
                      const nextIdx = (idx + 1) % TABS.length;
                      setSelected(TABS[nextIdx].key);
                    } else if (e.key === "ArrowLeft") {
                      e.preventDefault();
                      const prevIdx = (idx - 1 + TABS.length) % TABS.length;
                      setSelected(TABS[prevIdx].key);
                    } else if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelected(tab.key);
                    }
                  }}
                >
                  <div className={`flex items-center justify-center w-12 h-12 rounded-xl ${statusClasses.iconBg}`}>
                    <GroupIcon className={`${statusClasses.iconColor} size-6`} />
                  </div>
                  <div className="flex items-end justify-between mt-5">
                    <div>
                      <span className={`text-sm ${statusClasses.labelText}`}>
                        {tab.label}
                      </span>
                      <h4 className="mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
                        {stat.count.toLocaleString()}
                      </h4>
                    </div>
                    
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        
      </div>
      <style jsx>{`
        .tab-list {
          display: flex;
          flex-wrap: wrap;
          gap: 1rem; /* base spacing between tabs */
        }

        .tab-item {
          /* Flexbox sizing with constraints */
          flex: 1 1 180px; /* grow; shrink; base width */
          min-width: 160px;
          max-width: 320px;
          /* Smooth transitions for resizing and state */
          transition: flex-basis 300ms ease, width 300ms ease,
            background-color 200ms ease, border-color 200ms ease,
            transform 200ms ease;
          will-change: transform;
        }

        /* Desktop (≥1024px) */
        @media (min-width: 1024px) {
          .tab-list {
            gap: 1.5rem; /* more spacing on desktop */
          }
          .tab-item {
            flex-basis: 240px; /* comfortable width on desktop */
          }
        }

        /* Tablet (768px–1023px) */
        @media (min-width: 768px) and (max-width: 1023px) {
          .tab-item {
            flex-basis: 200px; /* medium width on tablets */
          }
        }

        /* Mobile (<768px) */
        @media (max-width: 767px) {
          .tab-item {
            flex-basis: 160px; /* compact width on mobile */
          }
        }
      `}</style>
    </ComponentCard>
  );
};
