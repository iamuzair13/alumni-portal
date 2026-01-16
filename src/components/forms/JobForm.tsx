"use client";

import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";

type JobFormValues = {
  title: string;
  category: string;
  company: string;
  deadline: string;
  location: string;
  jobLink: string;
};

type JobFormProps = {
  jobId?: number | null;
  onSuccess?: () => void;
  onCancel?: () => void;
};

export default function JobForm({ jobId, onSuccess, onCancel }: JobFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm<JobFormValues>({
    defaultValues: {
      title: "",
      category: "",
      company: "",
      deadline: "",
      location: "",
      jobLink: "",
    },
  });

  // Load job data if editing
  useEffect(() => {
    if (jobId) {
      setIsLoading(true);
      fetch(`/api/jobs/${jobId}`)
        .then((res) => {
          if (!res.ok) {
            throw new Error("Failed to load job");
          }
          return res.json();
        })
        .then((data) => {
          setValue("title", data.title || "");
          setValue("category", data.category || "");
          setValue("company", data.company || "");
          // Use deadline directly if it's already in YYYY-MM-DD format
          // Parse date string directly to avoid timezone issues
          if (data.deadline) {
            // Check if it's already in YYYY-MM-DD format
            const dateMatch = String(data.deadline).match(/^(\d{4})-(\d{2})-(\d{2})/);
            if (dateMatch) {
              // Already in correct format, use directly
              setValue("deadline", dateMatch[0]);
            } else {
              // Try to parse and format without timezone conversion
              const dateStr = String(data.deadline).split('T')[0]; // Get date part only
              if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                setValue("deadline", dateStr);
              } else {
                setValue("deadline", "");
              }
            }
          } else {
            setValue("deadline", "");
          }
          setValue("location", data.location || "");
          setValue("jobLink", data.jobLink || "");
        })
        .catch((err) => {
          toast.error("Failed to load job data");
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [jobId, setValue]);

  const onSubmit = async (data: JobFormValues) => {
    setIsSubmitting(true);
    try {
      const url = jobId ? `/api/jobs/${jobId}` : "/api/jobs";
      const method = jobId ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: data.title.trim(),
          category: data.category.trim() || null,
          company: data.company.trim(),
          deadline: data.deadline.trim() || null,
          location: data.location.trim() || null,
          jobLink: data.jobLink.trim() || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Failed to save job" }));
        throw new Error(error.error || "Failed to save job");
      }

      toast.success(jobId ? "Job updated successfully" : "Job created successfully");
      reset();
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save job");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Title <span className="text-red-600">*</span>
        </label>
        <input
          id="title"
          type="text"
          {...register("title", { required: "Title is required" })}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Job Title"
        />
        {errors.title && (
          <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="category" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Category
        </label>
        <input
          id="category"
          type="text"
          {...register("category")}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Job Category"
        />
      </div>

      <div>
        <label htmlFor="company" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Company <span className="text-red-600">*</span>
        </label>
        <input
          id="company"
          type="text"
          {...register("company", { required: "Company is required" })}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Company Name"
        />
        {errors.company && (
          <p className="mt-1 text-sm text-red-600">{errors.company.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="deadline" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Deadline
        </label>
        <input
          id="deadline"
          type="date"
          {...register("deadline")}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label htmlFor="location" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Location
        </label>
        <input
          id="location"
          type="text"
          {...register("location")}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Job Location"
        />
      </div>

      <div>
        <label htmlFor="jobLink" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Job Link
        </label>
        <input
          id="jobLink"
          type="url"
          {...register("jobLink", {
            pattern: {
              value: /^https?:\/\/.+/,
              message: "Please enter a valid URL",
            },
          })}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="https://example.com/job"
        />
        {errors.jobLink && (
          <p className="mt-1 text-sm text-red-600">{errors.jobLink.message}</p>
        )}
      </div>

      <div className="flex justify-end gap-3 pt-4">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Saving...
            </span>
          ) : (
            jobId ? "Update Job" : "Create Job"
          )}
        </button>
      </div>
    </form>
  );
}
