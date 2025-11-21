"use client";
import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  PakistanFlag,
  getCountryFlag,
} from "./country-flags";

type AlumniChaptersFormValues = {
  contactNumber: string;
  chapters: string[]; // Array to hold up to 3 selected chapters
};


const nationalChapters = [
  { value: 'kasur', label: 'Kasur' },
  { value: 'Rawalpindi', label: 'Rawalpindi' },
  { value: 'Karachi', label: 'Karachi' },
  { value: 'Islamabad', label: 'Islamabad' },
  { value: 'Peshawar', label: 'Peshawar' },
  { value: 'Quetta', label: 'Quetta' },
  { value: 'Multan', label: 'Multan' },
  { value: 'Faisalabad', label: 'Faisalabad' },
  { value: 'DG khan', label: 'DG Khan' },
  { value: 'Sahiwal', label: 'Sahiwal' },
  { value: 'Gilgit', label: 'Gilgit' },
  { value: 'Sargodha', label: 'Sargodha' },
];

const internationalChapters = [
  { value: 'KSA', label: 'KSA' },
  { value: 'Kuwait', label: 'Kuwait' },
  { value: 'UAE', label: 'UAE' },
  { value: 'UK', label: 'UK' },
  { value: 'Bahrain', label: 'Bahrain' },
  { value: 'Canada', label: 'Canada' },
  { value: 'USA', label: 'USA' },
  { value: 'Qatar', label: 'Qatar' },
  { value: 'Germany & Austria', label: 'Germany & Austria' },
];

// Combine all chapters with their types and flag components
const allChapters = [
  ...nationalChapters.map(ch => ({ ...ch, type: 'national' as const, FlagComponent: PakistanFlag })),
  ...internationalChapters.map(ch => ({ ...ch, type: 'international' as const, FlagComponent: getCountryFlag(ch.value) })),
];

const inputBase = "px-4 py-3 pr-8 bg-[#f0f1f2] focus:bg-transparent text-black w-full text-sm border border-gray-200 outline-[#007bff] rounded-md transition-all";
const labelBase = "mb-2 text-sm text-slate-900 font-medium block";
const errorText = "mt-1 text-xs text-rose-600";

type Props = {
  contactNumber: string;
  alumniId: string;
};

