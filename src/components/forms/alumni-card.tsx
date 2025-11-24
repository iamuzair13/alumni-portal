"use client";
import React, { useState } from "react";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";

type Props = {
  alumniId: string;
  name: string;
  sapId: string;
  faculty: string;
  department: string;
  program: string;
};

const schema = z.object({
  cnic: z.string().regex(/^[0-9]{5}-[0-9]{7}-[0-9]$/, "Invalid CNIC format (xxxxx-xxxxxxx-x)"),
  address: z.string().optional(),
  preference: z.enum(["Collect", "Deliver"], { message: "Select a preference" }),
  pictureName: z.string().min(1, "Profile picture is required"),
}).refine((data) => {
  // Address is required only when preference is "Deliver"
  if (data.preference === "Deliver") {
    return data.address && data.address.trim().length >= 10;
  }
  return true;
}, {
  message: "Address is required and must be at least 10 characters when delivery is selected",
  path: ["address"], // This will show the error on the address field
});

type FormVals = z.infer<typeof schema>;

const inputBase = "px-4 py-3 pr-8 bg-[#f0f1f2] focus:bg-transparent text-black w-full text-sm border border-gray-200 outline-[#007bff] rounded-md transition-all";
const labelBase = "my-2 text-sm text-slate-900 font-medium block";
const buttonPrimary = "mt-12 px-5 py-2.5 text-[15px] font-medium w-full max-w-[130px] mx-auto block bg-[#007bff] hover:bg-[#006bff] text-white rounded-md transition-all cursor-pointer disabled:opacity-60";

export function validateImage(file: File | undefined): { ok: boolean; error?: string } {
  if (!file) return { ok: false, error: "Select an image file" };
  const types = ["image/jpeg", "image/png", "image/gif"];
  if (!types.includes(file.type)) return { ok: false, error: "Only JPG, PNG or GIF allowed" };
  const max = 5 * 1024 * 1024;
  if (file.size > max) return { ok: false, error: "File must be ≤ 5MB" };
  return { ok: true };
}

