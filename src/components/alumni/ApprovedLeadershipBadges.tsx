"use client";

import React, { useMemo } from "react";
import { useLeadershipApplications, type LeadershipApplicationTrace } from "@/app/queries/leadership-applications";
import LeadershipRoleBadge from "@/components/ui/LeadershipRoleBadge";

type Props = {
  alumniId: number | null | undefined;
  className?: string;
  size?: "sm" | "md";
};

function uniqBadges(apps: LeadershipApplicationTrace[]) {
  const seen = new Set<string>();
  const next: Array<{ type: "chapter" | "association"; position: string; key: string }> = [];

  for (const a of apps) {
    const type = a.type;
    const position = String(a.position || "").trim();
    if (!type || !position) continue;
    const k = `${type}|${position.toLowerCase()}`;
    if (seen.has(k)) continue;
    seen.add(k);
    next.push({ type, position, key: k });
  }

  next.sort((x, y) => {
    if (x.type !== y.type) return x.type === "chapter" ? -1 : 1;
    return x.position.localeCompare(y.position);
  });

  return next;
}

export default function ApprovedLeadershipBadges({ alumniId, className, size = "md" }: Props) {
  const enabled = Number.isFinite(alumniId) && Number(alumniId) > 0;

  const { data, isLoading } = useLeadershipApplications(
    { type: "all", status: "approved", alumniId: enabled ? Number(alumniId) : undefined },
    enabled
  );

  const badges = useMemo(() => {
    const items = Array.isArray(data) ? data : [];
    return uniqBadges(items);
  }, [data]);

  if (!enabled) return null;
  if (isLoading) return null;
  if (badges.length === 0) return null;

  const gap = size === "sm" ? "gap-1.5" : "gap-2";

  return (
    <div className={`flex flex-wrap items-center ${gap} ${className || ""}`.trim()}>
      {badges.map((b) => (
        <span key={b.key} title={`${b.type === "chapter" ? "Chapter" : "Association"} • ${b.position}`}>
          <LeadershipRoleBadge type={b.type} position={b.position} className="rounded-lg shadow-sm" />
        </span>
      ))}
    </div>
  );
}
