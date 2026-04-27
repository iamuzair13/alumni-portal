"use client";
import { Suspense, useState, useCallback, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useAlumniFullDetails, useUpdateAlumniFields } from "@/app/queries/alumni-profile";
import { useQuery } from "@tanstack/react-query";
import AppHeader from "@/layout/AppHeader";
import Image from "next/image";
import BackButton from "@/components/ui/BackButton";
import PageBanner from "@/components/ui/PageBanner";
import EditableField from "@/components/ui/EditableField";
import EditableCountryProvinceCity from "@/components/ui/EditableCountryProvinceCity";
import EditableEmploymentStatus from "@/components/ui/EditableEmploymentStatus";
import { Toaster, toast } from "react-hot-toast";
import { canModify, isSuperAdminUser, isViewerUser } from "@/lib/alumniProfile";

function MoreDetailsContent() {
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const isViewer = isViewerUser(session?.user);
  const isSuperAdmin = isSuperAdminUser(session?.user);
  const isAlumniUser = String((session?.user as { type?: string | null })?.type || "").toLowerCase().trim() === "alumni";
  const [isSendingCredentials, setIsSendingCredentials] = useState(false);
  const safeSearchParams = searchParams ?? new URLSearchParams();
  
  // Get identifier from URL params, or fallback to session (SAP ID or registration number)
  const urlSapId = safeSearchParams.get("sapid") || "";
  
  // Extract session identifiers
  let sessionSapid: string | undefined;
  let sessionRegNo: string | undefined;
  if (session?.user) {
    const user = session.user as Record<string, unknown>;
    sessionSapid = user["sapid"] ? String(user["sapid"]).trim() : undefined;
    sessionRegNo = user["registrationno"] ? String(user["registrationno"]).trim() : undefined;
  }
  
  // Use URL param if available, otherwise use session SAP ID, otherwise use registration number
  const sapId = urlSapId || sessionSapid || sessionRegNo || "";

  const { data, isLoading, isError, error, refetch } = useAlumniFullDetails(sapId || undefined);
  const updateMutation = useUpdateAlumniFields(sapId || undefined);
  const [pendingChanges, setPendingChanges] = useState<Record<string, unknown>>({});
  const [isSavingAll, setIsSavingAll] = useState(false);

  const pendingRequestQuery = useQuery<
    { pending: boolean; request: null | { id: number; new_data: Record<string, unknown> } },
    Error
  >({
    queryKey: ["alumni", "pending-change", sapId],
    enabled: !!sapId && String((data as any)?.change_approval ?? "").toLowerCase().trim() === "pending",
    queryFn: async ({ signal }) => {
      const res = await fetch(`/api/alumni/${encodeURIComponent(sapId)}/pending-change`, {
        signal,
        headers: { accept: "application/json" },
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error ?? "Failed to load pending change request");
      return payload as { pending: boolean; request: null | { id: number; new_data: Record<string, unknown> } };
    },
    staleTime: 10 * 1000,
    gcTime: 2 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const pendingServerNewData = (pendingRequestQuery.data?.request?.new_data ?? {}) as Record<string, unknown>;
  const pendingDisplayMap = useMemo(() => {
    return { ...pendingServerNewData, ...pendingChanges };
  }, [pendingServerNewData, pendingChanges]);

  const [isInitialized, setIsInitialized] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleChangePassword = async () => {
    if (isChangingPassword) return;
    if (!currentPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
      toast.error("Please fill all password fields");
      return;
    }
    if (newPassword.trim().length < 4) {
      toast.error("New password must be at least 4 characters long");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New password and confirm password do not match");
      return;
    }

    setIsChangingPassword(true);
    try {
      const res = await fetch("/api/alumni/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(payload?.error || "Failed to change password");
        return;
      }
      toast.success("Password changed successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to change password");
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Mark as initialized once data is loaded (prevents false positives on initial render)
  // Also clear any pending changes that might have been set during initialization
  useEffect(() => {
    if (data && !isLoading && !isInitialized) {
      // Clear any pending changes that might have been incorrectly set during initialization
      setPendingChanges({});
      // Longer delay to ensure all components (including nested ones) have finished their initial render
      // This prevents any onValueChange calls during initialization from being tracked
      const timer = setTimeout(() => {
        setIsInitialized(true);
        // Final check: clear any pending changes that might have been set during the delay
        setPendingChanges((prev) => {
          // Only clear if there are changes (to avoid unnecessary state updates)
          if (Object.keys(prev).length > 0) {
            return {};
          }
          return prev;
        });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [data, isLoading, isInitialized]);

  // Helper function to normalize values for comparison (treat null, undefined, and empty string as equivalent)
  const normalizeValue = useCallback((val: unknown): unknown => {
    if (val === null || val === undefined || val === "") return null;
    if (typeof val === "string") {
      const trimmed = val.trim();
      // Treat "Not provided", "N/A", "NA", etc. as equivalent to null/empty
      if (trimmed === "" || trimmed.toLowerCase() === "not provided" || trimmed.toLowerCase() === "n/a" || trimmed.toLowerCase() === "na") {
        return null;
      }
      return trimmed;
    }
    return val;
  }, []);

  const formatDateDisplay = (value: unknown): string => {
    if (value === null || value === undefined || value === "") return "-";
    const str = String(value).trim();
    const d = new Date(str.length === 10 ? `${str}T00:00:00` : str);
    if (Number.isNaN(d.getTime())) return str;
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(d);
  };

  const formatDateTimeDisplay = (value: unknown): string => {
    if (value === null || value === undefined) return "";
    const str = String(value).trim();
    if (!str) return "";
    const d = new Date(str.length === 10 ? `${str}T00:00:00` : str);
    if (Number.isNaN(d.getTime())) return str;
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  };

  const handleFieldValueChange = useCallback((key: string, value: unknown) => {
    // Don't track changes until component is fully initialized
    if (!data || !isInitialized) return;
    
    if (value === undefined) {
      // Remove from pending changes
      setPendingChanges((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    } else {
      // Get the original value from data
      const originalValue = (data as Record<string, unknown>)?.[key];
      
      // Normalize both values for comparison
      const normalizedNewValue = normalizeValue(value);
      const normalizedOriginalValue = normalizeValue(originalValue);
      
      // Only add to pending changes if the value is actually different from the original
      // Store the actual value (not normalized) so we preserve what the user entered
      // For textarea fields, even if both normalize to null, if user entered something, store it
      const isDifferent = normalizedNewValue !== normalizedOriginalValue;
      
      if (isDifferent) {
        setPendingChanges((prev) => ({
          ...prev,
          [key]: value, // Store the actual value entered by user
        }));
      } else {
        // If the value matches the original, remove it from pending changes (in case it was there before)
        setPendingChanges((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      }
    }
  }, [data, isInitialized, normalizeValue]);

  const handleSaveAll = async () => {
    if (!sapId || Object.keys(pendingChanges).length === 0 || isSavingAll) return;

    // Validate: Get current country, province, and city values (use pending changes if available, otherwise use data)
    const countryChanged = pendingChanges.country !== undefined;
    const newCountry = countryChanged ? pendingChanges.country : (data?.country ?? null);
    const provinceValue = pendingChanges.province !== undefined ? pendingChanges.province : (data?.province ?? null);
    const cityValue = pendingChanges.city !== undefined ? pendingChanges.city : (data?.city ?? null);
    
    // Validate: If country is "Pakistan", both province and city are required
    if (newCountry && String(newCountry).trim() === "Pakistan") {
      const missingFields: string[] = [];
      
      if (!provinceValue || String(provinceValue).trim() === "" || String(provinceValue).trim() === "Not applicable") {
        missingFields.push("Province");
      }
      
      if (!cityValue || String(cityValue).trim() === "") {
        missingFields.push("City");
      }
      
      if (missingFields.length > 0) {
        const fieldsList = missingFields.join(" and ");
        toast.error(
          `When country is "Pakistan", ${fieldsList} ${missingFields.length > 1 ? 'are' : 'is'} required. Please fill in all required fields before saving.`,
          {
            duration: 5000,
            style: {
              background: '#fee2e2',
              color: '#991b1b',
              padding: '12px',
              borderRadius: '8px',
              maxWidth: '500px',
            },
          }
        );
        return;
      }
    }
    
    // Validate: If country is changed to non-Pakistan, city must be provided
    if (newCountry && newCountry !== "Pakistan") {
      if (!cityValue || String(cityValue).trim() === "") {
        toast.error("City is required when country is not Pakistan. Please enter a city.", {
          duration: 4000,
          style: {
            background: '#fee2e2',
            color: '#991b1b',
            padding: '12px',
            borderRadius: '8px',
          },
        });
        return;
      }
    }

    const changesCount = Object.keys(pendingChanges).length;
    setIsSavingAll(true);
    try {
      const res = await updateMutation.mutateAsync(pendingChanges as Partial<NonNullable<typeof data>>);
      // Clear pending changes after successful save
      setPendingChanges({});

      try {
        window.dispatchEvent(
          new CustomEvent("alumni-card-revision-changed", {
            detail: { sapId },
          })
        );
      } catch {
        // ignore
      }

      // Force refetch to ensure we have the latest from the database
      await refetch();

      const approval = String((res as { change_approval?: string | null })?.change_approval ?? "").toLowerCase().trim();
      if (approval === "pending") {
        toast.success("Changes are under approval. Check status in profile.", {
          duration: 4000,
          style: {
            background: '#fef3c7',
            color: '#92400e',
            padding: '12px',
            borderRadius: '8px',
          },
        });
      } else {
        toast.success(`Saved ${changesCount} field${changesCount !== 1 ? "s" : ""} successfully`, {
          duration: 3000,
          style: {
            background: '#d1fae5',
            color: '#065f46',
            padding: '12px',
            borderRadius: '8px',
          },
        });
      }
    } catch (error) {
      // Extract error message from the error
      let errorMessage = "Failed to save changes. Please try again.";
      let errorDetails = "";
      
      if (error instanceof Error) {
        errorMessage = error.message;
        // Try to parse error message if it contains JSON
        try {
          const errorData = JSON.parse(errorMessage);
          if (errorData.error) {
            errorMessage = errorData.error;
          }
          if (errorData.message) {
            errorDetails = errorData.message;
          }
          if (errorData.field) {
            errorDetails = `${errorDetails ? errorDetails + " " : ""}(Field: ${errorData.field})`;
          }
        } catch {
          // If parsing fails, use the error message as is
        }
      }
      
      // Combine error message and details
      const fullErrorMessage = errorDetails 
        ? `${errorMessage}\n${errorDetails}` 
        : errorMessage;
      
      toast.error(fullErrorMessage, {
        duration: 5000,
        style: {
          background: '#fee2e2',
          color: '#991b1b',
          padding: '12px',
          borderRadius: '8px',
          maxWidth: '400px',
          whiteSpace: 'pre-line',
        },
      });
    } finally {
      setIsSavingAll(false);
    }
  };

  const handleCancelAll = () => {
    setPendingChanges({});
    toast.success("All pending changes cancelled", {
      duration: 2000,
      style: {
        background: '#fef3c7',
        color: '#92400e',
        padding: '12px',
        borderRadius: '8px',
      },
    });
  };

  if (isLoading) {
    return (
      <>
        <AppHeader />
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="bg-white rounded-lg shadow-sm p-8 dark:bg-gray-900 dark:border dark:border-gray-700">
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center gap-4">
                  <svg className="animate-spin h-12 w-12 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Loading profile details...</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (isError || !data) {
    return (
      <>
        <AppHeader />
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="bg-white rounded-lg shadow-sm p-8 dark:bg-gray-900 dark:border dark:border-gray-700">
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center gap-4">
                  <svg className="h-12 w-12 text-red-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-red-600">Failed to load profile details</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{error instanceof Error ? error.message : "Unknown error"}</p>
                  <div className="mt-4">
                    <BackButton />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Normalize image path for Next.js Image component
  const normalizeImagePath = (imagePath: unknown): string => {
    // If empty or falsy, return default image
    if (!imagePath || typeof imagePath !== "string" || imagePath.trim() === "" || imagePath === "null" || imagePath === "undefined") {
      return "/images/person.jpg";
    }
    
    let trimmedPath = String(imagePath).trim();
    
    // Remove old path references
    trimmedPath = trimmedPath.replace(/\/tumbnail\//g, "/");
    trimmedPath = trimmedPath.replace(/\/alumni-images\/thumbnail\//g, "/");
    trimmedPath = trimmedPath.replace(/\/alumni-images\/card\//g, "/");
    
    // Normalize image path for Next.js Image component
    // Next.js requires paths to start with "/" or be absolute URLs (http:// or https://)
    // Images are stored in /public/images/(imagename.extention)
    if (!trimmedPath.startsWith("/") && !trimmedPath.startsWith("http://") && !trimmedPath.startsWith("https://")) {
      // If it's just a filename, prepend the images directory
      if (!trimmedPath.includes("/")) {
        return `/images/${trimmedPath}`;
      } else {
        // If it's a relative path without leading slash, add it
        return `/${trimmedPath}`;
      }
    }
    return trimmedPath;
  };

  const maritalStatusOptions = [
    { value: "Married", label: "Married" },
    { value: "Un-Married", label: "Un-Married" },
  ];

  // Employment status options matching AlumniSqlForm.tsx
  const employmentStatusOptions = [
    { value: "Employed", label: "Employed" },
    { value: "Self-Employed/Enterpreneur", label: "Self-Employed/Enterpreneur" },
    { value: "Pursuing Higher Education", label: "Pursuing Higher Education" },
    { value: "Unemployed(By Choice)", label: "Unemployed(By Choice)" },
    { value: "Unemployed(Searching for job)", label: "Unemployed(Searching for job)" },
  ];
  const occupationTransitionTimingOptions = [
    { value: "Before graduation", label: "Before graduation" },
    { value: "Immediately after graduation", label: "Immediately after graduation" },
    { value: "Within 3 months", label: "Within 3 months" },
    { value: "Within 6 months", label: "Within 6 months" },
    { value: "After 6 months", label: "After 6 months" },
  ];

  type MoreDetailsField = {
    label: string;
    value: unknown;
    key: string;
    editable: boolean;
    type?: "text" | "email" | "tel" | "number" | "textarea" | "select" | "checkbox" | "password" | "date";
    options?: Array<{ value: string; label: string }>;
    isSpecial?: boolean;
  };

  const sections: Array<{ title: string; fields: MoreDetailsField[] }> = [
    {
      title: "Personal Information",
      fields: [
        { label: "Name", value: data.alumniname, key: "alumniname", editable: false },
        { label: "SAP ID", value: data.sapid, key: "sapid", editable: false },
        { label: "Registration Number", value: data.registrationno, key: "registrationno", editable: false },
        { label: "Gender", value: data.gender, key: "gender", editable: false },
        { label: "Father's Name", value: data.fathername, key: "fathername", editable: false },
        { label: "Date of Birth", value: data.dateofbirth, key: "dateofbirth", editable: true, type: "date" as const },
        { label: "Marital Status", value: data.maritalstatus, key: "maritalstatus", editable: true, type: "select" as const, options: maritalStatusOptions },
        { label: "CNIC/Passport", value: data.cnicpassport, key: "cnicpassport", editable: false },
      ],
    },
    {
      title: "Contact Information",
      fields: [
        { label: "Primary Contact", value: data.contactno, key: "contactno", editable: true, type: "tel" as const },
        { label: "Secondary Contact", value: data.contactno1, key: "contactno1", editable: true, type: "tel" as const },
        { label: "Personal Email", value: data.personalemail, key: "personalemail", editable: true, type: "email" as const },
        { label: "Alumni Email", value: data.universityemail, key: "universityemail", editable: false, type: "email" as const },
      ],
    },
    {
      title: "Address Information",
      fields: [
        { label: "Home Country", value: data.country, key: "country", editable: true, isSpecial: true },
        { label: "Home Province", value: data.province, key: "province", editable: true, isSpecial: true },
        { label: "Home City", value: data.city, key: "city", editable: true, isSpecial: true },
        { label: "Home Address", value: data.address, key: "address", editable: true, type: "textarea" as const },
      ],
    },
    {
      title: "Academic Information",
      fields: [
        { label: "Campus", value: data.campusname, key: "campusname", editable: false },
        { label: "Faculty", value: data.facultyname, key: "facultyname", editable: false },
        { label: "Department", value: data.departmentname, key: "departmentname", editable: false },
        { label: "Program", value: data.degreetitle, key: "degreetitle", editable: false },
        { label: "CGPA", value: data.cgpa, key: "cgpa", editable: true, type: "number" as const },
        { label: "Year of Starting", value: data.yearofstarting, key: "yearofstarting", editable: false },
        { label: "Year of Ending", value: data.yearofending, key: "yearofending", editable: false },
      ],
    },
    {
      title: "Employment Information",
      fields: [
        { label: "Employment Status", value: data.employeed, key: "employeed", editable: true, type: "select" as const, options: employmentStatusOptions, isSpecial: true },
       
      ],
    },
    {
      title: "Additional Information",
      fields: [
        { label: "About Me", value: data.aboutme, key: "aboutme", editable: true, type: "textarea" as const },
        { label: "Last Login", value: formatDateTimeDisplay(data.lasttimelogin) || "Never", key: "lasttimelogin", editable: false },
        { label: "Login Count", value: data.logincount, key: "logincount", editable: false },
        { label: "Last Updated", value: formatDateDisplay((data as Record<string, unknown>).updated_at as unknown), key: "updated_at", editable: false },
        { label: "Created Date", value: data.createddatetime, key: "createddatetime", editable: false },
      ],
    },
    {
      title: "Social Media Links",
      fields: [
        { label: "Facebook", value: data.facebook, key: "facebook", editable: true, type: "text" as const },
        { label: "Instagram", value: data.instagram, key: "instagram", editable: true, type: "text" as const },
        { label: "YouTube", value: data.youtube, key: "youtube", editable: true, type: "text" as const },
        { label: "LinkedIn", value: data.linkedin, key: "linkedin", editable: true, type: "text" as const },
      ],
    },
  ];

  const isAdminOrSuperAdmin = canModify(session?.user);

  const handleSendCredentials = async () => {
    if (!data.alumniid || data.alumniid <= 0) {
      toast.error("Missing alumniId");
      return;
    }
    if (isSendingCredentials) return;
    setIsSendingCredentials(true);
    try {
      const res = await fetch("/api/send-credentials", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ alumniId: data.alumniid }),
      });
      const j = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || j?.ok === false) {
        throw new Error(j?.error || `Failed (${res.status})`);
      }
      toast.success("Credentials email sent");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to send credentials";
      toast.error(msg);
    } finally {
      setIsSendingCredentials(false);
    }
  };

  return (
    <>
      <AppHeader />
      <Toaster
        position="top-right"
        containerStyle={{ top: 80, zIndex: 100000 }}
      />
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 dark:text-gray-300 dark:bg-gray-900">
        <PageBanner title="Profile Details" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 dark:text-gray-300 dark:bg-gray-900 dark:border border-gray-700">
          <div className="mb-6">
            <BackButton />
          </div>

          <div className="bg-white rounded-lg shadow-sm overflow-hidden dark:bg-gray-900 dark:border dark:border-gray-700">
            <div className="p-6 sm:p-8">
              <div className="flex flex-col lg:flex-row gap-8">
                <div className="w-full lg:w-72 flex-shrink-0">
                  <div className="bg-gray-50 rounded-xl p-6 border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
                    <div className="flex flex-col items-center">
                      <div className="relative w-32 h-32 rounded-full overflow-hidden border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
                        <Image
                          src={normalizeImagePath(data.image1)}
                          alt={data.alumniname || "Profile"}
                          fill
                          className="object-cover"
                        />
                      </div>
                      <div className="mt-4 text-center">
                        <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{data.alumniname || "-"}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">{data.sapid || data.registrationno || ""}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex-1">
                  {isAdminOrSuperAdmin && data.alumniid && data.alumniid > 0 && (
                    <div className="mb-4 flex items-center justify-end">
                      <button
                        type="button"
                        disabled={isSendingCredentials}
                        onClick={handleSendCredentials}
                        className="inline-flex items-center justify-center rounded-md px-3 py-2 text-xs font-semibold bg-[#183D32] text-white hover:bg-[#183D32]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {isSendingCredentials ? "Sending..." : "Send Credentials"}
                      </button>
                    </div>
                  )}

                  <div className="space-y-8">
                    {sections.map((section) => (
                      <div key={section.title} className="border border-gray-200 rounded-xl overflow-hidden dark:border-gray-700">
                        <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 dark:bg-gray-800 dark:border-gray-700">
                          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">{section.title}</h3>
                        </div>
                        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
                          {section.fields.map((field) => {
                            const editable = field.editable && !isViewer;

                            if (field.isSpecial && field.key === "country") {
                              return (
                                <EditableCountryProvinceCity
                                  key={field.key}
                                  countryValue={data.country}
                                  provinceValue={data.province}
                                  cityValue={data.city}
                                  pendingCountryValue={pendingDisplayMap.country}
                                  pendingProvinceValue={pendingDisplayMap.province}
                                  pendingCityValue={pendingDisplayMap.city}
                                  disabled={!editable}
                                  onCountryChange={(_, value) => handleFieldValueChange("country", value)}
                                  onProvinceChange={(_, value) => handleFieldValueChange("province", value)}
                                  onCityChange={(_, value) => handleFieldValueChange("city", value)}
                                />
                              );
                            }

                            if (field.isSpecial && field.key === "employeed") {
                              return (
                                <EditableEmploymentStatus
                                  key={field.key}
                                  employeedValue={data.employeed}
                                  industryValue={data.industry}
                                  nameoforganizationValue={data.nameoforganization}
                                  designationValue={data.designation}
                                  totalyearsofexpereinceValue={data.totalyearsofexpereince}
                                  occupationTransitionTimingValue={data.occupation_transition_timing}
                                  organizationAddressValue={data.organization_address}
                                  workCountryValue={data.work_country}
                                  workCityValue={data.work_city}
                                  workEmailValue={data.officialemail}
                                  workPhoneValue={data.officialnumber}
                                  instituteNameValue={data.higher_education_institute_name}
                                  programValue={data.higher_education_program}
                                  instituteCountryValue={data.higher_education_institute_country}
                                  instituteCityValue={data.higher_education_institute_city}
                                  scholarshipValue={data.is_scholarship}
                                  pendingValues={pendingDisplayMap}
                                  disabled={!editable}
                                  onEmployeedChange={(_, value) => handleFieldValueChange("employeed", value)}
                                  onIndustryChange={(_, value) => handleFieldValueChange("industry", value)}
                                  onOrganizationChange={(_, value) => handleFieldValueChange("nameoforganization", value)}
                                  onDesignationChange={(_, value) => handleFieldValueChange("designation", value)}
                                  onExperienceChange={(_, value) => handleFieldValueChange("totalyearsofexpereince", value)}
                                  onOccupationTransitionTimingChange={(_, value) => handleFieldValueChange("occupation_transition_timing", value)}
                                  onOrganizationAddressChange={(_, value) => handleFieldValueChange("organization_address", value)}
                                  onWorkCountryChange={(_, value) => handleFieldValueChange("work_country", value)}
                                  onWorkCityChange={(_, value) => handleFieldValueChange("work_city", value)}
                                  onWorkEmailChange={(_, value) => handleFieldValueChange("officialemail", value)}
                                  onWorkPhoneChange={(_, value) => handleFieldValueChange("officialnumber", value)}
                                  onInstituteNameChange={(_, value) => handleFieldValueChange("higher_education_institute_name", value)}
                                  onProgramChange={(_, value) => handleFieldValueChange("higher_education_program", value)}
                                  onInstituteCountryChange={(_, value) => handleFieldValueChange("higher_education_institute_country", value)}
                                  onInstituteCityChange={(_, value) => handleFieldValueChange("higher_education_institute_city", value)}
                                  onScholarshipChange={(_, value) => handleFieldValueChange("is_scholarship", value)}
                                />
                              );
                            }

                            return (
                              <EditableField
                                key={field.key}
                                label={field.label}
                                value={field.value}
                                pendingValue={pendingDisplayMap[field.key]}
                                fieldKey={field.key}
                                type={field.type}
                                options={field.options}
                                disabled={!editable}
                                batchMode={true}
                                onValueChange={handleFieldValueChange}
                              />
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-8 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={handleCancelAll}
                      disabled={isSavingAll || Object.keys(pendingChanges).length === 0}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                    >
                      Cancel Changes
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveAll}
                      disabled={isSavingAll || Object.keys(pendingChanges).length === 0}
                      className="px-4 py-2 text-sm font-semibold text-white bg-[#183D32] hover:bg-[#183D32]/90 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSavingAll ? "Saving..." : "Save All"}
                    </button>
                  </div>

                  {isAlumniUser && (
                    <div className="mt-8 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <h3 className="text-base font-semibold text-slate-900 dark:text-gray-100">Change Password</h3>
                          <p className="mt-1 text-sm text-slate-600 dark:text-gray-400">For security, you must enter your current password.</p>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-1 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-gray-300">Current Password</label>
                          <div className="mt-1 flex gap-2">
                            <input
                              type={showCurrentPassword ? "text" : "password"}
                              value={currentPassword}
                              onChange={(e) => setCurrentPassword(e.target.value)}
                              className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-theme-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus-visible:ring-blue-500"
                              disabled={isChangingPassword}
                            />
                            <button
                              type="button"
                              onClick={() => setShowCurrentPassword((v) => !v)}
                              className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                            >
                              {showCurrentPassword ? "Hide" : "Show"}
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-gray-300">New Password</label>
                          <div className="mt-1 flex gap-2">
                            <input
                              type={showNewPassword ? "text" : "password"}
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-theme-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus-visible:ring-blue-500"
                              disabled={isChangingPassword}
                            />
                            <button
                              type="button"
                              onClick={() => setShowNewPassword((v) => !v)}
                              className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                            >
                              {showNewPassword ? "Hide" : "Show"}
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-gray-300">Confirm New Password</label>
                          <div className="mt-1 flex gap-2">
                            <input
                              type={showConfirmPassword ? "text" : "password"}
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-theme-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus-visible:ring-blue-500"
                              disabled={isChangingPassword}
                            />
                            <button
                              type="button"
                              onClick={() => setShowConfirmPassword((v) => !v)}
                              className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                            >
                              {showConfirmPassword ? "Hide" : "Show"}
                            </button>
                          </div>
                        </div>

                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={handleChangePassword}
                            disabled={isChangingPassword}
                            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                          >
                            {isChangingPassword ? "Changing..." : "Change Password"}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function MoreDetailsPage() {
  return (
    <Suspense fallback={null}>
      <MoreDetailsContent />
    </Suspense>
  );
}
