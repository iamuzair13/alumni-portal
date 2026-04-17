"use client";
import { useState, Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useAlumniFullDetails } from "@/app/queries/alumni-profile";
import AppHeader from "@/layout/AppHeader";
import BackButton from "@/components/ui/BackButton";
import { Toaster, toast } from "react-hot-toast";
import PageBanner from "@/components/ui/PageBanner";
import {
  SCHOLARSHIP_APPLYING_FOR_BY_CATEGORY,
  SCHOLARSHIP_DISCOUNT_CATEGORY_OPTIONS,
  isScholarshipFeeDiscountFlow,
  isScholarshipKinshipCategory,
  scholarshipApplyingForFromCategory,
} from "@/lib/scholarshipLetter";

function ScholarshipApplicationContent() {
  const searchParams = useSearchParams();
  const safeSearchParams = searchParams ?? new URLSearchParams();
  const sapIdFromParams = safeSearchParams.get("sapid");
  const [sapId, setSapId] = useState(sapIdFromParams || "");
  
  // Try to get SAP ID from session if not in params
  useEffect(() => {
    if (!sapId) {
      // Fetch current user's SAP ID from API
      fetch("/api/alumni/current-sapid")
        .then(res => res.json())
        .then(data => {
          if (data.sapid) {
            setSapId(data.sapid);
          }
        })
        .catch(() => {
          // If API fails, try to get from URL or show error
        });
    }
  }, [sapId]);
  
  const { data, isLoading } = useAlumniFullDetails(sapId || undefined);

  const [formData, setFormData] = useState({
    discountType: "",
    applyingFor: "",
    degreeTitle: "",
    kinshipRelation: "",
    kinshipFirstName: "",
    kinshipLastName: "",
    kinshipCnic: "",
    fatherCnic: "",
  });

  // Masters/PhD Discount specific state
  const [orgLoading, setOrgLoading] = useState(false);
  const [orgError, setOrgError] = useState<string | null>(null);
  const [faculties, setFaculties] = useState<Array<{ id: number; name: string }>>([]);
  const [departments, setDepartments] = useState<
    Array<{ id: number; name: string; facultyId: number }>
  >([]);
  const [programs, setPrograms] = useState<
    Array<{ id: number; name: string; departmentId: number }>
  >([]);

  // Admission details (new admission)
  const [admissionFacultyId, setAdmissionFacultyId] = useState<number | "">("");
  const [admissionDepartmentId, setAdmissionDepartmentId] = useState<number | "">("");
  const [admissionProgramId, setAdmissionProgramId] = useState<number | "">("");
  const [admissionCampus, setAdmissionCampus] = useState("");
  const [admissionSession, setAdmissionSession] = useState("");
  const [admissionStatus, setAdmissionStatus] = useState<"confirmed" | "pending" | "">("");

  // Attached documents (file uploads)
  const [docAdmissionLetterFile, setDocAdmissionLetterFile] = useState<File | null>(null);
  const [docTranscriptsFile, setDocTranscriptsFile] = useState<File | null>(null);
  const [docAlumniProofFile, setDocAlumniProofFile] = useState<File | null>(null);
  const [docCvFile, setDocCvFile] = useState<File | null>(null);
  const [docCnicFile, setDocCnicFile] = useState<File | null>(null);
  const [docOtherFile, setDocOtherFile] = useState<File | null>(null);
  const [docOtherText, setDocOtherText] = useState("");
  const [admissionApplicationRef, setAdmissionApplicationRef] = useState("");

  // Declaration
  const [mastersDeclarationAccepted, setMastersDeclarationAccepted] = useState(false);

  // Load organization datasets only when needed (fee discount / admission flow)
  useEffect(() => {
    if (!isScholarshipFeeDiscountFlow(formData.discountType)) {
      return;
    }
    if (faculties.length > 0 || orgLoading) {
      return;
    }

    let cancelled = false;
    async function loadOrg() {
      setOrgLoading(true);
      setOrgError(null);
      try {
        const res = await fetch("/api/public/org-datasets", {
          headers: { accept: "application/json" },
        });
        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          throw new Error(txt || `Failed to load faculties/departments/programs (${res.status})`);
        }
        const j = (await res.json()) as {
          faculties?: Array<{ id: number; faculty_name?: string }>;
          departments?: Array<{ id: number; department_name?: string; faculty_id: number }>;
          programs?: Array<{ id: number; program_name?: string; department_id: number }>;
        };
        if (cancelled) return;

        const mappedFaculties =
          j.faculties?.map((f) => ({
            id: Number(f.id),
            name: String((f as any).faculty_name ?? "").trim(),
          })) ?? [];
        const mappedDepartments =
          j.departments?.map((d) => ({
            id: Number(d.id),
            name: String((d as any).department_name ?? "").trim(),
            facultyId: Number((d as any).faculty_id),
          })) ?? [];
        const mappedPrograms =
          j.programs?.map((p) => ({
            id: Number(p.id),
            name: String((p as any).program_name ?? "").trim(),
            departmentId: Number((p as any).department_id),
          })) ?? [];

        setFaculties(
          mappedFaculties.filter(
            (f) => Number.isFinite(f.id) && f.id > 0 && f.name.length > 0,
          ),
        );
        setDepartments(
          mappedDepartments.filter(
            (d) =>
              Number.isFinite(d.id) &&
              d.id > 0 &&
              d.name.length > 0 &&
              Number.isFinite(d.facultyId) &&
              d.facultyId > 0,
          ),
        );
        setPrograms(
          mappedPrograms.filter(
            (p) =>
              Number.isFinite(p.id) &&
              p.id > 0 &&
              p.name.length > 0 &&
              Number.isFinite(p.departmentId) &&
              p.departmentId > 0,
          ),
        );

      } catch (err) {
        if (cancelled) return;
        const msg =
          err instanceof Error ? err.message : "Failed to load faculties/departments/programs";
        setOrgError(msg);
      } finally {
        if (!cancelled) {
          setOrgLoading(false);
        }
      }
    }

    loadOrg();
    return () => {
      cancelled = true;
    };
    // We intentionally exclude dependencies to avoid reloading unnecessarily
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.discountType]);

  const admissionDepartmentsForFaculty =
    typeof admissionFacultyId === "number"
      ? departments.filter((d) => d.facultyId === admissionFacultyId)
      : [];

  const admissionProgramsForDepartment =
    typeof admissionDepartmentId === "number"
      ? programs.filter((p) => p.departmentId === admissionDepartmentId)
      : [];

  const currentYear = new Date().getFullYear();
  const sessionOptions = Array.from({ length: 6 }).map((_, idx) =>
    String(currentYear + idx),
  );

  const missing = (v: unknown): string => {
    const s = String(v ?? "").trim();
    return s ? s : "Data is missing";
  };

  // Initialize fatherCnic when data loads
  useEffect(() => {
    if (data?.father_cnic && !formData.fatherCnic) {
      setFormData(prev => ({ ...prev, fatherCnic: data.father_cnic || "" }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.father_cnic]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const discountOptions = [...SCHOLARSHIP_DISCOUNT_CATEGORY_OPTIONS];
  const applyingForOptions = SCHOLARSHIP_APPLYING_FOR_BY_CATEGORY;
  const isFeeFlow = isScholarshipFeeDiscountFlow(formData.discountType);

  const kinshipRelations = [
    { value: "Sister", label: "Sister" },
    { value: "Brother", label: "Brother" },
    { value: "Other", label: "Other" },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const derivedApplying = scholarshipApplyingForFromCategory(formData.discountType);
    const effectiveApplyingFor = (derivedApplying ?? formData.applyingFor).trim();

    if (!formData.discountType || !effectiveApplyingFor) {
      toast.error(
        !formData.discountType
          ? "Please select a discount category."
          : formData.discountType === "kinship-15"
            ? "Please select Applying For (BS / Masters / PhD)."
            : "Please complete Applying For / program level where required.",
        {
        duration: 4000,
        style: {
          background: '#fee2e2',
          color: '#991b1b',
          padding: '12px',
          borderRadius: '8px',
        },
        }
      );
      return;
    }

    // Additional validation for fee discount (admission letter, uploads, declaration)
    if (isScholarshipFeeDiscountFlow(formData.discountType)) {
      // Ensure org data is ready
      if (orgLoading || faculties.length === 0) {
        toast.error("Please wait while options are loading. Try again in a moment.", {
          duration: 4000,
          style: {
            background: "#fee2e2",
            color: "#991b1b",
            padding: "12px",
            borderRadius: "8px",
          },
        });
        return;
      }

      if (
        !admissionFacultyId ||
        !admissionDepartmentId ||
        !admissionProgramId ||
        !admissionCampus ||
        !admissionSession ||
        !admissionStatus
      ) {
        toast.error("Please complete all admission and document sections before submitting.", {
          duration: 5000,
          style: {
            background: "#fee2e2",
            color: "#991b1b",
            padding: "12px",
            borderRadius: "8px",
          },
        });
        return;
      }

      if (!docAdmissionLetterFile || !docAlumniProofFile || !docCnicFile) {
        toast.error("Please upload all required documents before submitting.", {
          duration: 5000,
          style: {
            background: "#fee2e2",
            color: "#991b1b",
            padding: "12px",
            borderRadius: "8px",
          },
        });
        return;
      }

      if (docOtherFile && !docOtherText.trim()) {
        toast.error("Please specify 'Other' document name/description.", {
          duration: 4000,
          style: {
            background: "#fee2e2",
            color: "#991b1b",
            padding: "12px",
            borderRadius: "8px",
          },
        });
        return;
      }

      if (!mastersDeclarationAccepted) {
        toast.error("You must accept the declaration to proceed.", {
          duration: 4000,
          style: {
            background: "#fee2e2",
            color: "#991b1b",
            padding: "12px",
            borderRadius: "8px",
          },
        });
        return;
      }
    }

    if (
      isScholarshipKinshipCategory(formData.discountType) &&
      (!formData.kinshipRelation ||
        !formData.kinshipFirstName ||
        !formData.kinshipLastName ||
        !formData.kinshipCnic)
    ) {
      toast.error("Please provide all kinship details (relation, first name, last name, and CNIC)", {
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

    // Compute degree title for fee discount flow from selected admission program
    let degreeTitleToSend = (formData.degreeTitle || "").trim();
    if (isScholarshipFeeDiscountFlow(formData.discountType)) {
      const selectedProgram = programs.find(
        (p) => typeof admissionProgramId === "number" && p.id === admissionProgramId,
      );
      if (selectedProgram) {
        degreeTitleToSend = selectedProgram.name;
      }
    } else if (!degreeTitleToSend) {
      toast.error("Degree title is required.", {
        duration: 4000,
        style: {
          background: "#fee2e2",
          color: "#991b1b",
          padding: "12px",
          borderRadius: "8px",
        },
      });
      return;
    }

    if (!sapId) {
      toast.error("SAP ID not found. Please ensure you are logged in.", {
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

    setIsSubmitting(true);
    try {
      const url = `/api/alumni/${encodeURIComponent(sapId)}/scholarship-application`;
      const response =
        isScholarshipFeeDiscountFlow(formData.discountType)
          ? await (async () => {
              const fd = new FormData();
              fd.set("discountType", formData.discountType);
              fd.set("applyingFor", effectiveApplyingFor);
              fd.set("degreeTitle", degreeTitleToSend);

              fd.set("admissionFacultyId", String(admissionFacultyId));
              fd.set("admissionDepartmentId", String(admissionDepartmentId));
              fd.set("admissionProgramId", String(admissionProgramId));
              fd.set("admissionCampus", admissionCampus);
              fd.set("admissionSession", admissionSession);
              fd.set("admissionStatus", admissionStatus);

              fd.set("docAdmissionLetter", docAdmissionLetterFile as File);
              fd.set("docAlumniProof", docAlumniProofFile as File);
              fd.set("docCnic", docCnicFile as File);
              if (docTranscriptsFile) {
                fd.set("docTranscripts", docTranscriptsFile);
              }
              if (docCvFile) {
                fd.set("docCv", docCvFile);
              }
              if (docOtherFile) {
                fd.set("docOther", docOtherFile);
                fd.set("docOtherText", docOtherText.trim());
              }
              fd.set("admissionApplicationRef", admissionApplicationRef.trim());
              fd.set("declarationAccepted", mastersDeclarationAccepted ? "true" : "false");

              return fetch(url, { method: "POST", body: fd });
            })()
          : await fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                discountType: formData.discountType,
                applyingFor: effectiveApplyingFor,
                degreeTitle: degreeTitleToSend,
                kinshipRelation: formData.kinshipRelation || null,
                kinshipFirstName: formData.kinshipFirstName || null,
                kinshipLastName: formData.kinshipLastName || null,
                kinshipCnic: formData.kinshipCnic || null,
                fatherCnic: formData.fatherCnic || null,
              }),
            });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to submit application");
      }

      // Check if email was sent
      if (result.emailSent === false) {
        // Email failed but application was received
        toast.error(
          <div>
            <p className="font-semibold">Application received, but email delivery failed</p>
            <p className="text-xs mt-1">{result.message}</p>
            {result.emailError && (
              <p className="text-xs mt-1 text-gray-600">Error: {result.emailError}</p>
            )}
          </div>,
          {
            duration: 8000,
            style: {
              background: '#fef3c7',
              color: '#92400e',
              padding: '12px',
              borderRadius: '8px',
            },
          }
        );
      } else if (result.emailSent === true) {
        // Email sent successfully
        toast.success("Application submitted successfully! Please check your email for the confirmation document.", {
          duration: 6000,
          style: {
            background: '#d1fae5',
            color: '#065f46',
            padding: '12px',
            borderRadius: '8px',
          },
        });
      } else {
        // Email status unknown (might be SMTP not configured)
        toast.success(
          <div>
            <p className="font-semibold">{result.message}</p>
            {result.emailError && (
              <p className="text-xs mt-1 text-gray-600">Note: {result.emailError}</p>
            )}
          </div>,
          {
            duration: 6000,
            style: {
              background: '#dbeafe',
              color: '#1e40af',
              padding: '12px',
              borderRadius: '8px',
            },
          }
        );
      }

      // Reset form
      setFormData({
        discountType: "",
        applyingFor: "",
        degreeTitle: "",
        kinshipRelation: "",
        kinshipFirstName: "",
        kinshipLastName: "",
        kinshipCnic: "",
        fatherCnic: data?.father_cnic || "",
      });

      // Reset Masters/PhD uploads & declaration
      setAdmissionFacultyId("");
      setAdmissionDepartmentId("");
      setAdmissionProgramId("");
      setAdmissionCampus("");
      setAdmissionSession("");
      setAdmissionStatus("");
      setDocAdmissionLetterFile(null);
      setDocTranscriptsFile(null);
      setDocAlumniProofFile(null);
      setDocCvFile(null);
      setDocCnicFile(null);
      setDocOtherFile(null);
      setDocOtherText("");
      setAdmissionApplicationRef("");
      setMastersDeclarationAccepted(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to submit application. Please try again.", {
        duration: 4000,
        style: {
          background: '#fee2e2',
          color: '#991b1b',
          padding: '12px',
          borderRadius: '8px',
        },
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <>
        <AppHeader />
        <div className="min-h-screen bg-gray-50">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
    );
  }

  if (!data) {
    return (
      <>
        <AppHeader />
        <div className="min-h-screen bg-gray-50">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="bg-white rounded-lg shadow-sm p-8">
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center gap-4">
                  <p className="text-sm text-red-600">Failed to load profile data</p>
                  <BackButton />
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  const currentOptions = formData.discountType
    ? applyingForOptions[formData.discountType] ?? []
    : [];

  return (
    <>
      <AppHeader />
      <Toaster position="top-right" />
      <PageBanner title="Scholarship Application" />
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-6">
            <BackButton />
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 sm:p-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Scholarship</h1>
            <p className="text-gray-600 mb-8">Fill out the form below to apply for UOL Alumni Scholarship or Fee Discount.</p>

            <form onSubmit={handleSubmit} className="max-w-4xl mx-auto mt-4" aria-label="Scholarship application form">
              <div className="grid sm:grid-cols-2 gap-6">
                <div className="sm:col-span-2">
                  <label htmlFor="discountType" className="mb-2 text-sm text-slate-900 font-medium block">
                    Discount Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="discountType"
                    value={formData.discountType}
                    onChange={(e) => {
                      const v = e.target.value;
                      const derived = scholarshipApplyingForFromCategory(v);
                      setFormData({
                        ...formData,
                        discountType: v,
                        applyingFor: derived !== null ? derived : "",
                      });
                    }}
                    className="px-4 py-3 pr-8 bg-[#f0f1f2] focus:bg-transparent text-black w-full text-sm border border-gray-200 outline-[#007bff] rounded-md transition-all"
                    required
                  >
                    <option value="">Discount Type</option>
                    {discountOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                {formData.discountType === "kinship-15" && (
                  <div className="sm:col-span-2">
                    <label htmlFor="applyingForKinship" className="mb-2 text-sm text-slate-900 font-medium block">
                      Applying For <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="applyingForKinship"
                      value={formData.applyingFor}
                      onChange={(e) => setFormData({ ...formData, applyingFor: e.target.value })}
                      className="px-4 py-3 pr-8 bg-[#f0f1f2] focus:bg-transparent text-black w-full text-sm border border-gray-200 outline-[#007bff] rounded-md transition-all"
                      required
                    >
                      <option value="">Select program level</option>
                      {currentOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-gray-500">
                      Level of study for the beneficiary (kin) applying for the discount.
                    </p>
                  </div>
                )}

                {/* Fee discount detailed form (admission + documents) */}
                {isFeeFlow && (
                  <div className="sm:col-span-2 space-y-6 mt-4">
                    {/* 1. Applicant Information */}
                    <div className="border border-gray-200 rounded-lg p-4 sm:p-5">
                      <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">
                        1. Applicant Information
                      </h2>
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <label className="mb-2 text-sm text-slate-900 font-medium block">
                            Name of Candidate
                          </label>
                          <input
                            type="text"
                            value={missing(data?.alumniname)}
                            readOnly
                            className="px-4 py-3 pr-8 bg-[#f0f1f2] text-black w-full text-sm border border-gray-200 rounded-md opacity-60 cursor-not-allowed"
                          />
                          <p className="mt-1 text-xs text-gray-500">Auto-fetched from your profile</p>
                        </div>
                        <div>
                          <label className="mb-2 text-sm text-slate-900 font-medium block">
                            Father&apos;s / Guardian&apos;s Name
                          </label>
                          <input
                            type="text"
                            value={missing((data as any)?.fathername)}
                            readOnly
                            className="px-4 py-3 pr-8 bg-[#f0f1f2] text-black w-full text-sm border border-gray-200 rounded-md opacity-60 cursor-not-allowed"
                          />
                          <p className="mt-1 text-xs text-gray-500">Auto-fetched from your profile</p>
                        </div>
                        <div>
                          <label className="mb-2 text-sm text-slate-900 font-medium block">
                            SAP Code
                          </label>
                          <input
                            type="text"
                            value={missing(data?.sapid)}
                            readOnly
                            className="px-4 py-3 pr-8 bg-[#f0f1f2] text-black w-full text-sm border border-gray-200 rounded-md opacity-60 cursor-not-allowed"
                          />
                          <p className="mt-1 text-xs text-gray-500">Auto-fetched from your profile</p>
                        </div>
                        <div>
                          <label className="mb-2 text-sm text-slate-900 font-medium block">
                            Registration No.
                          </label>
                          <input
                            type="text"
                            value={missing(data?.registrationno)}
                            readOnly
                            className="px-4 py-3 pr-8 bg-[#f0f1f2] text-black w-full text-sm border border-gray-200 rounded-md opacity-60 cursor-not-allowed"
                          />
                          <p className="mt-1 text-xs text-gray-500">Auto-fetched from your profile</p>
                        </div>
                        <div>
                          <label className="mb-2 text-sm text-slate-900 font-medium block">
                            Year of Graduation
                          </label>
                          <input
                            type="text"
                            value={missing((data as any)?.yearofending)}
                            readOnly
                            className="px-4 py-3 pr-8 bg-[#f0f1f2] text-black w-full text-sm border border-gray-200 rounded-md opacity-60 cursor-not-allowed"
                          />
                          <p className="mt-1 text-xs text-gray-500">Auto-fetched from your profile</p>
                        </div>
                        <div>
                          <label className="mb-2 text-sm text-slate-900 font-medium block">
                            Contact Number
                          </label>
                          <input
                            type="text"
                            value={missing((data as any)?.contactno)}
                            readOnly
                            className="px-4 py-3 pr-8 bg-[#f0f1f2] text-black w-full text-sm border border-gray-200 rounded-md opacity-60 cursor-not-allowed"
                          />
                          <p className="mt-1 text-xs text-gray-500">Auto-fetched from your profile</p>
                        </div>
                        <div>
                          <label className="mb-2 text-sm text-slate-900 font-medium block">
                            Email Address
                          </label>
                          <input
                            type="text"
                            value={
                              missing(
                                data?.personalemail ||
                                  data?.universityemail ||
                                  data?.officialemail ||
                                  data?.alumniemail,
                              )
                            }
                            readOnly
                            className="px-4 py-3 pr-8 bg-[#f0f1f2] text-black w-full text-sm border border-gray-200 rounded-md opacity-60 cursor-not-allowed"
                          />
                          <p className="mt-1 text-xs text-gray-500">Auto-fetched from your profile</p>
                        </div>
                      </div>

                      <div className="mt-4">
                        <p className="mb-2 text-sm text-slate-900 font-medium">
                          Program Completed at UOL
                        </p>
                        <div className="grid sm:grid-cols-3 gap-4">
                          <div>
                            <label className="mb-1 text-xs font-medium text-slate-900 block">
                              Faculty
                            </label>
                            <input
                              type="text"
                              value={missing((data as any)?.facultyname)}
                              readOnly
                              className="px-3 py-2.5 bg-[#f0f1f2] text-black w-full text-xs sm:text-sm border border-gray-200 rounded-md opacity-60 cursor-not-allowed"
                            />
                            <p className="mt-1 text-xs text-gray-500">Auto-fetched from your profile</p>
                          </div>
                          <div>
                            <label className="mb-1 text-xs font-medium text-slate-900 block">
                              Department
                            </label>
                            <input
                              type="text"
                              value={missing((data as any)?.departmentname)}
                              readOnly
                              className="px-3 py-2.5 bg-[#f0f1f2] text-black w-full text-xs sm:text-sm border border-gray-200 rounded-md opacity-60 cursor-not-allowed"
                            />
                            <p className="mt-1 text-xs text-gray-500">Auto-fetched from your profile</p>
                          </div>
                          <div>
                            <label className="mb-1 text-xs font-medium text-slate-900 block">
                              Program
                            </label>
                            <input
                              type="text"
                              value={missing((data as any)?.degreetitle)}
                              readOnly
                              className="px-3 py-2.5 bg-[#f0f1f2] text-black w-full text-xs sm:text-sm border border-gray-200 rounded-md opacity-60 cursor-not-allowed"
                            />
                            <p className="mt-1 text-xs text-gray-500">Auto-fetched from your profile</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 2. Admission Details */}
                    <div className="border border-gray-200 rounded-lg p-4 sm:p-5">
                      <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">
                        2. Admission Details
                      </h2>
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="sm:col-span-2">
                          <label className="mb-2 text-sm text-slate-900 font-medium block">
                            Program level <span className="text-red-500">*</span>
                          </label>
                          <div className="px-4 py-3 bg-[#f0f1f2] text-black w-full text-sm border border-gray-200 rounded-md">
                            {formData.applyingFor || "—"} (from your selected discount category)
                          </div>
                          <p className="mt-1 text-xs text-gray-500">
                            Masters or PhD is determined by the discount category you chose above.
                          </p>
                        </div>
                        <div className="sm:col-span-2">
                          <div className="grid sm:grid-cols-3 gap-4">
                            <div>
                              <label className="mb-1 text-xs font-medium text-slate-900 block">
                                Faculty
                              </label>
                              <select
                                className="px-3 py-2.5 bg-[#f0f1f2] text-black w-full text-xs sm:text-sm border border-gray-200 rounded-md"
                                value={admissionFacultyId || ""}
                                onChange={(e) => {
                                  const v = e.target.value ? Number(e.target.value) : "";
                                  setAdmissionFacultyId(v);
                                  setAdmissionDepartmentId("");
                                  setAdmissionProgramId("");
                                }}
                                disabled={orgLoading}
                              >
                                <option value="">
                                  {orgLoading ? "Loading..." : "Select"}
                                </option>
                                {faculties.map((f) => (
                                  <option key={f.id} value={f.id}>
                                    {f.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="mb-1 text-xs font-medium text-slate-900 block">
                                Department
                              </label>
                              <select
                                className="px-3 py-2.5 bg-[#f0f1f2] text-black w-full text-xs sm:text-sm border border-gray-200 rounded-md"
                                value={admissionDepartmentId || ""}
                                onChange={(e) => {
                                  const v = e.target.value ? Number(e.target.value) : "";
                                  setAdmissionDepartmentId(v);
                                  setAdmissionProgramId("");
                                }}
                                disabled={
                                  orgLoading ||
                                  typeof admissionFacultyId !== "number" ||
                                  admissionDepartmentsForFaculty.length === 0
                                }
                              >
                                <option value="">
                                  {typeof admissionFacultyId !== "number"
                                    ? "Select faculty first"
                                    : admissionDepartmentsForFaculty.length === 0
                                    ? "No departments"
                                    : "Select"}
                                </option>
                                {admissionDepartmentsForFaculty.map((d) => (
                                  <option key={d.id} value={d.id}>
                                    {d.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="mb-1 text-xs font-medium text-slate-900 block">
                                Program Applied For
                              </label>
                              <select
                                className="px-3 py-2.5 bg-[#f0f1f2] text-black w-full text-xs sm:text-sm border border-gray-200 rounded-md"
                                value={admissionProgramId || ""}
                                onChange={(e) => {
                                  const v = e.target.value ? Number(e.target.value) : "";
                                  setAdmissionProgramId(v);
                                  // Auto-set Applying For for Masters/PhD based on program name if not chosen yet.
                                  if (
                                    !scholarshipApplyingForFromCategory(formData.discountType) &&
                                    (!formData.applyingFor || !formData.applyingFor.trim())
                                  ) {
                                    const selected = programs.find((p) => p.id === v);
                                    const nm = String(selected?.name ?? "").toLowerCase();
                                    const inferred = nm.includes("phd") ? "PhD" : nm ? "Masters" : "";
                                    if (inferred) {
                                      setFormData((prev) => ({ ...prev, applyingFor: inferred }));
                                    }
                                  }
                                }}
                                disabled={
                                  orgLoading ||
                                  typeof admissionDepartmentId !== "number" ||
                                  admissionProgramsForDepartment.length === 0
                                }
                              >
                                <option value="">
                                  {typeof admissionDepartmentId !== "number"
                                    ? "Select department first"
                                    : admissionProgramsForDepartment.length === 0
                                    ? "No programs"
                                    : "Select"}
                                </option>
                                {admissionProgramsForDepartment.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="mb-2 text-sm text-slate-900 font-medium block">
                            Campus (if applicable)
                          </label>
                          <select
                            className="px-4 py-3 pr-8 bg-[#f0f1f2] text-black w-full text-sm border border-gray-200 rounded-md"
                            value={admissionCampus}
                            onChange={(e) => setAdmissionCampus(e.target.value)}
                          >
                            <option value="">Select</option>
                            <option value="Lahore">Lahore</option>
                            <option value="Sargodha">Sargodha</option>
                            <option value="Islamabad">Islamabad</option>
                            <option value="Pakpattan">Pakpattan</option>
                          </select>
                        </div>

                        <div>
                          <label className="mb-2 text-sm text-slate-900 font-medium block">
                            Session / Intake
                          </label>
                          <select
                            className="px-4 py-3 pr-8 bg-[#f0f1f2] text-black w-full text-sm border border-gray-200 rounded-md"
                            value={admissionSession}
                            onChange={(e) => setAdmissionSession(e.target.value)}
                          >
                            <option value="">Select</option>
                            {sessionOptions.map((y) => (
                              <option key={y} value={y}>
                                {y}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="sm:col-span-2">
                          <label className="mb-2 text-sm text-slate-900 font-medium block">
                            Admission Status
                          </label>
                          <div className="flex items-center gap-6">
                            <label className="inline-flex items-center gap-2 text-sm text-slate-900">
                              <input
                                type="radio"
                                name="admissionStatus"
                                value="confirmed"
                                checked={admissionStatus === "confirmed"}
                                onChange={() => setAdmissionStatus("confirmed")}
                                className="h-4 w-4 text-blue-600 border-gray-300"
                              />
                              <span>Confirmed</span>
                            </label>
                            <label className="inline-flex items-center gap-2 text-sm text-slate-900">
                              <input
                                type="radio"
                                name="admissionStatus"
                                value="pending"
                                checked={admissionStatus === "pending"}
                                onChange={() => setAdmissionStatus("pending")}
                                className="h-4 w-4 text-blue-600 border-gray-300"
                              />
                              <span>Pending</span>
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 3. List of Attached Documents */}
                    <div className="border border-gray-200 rounded-lg p-4 sm:p-5">
                      <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">
                        3. List of Attached Documents (PDF Files Only)
                      </h2>
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <label className="mb-2 text-sm text-slate-900 font-medium block">
                            Copy of Admission Letter (PhD – UOL) <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="file"
                            accept="application/pdf,.pdf"
                            onChange={(e) => {
                              const f = e.target.files?.[0] ?? null;
                              if (f && f.type !== "application/pdf") {
                                toast.error("Only PDF files are allowed.");
                                e.currentTarget.value = "";
                                setDocAdmissionLetterFile(null);
                                return;
                              }
                              setDocAdmissionLetterFile(f);
                            }}
                            className="px-4 py-3 pr-8 bg-[#f0f1f2] text-black w-full text-sm border border-gray-200 rounded-md"
                            required
                          />
                        </div>
                        <div>
                          <label className="mb-2 text-sm text-slate-900 font-medium block">
                            Academic Transcripts and Certificates <span className="text-gray-500">(Optional)</span>
                          </label>
                          <input
                            type="file"
                            accept="application/pdf,.pdf"
                            onChange={(e) => {
                              const f = e.target.files?.[0] ?? null;
                              if (f && f.type !== "application/pdf") {
                                toast.error("Only PDF files are allowed.");
                                e.currentTarget.value = "";
                                setDocTranscriptsFile(null);
                                return;
                              }
                              setDocTranscriptsFile(f);
                            }}
                            className="px-4 py-3 pr-8 bg-[#f0f1f2] text-black w-full text-sm border border-gray-200 rounded-md"
                          />
                        </div>
                        <div>
                          <label className="mb-2 text-sm text-slate-900 font-medium block">
                            Alumni Card <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="file"
                            accept="application/pdf,.pdf"
                            onChange={(e) => {
                              const f = e.target.files?.[0] ?? null;
                              if (f && f.type !== "application/pdf") {
                                toast.error("Only PDF files are allowed.");
                                e.currentTarget.value = "";
                                setDocAlumniProofFile(null);
                                return;
                              }
                              setDocAlumniProofFile(f);
                            }}
                            className="px-4 py-3 pr-8 bg-[#f0f1f2] text-black w-full text-sm border border-gray-200 rounded-md"
                            required
                          />
                        </div>
                        <div>
                          <label className="mb-2 text-sm text-slate-900 font-medium block">
                            Curriculum Vitae (CV) <span className="text-gray-500">(Optional)</span>
                          </label>
                          <input
                            type="file"
                            accept="application/pdf,.pdf"
                            onChange={(e) => {
                              const f = e.target.files?.[0] ?? null;
                              if (f && f.type !== "application/pdf") {
                                toast.error("Only PDF files are allowed.");
                                e.currentTarget.value = "";
                                setDocCvFile(null);
                                return;
                              }
                              setDocCvFile(f);
                            }}
                            className="px-4 py-3 pr-8 bg-[#f0f1f2] text-black w-full text-sm border border-gray-200 rounded-md"
                          />
                        </div>
                        <div>
                          <label className="mb-2 text-sm text-slate-900 font-medium block">
                            CNIC Copy <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="file"
                            accept="application/pdf,.pdf"
                            onChange={(e) => {
                              const f = e.target.files?.[0] ?? null;
                              if (f && f.type !== "application/pdf") {
                                toast.error("Only PDF files are allowed.");
                                e.currentTarget.value = "";
                                setDocCnicFile(null);
                                return;
                              }
                              setDocCnicFile(f);
                            }}
                            className="px-4 py-3 pr-8 bg-[#f0f1f2] text-black w-full text-sm border border-gray-200 rounded-md"
                            required
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="mb-2 text-sm text-slate-900 font-medium block" htmlFor="admissionApplicationRef">
                            Admission Reference No / Application ID{" "}
                            <span className="text-gray-500 font-normal">(Optional)</span>
                          </label>
                          <input
                            id="admissionApplicationRef"
                            type="text"
                            value={admissionApplicationRef}
                            onChange={(e) => setAdmissionApplicationRef(e.target.value)}
                            className="px-4 py-3 pr-8 bg-[#f0f1f2] focus:bg-transparent text-black w-full text-sm border border-gray-200 outline-[#007bff] rounded-md transition-all"
                            placeholder="Enter your admission reference or application number"
                            maxLength={200}
                            autoComplete="off"
                          />
                          <p className="mt-1 text-xs text-gray-500">
                            If applicable, as shown on your admission letter or application portal.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* 4. Declaration */}
                    <div className="border border-gray-200 rounded-lg p-4 sm:p-5">
                      <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-3">
                        4. Declaration
                      </h2>
                      <p className="text-sm text-slate-900 mb-3">
                        I hereby declare that all information provided is true and correct.
                        I understand that the discount is subject to approval and institutional
                        policies of The University of Lahore.
                      </p>
                      <label className="flex items-start gap-3 text-sm text-slate-900 cursor-pointer">
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded"
                          checked={mastersDeclarationAccepted}
                          onChange={(e) => setMastersDeclarationAccepted(e.target.checked)}
                        />
                        <span>I have read and agree to the above declaration.</span>
                      </label>
                    </div>
                  </div>
                )}

                {isScholarshipKinshipCategory(formData.discountType) && (
                  <>
                    <div>
                      <label htmlFor="kinshipRelation" className="mb-2 text-sm text-slate-900 font-medium block">
                        Relation <span className="text-red-500">*</span>
                      </label>
                      <select
                        id="kinshipRelation"
                        value={formData.kinshipRelation}
                        onChange={(e) => setFormData({ ...formData, kinshipRelation: e.target.value })}
                        className="px-4 py-3 pr-8 bg-[#f0f1f2] focus:bg-transparent text-black w-full text-sm border border-gray-200 outline-[#007bff] rounded-md transition-all"
                        required
                      >
                        <option value="">Select Relation</option>
                        {kinshipRelations.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="kinshipFirstName" className="mb-2 text-sm text-slate-900 font-medium block">
                        {formData.kinshipRelation || "Kinship"} First Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        id="kinshipFirstName"
                        value={formData.kinshipFirstName}
                        onChange={(e) => setFormData({ ...formData, kinshipFirstName: e.target.value })}
                        className="px-4 py-3 pr-8 bg-[#f0f1f2] focus:bg-transparent text-black w-full text-sm border border-gray-200 outline-[#007bff] rounded-md transition-all"
                        required
                        placeholder={`Enter ${formData.kinshipRelation ? formData.kinshipRelation.toLowerCase() : "kinship"} first name`}
                      />
                    </div>

                    <div>
                      <label htmlFor="kinshipLastName" className="mb-2 text-sm text-slate-900 font-medium block">
                        {formData.kinshipRelation || "Kinship"} Last Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        id="kinshipLastName"
                        value={formData.kinshipLastName}
                        onChange={(e) => setFormData({ ...formData, kinshipLastName: e.target.value })}
                        className="px-4 py-3 pr-8 bg-[#f0f1f2] focus:bg-transparent text-black w-full text-sm border border-gray-200 outline-[#007bff] rounded-md transition-all"
                        required
                        placeholder={`Enter ${formData.kinshipRelation ? formData.kinshipRelation.toLowerCase() : "kinship"} last name`}
                      />
                    </div>

                    <div>
                      <label htmlFor="alumniCnic" className="mb-2 text-sm text-slate-900 font-medium block">
                        Alumni CNIC
                      </label>
                      <input
                        type="text"
                        id="alumniCnic"
                        value={data?.cnicpassport || ""}
                        className="px-4 py-3 pr-8 bg-[#f0f1f2] text-black w-full text-sm border border-gray-200 rounded-md opacity-60 cursor-not-allowed"
                        readOnly
                        disabled
                      />
                      <p className="mt-1 text-xs text-gray-500">Auto-fetched from your profile</p>
                    </div>

                    <div>
                      <label htmlFor="kinshipCnic" className="mb-2 text-sm text-slate-900 font-medium block">
                        {formData.kinshipRelation || "Kinship"} CNIC <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        id="kinshipCnic"
                        value={formData.kinshipCnic}
                        onChange={(e) => setFormData({ ...formData, kinshipCnic: e.target.value })}
                        className="px-4 py-3 pr-8 bg-[#f0f1f2] focus:bg-transparent text-black w-full text-sm border border-gray-200 outline-[#007bff] rounded-md transition-all"
                        required
                        placeholder={`Enter ${formData.kinshipRelation ? formData.kinshipRelation.toLowerCase() : "kinship"} CNIC (xxxxx-xxxxxxx-x)`}
                      />
                    </div>

                    <div>
                      <label htmlFor="fatherCnic" className="mb-2 text-sm text-slate-900 font-medium block">
                        Father CNIC
                      </label>
                      <input
                        type="text"
                        id="fatherCnic"
                        value={formData.fatherCnic}
                        onChange={(e) => setFormData({ ...formData, fatherCnic: e.target.value })}
                        className="px-4 py-3 pr-8 bg-[#f0f1f2] focus:bg-transparent text-black w-full text-sm border border-gray-200 outline-[#007bff] rounded-md transition-all"
                        placeholder={data?.father_cnic ? `Current: ${data.father_cnic}` : "Enter father CNIC (xxxxx-xxxxxxx-x)"}
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        {data?.father_cnic ? "Auto-fetched from your profile. You can update it if needed." : "Enter father CNIC if available"}
                      </p>
                    </div>
                  </>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-12 px-5 py-2.5 text-[15px] font-medium w-full max-w-[130px] mx-auto block bg-[#007bff] hover:bg-[#006bff] text-white rounded-md transition-all cursor-pointer disabled:opacity-60"
              >
                {isSubmitting ? "Submitting..." : "Submit Application"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}

export default function ScholarshipApplicationPage() {
  return (
    <Suspense
      fallback={
        <>
          <AppHeader />
          <div className="min-h-screen bg-gray-50">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
      <ScholarshipApplicationContent />
    </Suspense>
  );
}

