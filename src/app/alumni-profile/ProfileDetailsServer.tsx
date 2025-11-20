"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { useProgress } from "@bprogress/react";
import { safeText, formatPhone } from "@/lib/alumniProfile";
import toast from "react-hot-toast";
import SocialLinksForm from "@/components/forms/social-links-form";
import { useAlumniFullDetails } from "@/app/queries/alumni-profile";
import { calculateProfileCompletion } from "@/lib/profileCompletion";

type Props = {
  name: string;
  avatar: string;
  sapId: string;
  contact: string;
  faculty: string;
  dept: string;
  program: string;
  facebook?: string | null;
  instagram?: string | null;
  youtube?: string | null;
  linkedin?: string | null;
};

export default function ProfileDetailsServer({ name, avatar: initialAvatar, sapId, contact, faculty, dept, program, facebook, instagram, youtube, linkedin }: Props) {
  const { start, stop } = useProgress();
  const { data: fullDetails } = useAlumniFullDetails(sapId || undefined);
  const [avatar, setAvatar] = useState(initialAvatar);
  const [uploading, setUploading] = useState(false);
  const [showSocialForm, setShowSocialForm] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Calculate profile completion percentage
  const completionPercentage = useMemo(() => {
    return calculateProfileCompletion(fullDetails);
  }, [fullDetails]);

  // Sync avatar when prop changes
  useEffect(() => {
    if (initialAvatar) {
      setAvatar(initialAvatar);
    }
  }, [initialAvatar]);

  useEffect(() => {
    // Show progress on mount
    start();
    // Show loading spinner briefly
    const timer = setTimeout(() => {
      setIsLoading(false);
      stop();
    }, 500);

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

  if (isLoading) {
    return (
      <div className="bg-white flex justify-between border rounded-lg p-6 pt-0">
        <div className="w-full flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-4">
            <svg className="animate-spin h-12 w-12 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-sm text-gray-600">Loading profile details...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white flex justify-between border rounded-lg p-6 pt-0">
      <div>
        <div className="flex flex-col items-start sm:flex-row sm:items-end">
          <div className="flex flex-col items-center">
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
            {/* Profile Completion Progress Bar */}
            {sapId && (
              <div className="w-full max-w-[160px] mt-4">
                <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-700">Profile Completion</span>
                    <span className="text-xs font-semibold text-gray-900">{completionPercentage}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-500 ${
                        completionPercentage >= 80
                          ? "bg-green-600"
                          : completionPercentage >= 50
                          ? "bg-yellow-500"
                          : "bg-red-500"
                      }`}
                      style={{ width: `${completionPercentage}%` }}
                      role="progressbar"
                      aria-valuenow={completionPercentage}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`Profile completion: ${completionPercentage}%`}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1.5 text-center">
                    {completionPercentage < 50
                      ? "Complete your profile"
                      : completionPercentage < 80
                      ? "Great progress!"
                      : "Almost complete!"}
                  </p>
                </div>
              </div>
            )}
          </div>
          <div className="pt-4 sm:pt-0 sm:ml-6 flex-grow">
            <h4 className="text-slate-900 text-2xl font-bold">{name}</h4>
            <div className="mt-4 flex flex-wrap items-center gap-2 sm:gap-3">
              {[{ href: facebook || "#", label: "Facebook", svg: (
                <svg role="img" aria-label="Facebook" xmlns="http://www.w3.org/2000/svg" width="12" className="fill-gray-700" viewBox="0 0 155.139 155.139"><path d="M89.584 155.139V84.378h23.742l3.562-27.585H89.584V39.184c0-7.984 2.208-13.425 13.67-13.425l14.595-.006V1.08C115.325.752 106.661 0 96.577 0 75.52 0 61.104 12.853 61.104 36.452v20.341H37.29v27.585h23.814v70.761h28.48z"/></svg>
              )}, { href: instagram || "#", label: "Instagram", svg: (
                <svg role="img" aria-label="Instagram" xmlns="http://www.w3.org/2000/svg" width="12" className="fill-gray-700" viewBox="0 0 512 512"><path d="M512 97.248c-19.04 8.352-39.328 13.888-60.48 16.576 21.76-12.992 38.368-33.408 46.176-58.016-20.288 12.096-42.688 20.64-66.56 25.408C411.872 60.704 384.416 48 354.464 48c-58.112 0-104.896 47.168-104.896 104.992 0 8.32.704 16.32 2.432 23.936-87.264-4.256-164.48-46.08-216.352-109.792-9.056 15.712-14.368 33.696-14.368 53.056 0 36.352 18.72 68.576 46.624 87.232-16.864-.32-33.408-5.216-47.424-12.928v1.152c0 51.008 36.384 93.376 84.096 103.136-8.544 2.336-17.856 3.456-27.52 3.456-6.72 0-13.504-.384-19.872-1.792 13.6 41.568 52.192 72.128 98.08 73.12-35.712 27.936-81.056 44.768-130.144 44.768-8.608 0-16.864-.384-25.12-1.44C46.496 446.88 101.6 464 161.024 464c193.152 0 298.752-160 298.752-298.688 0-4.64-.16-9.12-.384-13.568 20.832-14.784 38.336-33.248 52.608-54.496z"/></svg>
              )}, { href: linkedin || "#", label: "LinkedIn", svg: (
                <svg role="img" aria-label="LinkedIn" xmlns="http://www.w3.org/2000/svg" width="14" className="fill-gray-700" viewBox="0 0 24 24"><path d="M23.994 24v-.001H24v-8.802c0-4.306-.927-7.623-5.961-7.623-2.42 0-4.044 1.328-4.707 2.587h-.07V7.976H8.489v16.023h4.97v-7.934c0-2.089.396-4.109 2.983-4.109 2.549 0 2.587 2.384 2.587 4.243V24zM.396 7.977h4.976V24H.396zM2.882 0C1.291 0 0 1.291 0 2.882s1.291 2.909 2.882 2.909 2.882-1.318 2.882-2.909A2.884 2.884 0 0 0 2.882 0z"/></svg>
              )}, { href: youtube || "#", label: "YouTube", svg: (
                <svg role="img" aria-label="YouTube" xmlns="http://www.w3.org/2000/svg" width="14" className="fill-gray-700" viewBox="0 0 24 24"><path d="M23.498 6.186a2.999 2.999 0 0 0-2.116-2.12C19.59 3.5 12 3.5 12 3.5s-7.59 0-9.382.566A2.999 2.999 0 0 0 .502 6.186C0 8.002 0 12 0 12s0 3.998.502 5.814a2.999 2.999 0 0 0 2.116 2.12C4.41 20.5 12 20.5 12 20.5s7.59 0 9.382-.566a2.999 2.999 0 0 0 2.116-2.12C24 15.998 24 12 24 12s0-3.998-.502-5.814zM9.75 15.02V8.98L15.5 12l-5.75 3.02z"/></svg>
              )}].map((s, i) => (
                <a 
                  key={i} 
                  href={s.href} 
                  target={s.href !== "#" ? "_blank" : undefined}
                  rel={s.href !== "#" ? "noopener noreferrer" : undefined}
                  onClick={(e) => {
                    if (s.href === "#") {
                      e.preventDefault();
                    }
                  }}
                  className={`w-8 h-8 sm:w-9 sm:h-9 inline-flex items-center justify-center rounded-full transition-colors ${
                    s.href !== "#" 
                      ? "bg-gray-100 hover:bg-gray-300 cursor-pointer" 
                      : "bg-gray-50 text-gray-400 cursor-not-allowed"
                  }`}
                  aria-label={s.href !== "#" ? s.label : `${s.label} not provided`}
                  title={s.href !== "#" ? s.label : `${s.label} not provided`}
                >
                  {s.svg}
                </a>
              ))}
              {sapId && (
                <button
                  type="button"
                  onClick={() => setShowSocialForm(!showSocialForm)}
                  className="w-8 h-8 sm:w-9 sm:h-9 inline-flex items-center justify-center rounded-full bg-blue-600 hover:bg-blue-700 text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  aria-label="Edit social media links"
                  title="Edit social media links"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
              )}
            </div>
            {showSocialForm && sapId && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <SocialLinksForm
                  sapId={sapId}
                  initialData={{ facebook, instagram, youtube, linkedin }}
                  onSuccess={() => {
                    setShowSocialForm(false);
                    window.location.reload();
                  }}
                />
              </div>
            )}
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
          {sapId && (
            <div className="mt-4">
              <Link
                href={`/alumni-profile/more-details?sapid=${encodeURIComponent(sapId)}`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                More Details
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

