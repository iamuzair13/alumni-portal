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
};

const schema = z.object({
  pictureName: z.string().min(1, "Profile picture is required"),
  confirmation: z.boolean().refine((val) => val === true, {
    message: "You must confirm that the information is correct",
  }),
  comment: z.string().optional(),
  addressPreference: z.enum(["Collect", "Deliver"], {
    message: "Please select an address preference",
  }),
  address: z.string().optional(),
}).refine((data) => {
  // Address is required only when preference is "Deliver"
  if (data.addressPreference === "Deliver") {
    return data.address && data.address.trim().length >= 10;
  }
  return true;
}, {
  message: "Address is required and must be at least 10 characters when delivery is selected",
  path: ["address"],
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

export default function AlumniCardForm({ alumniId, name, faculty, department, sapId }: Props) {
  const router = useRouter();
  const [fileError, setFileError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset, setValue, watch } = useForm<FormVals>({
    resolver: zodResolver(schema),
    defaultValues: { confirmation: false, comment: "", addressPreference: "Collect", address: "" },
    mode: "onChange",
  });

  // Watch address preference to show/hide address field
  const addressPreference = watch("addressPreference");

  // Clear address when preference changes to "Collect"
  React.useEffect(() => {
    if (addressPreference === "Collect") {
      setValue("address", "");
    }
  }, [addressPreference, setValue]);

  // Calculate validity date (3 years from application date)
  const validityDate = new Date();
  validityDate.setFullYear(validityDate.getFullYear() + 3);
  const validityDateStr = validityDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const validityDateISO = validityDate.toISOString().split('T')[0]; // Format: YYYY-MM-DD

  

  const onSubmit = async (vals: FormVals) => {
    setFileError(null);
    try {
      if (!selectedFile) {
        setFileError("Profile picture is required");
        return;
      }
      const loadingToast = toast.loading("Submitting your alumni card application...");
      
      const formData = new FormData();
      formData.append("alumniId", String(alumniId));
      formData.append("sapId", String(sapId || ""));
      formData.append("image", selectedFile);
      if (vals.comment) {
        formData.append("comment", vals.comment);
      }
      // Save address preference: if "Deliver" is selected, save the address, otherwise save "Collect from Campus"
      if (vals.addressPreference === "Deliver" && vals.address) {
        formData.append("cardaddress", vals.address);
      } else {
        formData.append("cardaddress", "Collect from Campus");
      }
      // Save validity date (3 years from application date)
      formData.append("validity_date", validityDateISO);

      const res = await fetch("/api/alumni-cards", {
        method: "POST",
        body: formData,
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
      setSelectedFile(null);
      setValue("pictureName", "");
      setValue("confirmation", false);
      setValue("comment", "");
      setValue("addressPreference", "Collect");
      setValue("address", "");
      
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
          <label className={labelBase} htmlFor="name">Name</label>
          <div className="relative flex items-center">
            <input id="name" className={inputBase} value={name} readOnly aria-label="Name" />
          </div>
        </div>
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
          <label className={labelBase} htmlFor="validity">Validity</label>
          <div className="relative flex items-center">
            <input id="validity" type="date" className={inputBase} value={validityDateISO} readOnly aria-label="Validity" />
          </div>
          <p className="text-xs text-gray-500 mt-1">Card will be valid until {validityDateStr} (3 years from application date)</p>
        </div>
      </div>

      <div>
        <label className={labelBase} htmlFor="picture">
          Image
          <span className="text-red-600 ml-1">*</span>
          <span className="ml-2 text-xs text-slate-500">Please Upload Passport size image</span>
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
                setSelectedFile(null);
                return;
              }
              setFileError(null);
              setPreviewUrl(file ? URL.createObjectURL(file) : null);
              setValue("pictureName", file?.name || "");
              setSelectedFile(file ?? null);
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

      <div>
        <label className={labelBase} htmlFor="addressPreference">Address Preference</label>
        <div className="relative flex items-center">
          <select id="addressPreference" {...register("addressPreference")} className={inputBase} aria-label="Address preference">
            <option value="Collect">Collect from Campus</option>
            <option value="Deliver">Deliver to my address</option>
          </select>
        </div>
        {errors.addressPreference && <p className="text-xs text-red-600 mt-1">{errors.addressPreference.message}</p>}
      </div>

      {addressPreference === "Deliver" && (
        <div>
          <label className={labelBase} htmlFor="address">
            Delivery Address
            <span className="text-red-600 ml-1">*</span>
          </label>
          <div className="relative flex items-center mt-4">
            <textarea
              id="address"
              {...register("address")}
              className={inputBase}
              rows={3}
              placeholder="Enter your complete delivery address..."
              aria-label="Delivery address"
            />
          </div>
          {errors.address && <p className="text-xs text-red-600 mt-1">{errors.address.message}</p>}
        </div>
      )}

      <div>
        <label className={labelBase} htmlFor="comment">Please mention if there is any mistake in data</label>
        <div className="relative flex items-center mt-4">
          <textarea
            id="comment"
            {...register("comment")}
            className={inputBase}
            rows={4}
            placeholder="If you notice any mistakes in your information, please mention them here..."
            aria-label="Comments about data mistakes"
          />
        </div>
        {errors.comment && <p className="text-xs text-red-600 mt-1">{errors.comment.message}</p>}
      </div>

      <div className="mt-6">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            {...register("confirmation")}
            className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            aria-label="Confirm information is correct"
          />
          <span className="text-sm text-slate-900">
            I confirm that the information is correct
            <span className="text-red-600 ml-1">*</span>
          </span>
        </label>
        {errors.confirmation && <p className="text-xs text-red-600 mt-1 ml-7">{errors.confirmation.message}</p>}
      </div>

      <div className="flex items-center justify-end gap-2 mt-6">
        <button type="submit" className={buttonPrimary} disabled={isSubmitting} aria-busy={isSubmitting} aria-label="Submit application">
          {isSubmitting ? "Submitting..." : "Submit"}
        </button>
      </div>
    </form>
    
</>
  );
}