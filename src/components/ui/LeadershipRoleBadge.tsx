"use client";

import React, { useMemo } from "react";
import { inferRoleNameFromPosition, LEADERSHIP_ROLE_LABELS, type LeadershipRoleName } from "@/lib/leadershipRoles";

export type LeadershipType = "chapter" | "association";
export type RoleName = LeadershipRoleName;

function roleLabel(role: RoleName): string {
  return LEADERSHIP_ROLE_LABELS[role] ?? role;
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

  const role = useMemo(() => inferRoleNameFromPosition(position), [position]);
  const label = useMemo(() => `${typeLabel(type)} • ${roleLabel(role)}`, [type, role]);

  const style = useMemo(() => {
    // Colour by role family so compound roles (e.g. vice_president_regional_affairs)
    // share the styling of their generic counterpart.
    if (role.startsWith("vice_president")) {
      return type === "chapter"
        ? "bg-blue-50 text-blue-800 border-blue-200"
        : "bg-cyan-50 text-cyan-800 border-cyan-200";
    }
    if (role.startsWith("coordinator")) {
      return type === "chapter"
        ? "bg-success-50 text-success-800 border-success-200"
        : "bg-teal-50 text-teal-800 border-teal-200";
    }
    // president and secretary_general
    return type === "chapter"
      ? "bg-purple-50 text-purple-800 border-purple-200"
      : "bg-brand-50 text-brand-800 border-brand-200";
  }, [role, type]);

  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${style} ${className || ""}`.trim()}>
      {label}
    </span>
  );
}
