"use client";

import React, { useMemo, useState } from "react";
import { useLeadershipApplications } from "@/app/queries/leadership-applications";
import LeadershipRoleBadge from "@/components/ui/LeadershipRoleBadge";
import ApprovedLeadershipBadges from "@/components/alumni/ApprovedLeadershipBadges";

type Props = {
  alumniId: number | null | undefined;
  className?: string;
};

export default function LeadershipApplicationsTracker({ alumniId, className }: Props) {
  const enabled = Number.isFinite(alumniId) && Number(alumniId) > 0;
  const { data: leadershipApplications, isLoading: leadershipAppsLoading } = useLeadershipApplications(
    { type: "all", status: "all", alumniId: enabled ? Number(alumniId) : undefined },
    enabled
  );

  const [appsSortKey, setAppsSortKey] = useState<"createdAt" | "type" | "position" | "status">("createdAt");
  const [appsSortDir, setAppsSortDir] = useState<"asc" | "desc">("desc");

  const leadershipApplicationsSorted = useMemo(() => {
    const items = Array.isArray(leadershipApplications) ? leadershipApplications : [];
    const dir = appsSortDir === "asc" ? 1 : -1;
    const key = appsSortKey;
    return [...items].sort((a, b) => {
      const va = (() => {
        if (key === "createdAt") return String(a.createdAt || "");
        if (key === "type") return String(a.type || "");
        if (key === "position") return String(a.position || "");
        if (key === "status") return String(a.status || "");
        return "";
      })();
      const vb = (() => {
        if (key === "createdAt") return String(b.createdAt || "");
        if (key === "type") return String(b.type || "");
        if (key === "position") return String(b.position || "");
        if (key === "status") return String(b.status || "");
        return "";
      })();
      return va.localeCompare(vb) * dir;
    });
  }, [leadershipApplications, appsSortDir, appsSortKey]);

  function typeLabel(t: "chapter" | "association"): string {
    return t === "chapter" ? "Chapter" : "Association";
  }

  function formatDate(v: string | null | undefined): string {
    if (!v) return "-";
    try {
      return new Date(v).toLocaleDateString("en-PK", { year: "numeric", month: "short", day: "2-digit" });
    } catch {
      return String(v);
    }
  }

  function identifierText(app: { sapId?: string | null; registrationno?: string | null }): string {
    const sap = String(app.sapId || "").trim();
    const reg = String(app.registrationno || "").trim();
    if (sap && reg) return `${sap} / ${reg}`;
    return sap || reg || "-";
  }

  return (
    <div className={className}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h5 className="text-base sm:text-lg font-semibold text-slate-800">Leadership Applications</h5>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const nextDir = appsSortKey === "createdAt" ? (appsSortDir === "asc" ? "desc" : "asc") : "desc";
              setAppsSortKey("createdAt");
              setAppsSortDir(nextDir);
            }}
            className="text-xs px-2.5 py-1.5 rounded-md border border-gray-200 bg-white hover:bg-gray-50"
          >
            Sort by Date
          </button>
          <button
            type="button"
            onClick={() => {
              const nextDir = appsSortKey === "status" ? (appsSortDir === "asc" ? "desc" : "asc") : "asc";
              setAppsSortKey("status");
              setAppsSortDir(nextDir);
            }}
            className="text-xs px-2.5 py-1.5 rounded-md border border-gray-200 bg-white hover:bg-gray-50"
          >
            Sort by Status
          </button>
        </div>
      </div>

      <div className="mt-3">
        <ApprovedLeadershipBadges alumniId={enabled ? Number(alumniId) : null} size="sm" />
      </div>

      <div className="mt-3 rounded-lg border border-gray-200 bg-white overflow-hidden">
        {leadershipAppsLoading ? (
          <div className="p-4 text-sm text-gray-600">Loading leadership applications...</div>
        ) : leadershipApplicationsSorted.length === 0 ? (
          <div className="p-4">
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-4 text-sm text-gray-700">
              No leadership applications submitted yet.
            </div>
          </div>
        ) : (
          <div className="max-h-[280px] overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">SAP / Reg No</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Type</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Role</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Submitted</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Additional Achievements</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {leadershipApplicationsSorted.map((app) => {
                  const statusText = String(app.status || "pending");
                  const statusLower = statusText.toLowerCase();
                  const badgeClass =
                    statusLower === "approved"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : statusLower === "rejected"
                        ? "bg-rose-50 text-rose-700 border-rose-200"
                        : "bg-amber-50 text-amber-700 border-amber-200";
                  return (
                    <tr key={`${app.type}-${app.id}`} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-900 whitespace-nowrap">{identifierText(app)}</td>
                      <td className="px-4 py-3 text-gray-900">{typeLabel(app.type)}</td>
                      <td className="px-4 py-3 text-gray-900">
                        <div className="flex items-center gap-2">
                          <span className="break-words">{String(app.position || "-")}</span>
                          {statusLower === "approved" ? (
                            <LeadershipRoleBadge type={app.type} position={String(app.position || "")} className="rounded-lg" />
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full border text-xs font-semibold ${badgeClass}`}>
                          {statusLower === "rejected" ? "Not Approved" : statusText}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{formatDate(app.createdAt)}</td>
                      <td className="px-4 py-3 text-gray-700">
                        <div className="max-w-[420px]">
                          <div className="line-clamp-2 break-words">{String(app.additionalAchievements || "-")}</div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