export default function AlumniCardForm({ alumniId, faculty, department, program, sapId }: Props) {
  const router = useRouter();
  const [fileError, setFileError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset, setValue, watch } = useForm<FormVals>({
    resolver: zodResolver(schema),
    defaultValues: { preference: "Collect" },
    mode: "onChange",
  });

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem("alumni-card-last");
      if (raw) {
        const last = JSON.parse(raw) as { cnicno?: string; cardaddress?: string; status?: string };
        if (last.cnicno) setValue("cnic", last.cnicno);
        if (last.cardaddress) setValue("address", last.cardaddress);
        if (last.status && (last.status === "Collect" || last.status === "Deliver")) setValue("preference", last.status as FormVals["preference"]);
      }
    } catch {}
  }, [setValue]);

  // Clear address when preference changes to "Collect"
  const preference = watch("preference");
  React.useEffect(() => {
    if (preference === "Collect") {
      setValue("address", "");
    }
  }, [preference, setValue]);

  

  const onSubmit = async (vals: FormVals) => {
    setFileError(null);
    try {
      const loadingToast = toast.loading("Submitting your alumni card application...");
      
      const payload = {
        alumniId,
        cnicno: vals.cnic,
        cardaddress: vals.preference === "Deliver" ? vals.address : "", // Only include address if delivery is selected
        status: vals.preference,
        cardpicture: vals.pictureName.slice(0, 50),
      };
      const res = await fetch("/api/alumni-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      
      toast.dismiss(loadingToast);
      
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        const errorMsg = j?.error || `Failed to submit application (${res.status})`;
        toast.error(errorMsg, {
          duration: 5000,
          style: {
            background: '#fee2e2',
            color: '#991b1b',
            padding: '16px',
            borderRadius: '8px',
          },
        });
        throw new Error(errorMsg);
      }
      
      toast.success("Alumni card application submitted successfully!", {
        duration: 4000,
        style: {
          background: '#d1fae5',
          color: '#065f46',
          padding: '16px',
          borderRadius: '8px',
        },
      });
      
      reset();
      setPreviewUrl(null);
      try { localStorage.setItem("alumni-card-last", JSON.stringify(payload)); } catch {}
      
      // Navigate back to profile page
      setTimeout(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const sapIdParam = urlParams.get('sapid') || sapId;
        if (sapIdParam) {
          router.push(`/alumni-profile?sapid=${encodeURIComponent(sapIdParam)}`);
        } else {
          router.push('/alumni-profile');
        }
        router.refresh();
      }, 1500);
    } catch {
      // Error already handled with toast above
    }
  };

  return (
    <>
    <form className="max-w-4xl mx-auto mt-4 " onSubmit={handleSubmit(onSubmit)} aria-label="Alumni card form">
      <div className="grid sm:grid-cols-2 gap-6">
        <div>
          <label className={labelBase} htmlFor="faculty">Faculty</label>
          <div className="relative flex items-center">
            <input id="faculty" className={inputBase} value={faculty} readOnly aria-label="Faculty" />
          </div>
        </div>
        <div>
          <label className={labelBase} htmlFor="department">Department</label>
          <div className="relative flex items-center">
            <input id="department" className={inputBase} value={department} readOnly aria-label="Department" />
          </div>
        </div>
        <div>
          <label className={labelBase} htmlFor="program">Program</label>
          <div className="relative flex items-center">
            <input id="program" className={inputBase} value={program} readOnly aria-label="Program" />
          </div>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-6">
        <div>
          <label className={labelBase} htmlFor="cnic">CNIC Number</label>
          <div className="relative flex items-center">
            <input id="cnic" {...register("cnic")} className={inputBase} placeholder="12345-1234567-1" aria-label="CNIC" />
          </div>
          {errors.cnic && <p className="text-xs text-red-600 mt-1">{errors.cnic.message}</p>}
        </div>
        <div>
          <label className={labelBase} htmlFor="preference">Delivery Preference</label>
          <div className="relative flex items-center">
            <select id="preference" {...register("preference")} className={inputBase} aria-label="Delivery preference">
              <option value="Collect">Collect from Campus</option>
              <option value="Deliver">Get it Delivered to Address</option>
            </select>
          </div>
          {errors.preference && <p className="text-xs text-red-600 mt-1">{errors.preference.message}</p>}
        </div>
      </div>

      <div>
        <label className={labelBase} htmlFor="address">Postal Address</label>
        <div className="relative flex items-center mt-4">
          <textarea
            id="address"
            {...register("address")}
            className={`${inputBase} ${watch("preference") === "Collect" ? "bg-gray-100 opacity-60 cursor-not-allowed" : ""}`}
            rows={3}
            aria-label="Postal Address"
            aria-disabled={watch("preference") === "Collect"}
            disabled={watch("preference") === "Collect"}
          />
        </div>
        {watch("preference") === "Collect" && (
          <p className="text-xs text-gray-500 mt-1">Collect you card from campus</p>
        )}
        {errors.address && <p className="text-xs text-red-600 mt-1">{errors.address.message}</p>}
      </div>

      <div>
        <label className={labelBase} htmlFor="picture">
          Profile Picture
          <span className="text-red-600 ml-1">*</span>
          <span className="ml-2 text-xs text-slate-500">Image must be headshot and blue background</span>
        </label>
        <div className="relative flex items-center">
          <input
            id="picture"
            type="file"
            accept="image/jpeg,image/png,image/gif"
            className={inputBase}
            aria-label="Profile picture"
            onChange={(e) => {
              const file = e.target.files?.[0];
              const v = validateImage(file);
              if (!v.ok) {
                setFileError(v.error || "Invalid file");
                setPreviewUrl(null);
                setValue("pictureName", "");
                return;
              }
              setFileError(null);
              setPreviewUrl(file ? URL.createObjectURL(file) : null);
              setValue("pictureName", file?.name || "");
            }}
            disabled={isSubmitting}
          />
        </div>
        <input type="hidden" {...register("pictureName")} name="pictureName" />
        {fileError && <p className="text-xs text-red-600 mt-1">{fileError}</p>}
        {errors.pictureName && <p className="text-xs text-red-600 mt-1">{errors.pictureName.message}</p>}
        {previewUrl && (
          <div className="mt-3">
            <Image src={previewUrl} alt="Profile preview" width={112} height={112} className="w-28 h-28 rounded-md object-cover border border-gray-200" />
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-2">
        <button type="submit" className={buttonPrimary} disabled={isSubmitting} aria-busy={isSubmitting} aria-label="Submit application">
          {isSubmitting ? "Submitting..." : "Submit"}
        </button>
      </div>
    </form>
    
</>
  );
}