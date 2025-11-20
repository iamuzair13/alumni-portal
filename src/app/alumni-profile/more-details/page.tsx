"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useAlumniFullDetails } from "@/app/queries/alumni-profile";
import AppHeader from "@/layout/AppHeader";
import Image from "next/image";
import Link from "next/link";

function MoreDetailsContent() {
  const searchParams = useSearchParams();
  const sapId = searchParams.get("sapid") || "";

  const { data, isLoading, isError, error } = useAlumniFullDetails(sapId || undefined);

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
                  <Link
                    href="/alumni-profile"
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Back to Profile
                  </Link>
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
    return String(value);
  };

  const sections = [
    {
      title: "Personal Information",
      fields: [
        { label: "Name", value: data.alumniname },
        { label: "SAP ID", value: data.sapid },
        { label: "Registration Number", value: data.registrationno },
        { label: "Gender", value: data.gender },
        { label: "Father's Name", value: data.fathername },
        { label: "Date of Birth", value: data.dateofbirth },
        { label: "Marital Status", value: data.maritalstatus },
        { label: "CNIC/Passport", value: data.cnicpassport },
      ],
    },
    {
      title: "Contact Information",
      fields: [
        { label: "Primary Contact", value: data.contactno },
        { label: "Secondary Contact", value: data.contactno1 },
        { label: "Show Secondary Contact", value: data.contactno1show },
        { label: "Personal Email", value: data.personalemail },
        { label: "Show Personal Email", value: data.personalemailshow },
        { label: "University Email", value: data.universityemail },
        { label: "Official Email", value: data.officialemail },
        { label: "Official Number", value: data.officialnumber },
      ],
    },
    {
      title: "Address Information",
      fields: [
        { label: "Country", value: data.country },
        { label: "Province", value: data.province },
        { label: "City", value: data.city },
        { label: "Address", value: data.address },
      ],
    },
    {
      title: "Academic Information",
      fields: [
        { label: "Campus", value: data.campusname },
        { label: "Faculty", value: data.facultyname },
        { label: "Department", value: data.departmentname },
        { label: "Degree Title", value: data.degreetitle },
        { label: "Major Subject", value: data.majorsubject },
        { label: "CGPA", value: data.cgpa },
        { label: "Academic Session", value: data.academicsession },
        { label: "Year of Starting", value: data.yearofstarting },
        { label: "Year of Ending", value: data.yearofending },
      ],
    },
    {
      title: "Employment Information",
      fields: [
        { label: "Employment Status", value: data.employeed },
        { label: "Industry", value: data.industry },
        { label: "Organization", value: data.nameoforganization },
        { label: "Designation", value: data.designation },
        { label: "Total Years of Experience", value: data.totalyearsofexpereince },
        { label: "Supervisor Name", value: data.supervisorname },
        { label: "Supervisor Designation", value: data.supervisordesignation },
        { label: "Supervisor Email", value: data.supervisoremail },
        { label: "Supervisor Number", value: data.supervisornumber },
      ],
    },
    {
      title: "Additional Information",
      fields: [
        { label: "About Me", value: data.aboutme },
        { label: "Data Source", value: data.datasource },
        { label: "Alumni Status", value: data.alumnistatus },
        { label: "Verification Status", value: data.verify },
        { label: "Last Login", value: data.lasttimelogin },
        { label: "Login Count", value: data.logincount },
        { label: "Created Date", value: data.createddatetime },
      ],
    },
    {
      title: "Social Media Links",
      fields: [
        { label: "Facebook", value: data.facebook },
        { label: "Instagram", value: data.instagram },
        { label: "YouTube", value: data.youtube },
        { label: "LinkedIn", value: data.linkedin },
      ],
    },
  ];

  return (
    <>
      <AppHeader />
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Profile Details</h1>
              <p className="mt-1 text-sm text-gray-500">Complete information about your profile</p>
            </div>
            <Link
              href={sapId ? `/alumni-profile?sapid=${encodeURIComponent(sapId)}` : "/alumni-profile"}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Profile
            </Link>
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
                  {section.fields.map((field, fieldIndex) => (
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

