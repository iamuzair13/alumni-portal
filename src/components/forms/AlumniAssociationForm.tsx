"use client";
import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { useQuery } from "@tanstack/react-query";

type AlumniAssociationFormValues = {
  role: string;
};

type RoleDetails = {
  role: string;
  description: string;
  criteria: string;
};

const ROLE_DETAILS: Record<string, RoleDetails> = {
  president: {
    role: "President",
    description: "Lead the association, suggest alumni engagement events, bring alumni together, and coordinate with the university management.",
    criteria: "Alumni with 10–15 years of experience, strong leadership and communication skills, and a commitment to the UOL community.",
  },
  vicePresident: {
    role: "Vice President",
    description: "Support the President, assist in planning and executing events in collaboration with the Alumni Office.",
    criteria: "Alumni with 5 years or more experience, organizational skills, and active involvement in alumni activities.",
  },
  coordinator: {
    role: "Coordinator",
    description: "Present at events, handle arrangements, and collaborate with the Alumni Office team for smooth execution.",
    criteria: "Alumni with 2–3 years of experience, good administrative skills, and attention to detail.",
  },
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>("");

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
    },
    disabled: !isFormEnabled,
  });

  const role = watch("role");

  // Update selectedRole when form value changes
  React.useEffect(() => {
    setSelectedRole(role || "");
  }, [role]);

  const onSubmit = async (data: AlumniAssociationFormValues) => {
    // Prevent double submission
    if (isSubmitting) {
      return;
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

      // Navigate back to profile page
      setTimeout(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const sapId = urlParams.get('sapid');
        if (sapId) {
          router.push(`/alumni-profile?sapid=${encodeURIComponent(sapId)}`);
        } else {
          router.push('/alumni-profile');
        }
        router.refresh();
      }, 1500);
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

  const selectedRoleDetails = selectedRole ? ROLE_DETAILS[selectedRole] : null;

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

          {/* Role Description - Shown when role is selected */}
          {selectedRoleDetails && (
            <div className="mt-6 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border border-blue-100 dark:border-blue-800/30">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                {selectedRoleDetails.role}
              </h4>
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Role:</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                    {selectedRoleDetails.description}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Criteria:</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                    {selectedRoleDetails.criteria}
                  </p>
                </div>
              </div>
            </div>
          )}
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

