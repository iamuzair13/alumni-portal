"use client";
import Image from "next/image";
import LoadingLink from "@/components/ui/LoadingLink";
import { useEffect, useRef, useState } from "react";
import { useAlumniProfile, alumniProfileKey, useAlumniFullDetails, alumniFullDetailsKey, currentUserImageKey } from "@/app/queries/alumni-profile";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import SocialLinksForm from "@/components/forms/social-links-form";
import { useSession } from "next-auth/react";
import { isViewerUser } from "@/lib/alumniProfile";
import ApprovedLeadershipBadges from "@/components/alumni/ApprovedLeadershipBadges";
import PassportPhotoCropModal from "@/components/ui/PassportPhotoCropModal";
import { uploadsImageUrl } from "@/lib/uploadsImageUrl";
import { Card, Chip, SectionHeader, BTN_PRIMARY, BTN_SECONDARY } from "@/components/alumni/profile/hub-ui";
import { Camera, CheckCircle2, Landmark } from "lucide-react";

type LeadershipInfo = {
  type: "chapter" | "association" | null;
  role: string | null;
  roleDisplay: string | null;
};

type ProfileTabProps = {
  sapId: string;
  chapters?: string[];
  isVerified?: boolean;
  chaptersError?: string | null;
  associationTitle?: string | null;
  associationError?: string | null;
  leadershipInfo?: LeadershipInfo;
  leadershipError?: string | null;
  leadershipGovernanceHtml?: string | null;
};

