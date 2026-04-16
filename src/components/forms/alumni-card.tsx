"use client";
import React, { useState, useEffect } from "react";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import PassportPhotoCropModal from "@/components/ui/PassportPhotoCropModal";

type Props = {
  alumniId: string;
  name: string;
  sapId: string;
  faculty: string;
  department: string;
  cnicPassport?: string;
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
  deliveryCity: z.string().optional(),
  deliveryStreetNo: z.string().optional(),
  deliveryHouseNo: z.string().optional(),
}).refine((data) => {
  if (data.addressPreference !== "Deliver") return true;
  const city = String(data.deliveryCity ?? "").trim();
  const street = String(data.deliveryStreetNo ?? "").trim();
  const house = String(data.deliveryHouseNo ?? "").trim();
  if (!city || !street || !house) return false;
  // Must match API: full cardaddress string ≥ 10 chars (composed from structured fields).
  const composed = `${house}, ${street}, ${city}`;
  return composed.length >= 10;
}, {
  message: "City, street number, and house number are required. The combined address must be at least 10 characters.",
  path: ["deliveryCity"],
});

type FormVals = z.infer<typeof schema>;

const inputBase = "px-4 py-3 pr-8 bg-[#f0f1f2] focus:bg-transparent text-black w-full text-sm border border-gray-200 outline-[#007bff] rounded-md transition-all";
const labelBase = "my-2 text-sm text-slate-900 font-medium block";
const buttonPrimary = "mt-12 px-5 py-2.5 text-[15px] font-medium w-full max-w-[130px] mx-auto block bg-[#007bff] hover:bg-[#006bff] text-white rounded-md transition-all cursor-pointer disabled:opacity-60";

export function validateImage(file: File | undefined): { ok: boolean; error?: string } {
  if (!file) return { ok: false, error: "Select an image file" };
  const types = ["image/jpeg", "image/png", "image/gif"];
  if (!types.includes(file.type)) return { ok: false, error: "Only JPG, PNG or GIF allowed" };
  const min = 50 * 1024;
  if (file.size < min) return { ok: false, error: "Image must be at least 50KB" };
  const max = 5 * 1024 * 1024;
  if (file.size > max) return { ok: false, error: "File must be ≤ 5MB" };
  return { ok: true };
}

async function validatePassportLikeImage(file: File): Promise<{ ok: boolean; error?: string }> {
  try {
    const url = URL.createObjectURL(file);
    try {
      const img = new window.Image();
      img.decoding = "async";
      const loaded = new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Failed to load image"));
      });
      img.src = url;
      await loaded;

      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;

      if (!w || !h) return { ok: false, error: "Invalid image" };

      // Passport photo is typically 35x45mm (w/h ≈ 0.78). Allow a small tolerance.
      const ratio = w / h;
      if (ratio < 0.72 || ratio > 0.82) {
        return { ok: false, error: "Image must be passport size (portrait)" };
      }

      // Basic resolution guard for “high resolution”.
      if (w < 300 || h < 400) {
        return { ok: false, error: "Image resolution is too low. Please upload a clearer photo." };
      }

      return { ok: true };
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch {
    // If we cannot read dimensions, don't block the upload.
    return { ok: true };
  }
}

