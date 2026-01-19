"use client";

import { DownloadIcon } from "@/icons";
import { useState } from "react";
import toast from "react-hot-toast";
import { useQueryClient } from "@tanstack/react-query";
import { cardStatusKey } from "@/app/queries/fetch-card-status";

type Props = {
  sapId: string;
  studentName: string;
  registrationNo?: string | null;
};

export default function PrintCardButton({ sapId, registrationNo }: Props) {
  const [isDownloading, setIsDownloading] = useState(false);
  const queryClient = useQueryClient();

  const handleDownload = async () => {
    if (isDownloading) return;

    setIsDownloading(true);
    const loadingToast = toast.loading("Downloading image...");

    try {
      // Fetch image data from API
      const res = await fetch(`/api/alumni-cards/by-sap/${encodeURIComponent(sapId)}/download-image`, {
        cache: "no-store",
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Failed to fetch image data" }));
        throw new Error(errorData.error || "Failed to fetch image data");
      }

      const data = await res.json();
      
      if (!data.imageName) {
        toast.dismiss(loadingToast);
        toast.error("Image not found");
        setIsDownloading(false);
        return;
      }

      // Normalize image path
      let imageUrl = String(data.imageName).trim();
      
      // Remove any old path references
      imageUrl = imageUrl.replace(/\/tumbnail\//g, "/");
      imageUrl = imageUrl.replace(/\/alumni-images\/thumbnail\//g, "/");
      imageUrl = imageUrl.replace(/\/alumni-images\/card\//g, "/");
      
      // Construct proper path
      if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
        // Full URL - use as-is
      } else if (imageUrl.startsWith("/")) {
        // Already has leading slash
        if (!imageUrl.startsWith("/images/")) {
          // Extract just the filename
          const filename = imageUrl.split("/").pop() || imageUrl.replace(/^\//, "");
          imageUrl = `/images/${filename}`;
        }
      } else {
        // Just a filename - prepend /images/
        imageUrl = `/images/${imageUrl}`;
      }

      // Fetch the image
      let imageRes;
      try {
        imageRes = await fetch(imageUrl, { cache: "no-store" });
      } catch (fetchError) {
        throw new Error(`Failed to fetch image: ${fetchError instanceof Error ? fetchError.message : "Unknown error"}`);
      }
      
      if (!imageRes.ok) {
        // Try alternative path if the first one fails
        const filename = imageUrl.split("/").pop() || imageUrl;
        const alternativeUrl = `/images/${filename}`;
        
        if (alternativeUrl !== imageUrl) {
          try {
            imageRes = await fetch(alternativeUrl, { cache: "no-store" });
            if (imageRes.ok) {
              imageUrl = alternativeUrl;
            } else {
              throw new Error(`Image not found at ${imageUrl} or ${alternativeUrl}`);
            }
          } catch {
            throw new Error(`Image not found at ${imageUrl} or ${alternativeUrl}`);
          }
        } else {
          throw new Error(`Failed to fetch image: ${imageRes.status} ${imageRes.statusText}`);
        }
      }

      const blob = await imageRes.blob();

      // Use filename from API (which already uses registration number or SAP ID)
      const filename = data.filename || ((registrationNo && String(registrationNo).trim() !== "") 
        ? `${String(registrationNo).trim()}.jpg`
        : `${sapId}.jpg`);

      // Create download link and trigger download
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.dismiss(loadingToast);
      toast.success("Image downloaded successfully");
      
      // Invalidate card status query to refresh the card image in alumni profile
      await queryClient.invalidateQueries({ queryKey: cardStatusKey(sapId) });
    } catch (err) {
      toast.dismiss(loadingToast);
      const errorMsg = err instanceof Error ? err.message : "Failed to download image";
      toast.error(errorMsg);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={isDownloading}
      className="p-2 rounded-lg text-gray-500 dark:text-gray-400 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-gray-700/50 disabled:opacity-50 disabled:cursor-not-allowed"
      aria-label="Download Card Image"
      title="Download Card Image"
    >
      <DownloadIcon className="h-7 w-7" />
    </button>
  );
}

