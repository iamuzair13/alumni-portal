"use client";

import React, { useMemo, useState } from "react";
import { useLeadershipApplications } from "@/app/queries/leadership-applications";
import LeadershipRoleBadge from "@/components/ui/LeadershipRoleBadge";
import ApprovedLeadershipBadges from "@/components/alumni/ApprovedLeadershipBadges";
import { Modal } from "@/components/ui/modal";
import { useModal } from "@/hooks/useModal";
import { useQuery } from "@tanstack/react-query";

type Props = {
  alumniId: number | null | undefined;
  className?: string;
};

type ViewApp = { type: "chapter" | "association"; applicationId: number };

function proficiencyLabel(value: number | null | undefined): string {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return "";
  const m = Math.min(5, Math.max(1, Math.round(n)));
  if (m === 1) return "Beginner";
  if (m === 2) return "Basic";
  if (m === 3) return "Intermediate";
  if (m === 4) return "Advanced";
  return "Expert";
}

function starsText(value: number | null | undefined): string {
  const n = Math.min(5, Math.max(0, Math.round(Number(value) || 0)));
  if (!n) return "";
  return "★★★★★".slice(0, n) + "☆☆☆☆☆".slice(0, 5 - n);
}

async function fetchApplicationDetails(input: ViewApp) {
  const params = new URLSearchParams();
  params.set("type", input.type);
  params.set("applicationId", String(input.applicationId));
  const res = await fetch(`/api/leadership/application-details?${params.toString()}`, {
    headers: { accept: "application/json" },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any)?.error || "Failed to load application details");
  return data as any;
}

