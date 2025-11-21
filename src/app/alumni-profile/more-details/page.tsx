"use client";
import { Suspense, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useAlumniFullDetails, useUpdateAlumniFields } from "@/app/queries/alumni-profile";
import AppHeader from "@/layout/AppHeader";
import Image from "next/image";
import BackButton from "@/components/ui/BackButton";
import EditableField from "@/components/ui/EditableField";
import EditableCountryProvinceCity from "@/components/ui/EditableCountryProvinceCity";
import EditableEmploymentStatus from "@/components/ui/EditableEmploymentStatus";
import { Toaster, toast } from "react-hot-toast";

function MoreDetailsContent() {
  const searchParams = useSearchParams();
  const sapId = searchParams.get("sapid") || "";

  const { data, isLoading, isError, error, refetch } = useAlumniFullDetails(sapId || undefined);
  const updateMutation = useUpdateAlumniFields(sapId || undefined);
  const [pendingChanges, setPendingChanges] = useState<Record<string, unknown>>({});
  const [isSavingAll, setIsSavingAll] = useState(false);

  const handleFieldValueChange = useCallback((key: string, value: unknown) => {
    if (value === undefined) {
      // Remove from pending changes
      setPendingChanges((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    } else {
      // Add or update pending change
      setPendingChanges((prev) => ({
        ...prev,
        [key]: value,
      }));
    }
  }, []);

  const handleSaveAll = async () => {
    if (!sapId || Object.keys(pendingChanges).length === 0 || isSavingAll) return;

    const changesCount = Object.keys(pendingChanges).length;
    setIsSavingAll(true);
    try {
      await updateMutation.mutateAsync(pendingChanges as Partial<NonNullable<typeof data>>);
      // Clear pending changes after successful save
      setPendingChanges({});
      // Refetch data to ensure we have the latest from the database
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
    } catch {
      toast.error("Failed to save changes. Please try again.", {
        duration: 4000,
        style: {
          background: '#fee2e2',
          color: '#991b1b',
          padding: '12px',
          borderRadius: '8px',
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

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return "Not provided";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    const strValue = String(value).trim();
    return strValue === "" ? "Not provided" : strValue;
  };

  const maritalStatusOptions = [
    { value: "Single", label: "Single" },
    { value: "Married", label: "Married" },
  ];

  const employmentStatusOptions = [
    { value: "Employed", label: "Employed" },
    { value: "Unemployed", label: "Unemployed" },
    { value: "HigherEd", label: "Pursuing Higher Education" },
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
        { label: "Date of Birth", value: data.dateofbirth, key: "dateofbirth", editable: false },
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
        { label: "University Email", value: data.universityemail, key: "universityemail", editable: true, type: "email" as const },
        { label: "Official Email", value: data.officialemail, key: "officialemail", editable: true, type: "email" as const, isConditional: true, conditionalKey: "employeed", conditionalValue: "Employed" },
        { label: "Official Number", value: data.officialnumber, key: "officialnumber", editable: true, type: "tel" as const, isConditional: true, conditionalKey: "employeed", conditionalValue: "Employed" },
      ],
    },
    {
      title: "Address Information",
      fields: [
        { label: "Country", value: data.country, key: "country", editable: true, isSpecial: true },
        { label: "Province", value: data.province, key: "province", editable: true, isSpecial: true },
        { label: "City", value: data.city, key: "city", editable: true, isSpecial: true },
        { label: "Address", value: data.address, key: "address", editable: true, type: "textarea" as const },
      ],
    },
    {
      title: "Academic Information",
      fields: [
        { label: "Campus", value: data.campusname, key: "campusname", editable: false },
        { label: "Faculty", value: data.facultyname, key: "facultyname", editable: false },
        { label: "Department", value: data.departmentname, key: "departmentname", editable: false },
        { label: "Degree Title", value: data.degreetitle, key: "degreetitle", editable: false },
        { label: "Major Subject", value: data.majorsubject, key: "majorsubject", editable: false },
        { label: "CGPA", value: data.cgpa, key: "cgpa", editable: true, type: "number" as const },
        { label: "Academic Session", value: data.academicsession, key: "academicsession", editable: false },
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
        { label: "Total Years of Experience", value: data.totalyearsofexpereince, key: "totalyearsofexpereince", editable: true, isSpecial: true },
      ],
    },
    {
      title: "Additional Information",
      fields: [
        { label: "About Me", value: data.aboutme, key: "aboutme", editable: false },
        { label: "Data Source", value: data.datasource, key: "datasource", editable: false },
        { label: "Alumni Status", value: data.alumnistatus, key: "alumnistatus", editable: false },
        { label: "Verification Status", value: data.verify, key: "verify", editable: false },
        { label: "Last Login", value: data.lasttimelogin, key: "lasttimelogin", editable: false },
        { label: "Login Count", value: data.logincount, key: "logincount", editable: false },
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
                    src={data.image1}
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
                      />
                      <EditableField
                        label="Address"
                        value={pendingChanges.address !== undefined ? pendingChanges.address : data.address}
                        fieldKey="address"
                        onValueChange={handleFieldValueChange}
                        type="textarea"
                        batchMode={true}
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
                        totalyearsofexpereinceValue={pendingChanges.totalyearsofexpereince !== undefined ? pendingChanges.totalyearsofexpereince : data.totalyearsofexpereince}
                        onEmployeedChange={handleFieldValueChange}
                        onIndustryChange={handleFieldValueChange}
                        onOrganizationChange={handleFieldValueChange}
                        onDesignationChange={handleFieldValueChange}
                        onExperienceChange={handleFieldValueChange}
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

