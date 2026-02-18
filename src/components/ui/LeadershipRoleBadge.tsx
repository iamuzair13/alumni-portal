"use client";

import React, { useMemo } from "react";

export type LeadershipType = "chapter" | "association";
export type RoleName = "president" | "vice_president" | "coordinator";

function inferRoleName(position: string): RoleName {
  const s = String(position || "").toLowerCase();
  if (s.includes("vice")) return "vice_president";
  if (s.includes("coordinator")) return "coordinator";
  return "president";
}

function roleLabel(role: RoleName): string {
  if (role === "vice_president") return "Vice President";
  if (role === "coordinator") return "Coordinator";
  return "President";
}

function typeLabel(t: LeadershipType): string {
  return t === "chapter" ? "Chapter" : "Association";
}

export default function LeadershipRoleBadge(props: {
  type: LeadershipType;
  position: string;
  className?: string;
}) {
  const { type, position, className } = props;

  const role = useMemo(() => inferRoleName(position), [position]);
  const label = useMemo(() => `${typeLabel(type)} • ${roleLabel(role)}`, [type, role]);

  const style = useMemo(() => {
    if (role === "president") {
      return type === "chapter"
        ? "bg-purple-50 text-purple-800 border-purple-200"
        : "bg-indigo-50 text-indigo-800 border-indigo-200";
    }
    if (role === "vice_president") {
      return type === "chapter"
        ? "bg-blue-50 text-blue-800 border-blue-200"
        : "bg-cyan-50 text-cyan-800 border-cyan-200";
    }
    return type === "chapter"
      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
      : "bg-teal-50 text-teal-800 border-teal-200";
  }, [role, type]);

  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${style} ${className || ""}`.trim()}>
      {label}
    </span>
  );
}
