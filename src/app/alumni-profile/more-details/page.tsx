"use client";
import { Suspense, useState, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useAlumniFullDetails, useUpdateAlumniFields } from "@/app/queries/alumni-profile";
import AppHeader from "@/layout/AppHeader";
import Image from "next/image";
import BackButton from "@/components/ui/BackButton";
import PageBanner from "@/components/ui/PageBanner";
import EditableField from "@/components/ui/EditableField";
import EditableCountryProvinceCity from "@/components/ui/EditableCountryProvinceCity";
import EditableEmploymentStatus from "@/components/ui/EditableEmploymentStatus";
import { Toaster, toast } from "react-hot-toast";
import { isViewerUser } from "@/lib/alumniProfile";

function MoreDetailsContent() {
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const isViewer = isViewerUser(session?.user);
  
  // Get identifier from URL params, or fallback to session (SAP ID or registration number)
  const urlSapId = searchParams.get("sapid") || "";
  
  // Extract session identifiers
  let sessionSapid: string | undefined;
  let sessionRegNo: string | undefined;
  if (session?.user) {
    const user = session.user as Record<string, unknown>;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const sapIdValue = user["sapid"];
    const regNoValue = user["registrationno"];
    sessionSapid = sapIdValue ? String(sapIdValue).trim() : undefined;
    sessionRegNo = regNoValue ? String(regNoValue).trim() : undefined;
  }
  
  // Use URL param if available, otherwise use session SAP ID, otherwise use registration number
  const sapId = urlSapId || sessionSapid || sessionRegNo || "";

  const { data, isLoading, isError, error, refetch } = useAlumniFullDetails(sapId || undefined);
  const updateMutation = useUpdateAlumniFields(sapId || undefined);
  const [pendingChanges, setPendingChanges] = useState<Record<string, unknown>>({});
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

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
  const normalizeValue = (val: unknown): unknown => {
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
  };

  // Helper function to check if two values are effectively the same
  const valuesAreEqual = (val1: unknown, val2: unknown): boolean => {
    const normalized1 = normalizeValue(val1);
    const normalized2 = normalizeValue(val2);
    // Also handle number comparisons (e.g., "123" === 123)
    if (typeof normalized1 === "string" && typeof normalized2 === "number") {
      return normalized1 === String(normalized2);
    }
    if (typeof normalized1 === "number" && typeof normalized2 === "string") {
      return String(normalized1) === normalized2;
    }
    return normalized1 === normalized2;
  };

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

    // Validate: If employment status requires fields, validate them
    const employmentStatusChanged = pendingChanges.employeed !== undefined;
    const currentEmploymentStatus = employmentStatusChanged 
      ? pendingChanges.employeed 
      : (data?.employeed ?? null);
    
    // Get current values (use pending changes if available, otherwise use data)
    const getValue = (key: string) => {
      // Special handling for startOfCareer - it's stored as totalyearsofexpereince
      if (key === "startOfCareer") {
        // Check if startOfCareer is explicitly in pendingChanges
        if ("startOfCareer" in pendingChanges) {
          return pendingChanges.startOfCareer;
        }
        // Otherwise, calculate from totalyearsofexpereince
        const totalYears = pendingChanges.totalyearsofexpereince !== undefined 
          ? pendingChanges.totalyearsofexpereince 
          : (data?.totalyearsofexpereince ?? null);
        if (totalYears) {
          const years = Number(totalYears);
          if (!isNaN(years) && years > 0) {
            return new Date().getFullYear() - years;
          }
        }
        // Check if startOfCareer exists in data
        const startOfCareer = (data as Record<string, unknown>).startOfCareer;
        if (startOfCareer) {
          if (typeof startOfCareer === "number") return startOfCareer;
          if (typeof startOfCareer === "string") {
            const year = new Date(startOfCareer).getFullYear();
            return isNaN(year) ? null : year;
          }
        }
        return null;
      }
      
      // Check pendingChanges first (user's current edits)
      // Use 'in' operator to check if key exists, even if value is empty string
      if (key in pendingChanges) {
        const pendingValue = pendingChanges[key];
        // Return the actual value as-is (including empty strings)
        // We'll validate empty strings in the validation check below
        return pendingValue;
      }
      // Fall back to data from API
      const dataValue = (data as Record<string, unknown>)?.[key];
      return dataValue ?? null;
    };
    
    // Check employment status (handle both DB values and display values)
    const employmentStatusLower = String(currentEmploymentStatus || "").toLowerCase();
    const isEmployedOrBusiness = employmentStatusLower === "employed" || employmentStatusLower === "employed/business";
    const isSelfEmployed = employmentStatusLower === "self-emplo" || employmentStatusLower === "self-employed";
    const isPursuingHigherEd = employmentStatusLower === "pursuing higher education" || employmentStatusLower === "highered";
    
    // Both "Employed/Business" and "Self-employed" require the same fields
    if (isEmployedOrBusiness || isSelfEmployed) {
      const requiredFields = [
        { key: "industry", label: "Sector" },
        { key: "nameoforganization", label: "Company Name" },
        { key: "designation", label: "Designation" },
        { key: "startOfCareer", label: "Start of Career" },
        { key: "organization_address", label: "Company Address" },
      ];

      const missingFields: string[] = [];
      
      for (const field of requiredFields) {
        const value = getValue(field.key);
        // Check if value is null, undefined, or empty string (after trimming)
        // For startOfCareer (number), also check if it's 0 or NaN
        let isEmpty = value === null || 
                      value === undefined || 
                      (typeof value === "string" && value.trim() === "");
        if (field.key === "startOfCareer") {
          // For start of career, check if it's a valid year
          const year = typeof value === "number" ? value : (typeof value === "string" ? Number(value) : null);
          isEmpty = year === null || isNaN(year) || year <= 1900 || year > new Date().getFullYear();
        }
        if (isEmpty) {
          missingFields.push(field.label);
        }
      }

      if (missingFields.length > 0) {
        const fieldsList = missingFields.join(", ");
        const statusLabel = isSelfEmployed ? "Self-employed" : "Employed/Business";
        toast.error(
          `When employment status is "${statusLabel}", the following fields are required: ${fieldsList}. Please fill in all required fields before saving.`,
          {
            duration: 6000,
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

    // Validate: If employment status is "Pursuing Higher Education", all higher education fields are required
    if (isPursuingHigherEd) {
      const requiredFields = [
        { key: "higher_education_institute_name", label: "Institute Name" },
        { key: "higher_education_program", label: "Program" },
        { key: "higher_education_institute_country", label: "Country" },
        { key: "higher_education_institute_city", label: "City" },
        { key: "is_scholarship", label: "Funding Source" },
      ];

      const missingFields: string[] = [];
      
      for (const field of requiredFields) {
        const value = getValue(field.key);
        if (!value || String(value).trim() === "") {
          missingFields.push(field.label);
        }
      }

      if (missingFields.length > 0) {
        const fieldsList = missingFields.join(", ");
        toast.error(
          `When employment status is "Pursuing Higher Education", the following fields are required: ${fieldsList}. Please fill in all required fields before saving.`,
          {
            duration: 6000,
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

    const changesCount = Object.keys(pendingChanges).length;
    setIsSavingAll(true);
    try {
      await updateMutation.mutateAsync(pendingChanges as Partial<NonNullable<typeof data>>);
      // Clear pending changes after successful save
      setPendingChanges({});
      // Force refetch to ensure we have the latest from the database
      await refetch();
      toast.success(`Successfully saved ${changesCount} field${changesCount > 1 ? 's' : ''}`, {
        duration: 3000,
        style: {
          background: '#d1fae5',
          color: '#065f46',
          padding: '12px',
          borderRadius: '8px',
        },
      });
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
        <div className="min-h-screen bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="bg-white rounded-lg shadow-sm p-8">
              <div className="flex items-center justify-center py-12">
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
        </div>
      </>
    );
  }

  if (isError || !data) {
    return (
      <>
        <AppHeader />
        <div className="min-h-screen bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="bg-white rounded-lg shadow-sm p-8">
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center gap-4">
                  <svg className="h-12 w-12 text-red-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-red-600">Failed to load profile details</p>
                  <p className="text-xs text-gray-500">{error instanceof Error ? error.message : "Unknown error"}</p>
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

  const formatValue = (value: unknown, isPassword: boolean = false): string => {
    if (value === null || value === undefined) return "Not provided";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    // For password fields, always show masked value
    if (isPassword) {
      const strValue = String(value).trim();
      return strValue === "" ? "Not provided" : strValue;
    }
    const strValue = String(value).trim();
    return strValue === "" ? "Not provided" : strValue;
  };

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
    { value: "Single", label: "Single" },
    { value: "Married", label: "Married" },
  ];

  // Employment status options matching AlumniSqlForm.tsx
  const employmentStatusOptions = [
    { value: "Employed/Business", label: "Employed/Business" },
    { value: "Self-employed", label: "Self-Employed" },
    { value: "Pursuing Higher Education", label: "Pursuing Higher Education" },
    { value: "Unemployed By choice", label: "Unemployed By choice" },
    { value: "Unemployed, searching for job", label: "Unemployed, searching for job" },
  ];

  const sections = [
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
        { label: "Password", value: data.password, key: "password", editable: true, type: "password" as const },
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
        { label: "Industry", value: data.industry, key: "industry", editable: true, isSpecial: true },
        { label: "Company Name", value: data.nameoforganization, key: "nameoforganization", editable: true, isSpecial: true },
        { label: "Designation", value: data.designation, key: "designation", editable: true, isSpecial: true },
        { label: "Start of Career", value: (() => {
          // Try to get startOfCareer from data, or calculate from total years of experience
          const startOfCareer = (data as Record<string, unknown>).startOfCareer;
          if (startOfCareer) {
            if (typeof startOfCareer === "string") {
              const year = new Date(startOfCareer).getFullYear();
              return isNaN(year) ? null : year;
            }
            return typeof startOfCareer === "number" ? startOfCareer : null;
          }
          // Calculate from total years of experience if available
          if (data.totalyearsofexpereince) {
            const years = Number(data.totalyearsofexpereince);
            if (!isNaN(years) && years > 0) {
              return new Date().getFullYear() - years;
            }
          }
          return null;
        })(), key: "startOfCareer", editable: true, type: "number" as const, isSpecial: true },
        // Work location fields are now handled by EditableEmploymentStatus component
        // They are shown conditionally based on employment status
      ],
    },
    {
      title: "Additional Information",
      fields: [
        { label: "About Me", value: data.aboutme, key: "aboutme", editable: true, type: "textarea" as const },
        { label: "Last Login", value: data.lasttimelogin, key: "lasttimelogin", editable: false },
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

  return (
    <>
      <AppHeader />
      <Toaster position="top-right" />
      <PageBanner title="More Details" />
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Profile Details</h1>
                <p className="mt-1 text-sm text-gray-500">Complete information about your profile. Hover over fields to edit.</p>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                {Object.keys(pendingChanges).length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <span className="text-sm font-medium text-yellow-800 whitespace-nowrap">
                      {Object.keys(pendingChanges).length} change{Object.keys(pendingChanges).length > 1 ? 's' : ''} pending
                    </span>
                    {!isViewer && (
                      <>
                        <button
                          type="button"
                          onClick={handleCancelAll}
                          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg transition-colors whitespace-nowrap"
                        >
                          Cancel All
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveAll}
                          disabled={isSavingAll}
                          className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap shadow-md"
                        >
                          {isSavingAll ? (
                            <>
                              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Saving...
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Save All Changes
                            </>
                          )}
                        </button>
                      </>
                    )}
                  </div>
                )}
                <BackButton />
              </div>
            </div>
          </div>

          {/* Profile Image */}
          {data.image1 && (
            <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
              <div className="flex items-center gap-6">
                <div className="relative w-32 h-32 rounded-full border-4 border-white bg-gray-100 overflow-hidden">
                  <Image
                    src={normalizeImagePath(data.image1)}
                    alt={data.alumniname || "Profile"}
                    width={128}
                    height={128}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{data.alumniname || "N/A"}</h2>
                  <p className="text-gray-600">{data.sapid || "N/A"}</p>
                </div>
              </div>
            </div>
          )}

          {/* Details Sections */}
          <div className="space-y-6">
            {sections.map((section, sectionIndex) => (
              <div key={sectionIndex} className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
                  {section.title}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {section.title === "Address Information" ? (
                    // Special rendering for Country/Province/City with dependencies
                    <>
                      <EditableCountryProvinceCity
                        countryValue={pendingChanges.country !== undefined ? pendingChanges.country : data.country}
                        provinceValue={pendingChanges.province !== undefined ? pendingChanges.province : data.province}
                        cityValue={pendingChanges.city !== undefined ? pendingChanges.city : data.city}
                        onCountryChange={handleFieldValueChange}
                        onProvinceChange={handleFieldValueChange}
                        onCityChange={handleFieldValueChange}
                        disabled={isViewer}
                      />
                      <EditableField
                        label="Address"
                        value={pendingChanges.address !== undefined ? pendingChanges.address : data.address}
                        fieldKey="address"
                        onValueChange={handleFieldValueChange}
                        type="textarea"
                        batchMode={true}
                        disabled={isViewer}
                      />
                    </>
                  ) : section.title === "Employment Information" ? (
                    // Special rendering for Employment Status with conditional fields
                    <>
                      <EditableEmploymentStatus
                        employeedValue={pendingChanges.employeed !== undefined ? pendingChanges.employeed : data.employeed}
                        industryValue={pendingChanges.industry !== undefined ? pendingChanges.industry : data.industry}
                        nameoforganizationValue={pendingChanges.nameoforganization !== undefined ? pendingChanges.nameoforganization : data.nameoforganization}
                        designationValue={pendingChanges.designation !== undefined ? pendingChanges.designation : data.designation}
                        totalyearsofexpereinceValue={(() => {
                          // Check if startOfCareer is in pending changes
                          if (pendingChanges.startOfCareer !== undefined) {
                            const startYear = typeof pendingChanges.startOfCareer === "number" ? pendingChanges.startOfCareer : Number(pendingChanges.startOfCareer);
                            if (!isNaN(startYear) && startYear > 1900) {
                              const currentYear = new Date().getFullYear();
                              const calculatedYears = currentYear - startYear;
                              return calculatedYears > 0 ? String(calculatedYears) : null;
                            }
                          }
                          // Check if startOfCareer is in data
                          const startOfCareer = (data as Record<string, unknown>).startOfCareer;
                          if (startOfCareer) {
                            const startYear = typeof startOfCareer === "number" ? startOfCareer : (typeof startOfCareer === "string" ? new Date(startOfCareer).getFullYear() : Number(startOfCareer));
                            if (!isNaN(startYear) && startYear > 1900) {
                              const currentYear = new Date().getFullYear();
                              const calculatedYears = currentYear - startYear;
                              return calculatedYears > 0 ? String(calculatedYears) : null;
                            }
                          }
                          // Fall back to totalyearsofexpereince
                          return pendingChanges.totalyearsofexpereince !== undefined ? pendingChanges.totalyearsofexpereince : data.totalyearsofexpereince;
                        })()}
                        organizationAddressValue={pendingChanges.organization_address !== undefined ? pendingChanges.organization_address : data.organization_address}
                        disabled={isViewer}
                        degreeTitleValue={pendingChanges.degree_title !== undefined ? pendingChanges.degree_title : (data as Record<string, unknown>).degree_title ?? null}
                        instituteNameValue={pendingChanges.higher_education_institute_name !== undefined ? pendingChanges.higher_education_institute_name : (data as Record<string, unknown>).higher_education_institute_name ?? null}
                        programValue={pendingChanges.higher_education_program !== undefined ? pendingChanges.higher_education_program : (data as Record<string, unknown>).higher_education_program ?? null}
                        instituteCountryValue={pendingChanges.higher_education_institute_country !== undefined ? pendingChanges.higher_education_institute_country : (data as Record<string, unknown>).higher_education_institute_country ?? null}
                        instituteCityValue={pendingChanges.higher_education_institute_city !== undefined ? pendingChanges.higher_education_institute_city : (data as Record<string, unknown>).higher_education_institute_city ?? null}
                        scholarshipValue={pendingChanges.is_scholarship !== undefined ? pendingChanges.is_scholarship : (data as Record<string, unknown>).is_scholarship ?? null}
                        onEmployeedChange={handleFieldValueChange}
                        onIndustryChange={handleFieldValueChange}
                        onOrganizationChange={handleFieldValueChange}
                        onDesignationChange={handleFieldValueChange}
                        onExperienceChange={handleFieldValueChange}
                        onStartOfCareerChange={handleFieldValueChange}
                        onOrganizationAddressChange={handleFieldValueChange}
                        workCountryValue={pendingChanges.work_country !== undefined ? pendingChanges.work_country : (data as Record<string, unknown>).work_country}
                        workCityValue={pendingChanges.work_city !== undefined ? pendingChanges.work_city : (data as Record<string, unknown>).work_city}
                        workPhoneValue={pendingChanges.officialnumber !== undefined ? pendingChanges.officialnumber : data.officialnumber}
                        workEmailValue={pendingChanges.officialemail !== undefined ? pendingChanges.officialemail : data.officialemail}
                        aboutMeValue={pendingChanges.about !== undefined ? pendingChanges.about : (data as Record<string, unknown>).about}
                        onWorkCountryChange={handleFieldValueChange}
                        onWorkCityChange={handleFieldValueChange}
                        onWorkPhoneChange={handleFieldValueChange}
                        onWorkEmailChange={handleFieldValueChange}
                        onAboutMeChange={handleFieldValueChange}
                        onDegreeTitleChange={handleFieldValueChange}
                        onInstituteNameChange={handleFieldValueChange}
                        onProgramChange={handleFieldValueChange}
                        onInstituteCountryChange={handleFieldValueChange}
                        onInstituteCityChange={handleFieldValueChange}
                        onScholarshipChange={handleFieldValueChange}
                      />
                      {section.fields
                        .filter(f => {
                          const fieldWithExtras = f as typeof f & { isSpecial?: boolean };
                          return !f.editable || !fieldWithExtras.isSpecial;
                        })
                        .map((field, fieldIndex) => (
                          <div key={fieldIndex} className="flex flex-col">
                            <span className="text-sm font-medium text-gray-500 mb-1">{field.label}</span>
                            <span className="text-base text-gray-900 break-words">
                              {field.value && typeof field.value === "string" && (field.value.startsWith("http://") || field.value.startsWith("https://")) ? (
                                <a
                                  href={field.value}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800 underline"
                                >
                                  {field.value}
                                </a>
                              ) : (
                                formatValue(field.value)
                              )}
                            </span>
                          </div>
                        ))}
                    </>
                  ) : (
                    // Regular rendering for other sections
                    section.fields.map((field, fieldIndex) => {
                      // Handle conditional fields (e.g., official email/number only shown when employed)
                      const fieldWithExtras = field as typeof field & { isConditional?: boolean; conditionalKey?: string; conditionalValue?: string; isSpecial?: boolean; type?: string; options?: Array<{ value: string; label: string }> };
                      if (fieldWithExtras.isConditional) {
                        const conditionalKey = fieldWithExtras.conditionalKey;
                        const conditionalValue = fieldWithExtras.conditionalValue;
                        if (conditionalKey) {
                          const currentConditionalValue = pendingChanges[conditionalKey] !== undefined 
                            ? pendingChanges[conditionalKey] 
                            : data[conditionalKey as keyof typeof data];
                          const shouldShow = String(currentConditionalValue || "").toLowerCase() === String(conditionalValue || "").toLowerCase();
                          if (!shouldShow) {
                            return null;
                          }
                        }
                      }
                      
                      if (field.editable && !fieldWithExtras.isSpecial) {
                        // Use the pending value if available, otherwise use the original value
                        const displayValue = pendingChanges[field.key] !== undefined 
                          ? pendingChanges[field.key] 
                          : field.value;
                        
                        return (
                          <EditableField
                            key={fieldIndex}
                            label={field.label}
                            value={displayValue}
                            fieldKey={field.key}
                            onValueChange={handleFieldValueChange}
                            type={fieldWithExtras.type || "text"}
                            options={fieldWithExtras.options}
                            batchMode={true}
                            disabled={isViewer}
                          />
                        );
                      }
                      if (!field.editable) {
                        return (
                          <div key={fieldIndex} className="flex flex-col">
                            <span className="text-sm font-medium text-gray-500 mb-1">{field.label}</span>
                            <span className="text-base text-gray-900 break-words">
                              {field.value && typeof field.value === "string" && (field.value.startsWith("http://") || field.value.startsWith("https://")) ? (
                                <a
                                  href={field.value}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800 underline"
                                >
                                  {field.value}
                                </a>
                              ) : (
                                formatValue(field.value)
                              )}
                            </span>
                          </div>
                        );
                      }
                      return null;
                    })
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

export default function MoreDetailsPage() {
  return (
    <Suspense
      fallback={
        <>
          <AppHeader />
          <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <div className="bg-white rounded-lg shadow-sm p-8">
                <div className="flex items-center justify-center py-12">
                  <div className="flex flex-col items-center gap-4">
                    <svg className="animate-spin h-12 w-12 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p className="text-sm text-gray-600">Loading...</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      }
    >
      <MoreDetailsContent />
    </Suspense>
  );
}