export default function AlumniCardForm({ alumniId, name, faculty, department, sapId, cnicPassport = "" }: Props) {
  const router = useRouter();
  const [fileError, setFileError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showCropModal, setShowCropModal] = useState(false);
  const [pendingCropFile, setPendingCropFile] = useState<File | null>(null);
  const [fetchedName, setFetchedName] = useState(name);
  const [fetchedFaculty, setFetchedFaculty] = useState(faculty);
  const [fetchedDepartment, setFetchedDepartment] = useState(department);
  const [fetchedCnicPassport, setFetchedCnicPassport] = useState<string>("");
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset, setValue, watch } = useForm<FormVals>({
    resolver: zodResolver(schema),
    defaultValues: {
      confirmation: false,
      comment: "",
      addressPreference: "Collect",
      deliveryCity: "",
      deliveryStreetNo: "",
      deliveryHouseNo: "",
    },
    mode: "onChange",
  });

  // Watch address preference to show/hide address field
  const addressPreference = watch("addressPreference");

  const alumniDetailsQuery = useQuery<any, Error>({
    queryKey: ["alumni", "full-details", sapId],
    enabled: !!sapId && sapId.trim() !== "",
    queryFn: async ({ signal }) => {
      const res = await fetch(`/api/alumni/${encodeURIComponent(sapId)}/full-details`, {
        signal,
        headers: { accept: "application/json" },
      });
      if (!res.ok) {
        throw new Error("Failed to load alumni details");
      }
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    refetchOnMount: false,
  });

  // Auto-fetch alumni details when component mounts or sapId changes
  useEffect(() => {
    if (!alumniDetailsQuery.data) return;
    const alumni = (alumniDetailsQuery.data as any)?.item;
    if (alumni) {
      if (alumni.alumniname) setFetchedName(alumni.alumniname);
      if (alumni.facultyname) setFetchedFaculty(alumni.facultyname);
      if (alumni.departmentname) setFetchedDepartment(alumni.departmentname);
      const cnicValue =
        (alumni as { cnicpassport?: unknown; cnicPassport?: unknown; cnicOrPassport?: unknown }).cnicpassport ??
        (alumni as { cnicpassport?: unknown; cnicPassport?: unknown; cnicOrPassport?: unknown }).cnicPassport ??
        (alumni as { cnicpassport?: unknown; cnicPassport?: unknown; cnicOrPassport?: unknown }).cnicOrPassport ??
        "";
      setFetchedCnicPassport(String(cnicValue ?? "").trim());
    }
  }, [alumniDetailsQuery.data]);

  // Clear address fields when preference changes to "Collect"
  React.useEffect(() => {
    if (addressPreference === "Collect") {
      setValue("deliveryCity", "");
      setValue("deliveryStreetNo", "");
      setValue("deliveryHouseNo", "");
    }
  }, [addressPreference, setValue]);

  // Calculate validity date (3 years from application date)
  const validityDate = new Date();
  validityDate.setFullYear(validityDate.getFullYear() + 3);
  const validityDateStr = validityDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const validityDateISO = validityDate.toISOString().split('T')[0]; // Format: YYYY-MM-DD
  const cnicFromQuery = (() => {
    const alumni = (alumniDetailsQuery.data as any)?.item;
    if (!alumni) return "";
    const cnicValue =
      (alumni as { cnicpassport?: unknown; cnicPassport?: unknown; cnicOrPassport?: unknown }).cnicpassport ??
      (alumni as { cnicpassport?: unknown; cnicPassport?: unknown; cnicOrPassport?: unknown }).cnicPassport ??
      (alumni as { cnicpassport?: unknown; cnicPassport?: unknown; cnicOrPassport?: unknown }).cnicOrPassport ??
      "";
    return String(cnicValue ?? "").trim();
  })();
  const cnicDisplayValue = cnicFromQuery || fetchedCnicPassport || String(cnicPassport || "").trim();

  

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
      // cardaddress = full line for mailing; structured columns stored separately
      if (vals.addressPreference === "Deliver") {
        const city = String(vals.deliveryCity ?? "").trim();
        const street = String(vals.deliveryStreetNo ?? "").trim();
        const house = String(vals.deliveryHouseNo ?? "").trim();
        formData.append("cardaddress", `${house}, ${street}, ${city}`);
        formData.append("delivery_city", city);
        formData.append("delivery_street_no", street);
        formData.append("delivery_house_no", house);
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
      setValue("deliveryCity", "");
      setValue("deliveryStreetNo", "");
      setValue("deliveryHouseNo", "");
      
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
    <PassportPhotoCropModal
      isOpen={showCropModal}
      file={pendingCropFile}
      onClose={() => {
        setShowCropModal(false);
        setPendingCropFile(null);
      }}
      onCropped={(cropped) => {
        setShowCropModal(false);
        setPendingCropFile(null);
        setFileError(null);
        setPreviewUrl(cropped ? URL.createObjectURL(cropped) : null);
        setValue("pictureName", cropped?.name || "");
        setSelectedFile(cropped ?? null);
      }}
      title="Edit Passport Photo"
    />
    <form className="max-w-4xl mx-auto  " onSubmit={handleSubmit(onSubmit)} aria-label="Alumni card form">
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className={labelBase} htmlFor="name">Name</label>
          <div className="relative flex items-center">
            <input id="name" className={inputBase} value={fetchedName || name} readOnly aria-label="Name" />
          </div>
        </div>
        <div>
          <label className={labelBase} htmlFor="faculty">Faculty</label>
          <div className="relative flex items-center">
            <input id="faculty" className={inputBase} value={fetchedFaculty || faculty} readOnly aria-label="Faculty" />
          </div>
        </div>
        <div>
          <label className={labelBase} htmlFor="department">Department</label>
          <div className="relative flex items-center">
            <input id="department" className={inputBase} value={fetchedDepartment || department} readOnly aria-label="Department" />
          </div>
        </div>
        <div>
          <label className={labelBase} htmlFor="validity">Validity</label>
          <div className="relative flex items-center">
            <input id="validity" type="date" className={inputBase} value={validityDateISO} readOnly aria-label="Validity" />
          </div>
          <p className="text-xs text-gray-500 mt-1">Card will be valid until {validityDateStr} (3 years from application date)</p>
        </div>
        <div>
          <label className={labelBase} htmlFor="cnic">CNIC/Passport</label>
          <div className="relative flex items-center">
            <input id="cnic" className={inputBase} value={cnicDisplayValue} readOnly aria-label="CNIC/Passport" />
          </div>
          <p className="text-xs text-blue-700 mt-1">Please make sure that your CNIC/Passport is correct. It will be used for verification and Alumni card issuance.</p>
        </div>
      </div>

      <div>
        <label className={labelBase} htmlFor="picture">
          Image
          <span className="text-red-600 ml-1">*</span>
          <span className="ml-2 text-xs text-red-500">Casual pictures are not accepted. Image must be passport size and headshot with blue or white background. Image size must be high resolution and 50kb minimum </span>
        </label>
        <div className="relative flex items-center">
          <input
            id="picture"
            type="file"
            accept="image/jpeg,image/png,image/gif"
            className={inputBase}
            aria-label="Profile picture"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              const v = validateImage(file);
              if (!v.ok) {
                setFileError(v.error || "Invalid file");
                setPreviewUrl(null);
                setValue("pictureName", "");
                setSelectedFile(null);
                return;
              }

              if (file) {
                setPendingCropFile(file);
                setShowCropModal(true);
              }
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
        <label className={labelBase} htmlFor="addressPreference">Delivery Preference</label>
        <div className="relative flex items-center">
          <select id="addressPreference" {...register("addressPreference")} className={inputBase} aria-label="Address preference">
            <option value="Collect">Collect from Campus</option>
            <option value="Deliver">Deliver to my below address</option>
          </select>
        </div>
        {errors.addressPreference && <p className="text-xs text-red-600 mt-1">{errors.addressPreference.message}</p>}
      </div>

      {addressPreference === "Deliver" && (
        <div className="grid sm:grid-cols-2 gap-4 sm:gap-6">
          
          <div>
            <div className={labelBase}>Delivery Address</div>
            <p className="text-xs text-gray-600 mb-2">Where the physical card should be sent (house, street, city).</p>
           
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <label className="text-xs font-medium text-slate-800 block mt-2 sm:mt-0" htmlFor="deliveryCity">
                  City<span className="text-red-600 ml-0.5">*</span>
                </label>
                <input
                  id="deliveryCity"
                  type="text"
                  {...register("deliveryCity")}
                  className={`${inputBase} mt-1`}
                  placeholder="City"
                  aria-label="Delivery city"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs font-medium text-slate-800 block mt-2 sm:mt-0" htmlFor="deliveryStreetNo">
                  Street No.<span className="text-red-600 ml-0.5">*</span>
                </label>
                <input
                  id="deliveryStreetNo"
                  type="text"
                  {...register("deliveryStreetNo")}
                  className={`${inputBase} mt-1`}
                  placeholder="Street number"
                  aria-label="Street number"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs font-medium text-slate-800 block mt-2 sm:mt-0" htmlFor="deliveryHouseNo">
                  House Number<span className="text-red-600 ml-0.5">*</span>
                </label>
                <input
                  id="deliveryHouseNo"
                  type="text"
                  {...register("deliveryHouseNo")}
                  className={`${inputBase} mt-1`}
                  placeholder="House number"
                  aria-label="House number"
                />
              </div>
            </div>
            {(errors.deliveryCity || errors.deliveryStreetNo || errors.deliveryHouseNo) && (
              <p className="text-xs text-red-600 mt-1">
                {errors.deliveryCity?.message ||
                  errors.deliveryStreetNo?.message ||
                  errors.deliveryHouseNo?.message ||
                  "City, street number, and house number are required."}
              </p>
            )}
          </div>
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