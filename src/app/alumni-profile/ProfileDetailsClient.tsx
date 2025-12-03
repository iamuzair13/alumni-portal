"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, useRef, useMemo } from "react";
import { useAlumniProfile, alumniProfileKey, useAlumniFullDetails, alumniFullDetailsKey, currentUserImageKey } from "@/app/queries/alumni-profile";
import { useQueryClient } from "@tanstack/react-query";
import { useProgress } from "@bprogress/react";
import toast from "react-hot-toast";
import SocialLinksForm from "@/components/forms/social-links-form";
import { calculateProfileCompletion } from "@/lib/profileCompletion";

type LeadershipInfo = {
  type: "chapter" | "association" | null;
  role: string | null;
  roleDisplay: string | null;
};

type ProfileDetailsClientProps = {
  sapId: string;
  chapters?: string[];
  isVerified?: boolean;
  chaptersError?: string | null;
  associationTitle?: string | null;
  associationError?: string | null;
  leadershipInfo?: LeadershipInfo;
  leadershipError?: string | null;
};

export default function ProfileDetailsClient({ sapId, chapters = [], isVerified = false, chaptersError, associationTitle = null, associationError = null, leadershipInfo = { type: null, role: null, roleDisplay: null }, leadershipError = null }: ProfileDetailsClientProps) {
  const { data, isLoading, isError, error } = useAlumniProfile(sapId);
  const { data: fullDetails, isLoading: isLoadingFullDetails } = useAlumniFullDetails(sapId);
  const queryClient = useQueryClient();
  const { start, stop } = useProgress();
  const [showSocialForm, setShowSocialForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageError, setImageError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Calculate profile completion percentage
  const completionPercentage = useMemo(() => {
    return calculateProfileCompletion(fullDetails);
  }, [fullDetails]);

  useEffect(() => {
    if (isLoading || isLoadingFullDetails) {
      start();
    } else {
      stop();
    }
  }, [isLoading, isLoadingFullDetails, start, stop]);
  
  // Use fullDetails for displaying profile summary as it has the raw database values
  // Fallback to data (mapped profile) if fullDetails is not available yet
  const name = String(fullDetails?.alumniname ?? data?.name ?? "").trim();
  
  // Normalize avatar path for Next.js Image component
  // Use image2 first (most recent upload), then image1 (for AlumniCardTemplate)
  const rawAvatar = String(
    fullDetails?.image2 ?? 
    fullDetails?.image1 ?? 
    (data as unknown as { image2?: string; image1?: string })?.image2 ??
    (data as unknown as { image1?: string })?.image1 ?? 
    ""
  ).trim();
  const avatar = useMemo(() => {
    // If image error occurred, always use fallback
    if (imageError) return "/images/person.jpg";
    
    // If empty or falsy, return default image
    if (!rawAvatar || rawAvatar === "" || rawAvatar === "null" || rawAvatar === "undefined") {
      return "/images/person.jpg";
    }
    
    // Remove old path references
    let imagePath = rawAvatar.replace(/\/tumbnail\//g, "/");
    imagePath = imagePath.replace(/\/alumni-images\/thumbnail\//g, "/");
    imagePath = imagePath.replace(/\/alumni-images\/card\//g, "/");
    
    // Normalize image path for Next.js Image component
    // Next.js requires paths to start with "/" or be absolute URLs (http:// or https://)
    // Images are stored in /public/images/(imagename.extention)
    if (!imagePath.startsWith("/") && !imagePath.startsWith("http://") && !imagePath.startsWith("https://")) {
      // If it's just a filename, prepend the images directory
      if (!imagePath.includes("/")) {
        imagePath = `/images/${imagePath}`;
      } else {
        // If it's a relative path without leading slash, add it
        imagePath = `/${imagePath}`;
      }
    }
    return imagePath;
  }, [rawAvatar, imageError]);
  
  // Reset image error when avatar changes
  useEffect(() => {
    if (rawAvatar && rawAvatar.trim() !== "" && rawAvatar !== "null" && rawAvatar !== "undefined") {
      setImageError(false);
    }
  }, [rawAvatar]);
  const faculty = String(fullDetails?.facultyname ?? data?.faculty ?? "").trim();
  const dept = String(fullDetails?.departmentname ?? data?.department ?? "").trim();
  const program = String(fullDetails?.degreetitle ?? data?.program ?? "").trim();
  // Use contactno directly from fullDetails, or try to reconstruct from mapped data
  const contact = String(fullDetails?.contactno ?? (data?.phoneNumber ? `${data?.countryCode ?? ""} ${data?.phoneNumber}`.trim() : "") ?? data?.officialPhone ?? "").trim();
  // Get SAP ID and Registration Number from fullDetails
  const sapIdValue = String(fullDetails?.sapid ?? "").trim();
  const registrationNoValue = String(fullDetails?.registrationno ?? "").trim();
  // Determine if both are available
  const hasSapId = sapIdValue && sapIdValue !== "";
  const hasRegNo = registrationNoValue && registrationNoValue !== "";
  const facebook = String(fullDetails?.facebook ?? (data as unknown as { facebook?: string })?.facebook ?? "").trim() || null;
  const instagram = String(fullDetails?.instagram ?? (data as unknown as { instagram?: string })?.instagram ?? "").trim() || null;
  const youtube = String(fullDetails?.youtube ?? (data as unknown as { youtube?: string })?.youtube ?? "").trim() || null;
  const linkedin = String(fullDetails?.linkedin ?? (data as unknown as { linkedin?: string })?.linkedin ?? "").trim() || null;

  // Debug: Log data to console for troubleshooting
  useEffect(() => {
    if (fullDetails || data) {
      console.log("[ProfileDetailsClient] Data loaded:", {
        fullDetails,
        data,
        name,
        faculty,
        dept,
        program,
        contact,
        sapId
      });
    }
  }, [fullDetails, data, name, faculty, dept, program, contact, sapId]);

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

      const result = await res.json();
      toast.dismiss(loadingToast);

      if (!res.ok) {
        const errorMsg = result?.error || "Failed to upload profile picture. Please try again.";
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

      toast.success("Profile picture updated successfully!", {
        duration: 4000,
        style: {
          background: '#d1fae5',
          color: '#065f46',
          padding: '16px',
          borderRadius: '8px',
        },
      });

      // Invalidate and refetch the profile data to show the updated image
      await queryClient.invalidateQueries({ queryKey: alumniProfileKey(sapId) });
      // Invalidate and refetch full details query to update profile picture immediately
      await queryClient.invalidateQueries({ queryKey: alumniFullDetailsKey(sapId) });
      // Force refetch full details to get the latest image2
      await queryClient.refetchQueries({ queryKey: alumniFullDetailsKey(sapId) });
      // Also invalidate current user image query to update header
      await queryClient.invalidateQueries({ queryKey: currentUserImageKey() });
      // Force refetch current user image to update header immediately
      await queryClient.refetchQueries({ queryKey: currentUserImageKey() });
      
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

  if (isLoading || isLoadingFullDetails) {
    return (
      <div className="w-full flex-shrink-0">
        <div className="bg-white flex justify-between rounded-lg p-6 pt-0">
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
      </div>
    );
  }

  if (isError) {
    return (
      <div className="w-full flex-shrink-0">
        <div className="bg-white flex justify-between rounded-lg p-6 pt-0">
          <div className="w-full flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-4">
              <svg className="h-12 w-12 text-red-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-red-600">Failed to load profile details</p>
              <p className="text-xs text-gray-500">{error instanceof Error ? error.message : "Unknown error"}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex-shrink-0">
      <div className="bg-white flex justify-between rounded-lg p-6 pt-0">
        <div>
          <div className="flex flex-col items-start sm:flex-row sm:items-end">
            <div className="flex flex-col items-center">
              <div className="relative w-32 h-32 sm:w-36 sm:h-36 md:w-40 md:h-40 -mt-16 sm:-mt-10 md:-mt-8 group">
                <div className="w-32 h-32 sm:w-36 sm:h-36 md:w-40 md:h-40 rounded-full border-4 border-white bg-gray-100 overflow-hidden">
                  <Image 
                    src={avatar} 
                    alt={name || "alumni"} 
                    width={160} 
                    height={160} 
                    sizes="(max-width: 640px) 8rem, (max-width: 768px) 10rem, 10rem" 
                    className="w-full h-full object-cover"
                    onError={() => {
                      // Set error state to trigger fallback to default image
                      if (!imageError) {
                        setImageError(true);
                      }
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleImageClick}
                  disabled={uploading}
                  className="absolute bottom-0 right-0 w-10 h-10 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-full flex items-center justify-center shadow-lg transition-all duration-200 group-hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
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
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                  aria-label="Profile picture file input"
                />
              </div>
              {/* Profile Completion Progress Bar */}
              <Link
                href={`/alumni-profile/more-details?sapid=${encodeURIComponent(sapId)}`}
                className="w-full max-w-[160px] sm:max-w-[180px] md:max-w-[200px] mt-4 block"
                title="Click to complete your profile"
              >
                <div className="bg-gray-50 rounded-lg p-2 border border-gray-200 hover:border-green-500 hover:shadow-md transition-all duration-200 cursor-pointer group">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-700 group-hover:text-green-600 transition-colors">Profile Completion</span>
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
                  <p className="text-xs text-gray-500 mt-1.5 text-center group-hover:text-green-600 transition-colors">
                    {completionPercentage < 50
                      ? "Complete your profile"
                      : completionPercentage < 80
                      ? "Great progress!"
                      : "Almost complete!"}
                  </p>
                </div>
              </Link>
            </div>
            <div className="pt-3 sm:pt-4 md:pt-0 sm:ml-4 md:ml-6 flex-grow">
              <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2 md:gap-3 gap-2">
                <h4 className="text-slate-900 text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold break-words">{name}</h4>
                
                {/* Leadership Label - Prominent Badge */}
                {leadershipInfo?.roleDisplay && leadershipInfo.type && (
                  <div className={`inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 md:px-4 py-1.5 sm:py-2 rounded-lg font-semibold text-xs sm:text-sm shadow-md ${
                    leadershipInfo.role?.toLowerCase().includes("president") 
                      ? leadershipInfo.type === "chapter"
                        ? "bg-gradient-to-r from-purple-600 to-purple-700 text-white border-2 border-purple-800"
                        : "bg-gradient-to-r from-indigo-600 to-indigo-700 text-white border-2 border-indigo-800"
                      : leadershipInfo.role?.toLowerCase().includes("vice") 
                      ? leadershipInfo.type === "chapter"
                        ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white border-2 border-blue-800"
                        : "bg-gradient-to-r from-cyan-600 to-cyan-700 text-white border-2 border-cyan-800"
                      : leadershipInfo.type === "chapter"
                        ? "bg-gradient-to-r from-green-600 to-green-700 text-white border-2 border-green-800"
                        : "bg-gradient-to-r from-teal-600 to-teal-700 text-white border-2 border-teal-800"
                  }`}>
                    <svg
                      className="w-4 h-4 sm:w-5 sm:h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
                      />
                    </svg>
                    <span>{leadershipInfo.roleDisplay}</span>
                  </div>
                )}
                
                {leadershipError && (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-rose-50 border border-rose-200 rounded-lg">
                    <span className="text-xs text-rose-700">{leadershipError}</span>
                  </div>
                )}
              </div>
              
              {/* Chapters and Association Section - Right after name */}
              <div className="mt-2 sm:mt-3 mb-3 sm:mb-4">
                {/* Error Messages */}
                {(chaptersError || associationError) && (
                  <div className="p-2.5 sm:p-3 bg-rose-50 border border-rose-200 rounded-lg mb-2 sm:mb-3">
                    <p className="text-xs sm:text-sm text-rose-700">{chaptersError || associationError}</p>
                  </div>
                )}

                {/* Not Verified Message */}
                {!isVerified && !chaptersError && !associationError && (
                  <div className="p-2.5 sm:p-3 bg-amber-50 border border-amber-200 rounded-lg mb-2 sm:mb-3">
                    <p className="text-xs sm:text-sm text-amber-700">
                      Your account needs to be verified before you can view or apply for chapters and associations.
                    </p>
                  </div>
                )}

                {/* Verified: Show Chapters and Associations */}
                {isVerified && !chaptersError && !associationError && (
                  <div className="flex flex-wrap gap-1.5 sm:gap-2">
                    {/* Chapters */}
                    {chapters.map((chapter, index) => (
                      <div
                        key={index}
                        className="inline-flex items-center gap-1.5 sm:gap-2 px-2 sm:px-2.5 md:px-3 py-1 sm:py-1.5 bg-green-50 border border-green-200 rounded-lg"
                      >
                        <svg
                          className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-600 flex-shrink-0"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        <span className="text-xs font-medium text-green-800 break-words">
                          {chapter}
                        </span>
                      </div>
                    ))}

                    {/* Association Membership */}
                    {associationTitle && (
                      <div className="inline-flex items-center gap-1.5 sm:gap-2 px-2 sm:px-2.5 md:px-3 py-1 sm:py-1.5 bg-blue-50 border border-blue-200 rounded-lg">
                        <svg
                          className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 flex-shrink-0"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M17 20h-10a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v12a2 2 0 01-2 2z"
                          />
                        </svg>
                        <span className="text-xs font-medium text-blue-800 break-words">
                          Member of {associationTitle}
                        </span>
                      </div>
                    )}

                    {/* No Memberships Message */}
                    {chapters.length === 0 && !associationTitle && (
                      <div className="text-xs text-gray-500 italic">
                        Not a member of any chapter or association
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-3 sm:mt-4 flex flex-wrap items-center gap-1.5 sm:gap-2 md:gap-3">
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
                <button
                  type="button"
                  onClick={() => setShowSocialForm(!showSocialForm)}
                  className="w-8 h-8 sm:w-9 sm:h-9 inline-flex items-center justify-center rounded-full bg-green-600 hover:bg-green-700 text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  aria-label="Edit social media links"
                  title="Edit social media links"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
              </div>
              {showSocialForm && (
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
          <div className="mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-gray-100">
            <h5 className="text-base sm:text-lg font-semibold text-slate-800 mb-2 sm:mb-3">Profile Details</h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4 sm:gap-5 md:gap-6 text-xs sm:text-sm text-slate-700">
              {hasSapId && (
                <div className="col-span-1"><span className="font-semibold">SAP ID:</span> <br/> {sapIdValue}</div>
              )}
              {hasRegNo && (
                <div className="col-span-1"><span className="font-semibold">Registration Number:</span> <br/> {registrationNoValue}</div>
              )}
              {!hasSapId && !hasRegNo && (
                <div className="col-span-1"><span className="font-semibold">SAP ID/Registration Number:</span> <br/> N/A</div>
              )}
              <div className="col-span-1"><span className="font-semibold">Phone:</span> <br/> {contact || "Not provided"}</div>
              <div className="col-span-1"><span className="font-semibold">Faculty:</span> <br/> {faculty || "N/A"}</div>
              <div className="col-span-1"><span className="font-semibold">Department:</span> <br/> {dept || "N/A"}</div>
              <div className="col-span-1"><span className="font-semibold">Program:</span> <br/> {program || "N/A"}</div>
            </div>
            <div className="mt-3 sm:mt-4">
              <Link
                href={`/alumni-profile/more-details?sapid=${encodeURIComponent(sapId)}`}
                className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-green-600 text-white text-xs sm:text-sm font-medium rounded-lg hover:bg-green-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                More Details
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}