export default function ProfileTab({ sapId, chapters = [], chaptersError, associationTitle = null, associationError = null, leadershipError = null, leadershipGovernanceHtml = null }: ProfileTabProps) {
  const { data: session } = useSession();
  const isViewer = isViewerUser(session?.user);
  const { data, isLoading, isError, error } = useAlumniProfile(sapId);
  const { data: fullDetails, isLoading: isLoadingFullDetails, isError: isFullDetailsError, error: fullDetailsError } = useAlumniFullDetails(sapId);
  const alumniIdForBadges = fullDetails?.alumniid ? Number(fullDetails.alumniid) : null;

  useEffect(() => {
    if (isError && error) {
      toast.error(`Failed to load profile: ${error instanceof Error ? error.message : String(error)}`, {
        duration: 5000 });
    }
    if (isFullDetailsError && fullDetailsError) {
      toast.error(`Failed to load full details: ${fullDetailsError instanceof Error ? fullDetailsError.message : String(fullDetailsError)}`, {
        duration: 5000 });
    }
  }, [isError, error, isFullDetailsError, fullDetailsError]);
  const queryClient = useQueryClient();
  const [showSocialForm, setShowSocialForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [avatarOverride, setAvatarOverride] = useState<string | null>(null);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [showCropModal, setShowCropModal] = useState(false);
  const [pendingCropFile, setPendingCropFile] = useState<File | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [photoConsent, setPhotoConsent] = useState<boolean | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const rawAvatar = String(
    fullDetails?.image2 ??
    fullDetails?.image1 ??
    (data as unknown as { image2?: string; image1?: string })?.image2 ??
    (data as unknown as { image1?: string })?.image1 ??
    ""
  ).trim();
  const avatar = (() => {
    if (avatarOverride) return avatarOverride;
    if (imageError) return "/images/person.jpg";
    if (!rawAvatar || rawAvatar === "null" || rawAvatar === "undefined") {
      return "/images/person.jpg";
    }
    let imagePath = rawAvatar.replace(/\/tumbnail\//g, "/");
    imagePath = imagePath.replace(/\/alumni-images\/thumbnail\//g, "/");
    imagePath = imagePath.replace(/\/alumni-images\/card\//g, "/");
    if (!imagePath.startsWith("http://") && !imagePath.startsWith("https://")) {
      if (!imagePath.startsWith("/") && !imagePath.includes("/")) {
        imagePath = uploadsImageUrl(imagePath);
      } else if (/^\/images\/[^/]+$/u.test(imagePath)) {
        imagePath = uploadsImageUrl(imagePath);
      } else if (!imagePath.startsWith("/")) {
        imagePath = `/${imagePath}`;
      }
    }
    return imagePath;
  })();

  useEffect(() => {
    if (rawAvatar && rawAvatar.trim() !== "" && rawAvatar !== "null" && rawAvatar !== "undefined") {
      setImageError(false);
    }
  }, [rawAvatar]);

  useEffect(() => {
    if (!avatarOverride) return;
    const normalizedOverride = avatarOverride.split("?")[0];
    if (normalizedOverride && rawAvatar && normalizedOverride.endsWith(`/${rawAvatar}`)) {
      setAvatarOverride(null);
    }
  }, [avatarOverride, rawAvatar]);

  const faculty = String(fullDetails?.facultyname ?? data?.faculty ?? "").trim();
  const dept = String(fullDetails?.departmentname ?? data?.department ?? "").trim();
  const program = String(fullDetails?.degreetitle ?? data?.program ?? "").trim();
  const passingYear = fullDetails?.yearofending ?? null;
  const contact = String(fullDetails?.contactno ?? (data?.phoneNumber ? `${data?.countryCode ?? ""} ${data?.phoneNumber}`.trim() : "") ?? data?.officialPhone ?? "").trim();
  const sapIdValue = String(fullDetails?.sapid ?? "").trim();
  const registrationNoValue = String(fullDetails?.registrationno ?? "").trim();
  const hasSapId = sapIdValue && sapIdValue !== "";
  const hasRegNo = registrationNoValue && registrationNoValue !== "";
  const facebook = String(fullDetails?.facebook ?? (data as unknown as { facebook?: string })?.facebook ?? "").trim() || null;
  const instagram = String(fullDetails?.instagram ?? (data as unknown as { instagram?: string })?.instagram ?? "").trim() || null;
  const youtube = String(fullDetails?.youtube ?? (data as unknown as { youtube?: string })?.youtube ?? "").trim() || null;
  const linkedin = String(fullDetails?.linkedin ?? (data as unknown as { linkedin?: string })?.linkedin ?? "").trim() || null;

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.", {
        duration: 5000 });
      return;
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      toast.error("File size exceeds 5MB limit. Please choose a smaller image.", {
        duration: 5000 });
      return;
    }

    setPendingCropFile(file);
    setShowCropModal(true);
  };

  const handleUploadWithConsent = async () => {
    if (!selectedFile || photoConsent === null) {
      toast.error("Please select a photo usage option.", {
        duration: 5000 });
      return;
    }

    setUploading(true);
    setShowConsentModal(false);
    const loadingToast = toast.loading("Uploading profile picture...");

    try {
      const formData = new FormData();
      formData.append("image", selectedFile);
      formData.append("alumni_consent_pic", String(photoConsent));

      const res = await fetch(`/api/alumni/${encodeURIComponent(sapId)}/profile-picture`, {
        method: "POST",
        body: formData });

      const result = await res.json();
      toast.dismiss(loadingToast);

      if (!res.ok) {
        const errorMsg = result?.error || "Failed to upload profile picture. Please try again.";
        toast.error(errorMsg, {
          duration: 5000 });
        return;
      }

      toast.success("Profile picture updated successfully!", {
        duration: 4000 });

      const returnedPath = String(result?.imagePath || result?.image || "").trim();
      if (returnedPath) {
        const normalized = returnedPath.startsWith("/") ? returnedPath : `/images/${returnedPath}`;
        setImageError(false);
        setAvatarOverride(`${normalized}?t=${Date.now()}`);
      }

      await queryClient.invalidateQueries({ queryKey: alumniProfileKey(sapId) });
      await queryClient.invalidateQueries({ queryKey: alumniFullDetailsKey(sapId) });
      await queryClient.refetchQueries({ queryKey: alumniFullDetailsKey(sapId) });
      await queryClient.invalidateQueries({ queryKey: currentUserImageKey() });
      await queryClient.refetchQueries({ queryKey: currentUserImageKey() });

      try {
        window.dispatchEvent(
          new CustomEvent("alumni-card-revision-changed", {
            detail: { sapId } })
        );
      } catch {
        // ignore
      }

      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err) {
      toast.dismiss(loadingToast);
      const errorMsg = err instanceof Error ? err.message : "An unexpected error occurred. Please try again.";
      toast.error(errorMsg, {
        duration: 5000 });
    } finally {
      setUploading(false);
      setSelectedFile(null);
      setPhotoConsent(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  if (isLoading || isLoadingFullDetails) {
    return (
      <div className="space-y-3" aria-busy="true">
        <div className="h-24 animate-pulse rounded-2xl bg-surface-raised" />
        <div className="h-48 animate-pulse rounded-2xl bg-surface-raised" />
        <div className="h-32 animate-pulse rounded-2xl bg-surface-raised" />
      </div>
    );
  }

  if (isError) {
    return (
      <Card className="flex flex-col items-center gap-3 p-10 text-center">
        <svg className="h-10 w-10 text-error-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-sm font-semibold text-error-600 dark:text-error-400">Failed to load profile details</p>
        <p className="text-xs text-content-muted">{error instanceof Error ? error.message : "Unknown error"}</p>
      </Card>
    );
  }

  return (
    <>
      <PassportPhotoCropModal
        isOpen={showCropModal}
        file={pendingCropFile}
        onClose={() => {
          setShowCropModal(false);
          setPendingCropFile(null);
          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
        }}
        onCropped={(cropped) => {
          setShowCropModal(false);
          setPendingCropFile(null);
          setSelectedFile(cropped);
          setShowConsentModal(true);
          setPhotoConsent(null);
        }}
        title="Edit Profile Picture"
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-5">
        {/* Photo + social column */}
        <div className="space-y-4">
          <Card className="p-5">
            <SectionHeader title="Profile Photo" />
            <div className="flex items-center gap-4">
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-surface-sunken ring-1 ring-border-subtle">
                <Image
                  src={avatar}
                  alt="Profile photo"
                  width={80}
                  height={80}
                  className="h-full w-full object-cover"
                  onError={() => {
                    if (!imageError) {
                      setImageError(true);
                    }
                  }}
                />
              </div>
              {!isViewer && (
                <div>
                  <button
                    type="button"
                    onClick={handleImageClick}
                    disabled={uploading}
                    className={`${BTN_PRIMARY} disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {uploading ? (
                      <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden>
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      <Camera className="h-4 w-4" aria-hidden />
                    )}
                    {uploading ? "Uploading..." : "Update photo"}
                  </button>
                  <p className="mt-2 text-xs text-content-muted">JPEG, PNG, GIF or WebP. Max 5MB.</p>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
              onChange={handleFileChange}
              className="hidden"
              aria-label="Profile picture file input"
            />
          </Card>

          <Card className="p-5">
            <SectionHeader
              title="Social Links"
              action={
                !isViewer ? (
                  <button
                    type="button"
                    onClick={() => setShowSocialForm(!showSocialForm)}
                    className={BTN_SECONDARY}
                    aria-label="Edit social media links"
                    title="Edit social media links"
                  >
                    {showSocialForm ? "Close" : "Edit"}
                  </button>
                ) : null
              }
            />
            <div className="flex flex-wrap items-center gap-2">
              {[{ href: facebook || "#", label: "Facebook" }, { href: instagram || "#", label: "Instagram" }, { href: linkedin || "#", label: "LinkedIn" }, { href: youtube || "#", label: "YouTube" }].map((s, i) => (
                <a
                  key={i}
                  href={s.href}
                  target={s.href !== "#" ? "_blank" : undefined}
                  rel={s.href !== "#" ? "noopener noreferrer" : undefined}
                  onClick={(e) => {
                    if (s.href === "#") {
                      e.preventDefault();
                      toast.error(`${s.label} link not available. No profile link has been added yet.`, {
                        duration: 3000 });
                    }
                  }}
                  className={`inline-flex h-9 items-center justify-center rounded-full px-4 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-brand-500 ${
                    s.href !== "#"
                      ? "bg-brand-50 text-brand-700 hover:bg-brand-100 dark:bg-brand-500/15 dark:text-brand-300 dark:hover:bg-brand-500/25"
                      : "bg-surface-sunken text-content-muted hover:bg-surface-raised"
                  }`}
                  aria-label={s.href !== "#" ? s.label : `${s.label} not provided`}
                  title={s.href !== "#" ? s.label : `${s.label} not provided`}
                >
                  {s.label}
                </a>
              ))}
            </div>
            {showSocialForm && !isViewer && (
              <div className="mt-4 rounded-xl border border-border-subtle bg-surface-raised p-4">
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
          </Card>

          <Card className="p-5">
            <SectionHeader title="Memberships" />
            {(chaptersError || associationError) && (
              <p className="mb-2 text-xs text-error-700 dark:text-error-400">{chaptersError || associationError}</p>
            )}
            {!chaptersError && !associationError && (
              <div className="flex flex-wrap gap-1.5">
                {chapters.map((chapter, index) => (
                  <Chip key={index} tone="brand">
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                    {chapter}
                  </Chip>
                ))}
                {associationTitle && (
                  <Chip tone="sky">
                    <Landmark className="h-3.5 w-3.5" aria-hidden />
                    Member of {associationTitle}
                  </Chip>
                )}
                {chapters.length === 0 && !associationTitle && (
                  <p className="text-xs italic text-content-muted">
                    Not a member of any chapter or association
                  </p>
                )}
              </div>
            )}
          </Card>
        </div>

        {/* Details column */}
        <Card className="p-5 lg:col-span-2">
          <SectionHeader
            title="Profile Details"
            description="Your registration and academic information."
          />
          <div className="grid grid-cols-1 gap-x-6 gap-y-4 text-sm text-content-secondary sm:grid-cols-2 md:grid-cols-3">
            {hasSapId && (
              <div><span className="block text-xs font-semibold uppercase tracking-wide text-content-muted">SAP ID</span>{sapIdValue}</div>
            )}
            {hasRegNo && (
              <div><span className="block text-xs font-semibold uppercase tracking-wide text-content-muted">Registration Number</span>{registrationNoValue}</div>
            )}
            {!hasSapId && !hasRegNo && (
              <div><span className="block text-xs font-semibold uppercase tracking-wide text-content-muted">SAP ID/Registration Number</span>N/A</div>
            )}
            <div><span className="block text-xs font-semibold uppercase tracking-wide text-content-muted">Phone</span>{contact || "Not provided"}</div>
            <div><span className="block text-xs font-semibold uppercase tracking-wide text-content-muted">Faculty</span>{faculty || "N/A"}</div>
            <div><span className="block text-xs font-semibold uppercase tracking-wide text-content-muted">Department</span>{dept || "N/A"}</div>
            <div><span className="block text-xs font-semibold uppercase tracking-wide text-content-muted">Program</span>{program || "N/A"}</div>
            <div><span className="block text-xs font-semibold uppercase tracking-wide text-content-muted">Passing Year</span>{passingYear ? String(passingYear) : "N/A"}</div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2.5 border-t border-border-subtle pt-5">
            <LoadingLink
              href={`/alumni-profile/more-details?sapid=${encodeURIComponent(sapId)}`}
              className={BTN_PRIMARY}
            >
              More Details
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </LoadingLink>
            {!isViewer && (
              <LoadingLink
                href={`/alumni-profile/view-applications?sapid=${encodeURIComponent(sapId)}`}
                className={BTN_SECONDARY}
              >
                View Applications
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </LoadingLink>
            )}
          </div>

          <div className="mt-5 border-t border-border-subtle pt-5">
            <h3 className="mb-3 text-sm font-semibold text-content">Roles & Recognition</h3>
            <ApprovedLeadershipBadges alumniId={alumniIdForBadges} size="sm" />
            {leadershipError && (
              <div className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 bg-error-50 border border-error-200 rounded-lg dark:border-error-900 dark:bg-error-950/40">
                <span className="text-xs text-error-700 dark:text-error-300">{leadershipError}</span>
              </div>
            )}
            {leadershipGovernanceHtml ? (
              <div className="mt-3">
                <details className="rounded-lg border border-border-subtle bg-surface-raised">
                  <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-content-secondary">Office Term & Related Governance</summary>
                  <div className="border-t border-border-subtle px-3 py-3">
                    <div className="prose prose-sm max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: leadershipGovernanceHtml }} />
                  </div>
                </details>
              </div>
            ) : null}
          </div>
        </Card>
      </div>

      {/* Photo Usage Consent Modal */}
      {showConsentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4" onClick={(e) => {
          if (e.target === e.currentTarget) {
            setShowConsentModal(false);
            setSelectedFile(null);
            setPhotoConsent(null);
            if (fileInputRef.current) {
              fileInputRef.current.value = "";
            }
          }
        }}>
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 dark:bg-gray-900 dark:border dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 dark:text-gray-100">Profile update (picture upload)</h3>
            <p className="text-sm text-gray-600 mb-4 dark:text-gray-400">Please select how you would like your photo to be used:</p>

            <div className="space-y-3 mb-6">
              <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors dark:border-gray-700 dark:hover:bg-gray-800">
                <input
                  type="radio"
                  name="photoConsent"
                  value="false"
                  checked={photoConsent === false}
                  onChange={() => setPhotoConsent(false)}
                  className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  I allow my photo to be used only to issue my Alumni Honor Card
                </span>
              </label>

              <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors dark:border-gray-700 dark:hover:bg-gray-800">
                <input
                  type="radio"
                  name="photoConsent"
                  value="true"
                  checked={photoConsent === true}
                  onChange={() => setPhotoConsent(true)}
                  className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  I allow my photo to be used for my Alumni Honor Card and other official purposes (such as university & alumni websites and official publications)
                </span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowConsentModal(false);
                  setSelectedFile(null);
                  setPhotoConsent(null);
                  if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                  }
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUploadWithConsent}
                disabled={photoConsent === null || uploading}
                className="px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed dark:bg-brand-500 dark:text-accent-950 dark:hover:bg-brand-400"
              >
                {uploading ? "Uploading..." : "Upload"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
