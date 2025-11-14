"use client";
import React, { useState } from "react";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

type Props = {
  alumniId: string;
  name: string;
  sapId: string;
  faculty: string;
  department: string;
  program: string;
  onSuccess?: () => void;
};

const schema = z.object({
  cnic: z.string().regex(/^[0-9]{5}-[0-9]{7}-[0-9]$/, "Invalid CNIC format (xxxxx-xxxxxxx-x)"),
  address: z.string().min(10, "Address is too short"),
  preference: z.enum(["Collect", "Deliver"], { message: "Select a preference" }),
  pictureName: z.string().min(1, "Profile picture is required"),
});

type FormVals = z.infer<typeof schema>;

const inputBase = "border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-theme-xs focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md";
const labelBase = "text-sm text-gray-600";
const buttonPrimary = "inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-60";

export function validateImage(file: File | undefined): { ok: boolean; error?: string } {
  if (!file) return { ok: false, error: "Select an image file" };
  const types = ["image/jpeg", "image/png", "image/gif"];
  if (!types.includes(file.type)) return { ok: false, error: "Only JPG, PNG or GIF allowed" };
  const max = 5 * 1024 * 1024;
  if (file.size > max) return { ok: false, error: "File must be ≤ 5MB" };
  return { ok: true };
}

export default function AlumniCardForm({ alumniId, faculty, department, program, onSuccess }: Props) {
  const [serverMsg, setServerMsg] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset, setValue } = useForm<FormVals>({
    resolver: zodResolver(schema),
    defaultValues: { preference: "Collect" },
    mode: "onChange",
  });

  

  const onSubmit = async (vals: FormVals) => {
    setServerMsg(null);
    setServerError(null);
    setFileError(null);
    try {
      const payload = {
        alumniId,
        cnicno: vals.cnic,
        cardaddress: vals.address,
        status: vals.preference,
        cardpicture: vals.pictureName.slice(0, 50),
      };
      const res = await fetch("/api/alumni-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || `Failed (${res.status})`);
      }
      setServerMsg("Application submitted.");
      reset();
      setPreviewUrl(null);
      try { localStorage.setItem("alumni-card-last", JSON.stringify(payload)); } catch {}
      onSuccess?.();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unexpected error";
      setServerError(msg);
    }
  };

  return (
    <form className="grid grid-cols-1 gap-4" onSubmit={handleSubmit(onSubmit)} aria-label="Alumni card form">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className={labelBase} htmlFor="faculty">Faculty</label>
          <input id="faculty" className={inputBase} value={faculty} readOnly aria-label="Faculty" />
        </div>
        <div>
          <label className={labelBase} htmlFor="department">Department</label>
          <input id="department" className={inputBase} value={department} readOnly aria-label="Department" />
        </div>
        <div>
          <label className={labelBase} htmlFor="program">Program</label>
          <input id="program" className={inputBase} value={program} readOnly aria-label="Program" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={labelBase} htmlFor="cnic">CNIC Number</label>
          <input id="cnic" {...register("cnic")} className={inputBase} placeholder="12345-1234567-1" aria-label="CNIC" />
          {errors.cnic && <p className="text-xs text-red-600 mt-1">{errors.cnic.message}</p>}
        </div>
        <div>
          <label className={labelBase} htmlFor="preference">Delivery Preference</label>
          <select id="preference" {...register("preference")} className={inputBase} aria-label="Delivery preference">
            <option value="Collect">Collect from Campus</option>
            <option value="Deliver">Get it Delivered to Address</option>
          </select>
          {errors.preference && <p className="text-xs text-red-600 mt-1">{errors.preference.message}</p>}
        </div>
      </div>

      <div>
        <label className={labelBase} htmlFor="address">Postal Address</label>
        <textarea id="address" {...register("address")} className={inputBase} rows={3} aria-label="Postal Address" />
        {errors.address && <p className="text-xs text-red-600 mt-1">{errors.address.message}</p>}
      </div>

      <div>
        <label className={labelBase} htmlFor="picture">Profile Picture</label>
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

      <div className="mt-2">
        {serverMsg && <div className="rounded-md border border-green-300 bg-green-50 px-3 py-2 text-green-700">{serverMsg}</div>}
        {serverError && <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-red-700">{serverError}</div>}
      </div>
    </form>
  );
}