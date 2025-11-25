"use client";
import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";

type Props = {
  alumniId: string;
  name: string;
  sapId: string;
};

const schema = z.object({
  month: z.string().min(1, "Please select a month"),
});

type FormVals = z.infer<typeof schema>;

const inputBase = "px-4 py-3 pr-8 bg-[#f0f1f2] focus:bg-transparent text-black w-full text-sm border border-gray-200 outline-[#007bff] rounded-md transition-all";
const labelBase = "my-2 text-sm text-slate-900 font-medium block";
const buttonPrimary = "mt-6 px-5 py-2.5 text-[15px] font-medium w-full max-w-[130px] mx-auto block bg-[#007bff] hover:bg-[#006bff] text-white rounded-md transition-all cursor-pointer disabled:opacity-60";

// Generate month options (current month and next 11 months)
function getMonthOptions(): { value: string; label: string }[] {
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  
  const options: { value: string; label: string }[] = [];
  const currentDate = new Date();
  
  for (let i = 0; i < 12; i++) {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth() + i, 1);
    const monthName = months[date.getMonth()];
    const year = date.getFullYear();
    options.push({
      value: `${monthName} ${year}`,
      label: `${monthName} ${year}`
    });
  }
  
  return options;
}

export default function GymMembershipForm({ alumniId, sapId }: Props) {
  const router = useRouter();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormVals>({
    resolver: zodResolver(schema),
    mode: "onChange",
  });

  const monthOptions = getMonthOptions();

  const onSubmit = async (vals: FormVals) => {
    try {
      const loadingToast = toast.loading("Submitting your gym membership application...");
      
      const payload = {
        alumniId,
        month: vals.month,
      };
      
      const res = await fetch("/api/alumni/gym-membership", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      
      toast.dismiss(loadingToast);
      
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Failed to submit application" }));
        throw new Error(data.error || "Failed to submit application");
      }
      
      toast.success("Gym membership application submitted successfully!");
      
      // Redirect to profile page after a short delay
      setTimeout(() => {
        router.push(sapId ? `/alumni-profile?sapid=${encodeURIComponent(sapId)}` : "/alumni-profile");
      }, 1500);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to submit application";
      toast.error(message);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-slate-900 mb-2">Gym Membership Application</h2>
        <p className="text-sm text-slate-600">
          Apply for gym facility access. As a UOL alumni, you are eligible for special discounts.
        </p>
      </div>

      <div className="space-y-6">
        <div>
          <label htmlFor="month" className={labelBase}>
            Apply for Month <span className="text-red-500">*</span>
          </label>
          <select
            id="month"
            {...register("month")}
            className={`${inputBase} ${errors.month ? "border-red-500" : ""}`}
            aria-invalid={errors.month ? "true" : "false"}
            aria-describedby={errors.month ? "month-error" : undefined}
          >
            <option value="">Select a month</option>
            {monthOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {errors.month && (
            <p id="month-error" className="mt-1 text-sm text-red-600" role="alert">
              {errors.month.message}
            </p>
          )}
        </div>
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className={buttonPrimary}
        aria-label="Submit gym membership application"
      >
        {isSubmitting ? "Submitting..." : "Submit Application"}
      </button>
    </form>
  );
}