export default function LeadershipApplicationsTracker({ alumniId, className }: Props) {
  const enabled = Number.isFinite(alumniId) && Number(alumniId) > 0;
  const { data: leadershipApplications, isLoading: leadershipAppsLoading } = useLeadershipApplications(
    { type: "all", status: "all", alumniId: enabled ? Number(alumniId) : undefined },
    enabled
  );

  const viewModal = useModal(false);
  const [selectedViewApp, setSelectedViewApp] = useState<ViewApp | null>(null);

  const [appsSortKey, setAppsSortKey] = useState<"createdAt" | "type" | "position" | "status">("createdAt");
  const [appsSortDir, setAppsSortDir] = useState<"asc" | "desc">("desc");

  const { data: viewDetailsData, isLoading: viewDetailsLoading } = useQuery({
    queryKey: ["leadership-application-details", selectedViewApp?.type, selectedViewApp?.applicationId],
    queryFn: async () => {
      if (!selectedViewApp) throw new Error("Missing application");
      return fetchApplicationDetails(selectedViewApp);
    },
    enabled: viewModal.isOpen && !!selectedViewApp,
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    refetchOnMount: true,
  });

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

  function openPdfDownload() {
    if (!selectedViewApp) return;
    const params = new URLSearchParams();
    params.set("type", selectedViewApp.type);
    params.set("applicationId", String(selectedViewApp.applicationId));
    window.open(`/api/leadership/application-pdf?${params.toString()}`, "_blank", "noopener,noreferrer");
  }

  function documentsFromItem(item: any) {
    const docs: Array<{ key: string; label: string; url: string }> = [];
    const cv = String(item?.cvFileUrl || "").trim();
    const f1 = String(item?.additionalFile1Url || "").trim();
    const f2 = String(item?.additionalFile2Url || "").trim();
    if (cv) docs.push({ key: "cv", label: "CV", url: cv });
    if (f1) docs.push({ key: "file1", label: "Additional Document 1", url: f1 });
    if (f2) docs.push({ key: "file2", label: "Additional Document 2", url: f2 });
    return docs;
  }

  return (
    <div className={className}>
      <div className="rounded-2xl border border-slate-200 bg-yellow-600 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-5 py-4 border-b border-slate-200 bg-white/50">
          <div className="min-w-0">
            <h5 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900">Leadership Applications</h5>
            <div className="mt-1 text-sm text-slate-700">Track your submitted applications and their statuses</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const nextDir = appsSortKey === "createdAt" ? (appsSortDir === "asc" ? "desc" : "asc") : "desc";
                setAppsSortKey("createdAt");
                setAppsSortDir(nextDir);
              }}
              className="text-xs sm:text-sm px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 shadow-sm hover:bg-[#fbf7ee] hover:border-[#caa24a] focus:outline-none focus:ring-2 focus:ring-[#caa24a]/40"
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
              className="text-xs sm:text-sm px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 shadow-sm hover:bg-[#fbf7ee] hover:border-[#caa24a] focus:outline-none focus:ring-2 focus:ring-[#caa24a]/40"
            >
              Sort by Status
            </button>
          </div>
        </div>

        <div className="px-4 sm:px-5 pt-3">
          <ApprovedLeadershipBadges alumniId={enabled ? Number(alumniId) : null} size="sm" />
        </div>

        <div className="px-4 sm:px-5 pb-4">
          <div className="mt-3 rounded-xl border border-slate-200 bg-white/90 overflow-hidden">
            {leadershipAppsLoading ? (
              <div className="p-4 text-sm text-slate-600">Loading leadership applications...</div>
            ) : leadershipApplicationsSorted.length === 0 ? (
              <div className="p-4">
                <div className="rounded-lg border border-slate-200 bg-[#fbf7ee] px-4 py-4 text-sm text-slate-700">
                  No leadership applications submitted yet.
                </div>
              </div>
            ) : (
              <div className="max-h-[280px] overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">SAP / Reg No</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Type</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Role</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Submitted</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-700">Actions</th>
                </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
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
                    <tr key={`${app.type}-${app.id}`} className="hover:bg-[#fbf7ee]/60">
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
                      
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedViewApp({ type: app.type, applicationId: app.id });
                            viewModal.openModal();
                          }}
                          className="text-xs font-semibold rounded-md border border-slate-300 bg-white px-3 py-1.5 text-slate-700 hover:bg-[#fbf7ee] hover:border-[#caa24a]"
                        >
                          View Application
                        </button>
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
      </div>

      {viewModal.isOpen && selectedViewApp && (
        <Modal
          isOpen={viewModal.isOpen}
          onClose={() => {
            viewModal.closeModal();
            setSelectedViewApp(null);
          }}
          showCloseButton={true}
          className="max-w-5xl"
        >
          <div className="p-6">
            {viewDetailsLoading ? (
              <div className="text-sm text-gray-600">Loading...</div>
            ) : !viewDetailsData?.item ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Unable to load application details.
              </div>
            ) : (
              (() => {
                const item = viewDetailsData.item as any;
                const statusText = String(item.status || "pending");
                const statusLower = statusText.toLowerCase();
                const statusBadge =
                  statusLower === "approved"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : statusLower === "rejected"
                      ? "bg-rose-50 text-rose-700 border-rose-200"
                      : "bg-amber-50 text-amber-700 border-amber-200";

                const docs = documentsFromItem(item);
                const downloadAllDocs = () => {
                  docs.forEach((d) => {
                    const a = document.createElement("a");
                    a.href = d.url;
                    a.download = "";
                    a.rel = "noopener noreferrer";
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                  });
                };

                const profMap = item?.optionalCriteriaProficiency && typeof item.optionalCriteriaProficiency === "object" ? item.optionalCriteriaProficiency : null;

                return (
                  <div className="space-y-4">
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-gray-900">Leadership Application Details</div>
                        <div className="mt-1 h-px bg-gray-200" />
                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-700">
                          <div className="truncate"><span className="font-medium">Applicant:</span> {item.name || "-"}</div>
                          <div className="truncate"><span className="font-medium">Role Applied For:</span> {item.position || "-"}</div>
                          <div className="truncate"><span className="font-medium">Application Date:</span> {item.createdAt ? String(item.createdAt) : "-"}</div>
                          <div>
                            <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${statusBadge}`}>
                              {statusLower === "rejected" ? "Not Approved" : statusText}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-start lg:justify-end gap-2">
                        <button
                          type="button"
                          onClick={openPdfDownload}
                          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                        >
                          Download PDF
                        </button>
                        <button
                          type="button"
                          onClick={downloadAllDocs}
                          disabled={docs.length === 0}
                          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                        >
                          Download Documents
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            viewModal.closeModal();
                            setSelectedViewApp(null);
                          }}
                          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                        >
                          Close
                        </button>
                      </div>
                    </div>

                    <div className="max-h-[75vh] overflow-y-auto pr-1 space-y-4">
                      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                        <div className="text-sm font-semibold text-gray-900">Criteria</div>
                        <div className="mt-3 overflow-x-auto">
                          <table className="min-w-[760px] w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                            <thead className="sticky top-0 bg-gray-50 z-10">
                              <tr className="border-b border-gray-200">
                                <th className="text-left px-4 py-3 font-semibold text-gray-700">Requirement</th>
                                <th className="text-left px-4 py-3 font-semibold text-gray-700 w-[160px]">Alumni</th>
                                <th className="text-left px-4 py-3 font-semibold text-gray-700 w-[160px]">Admin</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {(Array.isArray(viewDetailsData.criteria) ? viewDetailsData.criteria : []).map((c: any) => {
                                const isMandatory = Boolean(c.is_mandatory);
                                const alumniYes = Boolean(c.alumni_confirmed);
                                const adminYes = Boolean(c.admin_confirmed);
                                const rating = profMap && typeof profMap === "object" ? Number(profMap[String(c.id)] ?? 0) : 0;
                                const stars = !isMandatory && alumniYes && rating ? starsText(rating) : "";
                                const label = !isMandatory && alumniYes && rating ? proficiencyLabel(rating) : "";

                                return (
                                  <tr key={c.id} className="bg-white">
                                    <td className="px-4 py-3">
                                      <div className="flex items-start gap-2">
                                        <span className={`mt-0.5 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${isMandatory ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-gray-100 text-gray-700 border-gray-200"}`}>
                                          {isMandatory ? "Mandatory" : "Optional"}
                                        </span>
                                        <div className="min-w-0">
                                          <div className="font-semibold text-gray-900 break-words">{c.label}</div>
                                          {c.description ? <div className="mt-0.5 text-xs text-gray-600 break-words">{c.description}</div> : null}
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3">
                                      {alumniYes ? (
                                        <div className="text-gray-900">
                                          <div className="font-semibold">✔ Yes</div>
                                          {!isMandatory ? (
                                            <div className="mt-1 text-xs text-gray-700">
                                              {stars ? (
                                                <span>
                                                  <span className="font-semibold text-amber-700">{stars}</span>
                                                  {label ? ` (${label})` : ""}
                                                </span>
                                              ) : (
                                                <span className="text-gray-500">No rating</span>
                                              )}
                                            </div>
                                          ) : null}
                                        </div>
                                      ) : (
                                        <div className="font-semibold text-gray-500">No</div>
                                      )}
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className={`font-semibold ${adminYes ? "text-gray-900" : "text-gray-500"}`}>{adminYes ? "✔ Yes" : "☐"}</div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                        <div className="text-sm font-semibold text-gray-900">Additional Achievements</div>
                        <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-800 max-h-[250px] overflow-y-auto whitespace-pre-wrap">
                          {String(item.additionalAchievements || "").trim() || "-"}
                        </div>
                      </div>

                      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                        <div className="text-sm font-semibold text-gray-900">Plan / Strategy</div>
                        <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-800 max-h-[250px] overflow-y-auto whitespace-pre-wrap">
                          {String(item.planStrategy || "").trim() || "-"}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
