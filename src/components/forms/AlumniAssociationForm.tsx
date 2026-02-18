"use client";
import React, { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import LeadershipApplicationsTracker from "@/components/alumni/LeadershipApplicationsTracker";

type AlumniAssociationFormValues = {
  role: string;
  additionalAchievements: string;
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

export default function AlumniAssociationForm({ alumniId }: Props) {
  const router = useRouter();
  const qc = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [selectedCriteriaIds, setSelectedCriteriaIds] = useState<Set<number>>(new Set());
  const alumniIdNumber = useMemo(() => {
    const n = Number(alumniId);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [alumniId]);

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
    },
    disabled: !isFormEnabled,
  });

  const role = watch("role");

  // Update selectedRole when form value changes
  React.useEffect(() => {
    setSelectedRole(role || "");
    setSelectedCriteriaIds(new Set());
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
      return (await res.json()) as { items: RoleCriterion[]; roleDescription?: string };
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
    return s;
  }, [criteriaData]);

  const mandatoryCriteriaIds = useMemo(() => {
    return criteriaItems.filter((c) => c.is_mandatory).map((c) => Number(c.id)).filter((n) => Number.isFinite(n) && n > 0);
  }, [criteriaItems]);

  const onSubmit = async (data: AlumniAssociationFormValues) => {
    // Prevent double submission
    if (isSubmitting) {
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

    setIsSubmitting(true);
    const loadingToast = toast.loading("Submitting application...");

    try {
      const response = await fetch("/api/alumni/association", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          alumniId: parseInt(alumniId, 10),
          role: data.role,
          criteriaIds: Array.from(selectedCriteriaIds),
          additionalAchievements: data.additionalAchievements,
        }),
      });

      const result = await response.json();

      toast.dismiss(loadingToast);

      if (!response.ok) {
        throw new Error(result.error || "Failed to submit application");
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

          {/* Role Description */}
          {selectedRole ? (
            <div className="rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-4">
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Role Description</div>
              <div className="mt-1 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                {criteriaLoading ? "Loading..." : roleDescription ? roleDescription : "No role description configured yet."}
              </div>
            </div>
          ) : null}

          {/* Role Criteria */}
          {selectedRole ? (
            <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Role Criteria</h4>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Mandatory criteria must be confirmed to submit.</p>
                </div>
                {criteriaLoading ? (
                  <div className="text-xs text-gray-500">Loading...</div>
                ) : null}
              </div>

              {criteriaItems.length === 0 && !criteriaLoading ? (
                <div className="mt-3 text-sm text-gray-600 dark:text-gray-400">No criteria configured yet.</div>
              ) : (
                <div className="mt-3 space-y-2">
                  {criteriaItems.map((c) => {
                    const id = Number(c.id);
                    const checked = selectedCriteriaIds.has(id);
                    return (
                      <label key={id} className="flex items-start gap-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 px-3 py-2 cursor-pointer">
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
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          ) : null}

          <div>
            <label className={labelBase}>Additional Achievements</label>
            <textarea
              {...register("additionalAchievements")}
              rows={5}
              placeholder="Describe any additional achievements, leadership experience, awards, or qualifications relevant to this role."
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex items-center gap-3 mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
          <button
            type="submit"
            disabled={isSubmitting || !selectedRole}
            className="px-5 py-2.5 text-[15px] font-medium w-full max-w-[130px] bg-[#007bff] hover:bg-[#006bff] text-white rounded-md transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Submitting..." : "Submit Application"}
          </button>
        </div>
      </form>
    </div>
  );
}

