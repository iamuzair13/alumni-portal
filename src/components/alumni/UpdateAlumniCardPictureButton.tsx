"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

type Props = {
  sapId: string;
};

const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png"];
const MAX_SIZE = 5 * 1024 * 1024;

function validateImage(file: File | null): string | null {
  if (!file) return "Please choose an image file.";
  if (!ALLOWED_TYPES.includes(file.type)) return "Only JPG, JPEG, and PNG images are allowed.";
  if (file.size > MAX_SIZE) return "Image size must be 5MB or less.";
  return null;
}

export default function UpdateAlumniCardPictureButton({ sapId }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [uploading, setUploading] = useState(false);

  const onOpenPicker = () => {
    if (uploading) return;
    fileInputRef.current?.click();
  };

  const onFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.currentTarget.value = "";

    const validationError = validateImage(file);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    const formData = new FormData();
    formData.append("image", file as File);

    setUploading(true);
    const loading = toast.loading("Updating alumni card picture...");
    try {
      const res = await fetch(`/api/alumni-cards/by-sap/${encodeURIComponent(sapId)}/image`, {
        method: "PATCH",
        body: formData,
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || `Failed (${res.status})`);
      }

      toast.dismiss(loading);
      toast.success("Alumni card picture updated successfully.");
      router.refresh();
    } catch (err) {
      toast.dismiss(loading);
      toast.error(err instanceof Error ? err.message : "Failed to update card picture.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png"
        className="hidden"
        onChange={onFileChange}
      />
      <button
        type="button"
        onClick={onOpenPicker}
        disabled={uploading}
        className={`inline-flex items-center justify-center px-3 sm:px-4 py-2 sm:py-2.5 w-full rounded-lg text-white text-xs sm:text-sm font-medium transition-colors ${
          uploading
            ? "bg-gray-300 cursor-not-allowed"
            : "bg-[#183D32] hover:bg-[#0e241d] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#183D32]"
        }`}
      >
        {uploading ? "Updating..." : "Update Alumni Card Picture"}
      </button>
    </>
  );
}
