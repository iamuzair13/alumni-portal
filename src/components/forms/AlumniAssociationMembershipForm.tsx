"use client";
import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { useQuery } from "@tanstack/react-query";

type AlumniAssociationMembershipFormValues = {
  associationId: string;
};

type Association = {
  id: number;
  title: string;
  description: string | null;
  dean: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
};

const labelBase = "mb-2 text-sm text-slate-900 font-medium block";
const errorText = "mt-1 text-xs text-rose-600";

type Props = {
  alumniId: string;
};

async function fetchAssociations(): Promise<Association[]> {
  const res = await fetch("/api/associations/list");
  if (!res.ok) {
    throw new Error("Failed to fetch associations");
  }
  const data = await res.json();
  return data.associations || [];
}

export default function AlumniAssociationMembershipForm({ alumniId }: Props) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedAssociation, setSelectedAssociation] = useState<string>("");

  // Fetch associations list
  const { data: associations = [], isLoading: associationsLoading } = useQuery({
    queryKey: ["associations-list"],
    queryFn: fetchAssociations,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<AlumniAssociationMembershipFormValues>({
    defaultValues: {
      associationId: "",
    },
  });

  const associationId = watch("associationId");

  // Update selectedAssociation when form value changes
  React.useEffect(() => {
    setSelectedAssociation(associationId || "");
  }, [associationId]);

  const onSubmit = async (data: AlumniAssociationMembershipFormValues) => {
    // Prevent double submission
    if (isSubmitting) {
      return;
    }

    if (!alumniId) {
      toast.error("Alumni ID is required. Please log in again.");
      return;
    }

    if (!data.associationId) {
      toast.error("Please select an association.", {
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
    const loadingToast = toast.loading("Joining association...");

    try {
      const response = await fetch("/api/alumni/association-membership", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          alumniId: parseInt(alumniId, 10),
          associationId: parseInt(data.associationId, 10),
        }),
      });

      const result = await response.json();

      toast.dismiss(loadingToast);

      if (!response.ok) {
        throw new Error(result.error || "Failed to join association");
      }

      toast.success("Successfully joined the association!", {
        duration: 4000,
        style: {
          background: '#d1fae5',
          color: '#065f46',
          padding: '16px',
          borderRadius: '8px',
        },
      });

      // Navigate to my-associations page
      setTimeout(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const sapId = urlParams.get('sapid');
        if (sapId) {
          router.push(`/alumni-profile/my-associations?sapid=${encodeURIComponent(sapId)}`);
        } else {
          router.push('/alumni-profile/my-associations');
        }
        router.refresh();
      }, 1500);
    } catch (error) {
      toast.dismiss(loadingToast);
      const errorMessage = error instanceof Error ? error.message : "Failed to join association";
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

  const selectedAssociationDetails = selectedAssociation 
    ? associations.find(a => a.id === parseInt(selectedAssociation, 10))
    : null;

  if (associationsLoading) {
    return (
      <div className="rounded-2xl max-w-4xl mx-auto border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:outline-gray-700">
        <div className="flex items-center justify-center py-8">
          <div className="h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin dark:text-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:outline-gray-700" />
        </div>
      </div>
    );
  }

  if (associations.length === 0) {
    return (
      <div className="rounded-2xl max-w-4xl mx-auto border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:outline-gray-700">
        <div className="rounded-lg border-2 border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50 p-8 text-center dark:text-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:outline-gray-700 dark:text-gray-100">
          <div className="mb-4">
            <svg className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:outline-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2 dark:text-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:outline-gray-700 dark:text-gray-100">No associations available</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:outline-gray-700 dark:text-gray-100 dark:text-gray-100">
            There are currently no associations available to join. Please check back later.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl max-w-4xl mx-auto border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:outline-gray-700">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:outline-gray-700 dark:text-gray-100">Join an Association</h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 dark:text-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:outline-gray-700">Select an association to join and connect with alumni from your academic background.</p>

      <form className="max-w-4xl mx-auto mt-4" onSubmit={handleSubmit(onSubmit)}>
        <div className="space-y-6">
          {/* Association Selection - Radio Buttons */}
          <div>
            <label className={`${labelBase} text-base font-semibold dark:text-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:outline-gray-700`}>
              Select an Association <span className="text-rose-600 dark:text-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:outline-gray-700">*</span>
            </label>
            <div className="space-y-3 mt-3 dark:text-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:outline-gray-700">
              {associations.map((association) => (
                <label
                  key={association.id}
                  className={`flex items-start p-4 border-2 rounded-lg cursor-pointer transition-all dark:text-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:outline-gray-700 ${
                    selectedAssociation === String(association.id)
                      ? 'border-orange-500 bg-orange-50 dark:text-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:outline-gray-700'
                      : 'border-gray-200 bg-white hover:border-gray-300 dark:text-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:outline-gray-700'
                  }`}
                >
                  <input
                    type="radio"
                    value={association.id}
                    {...register("associationId", { required: "Please select an association" })}
                    className="mt-1 mr-3 h-5 w-5 text-orange-600 focus:ring-orange-500 border-gray-300 dark:text-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:outline-gray-700"
                  />
                  <div className="flex-1">
                    <span className="text-base font-semibold text-gray-900 dark:text-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:outline-gray-700">{association.title}</span>
                    {association.description && (
                      <p className="text-sm text-gray-600 mt-1 dark:text-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:outline-gray-700">{association.description}</p>
                    )}
                  </div>
                </label>
              ))}
            </div>
            {errors.associationId && <span className={errorText + " dark:text-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:outline-gray-700"}>{errors.associationId.message}</span>}
          </div>

          {/* Association Details - Shown when association is selected */}
          {selectedAssociationDetails && (
            <div className="mt-6 p-6 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 rounded-lg border border-orange-100 dark:border-orange-800/30">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 dark:text-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:outline-gray-700">
                {selectedAssociationDetails.title}
              </h4>
              <div className="space-y-3">
                {selectedAssociationDetails.description && (
                  <div>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1 dark:text-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:outline-gray-700">About:</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                      {selectedAssociationDetails.description}
                    </p>
                  </div>
                )}
                {selectedAssociationDetails.dean && (
                  <div>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Dean:</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 dark:text-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:outline-gray-700">
                      {selectedAssociationDetails.dean}
                    </p>
                  </div>
                )}
                {selectedAssociationDetails.email && (
                  <div>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1 dark:text-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:outline-gray-700">Email:</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {selectedAssociationDetails.email}
                    </p>
                  </div>
                )}
                {selectedAssociationDetails.phone && (
                  <div>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1 dark:text-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:outline-gray-700">Phone:</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {selectedAssociationDetails.phone}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Submit Button */}
        <div className="flex items-center gap-3 mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
          <button
            type="submit"
            disabled={isSubmitting || !selectedAssociation}
            className="px-5 py-2.5 text-[15px] font-medium w-full max-w-[130px] bg-[#007bff] hover:bg-[#006bff] text-white rounded-md transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Joining..." : "Join Association"}
          </button>
        </div>
      </form>
    </div>
  );
}

