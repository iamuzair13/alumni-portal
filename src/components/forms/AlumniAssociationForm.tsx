"use client";
import React, { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import LeadershipApplicationsTracker from "@/components/alumni/LeadershipApplicationsTracker";
import StarRating, { proficiencyLabel } from "@/components/ui/StarRating";

type AlumniAssociationFormValues = {
  role: string;
  additionalAchievements: string;
  planStrategy: string;
  roleDescriptionAcknowledged: boolean;
  officeGovernanceAcknowledged: boolean;
  codeOfEthicsAcknowledged: boolean;
  complianceAccepted: boolean;
};

type RoleCriterion = {
  id: number;
  label: string;
  description: string | null;
  is_mandatory: boolean;
  sort_order: number;
};

const labelBase = "mb-2 text-sm text-slate-900 font-medium block";
const errorText = "mt-1 text-xs text-rose-600";

type Props = {
  alumniId: string;
};

async function fetchFormSettings() {
  const res = await fetch("/api/leadership/settings");
  if (!res.ok) {
    return { chapter_leadership: true, association_leadership: true };
  }
  return res.json();
}

function normalizeRoleDescription(raw: string): string {
  const html = String(raw ?? "").trim();
  if (!html) return "";

  try {
    const doc = new DOMParser().parseFromString(html, "text/html");

    doc.querySelectorAll("a").forEach((a) => {
      const text = String(a.textContent ?? "").trim();
      const href = String(a.getAttribute("href") ?? "").trim();
      const replacement = text && href && text !== href ? `${text} (${href})` : text || href;
      a.replaceWith(doc.createTextNode(replacement));
    });

    doc.querySelectorAll("br").forEach((br) => br.replaceWith(doc.createTextNode("\n")));
    doc.querySelectorAll("p").forEach((p) => p.append(doc.createTextNode("\n")));
    doc.querySelectorAll("li").forEach((li) => {
      li.prepend(doc.createTextNode("• "));
      li.append(doc.createTextNode("\n"));
    });

    const text = String(doc.body.textContent ?? "");
    return text
      .replace(/\r/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  } catch {
    return html
      .replace(/<[^>]*>/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();
  }
}

export default function AlumniAssociationForm({ alumniId }: Props) {
  const router = useRouter();
  const qc = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [selectedCriteriaIds, setSelectedCriteriaIds] = useState<Set<number>>(new Set());
  const [optionalCriteriaProficiency, setOptionalCriteriaProficiency] = useState<Record<number, number>>({});
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [additionalFile1, setAdditionalFile1] = useState<File | null>(null);
  const [additionalFile2, setAdditionalFile2] = useState<File | null>(null);
  const [uploadedCvUrl, setUploadedCvUrl] = useState<string | null>(null);
  const [uploadedAdditionalFile1Url, setUploadedAdditionalFile1Url] = useState<string | null>(null);
  const [uploadedAdditionalFile2Url, setUploadedAdditionalFile2Url] = useState<string | null>(null);
  const [cvError, setCvError] = useState<string | null>(null);
  const alumniIdNumber = useMemo(() => {
    const n = Number(alumniId);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [alumniId]);

  const validateFile = (file: File, isRequired: boolean) => {
    const maxSize = 5 * 1024 * 1024;
    const allowed = new Set([
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
    ]);

    if (!file || file.size === 0) {
      if (isRequired) throw new Error("CV upload is required");
      return;
    }
    if (!allowed.has(file.type)) {
      throw new Error("Unsupported file type. Only PDF, DOCX, and DOC are allowed.");
    }
    if (file.size > maxSize) {
      throw new Error("File size exceeds 5MB limit");
    }
  };

  // Check if form is enabled
  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ["leadership-settings"],
    queryFn: fetchFormSettings,
    staleTime: 60 * 1000,
  });

  const isFormEnabled = settings?.association_leadership ?? true;

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<AlumniAssociationFormValues>({
    defaultValues: {
      role: "",
      additionalAchievements: "",
      planStrategy: "",
      roleDescriptionAcknowledged: false,
      officeGovernanceAcknowledged: false,
      codeOfEthicsAcknowledged: false,
      complianceAccepted: false,
    },
    disabled: !isFormEnabled,
  });

  const role = watch("role");
  const planStrategy = watch("planStrategy");
  const roleDescriptionAcknowledged = watch("roleDescriptionAcknowledged");
  const officeGovernanceAcknowledged = watch("officeGovernanceAcknowledged");
  const codeOfEthicsAcknowledged = watch("codeOfEthicsAcknowledged");

  const planMinLen = 50;
  const planMaxLen = 1000;
  const planLen = useMemo(() => String(planStrategy || "").length, [planStrategy]);

  // Update selectedRole when form value changes
  React.useEffect(() => {
    setSelectedRole(role || "");
    setSelectedCriteriaIds(new Set());
    setOptionalCriteriaProficiency({});
    setCvFile(null);
    setAdditionalFile1(null);
    setAdditionalFile2(null);
    setUploadedCvUrl(null);
    setUploadedAdditionalFile1Url(null);
    setUploadedAdditionalFile2Url(null);
    setCvError(null);
  }, [role]);

  const criteriaRoleName = useMemo(() => {
    if (!selectedRole) return null;
    if (selectedRole === "vicePresident") return "vice_president";
    if (selectedRole === "president" || selectedRole === "coordinator") return selectedRole;
    return null;
  }, [selectedRole]);

  const { data: criteriaData, isLoading: criteriaLoading } = useQuery({
    queryKey: ["leadership-criteria", "association", criteriaRoleName],
    queryFn: async () => {
      if (!criteriaRoleName) return { items: [] as RoleCriterion[] };
      const res = await fetch(`/api/leadership/criteria?type=association&role=${encodeURIComponent(criteriaRoleName)}`, {
        headers: { accept: "application/json" },
      });
      if (!res.ok) throw new Error("Failed to load criteria");
      return (await res.json()) as {
        items: RoleCriterion[];
        roleDescription?: string;
        officeTermGovernanceHtml?: string;
        codeOfEthics?: string;
        complianceDeclaration?: string;
      };
    },
    enabled: !!criteriaRoleName && isFormEnabled,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const criteriaItems = useMemo(() => {
    const items = criteriaData?.items ?? [];
    return Array.isArray(items) ? items : [];
  }, [criteriaData]);

  const roleDescription = useMemo(() => {
    const raw = (criteriaData as any)?.roleDescription;
    const s = String(raw ?? "").trim();
    return normalizeRoleDescription(s);
  }, [criteriaData]);

  const officeTermGovernanceRaw = useMemo(() => {
    const raw = (criteriaData as any)?.officeTermGovernanceHtml;
    return String(raw ?? "").trim();
  }, [criteriaData]);

  const officeTermGovernanceHtml = useMemo(() => {
    return normalizeRoleDescription(officeTermGovernanceRaw);
  }, [officeTermGovernanceRaw]);

  const codeOfEthicsRaw = useMemo(() => {
    const raw = (criteriaData as any)?.codeOfEthics;
    return String(raw ?? "").trim();
  }, [criteriaData]);

  const codeOfEthics = useMemo(() => {
    return normalizeRoleDescription(codeOfEthicsRaw);
  }, [codeOfEthicsRaw]);

  const complianceDeclaration = useMemo(() => {
    const raw = (criteriaData as any)?.complianceDeclaration;
    const s = String(raw ?? "").trim();
    return s;
  }, [criteriaData]);

  const mandatoryCriteriaIds = useMemo(() => {
    return criteriaItems.filter((c) => c.is_mandatory).map((c) => Number(c.id)).filter((n) => Number.isFinite(n) && n > 0);
  }, [criteriaItems]);

  function starsText(value: number): string {
    const n = Math.max(0, Math.min(5, Math.round(Number(value) || 0)));
    return "★".repeat(n) + "☆".repeat(5 - n);
  }

  const handlePrintApplication = () => {
    try {
      const applicantId = String(parseInt(alumniId, 10) || "").trim();
      const position = selectedRole ? selectedRole : "-";
      const selected = criteriaItems
        .filter((c) => selectedCriteriaIds.has(Number(c.id)))
        .map((c) => ({
          id: Number(c.id),
          label: String(c.label || ""),
          isMandatory: Boolean(c.is_mandatory),
        }));

      const rowsHtml = selected
        .map((c) => {
          if (c.isMandatory) {
            return `
              <div class="row">
                <div class="label">${c.label}</div>
                <div class="value"><span class="pill pill-mandatory">Mandatory</span></div>
              </div>
            `;
          }
          const rating = Number(optionalCriteriaProficiency[c.id] || 0);
          const label = proficiencyLabel(rating) || "-";
          const stars = rating ? starsText(rating) : "-";
          return `
            <div class="row">
              <div class="label">${c.label}</div>
              <div class="value">
                <div><span class="pill pill-optional">Optional</span></div>
                <div class="sub">Proficiency: <span class="stars">${stars}</span> <span class="muted">(${label})</span></div>
              </div>
            </div>
          `;
        })
        .join("\n");

      const html = `
        <!doctype html>
        <html>
          <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <title>Leadership Application</title>
            <style>
              :root { --border: #e5e7eb; --text: #0f172a; --muted: #475569; --bg: #ffffff; --pill: #f1f5f9; --gold: #f59e0b; }
              * { box-sizing: border-box; }
              body { margin: 0; padding: 24px; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, "Noto Sans"; color: var(--text); background: #f8fafc; }
              .card { max-width: 860px; margin: 0 auto; background: var(--bg); border: 1px solid var(--border); border-radius: 16px; padding: 20px; }
              h1 { margin: 0 0 6px; font-size: 20px; }
              .meta { display: grid; grid-template-columns: 1fr; gap: 6px; margin-top: 10px; }
              .meta div { color: var(--muted); font-size: 12px; }
              .sectionTitle { margin-top: 18px; font-size: 14px; font-weight: 700; }
              .list { margin-top: 10px; border-top: 1px solid var(--border); }
              .row { display: grid; grid-template-columns: 1fr; gap: 6px; padding: 12px 0; border-bottom: 1px solid var(--border); }
              .label { font-size: 13px; font-weight: 600; }
              .value { font-size: 12px; color: var(--muted); }
              .pill { display: inline-flex; padding: 2px 8px; border-radius: 999px; border: 1px solid var(--border); background: var(--pill); font-size: 10px; font-weight: 700; }
              .pill-mandatory { background: #fff1f2; border-color: #fecdd3; color: #9f1239; }
              .pill-optional { background: #eff6ff; border-color: #bfdbfe; color: #1d4ed8; }
              .sub { margin-top: 6px; }
              .stars { letter-spacing: 1px; color: var(--gold); font-weight: 700; }
              .muted { color: var(--muted); }
              @media (min-width: 640px) {
                .meta { grid-template-columns: 1fr 1fr; }
                .row { grid-template-columns: 1fr 1fr; align-items: start; }
              }
              @media print {
                body { background: #fff; padding: 0; }
                .card { border: none; border-radius: 0; }
              }
            </style>
          </head>
          <body>
            <div class="card">
              <h1>Leadership Application</h1>
              <div class="meta">
                <div><strong>Type:</strong> Association</div>
                <div><strong>Role:</strong> ${position}</div>
                <div><strong>Applicant ID:</strong> ${applicantId || "-"}</div>
                <div><strong>Date:</strong> ${new Date().toLocaleDateString("en-PK", { year: "numeric", month: "short", day: "2-digit" })}</div>
              </div>

              <div class="sectionTitle">Selected Criteria</div>
              <div class="list">
                ${rowsHtml || `<div class="row"><div class="label">-</div><div class="value">No criteria selected.</div></div>`}
              </div>

              <div class="sectionTitle">Additional Achievements</div>
              <div class="value" style="margin-top: 8px; white-space: pre-wrap;">${String(watch("additionalAchievements") || "-")}</div>
            </div>
            <script>
              window.addEventListener('load', () => { setTimeout(() => window.print(), 250); });
            </script>
          </body>
        </html>
      `;

      const w = window.open("", "_blank", "noopener,noreferrer");
      if (!w) {
        toast.error("Popup blocked. Please allow popups to print the application.");
        return;
      }
      w.document.open();
      w.document.write(html);
      w.document.close();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to prepare print view");
    }
  };

  const onSubmit = async (data: AlumniAssociationFormValues) => {
    // Prevent double submission
    if (isSubmitting || isUploadingFiles) {
      return;
    }

    if (!data.roleDescriptionAcknowledged || !data.officeGovernanceAcknowledged || !data.codeOfEthicsAcknowledged) {
      toast.error("Please confirm that you have read and fully understood the Role Description, Office Governance, and Code of Ethics.");
      return;
    }

    if (!data.complianceAccepted) {
      toast.error("Please confirm the compliance declaration to submit.");
      return;
    }

    if (mandatoryCriteriaIds.length > 0) {
      const missing = mandatoryCriteriaIds.filter((id) => !selectedCriteriaIds.has(id));
      if (missing.length > 0) {
        toast.error("Please confirm all mandatory criteria.");
        return;
      }
    }

    if (!alumniId) {
      toast.error("Alumni ID is required. Please log in again.");
      return;
    }

    if (!data.role) {
      toast.error("Please select a role.", {
        duration: 3000,
        style: {
          background: '#fee2e2',
          color: '#991b1b',
          padding: '12px',
          borderRadius: '8px',
        },
      });
      return;
    }

    try {
      if (!cvFile) {
        setCvError("CV upload is required");
        toast.error("Please upload your CV (required).", {
          duration: 3000,
          style: {
            background: '#fee2e2',
            color: '#991b1b',
            padding: '12px',
            borderRadius: '8px',
          },
        });
        return;
      }
      validateFile(cvFile, true);
      if (additionalFile1) validateFile(additionalFile1, false);
      if (additionalFile2) validateFile(additionalFile2, false);
    } catch (e) {
      setCvError(e instanceof Error ? e.message : "Invalid file");
      toast.error(e instanceof Error ? e.message : "Invalid file", {
        duration: 4000,
        style: {
          background: '#fee2e2',
          color: '#991b1b',
          padding: '12px',
          borderRadius: '8px',
        },
      });
      return;
    }

    setIsSubmitting(true);
    const loadingToast = toast.loading("Submitting application...");

    try {
      setIsUploadingFiles(true);
      const uploadFd = new FormData();
      uploadFd.set("type", "association");
      uploadFd.set("alumniId", String(parseInt(alumniId, 10)));
      uploadFd.set("cv", cvFile as File);
      if (additionalFile1) uploadFd.set("file1", additionalFile1);
      if (additionalFile2) uploadFd.set("file2", additionalFile2);

      const uploadRes = await fetch("/api/uploads/leadership", {
        method: "POST",
        body: uploadFd,
      });
      const uploadJson = await uploadRes.json().catch(() => ({}));
      if (!uploadRes.ok) {
        throw new Error((uploadJson as any)?.error || "Failed to upload files");
      }

      const cvUrl = String((uploadJson as any)?.cv?.url || "").trim();
      const file1Url = (uploadJson as any)?.file1?.url ? String((uploadJson as any).file1.url).trim() : null;
      const file2Url = (uploadJson as any)?.file2?.url ? String((uploadJson as any).file2.url).trim() : null;

      if (!cvUrl) {
        throw new Error("Upload did not return CV URL");
      }

      setUploadedCvUrl(cvUrl);
      setUploadedAdditionalFile1Url(file1Url);
      setUploadedAdditionalFile2Url(file2Url);

      const response = await fetch("/api/alumni/association", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          alumniId: alumniIdNumber,
          role: data.role,
          criteriaIds: Array.from(selectedCriteriaIds),
          additionalAchievements: data.additionalAchievements,
          planStrategy: data.planStrategy,
          optionalCriteriaProficiency,
          cvFileUrl: cvUrl,
          additionalFile1Url: file1Url,
          additionalFile2Url: file2Url,
        }),
      });

      const result = await response.json().catch(() => ({}));

      toast.dismiss(loadingToast);

      if (!response.ok) {
        throw new Error((result as any)?.error || "Failed to submit application");
      }

      toast.success("Application submitted successfully!", {
        duration: 4000,
        style: {
          background: '#d1fae5',
          color: '#065f46',
          padding: '16px',
          borderRadius: '8px',
        },
      });

      // Refresh leadership applications tracker (stay on same page)
      qc.invalidateQueries({ queryKey: ["leadership-applications"], exact: false });
      qc.refetchQueries({ queryKey: ["leadership-applications"], exact: false });
      router.refresh();
    } catch (error) {
      toast.dismiss(loadingToast);
      const errorMessage = error instanceof Error ? error.message : "Failed to submit application";
      toast.error(errorMessage, {
        duration: 5000,
        style: {
          background: '#fee2e2',
          color: '#991b1b',
          padding: '16px',
          borderRadius: '8px',
        },
      });
    } finally {
      setIsUploadingFiles(false);
      setIsSubmitting(false);
    }
  };

  if (settingsLoading) {
    return (
      <div className="rounded-2xl max-w-4xl mx-auto border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="flex items-center justify-center py-8">
          <div className="h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!isFormEnabled) {
    return (
      <div className="rounded-2xl max-w-4xl mx-auto border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="rounded-lg border-2 border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50 p-8 text-center">
          <div className="mb-4">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">Applications will open soon.</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Association leadership applications are currently disabled. Please check back later.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl max-w-4xl mx-auto border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="mb-6">
        <LeadershipApplicationsTracker alumniId={alumniIdNumber} />
      </div>
      <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Alumni Association</h3>
      <p className="text-sm text-gray-600 dark:text-gray-400">Apply for a leadership role in the Alumni Association.</p>

      <form className="max-w-4xl mx-auto mt-4" onSubmit={handleSubmit(onSubmit)}>
        <div className="space-y-6">
          {/* Role Selection - Radio Buttons */}
          <div>
            <label className={`${labelBase} text-base font-semibold`}>
              Apply for the role <span className="text-rose-600">*</span>
            </label>
            <div className="space-y-3 mt-3">
              {[
                { value: "president", label: "President" },
                { value: "vicePresident", label: "Vice President" },
                { value: "coordinator", label: "Coordinator" },
              ].map((roleOption) => (
                <label
                  key={roleOption.value}
                  className={`flex items-start p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    selectedRole === roleOption.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    value={roleOption.value}
                    {...register("role", { required: "Please select a role" })}
                    className="mt-1 mr-3 h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <div className="flex-1">
                    <span className="text-base font-semibold text-gray-900">{roleOption.label}</span>
                  </div>
                </label>
              ))}
            </div>
            {errors.role && <span className={errorText}>{errors.role.message}</span>}
          </div>

          {selectedRole ? (
            <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] p-4">
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Role Information</div>
              <div className="mt-3 space-y-3">
                <details className="rounded-lg border border-gray-200 dark:border-gray-800 p-3" open>
                  <summary className="cursor-pointer text-sm font-medium text-gray-900 dark:text-gray-100">Role Description</summary>
                  <div className="mt-2 text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                    {criteriaLoading ? "Loading..." : roleDescription ? roleDescription : "No role description configured yet."}
                  </div>
                  <label className="mt-3 flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      {...register("roleDescriptionAcknowledged", { required: true })}
                      className="mt-1 h-4 w-4 text-blue-600"
                    />
                    <span className="text-sm text-gray-800 dark:text-gray-200">
                      I have read and fully understood the information.
                      <span className="text-rose-600"> *</span>
                    </span>
                  </label>
                  {errors.roleDescriptionAcknowledged ? (
                    <div className={errorText}>You must confirm before submitting.</div>
                  ) : null}
                </details>

                <details className="rounded-lg border border-gray-200 dark:border-gray-800 p-3" open>
                  <summary className="cursor-pointer text-sm font-medium text-gray-900 dark:text-gray-100">Office Term & Related Governance</summary>
                  <div className="mt-2 text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                    {criteriaLoading ? "Loading..." : officeTermGovernanceHtml ? officeTermGovernanceHtml : "No office term & related governance configured yet."}
                  </div>
                  <label className="mt-3 flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      {...register("officeGovernanceAcknowledged", { required: true })}
                      className="mt-1 h-4 w-4 text-blue-600"
                    />
                    <span className="text-sm text-gray-800 dark:text-gray-200">
                      I have read and fully understood the information.
                      <span className="text-rose-600"> *</span>
                    </span>
                  </label>
                  {errors.officeGovernanceAcknowledged ? (
                    <div className={errorText}>You must confirm before submitting.</div>
                  ) : null}
                </details>

                <details className="rounded-lg border border-gray-200 dark:border-gray-800 p-3" open>
                  <summary className="cursor-pointer text-sm font-medium text-gray-900 dark:text-gray-100">Code of Ethics</summary>
                  <div className="mt-2 text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                    {criteriaLoading ? "Loading..." : codeOfEthics ? codeOfEthics : "No code of ethics configured yet."}
                  </div>
                  <label className="mt-3 flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      {...register("codeOfEthicsAcknowledged", { required: true })}
                      className="mt-1 h-4 w-4 text-blue-600"
                    />
                    <span className="text-sm text-gray-800 dark:text-gray-200">
                      I have read and fully understood the information.
                      <span className="text-rose-600"> *</span>
                    </span>
                  </label>
                  {errors.codeOfEthicsAcknowledged ? (
                    <div className={errorText}>You must confirm before submitting.</div>
                  ) : null}
                </details>

                <details className="rounded-lg border border-gray-200 dark:border-gray-800 p-3" open>
                  <summary className="cursor-pointer text-sm font-medium text-gray-900 dark:text-gray-100">Role Criteria</summary>
                  <div className="mt-2">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-xs text-gray-600 dark:text-gray-400">Mandatory criteria must be confirmed to submit.</p>
                      {criteriaLoading ? <div className="text-xs text-gray-500">Loading...</div> : null}
                    </div>

                    {criteriaItems.length === 0 && !criteriaLoading ? (
                      <div className="mt-3 text-sm text-gray-600 dark:text-gray-400">No criteria configured yet.</div>
                    ) : (
                      <div className="mt-3 space-y-2">
                        {criteriaItems.map((c) => {
                          const id = Number(c.id);
                          const checked = selectedCriteriaIds.has(id);
                          return (
                            <label
                              key={id}
                              className="flex items-start gap-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 px-3 py-2 cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  setSelectedCriteriaIds((prev) => {
                                    const next = new Set(prev);
                                    if (e.target.checked) next.add(id);
                                    else next.delete(id);
                                    return next;
                                  });

                                  if (!e.target.checked && !c.is_mandatory) {
                                    setOptionalCriteriaProficiency((prev) => {
                                      const next = { ...prev };
                                      delete next[id];
                                      return next;
                                    });
                                  }
                                }}
                                className="mt-1 h-4 w-4 text-blue-600"
                              />
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{c.label}</span>
                                  {c.is_mandatory ? (
                                    <span className="rounded-full bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 text-[10px] font-semibold">Mandatory</span>
                                  ) : (
                                    <span className="rounded-full bg-gray-100 text-gray-700 border border-gray-200 px-2 py-0.5 text-[10px] font-semibold">Optional</span>
                                  )}
                                </div>
                                {c.description ? (
                                  <div className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{c.description}</div>
                                ) : null}

                                {!c.is_mandatory && checked ? (
                                  <div className="mt-2 rounded-lg border border-gray-200 bg-white px-3 py-2">
                                    <div className="text-xs font-semibold text-slate-700 mb-1">Proficiency (optional)</div>
                                    <StarRating
                                      value={Number(optionalCriteriaProficiency[id] || 0)}
                                      onChange={(val) => {
                                        setOptionalCriteriaProficiency((prev) => ({ ...prev, [id]: val }));
                                      }}
                                      ariaLabel={`Proficiency rating for ${c.label}`}
                                      sizeClassName="text-[18px]"
                                    />
                                  </div>
                                ) : null}
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </details>

                <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      Please tell your plan or strategy to achieve the role and responsibility assigned to you.
                    </div>
                    <div className={`text-xs font-semibold ${planLen > planMaxLen ? "text-rose-600" : "text-gray-500"}`}>
                      {planLen} / {planMaxLen}
                    </div>
                  </div>
                  <textarea
                    {...register("planStrategy", {
                      validate: (v) => {
                        const s = String(v || "");
                        const trimmed = s.trim();
                        if (!trimmed) return true;
                        if (trimmed.length < planMinLen) return `Please write at least ${planMinLen} characters (or leave it empty).`;
                        if (trimmed.length > planMaxLen) return `Please keep it under ${planMaxLen} characters.`;
                        return true;
                      },
                    })}
                    rows={4}
                    placeholder="Write your plan or strategy here..."
                    onInput={(e) => {
                      const el = e.currentTarget;
                      el.style.height = "auto";
                      el.style.height = `${el.scrollHeight}px`;
                    }}
                    className="mt-3 w-full resize-none rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {errors.planStrategy ? <div className={errorText}>{errors.planStrategy.message}</div> : null}
                  <div className="mt-1 text-xs text-gray-500">
                    Optional. If provided, aim for {planMinLen}-{planMaxLen} characters.
                  </div>
                </div>


              </div>
                          <div>
            <label className={labelBase}>Additional Achievements</label>
            <textarea
              {...register("additionalAchievements")}
              rows={5}
              placeholder="Describe any additional achievements, leadership experience, awards, or qualifications relevant to this role."
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
                        <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] p-4">
            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Upload Documents</div>
            <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">Allowed: PDF, DOC, DOCX. Max size: 5MB per file.</div>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={labelBase}>
                  Upload CV (required) <span className="text-rose-600">*</span>
                </label>
                <label
                  htmlFor="association-upload-cv"
                  className="flex items-center bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2.5 outline-none rounded w-max cursor-pointer"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 mr-2 fill-white inline" viewBox="0 0 32 32">
                    <path d="M23.75 11.044a7.99 7.99 0 0 0-15.5-.009A8 8 0 0 0 9 27h3a1 1 0 0 0 0-2H9a6 6 0 0 1-.035-12 1.038 1.038 0 0 0 1.1-.854 5.991 5.991 0 0 1 11.862 0A1.08 1.08 0 0 0 23 13a6 6 0 0 1 0 12h-3a1 1 0 0 0 0 2h3a8 8 0 0 0 .75-15.956z" />
                    <path d="M20.293 19.707a1 1 0 0 0 1.414-1.414l-5-5a1 1 0 0 0-1.414 0l-5 5a1 1 0 0 0 1.414 1.414L15 16.414V29a1 1 0 0 0 2 0V16.414z" />
                  </svg>
                  Upload
                  <input
                    id="association-upload-cv"
                    type="file"
                    accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      setCvFile(f);
                      setUploadedCvUrl(null);
                      setCvError(null);
                    }}
                    className="hidden"
                  />
                </label>
                <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">Selected: {cvFile ? cvFile.name : "-"}</div>
                {cvError ? <div className={errorText}>{cvError}</div> : null}
              </div>


              <div>
                <label className={labelBase}>Supporting Document 1 (optional)</label>
                <label
                  htmlFor="association-upload-file1"
                  className="flex items-center bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium px-4 py-2.5 outline-none rounded w-max cursor-pointer"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 mr-2 fill-white inline" viewBox="0 0 32 32">
                    <path d="M23.75 11.044a7.99 7.99 0 0 0-15.5-.009A8 8 0 0 0 9 27h3a1 1 0 0 0 0-2H9a6 6 0 0 1-.035-12 1.038 1.038 0 0 0 1.1-.854 5.991 5.991 0 0 1 11.862 0A1.08 1.08 0 0 0 23 13a6 6 0 0 1 0 12h-3a1 1 0 0 0 0 2h3a8 8 0 0 0 .75-15.956z" />
                    <path d="M20.293 19.707a1 1 0 0 0 1.414-1.414l-5-5a1 1 0 0 0-1.414 0l-5 5a1 1 0 0 0 1.414 1.414L15 16.414V29a1 1 0 0 0 2 0V16.414z" />
                  </svg>
                  Upload
                  <input
                    id="association-upload-file1"
                    type="file"
                    accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      setAdditionalFile1(f);
                      setUploadedAdditionalFile1Url(null);
                    }}
                    className="hidden"
                  />
                </label>
                <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">Selected: {additionalFile1 ? additionalFile1.name : "-"}</div>
              </div>

              <div>
                <label className={labelBase}>Supporting Document 2 (optional)</label>
                <label
                  htmlFor="association-upload-file2"
                  className="flex items-center bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium px-4 py-2.5 outline-none rounded w-max cursor-pointer"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 mr-2 fill-white inline" viewBox="0 0 32 32">
                    <path d="M23.75 11.044a7.99 7.99 0 0 0-15.5-.009A8 8 0 0 0 9 27h3a1 1 0 0 0 0-2H9a6 6 0 0 1-.035-12 1.038 1.038 0 0 0 1.1-.854 5.991 5.991 0 0 1 11.862 0A1.08 1.08 0 0 0 23 13a6 6 0 0 1 0 12h-3a1 1 0 0 0 0 2h3a8 8 0 0 0 .75-15.956z" />
                    <path d="M20.293 19.707a1 1 0 0 0 1.414-1.414l-5-5a1 1 0 0 0-1.414 0l-5 5a1 1 0 0 0 1.414 1.414L15 16.414V29a1 1 0 0 0 2 0V16.414z" />
                  </svg>
                  Upload
                  <input
                    id="association-upload-file2"
                    type="file"
                    accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      setAdditionalFile2(f);
                      setUploadedAdditionalFile2Url(null);
                    }}
                    className="hidden"
                  />
                </label>
                <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">Selected: {additionalFile2 ? additionalFile2.name : "-"}</div>
              </div>
            </div>

            {(uploadedCvUrl || uploadedAdditionalFile1Url || uploadedAdditionalFile2Url) ? (
              <div className="mt-3 text-xs text-gray-600 dark:text-gray-400">
                Uploaded files will be attached to your application submission.
              </div>
            ) : null}
          </div>
                          <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-3">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Compliance Declaration</div>
                  {complianceDeclaration ? (
                    <div className="mt-2 text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                      {complianceDeclaration}
                    </div>
                  ) : (
                    <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">No compliance declaration configured yet.</div>
                  )}
                  <label className="mt-3 flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      {...register("complianceAccepted", { required: true })}
                      className="mt-1 h-4 w-4 text-blue-600"
                    />
                    <span className="text-sm text-gray-800 dark:text-gray-200">
                      I have read and agree to the compliance declaration.
                      <span className="text-rose-600"> *</span>
                    </span>
                  </label>
                  {errors.complianceAccepted ? (
                    <div className={errorText}>You must accept before submitting.</div>
                  ) : null}
                </div>
            </div>
            
          ) : null}


        </div>

        {/* Submit Button */}
        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700 space-y-4">
          

          <button
            type="submit"
            disabled={
              isSubmitting ||
              isUploadingFiles ||
              !selectedRole ||
              !roleDescriptionAcknowledged ||
              !officeGovernanceAcknowledged ||
              !codeOfEthicsAcknowledged
            }
            className="px-5 py-2.5 text-[15px] font-medium w-full max-w-[130px] bg-[#007bff] hover:bg-[#006bff] text-white rounded-md transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isUploadingFiles ? "Uploading..." : isSubmitting ? "Submitting..." : "Submit Application"}
          </button>


        </div>
      </form>
    </div>
  );
}

