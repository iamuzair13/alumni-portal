"use client";
import React from "react";

type TabKey = "talkMentorship" | "alumniChapters" | "alumniAssociation";

type StatusClasses = {
  selectedContainer: string;
  hoverBorder: string;
  iconBg: string;
  iconColor: string;
  labelText: string;
};

type Props = {
  tab: { key: TabKey; label: string };
  idx: number;
  selected: TabKey;
  setSelected: (key: TabKey) => void;
  statCount: number;
  Icon: React.ComponentType<{ className?: string }>;
  statusClasses: StatusClasses;
};

export default function AlumniParticipationTabButton({ tab, idx, selected, setSelected, statCount, Icon, statusClasses }: Props) {
  const isSelected = selected === tab.key;
  const base = "w-[240px] last:border-0 bg-white flex flex-col items-center whitespace-nowrap text-center border-r border-gray-300 px-4 py-2 text-sm transition-colors transition-transform hover:translate-y-[-1px] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900";
  const selectedCls = isSelected ? statusClasses.selectedContainer : "border-gray-300 bg-white";

  return (
    <button
      key={tab.key}
      type="button"
      className={`${base} ${statusClasses.hoverBorder} ${selectedCls}`}
      onClick={() => setSelected(tab.key)}
      role="tab"
      aria-selected={isSelected}
      aria-label={`${tab.label} (${statCount.toLocaleString()})`}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") {
          e.preventDefault();
          const nextIdx = (idx + 1) % 3;
          const keys: TabKey[] = ["talkMentorship", "alumniChapters", "alumniAssociation"];
          setSelected(keys[nextIdx]);
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          const prevIdx = (idx - 1 + 3) % 3;
          const keys: TabKey[] = ["talkMentorship", "alumniChapters", "alumniAssociation"];
          setSelected(keys[prevIdx]);
        } else if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setSelected(tab.key);
        }
      }}
    >
      <div className="flex items-center gap-2">
        <Icon className={`${statusClasses.iconColor} size-6`} />
        <span className={`font-medium ${statusClasses.labelText}`}>{tab.label}</span>
      </div>
      <span className="ml-1 text-[35px] font-bold text-gray-600 dark:text-gray-400">
        {statCount.toLocaleString()}
      </span>
    </button>
  );
}