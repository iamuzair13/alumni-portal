"use client";
import { useState, Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
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
  isMergedScholarshipSlug,
  getMergedFeeComponentSlugs,
  isHighAchieverMedalist,
  resolveHighAchieverPercent,
  HIGH_ACHIEVER_DISCOUNT_PERCENT,
} from "@/lib/scholarshipLetter";
import {
  findCategoryBySlug,
  formatDiscountPercentDisplay,
  parseCgpa,
  resolveCategoryFlowType,
  resolveDiscountPercent,
  resolveMergedFeeDiscount,
  type ScholarshipCategoryWithTiers,
} from "@/lib/scholarshipDiscount";
import Link from "next/link";

async function fetchScholarshipFormSettings() {
  const res = await fetch("/api/scholarship/settings");
  if (!res.ok) {
    return { scholarship_application: true };
  }
  return res.json();
}

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

  const { data: formSettings, isLoading: settingsLoading } = useQuery({
    queryKey: ["scholarship-settings"],
    queryFn: fetchScholarshipFormSettings,
    staleTime: 60 * 1000,
  });

  const isFormEnabled = formSettings?.scholarship_application ?? true;

  const [formData, setFormData] = useState({
    discountType: "",
    applyingFor: "",
    degreeTitle: "",
    kinshipName: "",
    kinshipFatherName: "",
    kinshipCampus: "",
    kinshipFaculty: "",
    kinshipDepartment: "",
    kinshipProgram: "",
    kinshipAdmissionRefNo: "",
    kinshipLastDegreeCertificate: "",
    kinshipPassingOutYear: "",
    kinshipCnic: "",
    fatherCnic: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [applyAdmissionFeeDiscount, setApplyAdmissionFeeDiscount] = useState(false);
  const [scholarshipCategories, setScholarshipCategories] = useState<ScholarshipCategoryWithTiers[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);

  useEffect(() => {
    if (!isFormEnabled) {
      setCategoriesLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setCategoriesLoading(true);
      setCategoriesError(null);
      try {
        const res = await fetch("/api/scholarship/categories?includeTiers=1");
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || "Failed to load discount categories");
        if (!cancelled) {
          setScholarshipCategories(Array.isArray(json.items) ? json.items : []);
        }
      } catch (e) {
        if (!cancelled) {
          setCategoriesError(e instanceof Error ? e.message : "Failed to load categories");
        }
      } finally {
        if (!cancelled) setCategoriesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isFormEnabled]);

  const selectedCategory = findCategoryBySlug(formData.discountType, scholarshipCategories);
  const profileCgpa = parseCgpa((data as { cgpa?: number | null })?.cgpa);
  const alumniMedal = (data as { medal?: string | null })?.medal ?? null;
  const highAchieverPercent = resolveHighAchieverPercent(alumniMedal);
  const isHighAchiever = isHighAchieverMedalist(alumniMedal);
  const mergedFeeComponents = getMergedFeeComponentSlugs(formData.discountType);
  const mergedFeeResult =
    profileCgpa != null && isMergedScholarshipSlug(formData.discountType)
      ? resolveMergedFeeDiscount(formData.discountType, profileCgpa, scholarshipCategories, mergedFeeComponents)
      : null;
  const admissionFeePercent =
    mergedFeeResult != null
      ? mergedFeeResult.admissionFeePercent
      : null;
  const tuitionFeePercent =
    mergedFeeResult != null
      ? mergedFeeResult.tuitionFeePercent
      : null;
  const effectiveAdmissionFeePercent = applyAdmissionFeeDiscount ? admissionFeePercent : null;
  const baseDiscountPercent =
    mergedFeeResult != null
      ? tuitionFeePercent
      : profileCgpa != null && selectedCategory?.tiers?.length
        ? resolveDiscountPercent(profileCgpa, selectedCategory.tiers)
        : null;
  const applicableDiscountPercent =
    baseDiscountPercent != null && highAchieverPercent != null
      ? baseDiscountPercent + highAchieverPercent
      : baseDiscountPercent ?? highAchieverPercent ?? null;

  const categoryFlow = resolveCategoryFlowType(formData.discountType, scholarshipCategories, {
    isFee: isScholarshipFeeDiscountFlow,
    isKinship: isScholarshipKinshipCategory,
  });
  const isFeeFlow = categoryFlow === "fee_discount";
  const isKinshipFlow = categoryFlow === "kinship";
  const needsKinshipApplyingFor =
    isKinshipFlow &&
    !selectedCategory?.default_apply_for &&
    !scholarshipApplyingForFromCategory(formData.discountType);

  const applyingForOptions = SCHOLARSHIP_APPLYING_FOR_BY_CATEGORY;
  const canSubmitScholarship =
    profileCgpa != null &&
    !!formData.discountType &&
    (mergedFeeResult != null
      ? mergedFeeResult.admissionFeePercent != null || mergedFeeResult.tuitionFeePercent != null
      : applicableDiscountPercent != null) &&
    !categoriesLoading;

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

  // Attached documents (file uploads)
  const [docAdmissionLetterFile, setDocAdmissionLetterFile] = useState<File | null>(null);
  const [docTranscriptsFile, setDocTranscriptsFile] = useState<File | null>(null);
  const [docAlumniProofFile, setDocAlumniProofFile] = useState<File | null>(null);
  const [docCvFile, setDocCvFile] = useState<File | null>(null);
  const [docCnicFile, setDocCnicFile] = useState<File | null>(null);
  const [docKinshipAdmissionLetterFile, setDocKinshipAdmissionLetterFile] = useState<File | null>(null);
  const [docKinshipAlumniCardFile, setDocKinshipAlumniCardFile] = useState<File | null>(null);
  const [docKinshipFrcFile, setDocKinshipFrcFile] = useState<File | null>(null);
  const [docKinshipCnicKinFile, setDocKinshipCnicKinFile] = useState<File | null>(null);
  const [docKinshipCnicAlumniFile, setDocKinshipCnicAlumniFile] = useState<File | null>(null);
  const [docKinshipAcademicCertificatesFile, setDocKinshipAcademicCertificatesFile] =
    useState<File | null>(null);
  const [docOtherFile, setDocOtherFile] = useState<File | null>(null);
  const [docOtherText, setDocOtherText] = useState("");
  const [admissionApplicationRef, setAdmissionApplicationRef] = useState("");
  /** Optional marks % for Educational Record (stored on scholarship application, not profile). */
  const [gradePercent, setGradePercent] = useState("");

  // Declaration
  const [mastersDeclarationAccepted, setMastersDeclarationAccepted] = useState(false);

  // Load organization datasets when needed (fee discount and kinship flow)
  useEffect(() => {
    if (!isFeeFlow && !isKinshipFlow) {
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
  }, [formData.discountType, isFeeFlow, isKinshipFlow]);

  const admissionDepartmentsForFaculty =
    typeof admissionFacultyId === "number"
      ? departments.filter((d) => d.facultyId === admissionFacultyId)
      : [];

  const admissionProgramsForDepartment =
    typeof admissionDepartmentId === "number"
      ? programs.filter((p) => p.departmentId === admissionDepartmentId)
      : [];

  const kinshipFacultyId =
    faculties.find(
      (f) =>
        f.name.trim().toLowerCase() === formData.kinshipFaculty.trim().toLowerCase(),
    )?.id ?? null;
  const kinshipDepartmentsForFaculty =
    kinshipFacultyId != null
      ? departments.filter((d) => d.facultyId === kinshipFacultyId)
      : [];
  const kinshipDepartmentId =
    kinshipDepartmentsForFaculty.find(
      (d) =>
        d.name.trim().toLowerCase() === formData.kinshipDepartment.trim().toLowerCase(),
    )?.id ?? null;
  const kinshipProgramsForDepartment =
    kinshipDepartmentId != null
      ? programs.filter((p) => p.departmentId === kinshipDepartmentId)
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

  const kinshipLastDegreeCertificateOptions = [
    { value: "FA", label: "FA" },
    { value: "FSC", label: "FSC" },
    { value: "ICS", label: "ICS" },
    { value: "I.COM", label: "I.COM" },
    { value: "A Levels", label: "A Levels" },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (profileCgpa == null) {
      toast.error("Please add your CGPA in your alumni profile before applying.", {
        duration: 5000,
        style: { background: "#fee2e2", color: "#991b1b", padding: "12px", borderRadius: "8px" },
      });
      return;
    }

    if (!formData.discountType) {
      toast.error("Please select a discount category.", {
        duration: 4000,
        style: { background: "#fee2e2", color: "#991b1b", padding: "12px", borderRadius: "8px" },
      });
      return;
    }

    if (applicableDiscountPercent == null) {
      toast.error(
        "No discount tier applies to your CGPA for this category. Contact the alumni office or choose another category.",
        {
          duration: 5000,
          style: { background: "#fee2e2", color: "#991b1b", padding: "12px", borderRadius: "8px" },
        },
      );
      return;
    }

    const derivedApplying =
      selectedCategory?.default_apply_for ??
      scholarshipApplyingForFromCategory(formData.discountType);
    const effectiveApplyingFor = (derivedApplying ?? formData.applyingFor).trim();

    if (!effectiveApplyingFor) {
      toast.error(
        needsKinshipApplyingFor
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
    if (isFeeFlow) {
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
        !admissionSession
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
      isKinshipFlow &&
      (!formData.kinshipName ||
        !formData.kinshipFatherName ||
        !formData.kinshipCampus ||
        !formData.kinshipFaculty ||
        !formData.kinshipDepartment ||
        !formData.kinshipProgram ||
        !formData.kinshipAdmissionRefNo ||
        !formData.kinshipLastDegreeCertificate ||
        !formData.kinshipPassingOutYear ||
        !formData.kinshipCnic)
    ) {
      toast.error("Please complete all required kinship details.", {
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
    if (
      isKinshipFlow &&
      (!docKinshipAdmissionLetterFile ||
        !docKinshipAlumniCardFile ||
        !docKinshipFrcFile ||
        !docKinshipCnicKinFile ||
        !docKinshipCnicAlumniFile ||
        !docKinshipAcademicCertificatesFile)
    ) {
      toast.error("Please complete all required kinship document checklist fields.", {
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

    // Compute degree title for fee discount flow from selected admission program
    let degreeTitleToSend = (formData.degreeTitle || "").trim();
    if (isFeeFlow) {
      const selectedProgram = programs.find(
        (p) => typeof admissionProgramId === "number" && p.id === admissionProgramId,
      );
      if (selectedProgram) {
        degreeTitleToSend = selectedProgram.name;
      }
    } else if (isKinshipFlow) {
      degreeTitleToSend = (formData.kinshipProgram || "").trim();
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
        isFeeFlow
          ? await (async () => {
              const fd = new FormData();
              fd.set("discountType", formData.discountType);
              fd.set("applyingFor", effectiveApplyingFor);
              fd.set("degreeTitle", degreeTitleToSend);
              fd.set("appliedDiscountPercent", String(applicableDiscountPercent));
              if (mergedFeeResult != null) {
                fd.set("admissionFeePercent", String(effectiveAdmissionFeePercent ?? ""));
                fd.set("tuitionFeePercent", String(mergedFeeResult.tuitionFeePercent ?? ""));
                fd.set("applyAdmissionFeeDiscount", applyAdmissionFeeDiscount ? "true" : "false");
              }
              fd.set("highAchieverPercent", String(highAchieverPercent ?? ""));

              fd.set("admissionFacultyId", String(admissionFacultyId));
              fd.set("admissionDepartmentId", String(admissionDepartmentId));
              fd.set("admissionProgramId", String(admissionProgramId));
              fd.set("admissionCampus", admissionCampus);
              fd.set("admissionSession", admissionSession);

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
              if (gradePercent.trim()) {
                fd.set("gradePercent", gradePercent.trim());
              }

              return fetch(url, { method: "POST", body: fd });
            })()
          : isKinshipFlow
          ? await (async () => {
              const fd = new FormData();
              fd.set("discountType", formData.discountType);
              fd.set("applyingFor", effectiveApplyingFor);
              fd.set("degreeTitle", degreeTitleToSend);
              fd.set("appliedDiscountPercent", String(applicableDiscountPercent));
              if (mergedFeeResult != null) {
                fd.set("admissionFeePercent", String(effectiveAdmissionFeePercent ?? ""));
                fd.set("tuitionFeePercent", String(mergedFeeResult.tuitionFeePercent ?? ""));
                fd.set("applyAdmissionFeeDiscount", applyAdmissionFeeDiscount ? "true" : "false");
              }
              fd.set("highAchieverPercent", String(highAchieverPercent ?? ""));
              fd.set("kinshipName", formData.kinshipName);
              fd.set("kinshipFatherName", formData.kinshipFatherName);
              fd.set("kinshipCampus", formData.kinshipCampus);
              fd.set("kinshipFaculty", formData.kinshipFaculty);
              fd.set("kinshipDepartment", formData.kinshipDepartment);
              fd.set("kinshipProgram", formData.kinshipProgram);
              fd.set("kinshipAdmissionRefNo", formData.kinshipAdmissionRefNo);
              fd.set(
                "kinshipLastDegreeCertificate",
                formData.kinshipLastDegreeCertificate,
              );
              fd.set("kinshipPassingOutYear", formData.kinshipPassingOutYear);
              fd.set("kinshipCnic", formData.kinshipCnic);
              fd.set("fatherCnic", formData.fatherCnic || "");
              fd.set(
                "docKinshipAcademicCertificates",
                docKinshipAcademicCertificatesFile as File,
              );
              fd.set("docKinshipAdmissionLetter", docKinshipAdmissionLetterFile as File);
              fd.set("docKinshipAlumniCard", docKinshipAlumniCardFile as File);
              fd.set("docKinshipFrc", docKinshipFrcFile as File);
              fd.set("docKinshipCnicKin", docKinshipCnicKinFile as File);
              fd.set("docKinshipCnicAlumni", docKinshipCnicAlumniFile as File);
              if (gradePercent.trim()) {
                fd.set("gradePercent", gradePercent.trim());
              }
              return fetch(url, { method: "POST", body: fd });
            })()
          : await fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                discountType: formData.discountType,
                applyingFor: effectiveApplyingFor,
                degreeTitle: degreeTitleToSend,
                appliedDiscountPercent: applicableDiscountPercent,
                admissionFeePercent: effectiveAdmissionFeePercent ?? null,
                tuitionFeePercent: mergedFeeResult?.tuitionFeePercent ?? null,
                applyAdmissionFeeDiscount: mergedFeeResult != null ? applyAdmissionFeeDiscount : undefined,
                highAchieverPercent: highAchieverPercent ?? null,
                kinshipName: formData.kinshipName || null,
                kinshipFatherName: formData.kinshipFatherName || null,
                kinshipCnic: formData.kinshipCnic || null,
                fatherCnic: formData.fatherCnic || null,
                gradePercent: gradePercent.trim() || null,
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
        kinshipName: "",
        kinshipFatherName: "",
        kinshipCampus: "",
        kinshipFaculty: "",
        kinshipDepartment: "",
        kinshipProgram: "",
        kinshipAdmissionRefNo: "",
        kinshipLastDegreeCertificate: "",
        kinshipPassingOutYear: "",
        kinshipCnic: "",
        fatherCnic: data?.father_cnic || "",
      });

      // Reset Masters/PhD uploads & declaration
      setAdmissionFacultyId("");
      setAdmissionDepartmentId("");
      setAdmissionProgramId("");
      setAdmissionCampus("");
      setAdmissionSession("");
      setDocAdmissionLetterFile(null);
      setDocTranscriptsFile(null);
      setDocAlumniProofFile(null);
      setDocCvFile(null);
      setDocCnicFile(null);
      setDocKinshipAdmissionLetterFile(null);
      setDocKinshipAlumniCardFile(null);
      setDocKinshipFrcFile(null);
      setDocKinshipCnicKinFile(null);
      setDocKinshipCnicAlumniFile(null);
      setDocKinshipAcademicCertificatesFile(null);
      setDocOtherFile(null);
      setDocOtherText("");
      setAdmissionApplicationRef("");
      setGradePercent("");
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

  if (isLoading || settingsLoading) {
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

  if (!isFormEnabled) {
    return (
      <>
        <AppHeader />
        <PageBanner title="Scholarship Application" />
        <div className="min-h-screen bg-gray-50">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="mb-6">
              <BackButton />
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="rounded-lg border-2 border-gray-300 bg-gray-50 p-8 text-center">
                <div className="mb-4">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-700 mb-2">Applications will open soon.</h3>
                <p className="text-sm text-gray-500">
                  Scholarship applications are currently disabled. Please check back later.
                </p>
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
            <span className="text-red-500 text-[16px]"> (Applicable if your Admission in University is confirmed and not applicable for Faculty of Medicine and Dentistry)</span>
            <p className="text-gray-600 mb-8">Fill out the form below to apply for UOL Alumni Scholarship or Fee Discount.</p>

            <form onSubmit={handleSubmit} className="max-w-4xl mx-auto mt-4" aria-label="Scholarship application form">
              <div className="grid sm:grid-cols-2 gap-6">
                {profileCgpa == null && (
                  <div className="sm:col-span-2 rounded-lg border border-amber-200 bg-amber-50 p-4">
                    <p className="text-sm font-medium text-amber-900">CGPA required</p>
                    <p className="mt-1 text-sm text-amber-800">
                      Add your CGPA in your alumni profile before you can submit a scholarship application.
                    </p>
                    <Link
                      href="/alumni-profile/more-details"
                      className="mt-2 inline-block text-sm font-semibold text-blue-700 hover:underline"
                    >
                      Update profile →
                    </Link>
                  </div>
                )}

                {categoriesError && (
                  <div className="sm:col-span-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                    {categoriesError}
                  </div>
                )}

                <div className="sm:col-span-2">
                  <label htmlFor="discountType" className="mb-2 text-sm text-slate-900 font-medium block">
                    Discount Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="discountType"
                    value={formData.discountType}
                    onChange={(e) => {
                      const v = e.target.value;
                      const cat = findCategoryBySlug(v, scholarshipCategories);
                      const derived =
                        cat?.default_apply_for ?? scholarshipApplyingForFromCategory(v);
                      setFormData({
                        ...formData,
                        discountType: v,
                        applyingFor: derived !== null ? derived : "",
                      });
                    }}
                    className="px-4 py-3 pr-8 bg-[#f0f1f2] focus:bg-transparent text-black w-full text-sm border border-gray-200 outline-[#007bff] rounded-md transition-all"
                    required
                    disabled={categoriesLoading || profileCgpa == null}
                  >
                    <option value="">
                      {categoriesLoading ? "Loading categories..." : "Select discount category"}
                    </option>
                    {SCHOLARSHIP_DISCOUNT_CATEGORY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                {formData.discountType && profileCgpa != null && (
                  <div className="sm:col-span-2 rounded-lg border border-blue-100 bg-blue-50/80 p-4">
                    {mergedFeeResult != null ? (
                      <>
                        <div className="flex flex-wrap gap-6 text-sm">
                          <div>
                            <span className="text-gray-600">Your CGPA</span>
                            <p className="font-semibold text-gray-900">{profileCgpa.toFixed(2)}</p>
                          </div>
                          {applyAdmissionFeeDiscount && (
                            <div>
                              <span className="text-gray-600">Admission Fee Discount (Standalone)</span>
                              <p className="font-semibold text-green-700">
                                {mergedFeeResult.admissionFeePercent != null
                                  ? formatDiscountPercentDisplay(mergedFeeResult.admissionFeePercent)
                                  : "No tier matches your CGPA"}
                              </p>
                            </div>
                          )}
                          <div>
                            <span className="text-gray-600">Tuition Fee Discount</span>
                            <p className="font-semibold text-green-700">
                              {mergedFeeResult.tuitionFeePercent != null
                                ? formatDiscountPercentDisplay(mergedFeeResult.tuitionFeePercent)
                                : "No tier matches your CGPA"}
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-600">High Achiever Discount{alumniMedal ? ` (${alumniMedal})` : ""}</span>
                            <p className={`font-semibold ${isHighAchiever ? "text-green-700" : "text-gray-500"}`}>
                              {isHighAchiever ? formatDiscountPercentDisplay(highAchieverPercent!) : "0%"}
                            </p>
                          </div>
                          {applicableDiscountPercent != null && (
                            <div>
                              <span className="text-gray-600">Total Tuition Fee Discount</span>
                              <p className="font-semibold text-green-700">
                                {formatDiscountPercentDisplay(applicableDiscountPercent)}
                              </p>
                            </div>
                          )}
                        </div>
                        {mergedFeeResult.admissionFeePercent != null && (
                          <label className="mt-3 flex items-center gap-2 text-sm text-slate-800 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={applyAdmissionFeeDiscount}
                              onChange={(e) => setApplyAdmissionFeeDiscount(e.target.checked)}
                              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            Apply Admission Fee Discount
                          </label>
                        )}
                        {mergedFeeResult.tuitionFeePercent == null && !isHighAchiever && (
                          <p className="mt-2 text-xs text-amber-800">
                            Your CGPA does not fall within any configured range for this category. Choose another
                            category or contact the alumni office.
                          </p>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="flex flex-wrap gap-6 text-sm">
                          <div>
                            <span className="text-gray-600">Your CGPA</span>
                            <p className="font-semibold text-gray-900">{profileCgpa.toFixed(2)}</p>
                          </div>
                          <div>
                            <span className="text-gray-600">Applicable discount</span>
                            <p className="font-semibold text-green-700">
                              {baseDiscountPercent != null
                                ? formatDiscountPercentDisplay(baseDiscountPercent)
                                : "No tier matches your CGPA"}
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-600">High Achiever Discount{alumniMedal ? ` (${alumniMedal})` : ""}</span>
                            <p className={`font-semibold ${isHighAchiever ? "text-green-700" : "text-gray-500"}`}>
                              {isHighAchiever ? formatDiscountPercentDisplay(highAchieverPercent!) : "0%"}
                            </p>
                          </div>
                          {applicableDiscountPercent != null && (
                            <div>
                              <span className="text-gray-600">Total Tution Fee Discount</span>
                              <p className="font-semibold text-green-700">
                                {formatDiscountPercentDisplay(applicableDiscountPercent)}
                              </p>
                            </div>
                          )}
                        </div>
                        {baseDiscountPercent == null && !isHighAchiever && (
                          <p className="mt-2 text-xs text-amber-800">
                            Your CGPA does not fall within any configured range for this category. Choose another
                            category or contact the alumni office.
                          </p>
                        )}
                      </>
                    )}
                  </div>
                )}

                {needsKinshipApplyingFor && (
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

                      <div className="mt-4">
                        <p className="mb-2 text-sm text-slate-900 font-medium">
                          Educational Record (UOL)
                        </p>
                        <div className="grid sm:grid-cols-2 gap-4">
                          <div>
                            <label className="mb-2 text-sm text-slate-900 font-medium block">
                              CGPA
                            </label>
                            <input
                              type="text"
                              value={missing((data as any)?.cgpa)}
                              readOnly
                              className="px-4 py-3 pr-8 bg-[#f0f1f2] text-black w-full text-sm border border-gray-200 rounded-md opacity-60 cursor-not-allowed"
                            />
                            <p className="mt-1 text-xs text-gray-500">Auto-fetched from your profile</p>
                          </div>
                          <div>
                            <label className="mb-2 text-sm text-slate-900 font-medium block">
                              Grade (%)
                            </label>
                            <input
                              type="text"
                              inputMode="decimal"
                              placeholder="e.g. 95"
                              value={gradePercent}
                              onChange={(e) => setGradePercent(e.target.value)}
                              className="px-4 py-3 pr-8 bg-[#f0f1f2] focus:bg-transparent text-black w-full text-sm border border-gray-200 outline-[#007bff] rounded-md transition-all"
                            />
                            <p className="mt-1 text-xs text-gray-500">Optional — enter your marks percentage</p>
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

                {isKinshipFlow && (
                  <div className="sm:col-span-2 space-y-6 mt-4">
                    <div className="border border-gray-200 rounded-lg p-4 sm:p-5">
                      <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">
                        (a) Alumni Details
                      </h2>
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <label className="mb-2 text-sm text-slate-900 font-medium block">Name</label>
                          <input type="text" value={missing(data?.alumniname)} readOnly className="px-4 py-3 pr-8 bg-[#f0f1f2] text-black w-full text-sm border border-gray-200 rounded-md opacity-60 cursor-not-allowed" />
                        </div>
                        <div>
                          <label className="mb-2 text-sm text-slate-900 font-medium block">Father&apos;s Name</label>
                          <input type="text" value={missing((data as any)?.fathername)} readOnly className="px-4 py-3 pr-8 bg-[#f0f1f2] text-black w-full text-sm border border-gray-200 rounded-md opacity-60 cursor-not-allowed" />
                        </div>
                        <div>
                          <label className="mb-2 text-sm text-slate-900 font-medium block">DOB</label>
                          <input type="text" value={missing((data as any)?.dateofbirth || (data as any)?.dob)} readOnly className="px-4 py-3 pr-8 bg-[#f0f1f2] text-black w-full text-sm border border-gray-200 rounded-md opacity-60 cursor-not-allowed" />
                        </div>
                        <div>
                          <label className="mb-2 text-sm text-slate-900 font-medium block">CNIC</label>
                          <input type="text" value={missing(data?.cnicpassport)} readOnly className="px-4 py-3 pr-8 bg-[#f0f1f2] text-black w-full text-sm border border-gray-200 rounded-md opacity-60 cursor-not-allowed" />
                        </div>
                      </div>
                    </div>

                    <div className="border border-gray-200 rounded-lg p-4 sm:p-5">
                      <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">
                        (b) Alumni Educational Record
                      </h2>
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div><label className="mb-2 text-sm text-slate-900 font-medium block">Campus</label><input type="text" value={missing((data as any)?.campusname || (data as any)?.campus)} readOnly className="px-4 py-3 pr-8 bg-[#f0f1f2] text-black w-full text-sm border border-gray-200 rounded-md opacity-60 cursor-not-allowed" /></div>
                        <div><label className="mb-2 text-sm text-slate-900 font-medium block">Faculty</label><input type="text" value={missing((data as any)?.facultyname)} readOnly className="px-4 py-3 pr-8 bg-[#f0f1f2] text-black w-full text-sm border border-gray-200 rounded-md opacity-60 cursor-not-allowed" /></div>
                        <div><label className="mb-2 text-sm text-slate-900 font-medium block">Department</label><input type="text" value={missing((data as any)?.departmentname)} readOnly className="px-4 py-3 pr-8 bg-[#f0f1f2] text-black w-full text-sm border border-gray-200 rounded-md opacity-60 cursor-not-allowed" /></div>
                        <div><label className="mb-2 text-sm text-slate-900 font-medium block">Program</label><input type="text" value={missing((data as any)?.degreetitle)} readOnly className="px-4 py-3 pr-8 bg-[#f0f1f2] text-black w-full text-sm border border-gray-200 rounded-md opacity-60 cursor-not-allowed" /></div>
                        <div><label className="mb-2 text-sm text-slate-900 font-medium block">SAP ID</label><input type="text" value={missing(data?.sapid)} readOnly className="px-4 py-3 pr-8 bg-[#f0f1f2] text-black w-full text-sm border border-gray-200 rounded-md opacity-60 cursor-not-allowed" /></div>
                        <div><label className="mb-2 text-sm text-slate-900 font-medium block">CGPA</label><input type="text" value={missing((data as any)?.cgpa)} readOnly className="px-4 py-3 pr-8 bg-[#f0f1f2] text-black w-full text-sm border border-gray-200 rounded-md opacity-60 cursor-not-allowed" /><p className="mt-1 text-xs text-gray-500">Auto-fetched from your profile</p></div>
                        <div>
                          <label className="mb-2 text-sm text-slate-900 font-medium block">Grade (%)</label>
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="e.g. 95"
                            value={gradePercent}
                            onChange={(e) => setGradePercent(e.target.value)}
                            className="px-4 py-3 pr-8 bg-[#f0f1f2] focus:bg-transparent text-black w-full text-sm border border-gray-200 outline-[#007bff] rounded-md transition-all"
                          />
                          <p className="mt-1 text-xs text-gray-500">Optional — enter your marks percentage</p>
                        </div>
                        <div><label className="mb-2 text-sm text-slate-900 font-medium block">Passing Out Year</label><input type="text" value={missing((data as any)?.yearofending)} readOnly className="px-4 py-3 pr-8 bg-[#f0f1f2] text-black w-full text-sm border border-gray-200 rounded-md opacity-60 cursor-not-allowed" /></div>
                        <div><label className="mb-2 text-sm text-slate-900 font-medium block">Discount Category</label><input type="text" value={missing(selectedCategory?.label)} readOnly className="px-4 py-3 pr-8 bg-[#f0f1f2] text-black w-full text-sm border border-gray-200 rounded-md opacity-60 cursor-not-allowed" /></div>
                        <div><label className="mb-2 text-sm text-slate-900 font-medium block">Applicable Discount</label><input type="text" value={formatDiscountPercentDisplay(applicableDiscountPercent)} readOnly className="px-4 py-3 pr-8 bg-[#f0f1f2] text-black w-full text-sm border border-gray-200 rounded-md opacity-60 cursor-not-allowed" /></div>
                        <div className="sm:col-span-2"><label className="mb-2 text-sm text-slate-900 font-medium block">Applying For</label><input type="text" value={missing(formData.applyingFor)} readOnly className="px-4 py-3 pr-8 bg-[#f0f1f2] text-black w-full text-sm border border-gray-200 rounded-md opacity-60 cursor-not-allowed" /></div>
                      </div>
                    </div>

                    <div className="border border-gray-200 rounded-lg p-4 sm:p-5">
                      <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">
                        (c) Kin Details - Previous Educational Record & Program Applied For
                      </h2>
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div><label className="mb-2 text-sm text-slate-900 font-medium block">Name <span className="text-red-500">*</span></label><input type="text" value={formData.kinshipName} onChange={(e) => setFormData({ ...formData, kinshipName: e.target.value })} className="px-4 py-3 pr-8 bg-[#f0f1f2] focus:bg-transparent text-black w-full text-sm border border-gray-200 outline-[#007bff] rounded-md transition-all" required /></div>
                        <div><label className="mb-2 text-sm text-slate-900 font-medium block">Father&apos;s Name <span className="text-red-500">*</span></label><input type="text" value={formData.kinshipFatherName} onChange={(e) => setFormData({ ...formData, kinshipFatherName: e.target.value })} className="px-4 py-3 pr-8 bg-[#f0f1f2] focus:bg-transparent text-black w-full text-sm border border-gray-200 outline-[#007bff] rounded-md transition-all" required /></div>
                        <div>
                          <label className="mb-2 text-sm text-slate-900 font-medium block">Campus <span className="text-red-500">*</span></label>
                          <select
                            value={formData.kinshipCampus}
                            onChange={(e) => setFormData({ ...formData, kinshipCampus: e.target.value })}
                            className="px-4 py-3 pr-8 bg-[#f0f1f2] focus:bg-transparent text-black w-full text-sm border border-gray-200 outline-[#007bff] rounded-md transition-all"
                            required
                          >
                            <option value="">Select campus</option>
                            <option value="Lahore">Lahore</option>
                            <option value="Sargodha">Sargodha</option>
                            <option value="Islamabad">Islamabad</option>
                            <option value="Pakpattan">Pakpattan</option>
                          </select>
                        </div>
                        <div>
                          <label className="mb-2 text-sm text-slate-900 font-medium block">Faculty <span className="text-red-500">*</span></label>
                          <select
                            value={formData.kinshipFaculty}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                kinshipFaculty: e.target.value,
                                kinshipDepartment: "",
                                kinshipProgram: "",
                              })
                            }
                            className="px-4 py-3 pr-8 bg-[#f0f1f2] focus:bg-transparent text-black w-full text-sm border border-gray-200 outline-[#007bff] rounded-md transition-all"
                            required
                          >
                            <option value="">{orgLoading ? "Loading..." : "Select faculty"}</option>
                            {faculties.map((f) => (
                              <option key={f.id} value={f.name}>
                                {f.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="mb-2 text-sm text-slate-900 font-medium block">Department <span className="text-red-500">*</span></label>
                          <select
                            value={formData.kinshipDepartment}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                kinshipDepartment: e.target.value,
                                kinshipProgram: "",
                              })
                            }
                            className="px-4 py-3 pr-8 bg-[#f0f1f2] focus:bg-transparent text-black w-full text-sm border border-gray-200 outline-[#007bff] rounded-md transition-all"
                            disabled={!formData.kinshipFaculty || kinshipDepartmentsForFaculty.length === 0}
                            required
                          >
                            <option value="">
                              {!formData.kinshipFaculty
                                ? "Select faculty first"
                                : kinshipDepartmentsForFaculty.length === 0
                                  ? "No departments"
                                  : "Select department"}
                            </option>
                            {kinshipDepartmentsForFaculty.map((d) => (
                              <option key={d.id} value={d.name}>
                                {d.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="mb-2 text-sm text-slate-900 font-medium block">Program <span className="text-red-500">*</span></label>
                          <select
                            value={formData.kinshipProgram}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                kinshipProgram: e.target.value,
                              })
                            }
                            className="px-4 py-3 pr-8 bg-[#f0f1f2] focus:bg-transparent text-black w-full text-sm border border-gray-200 outline-[#007bff] rounded-md transition-all"
                            disabled={!formData.kinshipDepartment || kinshipProgramsForDepartment.length === 0}
                            required
                          >
                            <option value="">
                              {!formData.kinshipDepartment
                                ? "Select department first"
                                : kinshipProgramsForDepartment.length === 0
                                  ? "No programs"
                                  : "Select program"}
                            </option>
                            {kinshipProgramsForDepartment.map((p) => (
                              <option key={p.id} value={p.name}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div><label className="mb-2 text-sm text-slate-900 font-medium block">Admission Ref No <span className="text-red-500">*</span></label><input type="text" value={formData.kinshipAdmissionRefNo} onChange={(e) => setFormData({ ...formData, kinshipAdmissionRefNo: e.target.value })} className="px-4 py-3 pr-8 bg-[#f0f1f2] focus:bg-transparent text-black w-full text-sm border border-gray-200 outline-[#007bff] rounded-md transition-all" required /></div>
                        <div>
                          <label className="mb-2 text-sm text-slate-900 font-medium block">Last Degree/Certificate <span className="text-red-500">*</span></label>
                          <select
                            value={formData.kinshipLastDegreeCertificate}
                            onChange={(e) => setFormData({ ...formData, kinshipLastDegreeCertificate: e.target.value })}
                            className="px-4 py-3 pr-8 bg-[#f0f1f2] focus:bg-transparent text-black w-full text-sm border border-gray-200 outline-[#007bff] rounded-md transition-all"
                            required
                          >
                            <option value="">Select</option>
                            {kinshipLastDegreeCertificateOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="mb-2 text-sm text-slate-900 font-medium block">Passing Out Year <span className="text-red-500">*</span></label>
                          <select
                            value={formData.kinshipPassingOutYear}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                kinshipPassingOutYear: e.target.value,
                              })
                            }
                            className="px-4 py-3 pr-8 bg-[#f0f1f2] focus:bg-transparent text-black w-full text-sm border border-gray-200 outline-[#007bff] rounded-md transition-all"
                            required
                          >
                            <option value="">Select passing out year</option>
                            {Array.from({ length: 71 }, (_, idx) => String(new Date().getFullYear() - idx)).map(
                              (year) => (
                                <option key={year} value={year}>
                                  {year}
                                </option>
                              ),
                            )}
                          </select>
                        </div>
                        <div><label className="mb-2 text-sm text-slate-900 font-medium block">CNIC (Kinship) <span className="text-red-500">*</span></label><input type="text" value={formData.kinshipCnic} onChange={(e) => setFormData({ ...formData, kinshipCnic: e.target.value })} className="px-4 py-3 pr-8 bg-[#f0f1f2] focus:bg-transparent text-black w-full text-sm border border-gray-200 outline-[#007bff] rounded-md transition-all" required /></div>
                      </div>
                    </div>

                    <div className="border border-gray-200 rounded-lg p-4 sm:p-5">
                      <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">
                        (d) Documents Checklist (all are required)
                      </h2>
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <label className="mb-2 text-sm text-slate-900 font-medium block">Copy of Admission Letter <span className="text-red-500">*</span></label>
                          <input type="file" accept="application/pdf,.pdf" onChange={(e) => setDocKinshipAdmissionLetterFile(e.target.files?.[0] ?? null)} className="px-4 py-3 pr-8 bg-[#f0f1f2] text-black w-full text-sm border border-gray-200 rounded-md" required />
                        </div>
                        <div>
                          <label className="mb-2 text-sm text-slate-900 font-medium block">Academic Certificates/Transcripts (Kin) <span className="text-red-500">*</span></label>
                          <input type="file" accept="application/pdf,.pdf" onChange={(e) => setDocKinshipAcademicCertificatesFile(e.target.files?.[0] ?? null)} className="px-4 py-3 pr-8 bg-[#f0f1f2] text-black w-full text-sm border border-gray-200 rounded-md" required />
                        </div>
                        <div>
                          <label className="mb-2 text-sm text-slate-900 font-medium block">Alumni Card <span className="text-red-500">*</span></label>
                          <input type="file" accept="application/pdf,.pdf" onChange={(e) => setDocKinshipAlumniCardFile(e.target.files?.[0] ?? null)} className="px-4 py-3 pr-8 bg-[#f0f1f2] text-black w-full text-sm border border-gray-200 rounded-md" required />
                        </div>
                        <div>
                          <label className="mb-2 text-sm text-slate-900 font-medium block">FRC <span className="text-red-500">*</span></label>
                          <input type="file" accept="application/pdf,.pdf" onChange={(e) => setDocKinshipFrcFile(e.target.files?.[0] ?? null)} className="px-4 py-3 pr-8 bg-[#f0f1f2] text-black w-full text-sm border border-gray-200 rounded-md" required />
                        </div>
                        <div>
                          <label className="mb-2 text-sm text-slate-900 font-medium block">CNIC Copy (Kinship) <span className="text-red-500">*</span></label>
                          <input type="file" accept="application/pdf,.pdf" onChange={(e) => setDocKinshipCnicKinFile(e.target.files?.[0] ?? null)} className="px-4 py-3 pr-8 bg-[#f0f1f2] text-black w-full text-sm border border-gray-200 rounded-md" required />
                        </div>
                        <div>
                          <label className="mb-2 text-sm text-slate-900 font-medium block">CNIC Copy (Alumni) <span className="text-red-500">*</span></label>
                          <input type="file" accept="application/pdf,.pdf" onChange={(e) => setDocKinshipCnicAlumniFile(e.target.files?.[0] ?? null)} className="px-4 py-3 pr-8 bg-[#f0f1f2] text-black w-full text-sm border border-gray-200 rounded-md" required />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !canSubmitScholarship}
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

