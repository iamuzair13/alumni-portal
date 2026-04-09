"use client";

import React from "react";
import toast from "react-hot-toast";
import { useQueryClient } from "@tanstack/react-query";
import { cardStatusKey } from "@/app/queries/fetch-card-status";

type Props = {
  sapId: string;
};

const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png"];
const MAX_SIZE = 2 * 1024 * 1024; // 2MB

export default function UpdateAlumniCardPictureButton({ sapId }: Props) {
  const [uploading, setUploading] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const onPick = () => {
    if (uploading) return;
    fileRef.current?.click();
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("Only JPG and PNG images are allowed.");
      e.currentTarget.value = "";
      return;
    }
    if (file.size > MAX_SIZE) {
      toast.error("File size must be 2MB or less.");
      e.currentTarget.value = "";
      return;
    }

    setUploading(true);
    const loading = toast.loading("Updating alumni card picture...");
    try {
      const formData = new FormData();
      formData.append("image", file);

      const res = await fetch(`/api/alumni-cards/by-sap/${encodeURIComponent(sapId)}/image`, {
        method: "PATCH",
        body: formData,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || "Failed to update alumni card picture.");
      }

      toast.dismiss(loading);
      toast.success("Alumni card picture updated successfully.");
      await qc.invalidateQueries({ queryKey: cardStatusKey(sapId), exact: true });
      window.location.reload();
    } catch (err) {
      toast.dismiss(loading);
      toast.error(err instanceof Error ? err.message : "Failed to update alumni card picture.");
    } finally {
      setUploading(false);
      e.currentTarget.value = "";
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={onPick}
        disabled={uploading}
        className="inline-flex items-center justify-center px-3 py-2 rounded-lg text-white text-xs sm:text-sm font-medium bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
      >
        {uploading ? "Updating..." : "Update Alumni Card Picture"}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png"
        className="hidden"
        onChange={onFileChange}
        disabled={uploading}
      />
    </>
  );
}