export default function AlumniChaptersForm({ 
  contactNumber: initialContactNumber,
  alumniId,
}: Props) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedChapters, setSelectedChapters] = useState<string[]>([]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<AlumniChaptersFormValues>({
    defaultValues: {
      contactNumber: initialContactNumber || "",
      chapters: [],
    },
  });

  // Auto-fill contact number on mount
  useEffect(() => {
    setValue("contactNumber", initialContactNumber || "");
  }, [initialContactNumber, setValue]);

  // Sync selectedChapters with form value
  useEffect(() => {
    setValue("chapters", selectedChapters);
  }, [selectedChapters, setValue]);

  const handleChapterToggle = (chapterValue: string) => {
    setSelectedChapters(prev => {
      if (prev.includes(chapterValue)) {
        // Remove if already selected
        return prev.filter(ch => ch !== chapterValue);
      } else {
        // Add if not selected and less than 3
        if (prev.length >= 3) {
          toast.error("You can select up to 3 chapters only.", {
            duration: 3000,
            style: {
              background: '#fee2e2',
              color: '#991b1b',
              padding: '12px',
              borderRadius: '8px',
            },
          });
          return prev;
        }
        return [...prev, chapterValue];
      }
    });
  };

  const onSubmit = async (data: AlumniChaptersFormValues) => {
    if (!alumniId) {
      toast.error("Alumni ID is required. Please log in again.");
      return;
    }

    // Validate that at least one chapter is selected
    if (selectedChapters.length === 0) {
      toast.error("Please select at least one chapter.", {
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

    // Validate maximum 3 chapters
    if (selectedChapters.length > 3) {
      toast.error("You can select up to 3 chapters only.", {
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
      const response = await fetch("/api/alumni/chapters", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          alumniId: parseInt(alumniId, 10),
          chapters: selectedChapters, // Send array of selected chapters
          contactNumber: data.contactNumber,
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

  return (
    <div className="rounded-2xl max-w-4xl mx-auto border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Alumni Chapters</h3>
      <p className="text-sm text-gray-600 dark:text-gray-400">Apply to join alumni chapters and connect with fellow alumni in your area.</p>

      <form className="max-w-4xl mx-auto mt-4" onSubmit={handleSubmit(onSubmit)}>
        <div className="grid sm:grid-cols-2 gap-6">
          {/* Contact Number - Manual input */}
          <div className="md:col-span-2">
            <label htmlFor="contactNumber" className={labelBase}>
              Contact Number <span className="text-rose-600">*</span>
            </label>
            <div className="relative flex items-center">
              <input
                id="contactNumber"
                type="tel"
                {...register("contactNumber", {
                  required: "Contact number is required",
                  pattern: {
                    value: /^[0-9+\-\s()]+$/,
                    message: "Please enter a valid contact number",
                  },
                })}
                className={`${inputBase} ${errors.contactNumber ? "border-rose-500 bg-rose-50" : ""}`}
                placeholder="Enter your contact number"
              />
            </div>
            {errors.contactNumber && <span className={errorText}>{errors.contactNumber.message}</span>}
          </div>

          {/* Chapters Selection - Multi-select up to 3 */}
          <div className="md:col-span-2">
            <label className={labelBase}>
              Select Chapters <span className="text-rose-600">*</span>
              <span className="text-xs text-gray-500 font-normal ml-2">(Select up to 3 chapters)</span>
            </label>
        <div className="space-y-4">
          {/* National Chapters Section */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              National Chapters
              <PakistanFlag className="w-5 h-4" />
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {nationalChapters.map((chapter) => {
                const isSelected = selectedChapters.includes(chapter.value);
                return (
                  <label
                    key={chapter.value}
                    className={`flex items-center p-3 border rounded-md cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-blue-50 border-blue-500'
                        : 'bg-white border-gray-200 hover:border-gray-300'
                    } ${selectedChapters.length >= 3 && !isSelected ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleChapterToggle(chapter.value)}
                      disabled={selectedChapters.length >= 3 && !isSelected}
                      className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="text-sm flex items-center">
                      <span className="mr-2 flex-shrink-0">
                        <PakistanFlag className="w-5 h-4" />
                      </span>
                      {chapter.label}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* International Chapters Section */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">International Chapters</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {internationalChapters.map((chapter) => {
                const isSelected = selectedChapters.includes(chapter.value);
                const FlagComponent = getCountryFlag(chapter.value);
                return (
                  <label
                    key={chapter.value}
                    className={`flex items-center p-3 border rounded-md cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-blue-50 border-blue-500'
                        : 'bg-white border-gray-200 hover:border-gray-300'
                    } ${selectedChapters.length >= 3 && !isSelected ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleChapterToggle(chapter.value)}
                      disabled={selectedChapters.length >= 3 && !isSelected}
                      className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="text-sm flex items-center">
                      <span className="mr-2 flex-shrink-0">
                        <FlagComponent className="w-5 h-4" />
                      </span>
                      {chapter.label}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
        {selectedChapters.length > 0 && (
          <div className="mt-3 p-3 bg-gray-50 rounded-md">
            <p className="text-xs text-gray-600 mb-1">
              Selected chapters ({selectedChapters.length}/3):
            </p>
            <div className="flex flex-wrap gap-2">
              {selectedChapters.map((chapterValue) => {
                const chapter = allChapters.find(ch => ch.value === chapterValue);
                return chapter ? (
                  <span
                    key={chapterValue}
                    className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs"
                  >
                    <span className="mr-1 flex-shrink-0">
                      <chapter.FlagComponent className="w-4 h-3" />
                    </span>
                    {chapter.label}
                    <button
                      type="button"
                      onClick={() => handleChapterToggle(chapterValue)}
                      className="ml-1 text-blue-600 hover:text-blue-800"
                    >
                      ×
                    </button>
                  </span>
                ) : null;
              })}
            </div>
          </div>
        )}
            {errors.chapters && <span className={errorText}>{errors.chapters.message}</span>}
          </div>
        </div>

        {/* Submit Button */}
        <div className="md:col-span-2 flex items-center gap-3 mt-6">
          <button
            type="submit"
            disabled={isSubmitting || selectedChapters.length === 0}
            className="px-5 py-2.5 text-[15px] font-medium w-full max-w-[130px] bg-[#007bff] hover:bg-[#006bff] text-white rounded-md transition-all cursor-pointer disabled:opacity-60"
          >
            {isSubmitting ? "Submitting..." : "Submit Application"}
          </button>
        </div>
      </form>
    </div>
  );
}
