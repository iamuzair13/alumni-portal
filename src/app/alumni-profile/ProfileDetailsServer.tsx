"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { useProgress } from "@bprogress/react";
import { safeText, formatPhone } from "@/lib/alumniProfile";
import toast from "react-hot-toast";

type Props = {
  name: string;
  avatar: string;
  sapId: string;
  contact: string;
  faculty: string;
  dept: string;
  program: string;
};

export default function ProfileDetailsServer({ name, avatar: initialAvatar, sapId, contact, faculty, dept, program }: Props) {
  const { start, stop } = useProgress();
  const [avatar, setAvatar] = useState(initialAvatar);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Show progress on mount
    start();
    // Stop progress after a short delay to allow content to render
    const timer = setTimeout(() => {
      stop();
    }, 300);

    return () => {
      clearTimeout(timer);
      stop();
    };
  }, [start, stop]);

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.", {
        duration: 5000,
        style: {
          background: '#fee2e2',
          color: '#991b1b',
          padding: '16px',
          borderRadius: '8px',
        },
      });
      return;
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      toast.error("File size exceeds 5MB limit. Please choose a smaller image.", {
        duration: 5000,
        style: {
          background: '#fee2e2',
          color: '#991b1b',
          padding: '16px',
          borderRadius: '8px',
        },
      });
      return;
    }

    setUploading(true);
    const loadingToast = toast.loading("Uploading profile picture...");

    try {
      const formData = new FormData();
      formData.append("image", file);

      const res = await fetch(`/api/alumni/${encodeURIComponent(sapId)}/profile-picture`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      toast.dismiss(loadingToast);

      if (!res.ok) {
        const errorMsg = data?.error || "Failed to upload profile picture. Please try again.";
        toast.error(errorMsg, {
          duration: 5000,
          style: {
            background: '#fee2e2',
            color: '#991b1b',
            padding: '16px',
            borderRadius: '8px',
          },
        });
        return;
      }

      // Update avatar with new image path (add cache busting)
      const newImagePath = data.imagePath + `?t=${Date.now()}`;
      setAvatar(newImagePath);

      toast.success("Profile picture updated successfully!", {
        duration: 4000,
        style: {
          background: '#d1fae5',
          color: '#065f46',
          padding: '16px',
          borderRadius: '8px',
        },
      });

      // Refresh the page after a short delay to show the updated image
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err) {
      toast.dismiss(loadingToast);
      const errorMsg = err instanceof Error ? err.message : "An unexpected error occurred. Please try again.";
      toast.error(errorMsg, {
        duration: 5000,
        style: {
          background: '#fee2e2',
          color: '#991b1b',
          padding: '16px',
          borderRadius: '8px',
        },
      });
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="bg-white flex justify-between border rounded-lg p-6 pt-0">
      <div>
        <div className="flex flex-col items-start sm:flex-row sm:items-end">
          <div className="relative w-32 h-32 -mt-16 sm:-mt-10 group">
            <div className="w-32 h-32 rounded-full border-4 border-red-600 bg-gray-100 overflow-hidden">
              <Image
                src={avatar}
                alt={name || "alumni"}
                width={128}
                height={128}
                sizes="(max-width: 640px) 8rem, (max-width: 768px) 8rem, 8rem"
                className="w-full h-full object-cover"
              />
            </div>
            {sapId && (
              <button
                type="button"
                onClick={handleImageClick}
                disabled={uploading}
                className="absolute bottom-0 right-0 w-10 h-10 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-full flex items-center justify-center shadow-lg transition-all duration-200 group-hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                aria-label="Upload profile picture"
                title="Upload profile picture"
              >
              {uploading ? (
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              )}
              </button>
            )}
            {sapId && (
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                onChange={handleFileChange}
                className="hidden"
                aria-label="Profile picture file input"
              />
            )}
          </div>
          <div className="pt-4 sm:pt-0 sm:ml-6 flex-grow">
            <h4 className="text-slate-900 text-2xl font-bold">{name}</h4>
          </div>
        </div>
        <div className="mt-6 pt-4 border-t border-gray-100">
          <h5 className="text-lg font-semibold text-red-800 mb-3">Profile Details</h5>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-6 text-sm text-slate-700">
            <div className="col-span-1"><span className="font-semibold">SAP ID:</span> <br/> {safeText(sapId) || "N/A"}</div>
            <div className="col-span-1"><span className="font-semibold">Phone:</span> <br/> {formatPhone(contact) || "Not provided"}</div>
            <div className="col-span-1"><span className="font-semibold">Faculty:</span> <br/> {safeText(faculty) || "N/A"}</div>
            <div className="col-span-1"><span className="font-semibold">Department:</span> <br/> {safeText(dept) || "N/A"}</div>
            <div className="col-span-1"><span className="font-semibold">Program:</span> <br/> {safeText(program) || "N/A"}</div>
          </div>
          <button className="text-blue-600 hover:text-blue-700">Show More Details</button>
        </div>
      </div>
    </div>
  );
}

