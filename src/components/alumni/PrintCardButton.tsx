"use client";

import { DownloadIcon, EyeIcon } from "@/icons";
import { useState } from "react";
import toast from "react-hot-toast";
import { useQueryClient } from "@tanstack/react-query";
import { cardStatusKey } from "@/app/queries/fetch-card-status";
import { Modal } from "@/components/ui/modal";

type Props = {
  sapId: string;
  studentName: string;
  registrationNo?: string | null;
};

export default function PrintCardButton({ sapId, registrationNo }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [imageData, setImageData] = useState<{
    url: string;
    filename: string;
    error?: string;
  } | null>(null);
  const queryClient = useQueryClient();

  const handlePreview = async () => {
    if (isLoading) return;

    setIsLoading(true);
    const loadingToast = toast.loading("Loading image...");

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
        setImageData({ url: "", filename: "", error: "Image Does not found" });
        setShowPreview(true);
        setIsLoading(false);
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
              setImageData({ url: "", filename: "", error: "Image Does not found" });
              setShowPreview(true);
              toast.dismiss(loadingToast);
              toast.error("Image not found");
              setIsLoading(false);
              return;
            }
          } catch {
            setImageData({ url: "", filename: "", error: "Image Does not found" });
            setShowPreview(true);
            toast.dismiss(loadingToast);
            toast.error("Image not found");
            setIsLoading(false);
            return;
          }
        } else {
          setImageData({ url: "", filename: "", error: "Image Does not found" });
          setShowPreview(true);
          toast.dismiss(loadingToast);
          toast.error("Image not found");
          setIsLoading(false);
          return;
        }
      }

      const blob = await imageRes.blob();
      const blobUrl = window.URL.createObjectURL(blob);

      // Use filename from API (which already uses registration number or SAP ID)
      const filename = data.filename || ((registrationNo && String(registrationNo).trim() !== "") 
        ? `${String(registrationNo).trim()}.jpg`
        : `${sapId}.jpg`);

      setImageData({ url: blobUrl, filename });
      setShowPreview(true);
      toast.dismiss(loadingToast);
      
    } catch (err) {
      toast.dismiss(loadingToast);
      const errorMsg = err instanceof Error ? err.message : "Failed to load image";
      setImageData({ url: "", filename: "", error: errorMsg });
      setShowPreview(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!imageData || imageData.error) return;

    const loadingToast = toast.loading("Downloading image...");

    try {
      // Create download link and trigger download
      const link = document.createElement("a");
      link.href = imageData.url;
      link.download = imageData.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.dismiss(loadingToast);
      toast.success("Image downloaded successfully");
      
      // Invalidate card status query to refresh the card image in alumni profile
      await queryClient.invalidateQueries({ queryKey: cardStatusKey(sapId) });
    } catch (err) {
      toast.dismiss(loadingToast);
      const errorMsg = err instanceof Error ? err.message : "Failed to download image";
      toast.error(errorMsg);
    }
  };

  const handleClosePreview = () => {
    setShowPreview(false);
    if (imageData?.url && !imageData.error) {
      window.URL.revokeObjectURL(imageData.url);
    }
    setImageData(null);
  };

  return (
    <>
      <button
        type="button"
        onClick={handlePreview}
        disabled={isLoading}
        className="p-2 rounded-lg text-gray-500 dark:text-gray-400 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-gray-700/50 disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Preview Card Image"
        title="Preview Card Image"
      >
        <DownloadIcon className="h-7 w-7" />
      </button>

      <Modal
        isOpen={showPreview}
        onClose={handleClosePreview}
        showCloseButton={true}
        className="max-w-4xl"
      >
        <div className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Card Image Preview
          </h2>
          
          <div className="flex flex-col items-center space-y-4">
            {imageData?.error ? (
              <div className="flex flex-col items-center justify-center py-12 px-6 bg-gray-50 dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
                <div className="text-red-500 text-6xl mb-4">⚠️</div>
                <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
                  {imageData.error}
                </p>
              </div>
            ) : imageData?.url ? (
              <div className="relative">
                <img
                  src={imageData.url}
                  alt="Card Preview"
                  className="max-w-full max-h-96 object-contain rounded-lg shadow-lg"
                />
              </div>
            ) : (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              </div>
            )}
            
            {imageData && !imageData.error && (
              <div className="flex items-center space-x-4">
                <button
                  type="button"
                  onClick={handleDownload}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors duration-200"
                >
                  <DownloadIcon className="h-5 w-5 mr-2" />
                  Download Image
                </button>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Filename: {imageData.filename}
                </span>
              </div>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}

