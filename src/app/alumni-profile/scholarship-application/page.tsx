"use client";
import { useState, Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useAlumniFullDetails } from "@/app/queries/alumni-profile";
import AppHeader from "@/layout/AppHeader";
import BackButton from "@/components/ui/BackButton";
import { Toaster, toast } from "react-hot-toast";

function ScholarshipApplicationContent() {
  const searchParams = useSearchParams();
  const sapIdFromParams = searchParams.get("sapid");
  const [sapId, setSapId] = useState(sapIdFromParams || "");
  
  // Try to get SAP ID from session if not in params
  useEffect(() => {
    if (!sapId) {
      // Fetch current user's SAP ID from API
      fetch("/api/alumni/current-sapid")
        .then(res => res.json())
        .then(data => {
          if (data.sapid) {
            setSapId(data.sapid);
          }
        })
        .catch(() => {
          // If API fails, try to get from URL or show error
        });
    }
  }, [sapId]);
  
  const { data, isLoading } = useAlumniFullDetails(sapId || undefined);
  
  const [formData, setFormData] = useState({
    discountType: "",
    applyingFor: "",
    degreeTitle: "",
    kinshipRelation: "",
    kinshipName: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const discountOptions = [
    { value: "kinship", label: "Kinship Discount" },
    { value: "masters-phd", label: "Masters/PhD Discount" },
    { value: "masters-collaboration", label: "Masters Scholarships via UOL International Collaborations (for alumni only)" },
  ];

  const applyingForOptions = {
    kinship: [
      { value: "BS", label: "BS (Bachelor's)" },
      { value: "Masters", label: "Masters" },
      { value: "PhD", label: "PhD" },
    ],
    "masters-phd": [
      { value: "Masters", label: "Masters (50% discount)" },
      { value: "PhD", label: "PhD (25% discount)" },
    ],
    "masters-collaboration": [
      { value: "Masters", label: "Masters Scholarships via UOL International Collaborations" },
    ],
  };

  const kinshipRelations = [
    { value: "Sister", label: "Sister" },
    { value: "Brother", label: "Brother" },
    { value: "Other", label: "Other" },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.discountType || !formData.applyingFor || !formData.degreeTitle) {
      toast.error("Please fill in all required fields", {
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

    if (formData.discountType === "kinship" && (!formData.kinshipRelation || !formData.kinshipName)) {
      toast.error("Please provide kinship relation and name", {
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

    if (!sapId) {
      toast.error("SAP ID not found. Please ensure you are logged in.", {
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
    try {
      const response = await fetch(`/api/alumni/${encodeURIComponent(sapId)}/scholarship-application`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          discountType: formData.discountType,
          applyingFor: formData.applyingFor,
          degreeTitle: formData.degreeTitle,
          kinshipRelation: formData.kinshipRelation || null,
          kinshipName: formData.kinshipName || null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to submit application");
      }

      // Check if email was sent
      if (result.emailSent === false) {
        // Email failed but application was received
        toast.error(
          <div>
            <p className="font-semibold">Application received, but email delivery failed</p>
            <p className="text-xs mt-1">{result.message}</p>
            {result.emailError && (
              <p className="text-xs mt-1 text-gray-600">Error: {result.emailError}</p>
            )}
          </div>,
          {
            duration: 8000,
            style: {
              background: '#fef3c7',
              color: '#92400e',
              padding: '12px',
              borderRadius: '8px',
            },
          }
        );
      } else if (result.emailSent === true) {
        // Email sent successfully
        toast.success("Application submitted successfully! Please check your email for the confirmation document.", {
          duration: 6000,
          style: {
            background: '#d1fae5',
            color: '#065f46',
            padding: '12px',
            borderRadius: '8px',
          },
        });
      } else {
        // Email status unknown (might be SMTP not configured)
        toast.success(
          <div>
            <p className="font-semibold">{result.message}</p>
            {result.emailError && (
              <p className="text-xs mt-1 text-gray-600">Note: {result.emailError}</p>
            )}
          </div>,
          {
            duration: 6000,
            style: {
              background: '#dbeafe',
              color: '#1e40af',
              padding: '12px',
              borderRadius: '8px',
            },
          }
        );
      }

      // Reset form
      setFormData({
        discountType: "",
        applyingFor: "",
        degreeTitle: "",
        kinshipRelation: "",
        kinshipName: "",
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to submit application. Please try again.", {
        duration: 4000,
        style: {
          background: '#fee2e2',
          color: '#991b1b',
          padding: '12px',
          borderRadius: '8px',
        },
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <>
        <AppHeader />
        <div className="min-h-screen bg-gray-50">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="bg-white rounded-lg shadow-sm p-8">
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center gap-4">
                  <svg className="animate-spin h-12 w-12 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <p className="text-sm text-gray-600">Loading...</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <AppHeader />
        <div className="min-h-screen bg-gray-50">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="bg-white rounded-lg shadow-sm p-8">
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center gap-4">
                  <p className="text-sm text-red-600">Failed to load profile data</p>
                  <BackButton />
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  const currentOptions = formData.discountType ? applyingForOptions[formData.discountType as keyof typeof applyingForOptions] || [] : [];

  return (
    <>
      <AppHeader />
      <Toaster position="top-right" />
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-6">
            <BackButton />
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 sm:p-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Scholarship / Fee Discount Application</h1>
            <p className="text-gray-600 mb-8">Fill out the form below to apply for UOL Alumni Scholarship or Fee Discount.</p>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="discountType" className="block text-sm font-medium text-gray-700 mb-2">
                  Select Discount <span className="text-red-500">*</span>
                </label>
                <select
                  id="discountType"
                  value={formData.discountType}
                  onChange={(e) => {
                    setFormData({
                      ...formData,
                      discountType: e.target.value,
                      applyingFor: "", // Reset when discount type changes
                    });
                  }}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select Discount Type</option>
                  {discountOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {formData.discountType && (
                <div>
                  <label htmlFor="applyingFor" className="block text-sm font-medium text-gray-700 mb-2">
                    Applying For <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="applyingFor"
                    value={formData.applyingFor}
                    onChange={(e) => setFormData({ ...formData, applyingFor: e.target.value })}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select Program</option>
                    {currentOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {formData.discountType === "kinship" && (
                <>
                  <div>
                    <label htmlFor="kinshipRelation" className="block text-sm font-medium text-gray-700 mb-2">
                      Relation <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="kinshipRelation"
                      value={formData.kinshipRelation}
                      onChange={(e) => setFormData({ ...formData, kinshipRelation: e.target.value })}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">Select Relation</option>
                      {kinshipRelations.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="kinshipName" className="block text-sm font-medium text-gray-700 mb-2">
                      Name of {formData.kinshipRelation || "Beneficiary"} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="kinshipName"
                      value={formData.kinshipName}
                      onChange={(e) => setFormData({ ...formData, kinshipName: e.target.value })}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                      placeholder="Enter name"
                    />
                  </div>
                </>
              )}

              <div>
                <label htmlFor="degreeTitle" className="block text-sm font-medium text-gray-700 mb-2">
                  Degree Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="degreeTitle"
                  value={formData.degreeTitle}
                  onChange={(e) => setFormData({ ...formData, degreeTitle: e.target.value })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                  placeholder="Enter degree title"
                />
              </div>

              <div className="flex items-center gap-4 pt-4">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Submitting...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Submit Application
                    </>
                  )}
                </button>
                <BackButton />
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}

export default function ScholarshipApplicationPage() {
  return (
    <Suspense
      fallback={
        <>
          <AppHeader />
          <div className="min-h-screen bg-gray-50">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <div className="bg-white rounded-lg shadow-sm p-8">
                <div className="flex items-center justify-center py-12">
                  <div className="flex flex-col items-center gap-4">
                    <svg className="animate-spin h-12 w-12 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p className="text-sm text-gray-600">Loading...</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      }
    >
      <ScholarshipApplicationContent />
    </Suspense>
  );
}

