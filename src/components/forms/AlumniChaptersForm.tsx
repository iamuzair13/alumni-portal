"use client";
import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

type AlumniChaptersFormValues = {
  name: string;
  faculty: string;
  department: string;
  passingYear: string;
  contactNumber: string;
  nationalChapter: string;
  internationalChapter: string;
};

const nationalChapters = [
  'kasur',
  'Rawalpindi',
  'Isla',
  'Karachi',
  'Islamabad',
  'Peshawar',
  'Quetta',
  'Multan',
  'Faisalabad',
  'DG khan',
  'Sahiwal',
  'Gilgit',
  'Sargodha',
];

const internationalChapters = [
  'KSA',
  'United Kingdom',
  'Kuwait',
  'UAE',
  'UK',
  'Bahrain ',
  'Canada',
  'USA',
  'Qatar',
  'Germany & Austria',
  ''
].filter(ch => ch.trim() !== ''); // Remove empty strings

const inputBase = "px-4 py-3 pr-8 bg-[#f0f1f2] focus:bg-transparent text-black w-full text-sm border border-gray-200 outline-[#007bff] rounded-md transition-all";
const labelBase = "mb-2 text-sm text-slate-900 font-medium block";
const errorText = "mt-1 text-xs text-rose-600";

type Props = {
  name: string;
  faculty: string;
  department: string;
  passingYear: number | null;
  contactNumber: string;
  alumniId: string;
};

export default function AlumniChaptersForm({ 
  name, 
  faculty, 
  department, 
  passingYear, 
  contactNumber: initialContactNumber,
  alumniId,
}: Props) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<AlumniChaptersFormValues>({
    defaultValues: {
      name: name || "",
      faculty: faculty || "",
      department: department || "",
      passingYear: passingYear ? String(passingYear) : "",
      contactNumber: initialContactNumber || "",
      nationalChapter: "",
      internationalChapter: "",
    },
  });

  // Auto-fill form fields on mount
  useEffect(() => {
    setValue("name", name || "");
    setValue("faculty", faculty || "");
    setValue("department", department || "");
    if (passingYear) {
      setValue("passingYear", String(passingYear));
    }
    setValue("contactNumber", initialContactNumber || "");
  }, [name, faculty, department, passingYear, initialContactNumber, setValue]);

  const onSubmit = async (data: AlumniChaptersFormValues) => {
    if (!alumniId) {
      toast.error("Alumni ID is required. Please log in again.");
      return;
    }

    // Validate that at least one chapter is selected
    if (!data.nationalChapter && !data.internationalChapter) {
      toast.error("Please select at least one chapter (National or International).");
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
          nationalChapter: data.nationalChapter || null,
          internationalChapter: data.internationalChapter || null,
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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Name - Auto-filled */}
      <div>
        <label htmlFor="name" className={labelBase}>
          Name <span className="text-rose-600">*</span>
        </label>
        <input
          id="name"
          type="text"
          {...register("name", { required: "Name is required" })}
          disabled
          className={`${inputBase} bg-gray-100 cursor-not-allowed`}
        />
        {errors.name && <p className={errorText}>{errors.name.message}</p>}
      </div>

      {/* Faculty - Auto-filled */}
      <div>
        <label htmlFor="faculty" className={labelBase}>
          Faculty <span className="text-rose-600">*</span>
        </label>
        <input
          id="faculty"
          type="text"
          {...register("faculty", { required: "Faculty is required" })}
          disabled
          className={`${inputBase} bg-gray-100 cursor-not-allowed`}
        />
        {errors.faculty && <p className={errorText}>{errors.faculty.message}</p>}
      </div>

      {/* Department - Auto-filled */}
      <div>
        <label htmlFor="department" className={labelBase}>
          Department <span className="text-rose-600">*</span>
        </label>
        <input
          id="department"
          type="text"
          {...register("department", { required: "Department is required" })}
          disabled
          className={`${inputBase} bg-gray-100 cursor-not-allowed`}
        />
        {errors.department && <p className={errorText}>{errors.department.message}</p>}
      </div>

      {/* Passing Year - Auto-filled */}
      <div>
        <label htmlFor="passingYear" className={labelBase}>
          Passing Year <span className="text-rose-600">*</span>
        </label>
        <input
          id="passingYear"
          type="text"
          {...register("passingYear", { required: "Passing year is required" })}
          disabled
          className={`${inputBase} bg-gray-100 cursor-not-allowed`}
        />
        {errors.passingYear && <p className={errorText}>{errors.passingYear.message}</p>}
      </div>

      {/* Contact Number - Manual input */}
      <div>
        <label htmlFor="contactNumber" className={labelBase}>
          Contact Number <span className="text-rose-600">*</span>
        </label>
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
          className={inputBase}
          placeholder="Enter your contact number"
        />
        {errors.contactNumber && <p className={errorText}>{errors.contactNumber.message}</p>}
      </div>

      {/* National Chapters Dropdown */}
      <div>
        <label htmlFor="nationalChapter" className={labelBase}>
          National Chapter
        </label>
        <select
          id="nationalChapter"
          {...register("nationalChapter")}
          className={inputBase}
        >
          <option value="">Select a national chapter</option>
          {nationalChapters.map((chapter) => (
            <option key={chapter} value={chapter}>
              {chapter}
            </option>
          ))}
        </select>
        {errors.nationalChapter && <p className={errorText}>{errors.nationalChapter.message}</p>}
      </div>

      {/* International Chapters Dropdown */}
      <div>
        <label htmlFor="internationalChapter" className={labelBase}>
          International Chapter
        </label>
        <select
          id="internationalChapter"
          {...register("internationalChapter")}
          className={inputBase}
        >
          <option value="">Select an international chapter</option>
          {internationalChapters.map((chapter) => (
            <option key={chapter} value={chapter}>
              {chapter}
            </option>
          ))}
        </select>
        {errors.internationalChapter && <p className={errorText}>{errors.internationalChapter.message}</p>}
      </div>

      {/* Submit Button */}
      <div className="flex gap-4 pt-4">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? "Submitting..." : "Submit Application"}
        </button>
      </div>
    </form>
  );
}

