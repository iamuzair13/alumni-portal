"use client";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useAlumniFullDetails } from "@/app/queries/alumni-profile";
import AppHeader from "@/layout/AppHeader";
import BackButton from "@/components/ui/BackButton";
import { toast } from "react-hot-toast";
import PageBanner from "@/components/ui/PageBanner";
import Alert from "@/components/ui/alert/Alert";
import { AcknowledgmentCheckbox, FormActions } from "@/components/ui/form";
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
  HIGH_ACHIEVER_DISCOUNT_PERCENT } from "@/lib/scholarshipLetter";
import {
  findCategoryBySlug,
  formatDiscountPercentDisplay,
  parseCgpa,
  resolveCategoryFlowType,
  resolveDiscountPercent,
  resolveMergedFeeDiscount,
  type ScholarshipCategoryWithTiers } from "@/lib/scholarshipDiscount";
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
    staleTime: 60 * 1000 });

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
    kinshipGradeType: "",
    kinshipGradeValue: "",
    fatherCnic: "" });

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
    isKinship: isScholarshipKinshipCategory });
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
  const [admissionSemester, setAdmissionSemester] = useState("");

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
  /** Optional marks % for Educational Record (stored on scholarship application, not profile). */
  const [gradePercent, setGradePercent] = useState("");
  /** Scholarship application year (starts from 2026, future years generated dynamically). */
  const [applicationYear, setApplicationYear] = useState<string>("");
  /** Scholarship application term (Fall / Spring). */
  const [applicationTerm, setApplicationTerm] = useState<string>("");

  // Declaration
  const [mastersDeclarationAccepted, setMastersDeclarationAccepted] = useState(false);
  // Scholarship disclosure declaration (required for all flows).
  // Defaults to "None" — applicants with active scholarships must replace it.
  const [scholarshipDisclosure, setScholarshipDisclosure] = useState("None");
  const [disclosureAccepted, setDisclosureAccepted] = useState(false);
  const [discountTermsAccepted, setDiscountTermsAccepted] = useState(false);

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
          headers: { accept: "application/json" } });
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
            name: String((f as any).faculty_name ?? "").trim() })) ?? [];
        const mappedDepartments =
          j.departments?.map((d) => ({
            id: Number(d.id),
            name: String((d as any).department_name ?? "").trim(),
            facultyId: Number((d as any).faculty_id) })) ?? [];
        const mappedPrograms =
          j.programs?.map((p) => ({
            id: Number(p.id),
            name: String((p as any).program_name ?? "").trim(),
            departmentId: Number((p as any).department_id) })) ?? [];

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

  // Semester options for self (fee-discount) applications — BS runs up to 8 semesters.
  const semesterOptions = Array.from({ length: 8 }, (_, i) => String(i + 1));

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
    {value: "BS", label: "BS"},
    { value: "FA", label: "FA" },
    { value: "FSC", label: "FSC" },
    { value: "ICS", label: "ICS" },
    { value: "I.COM", label: "I.COM" },
    { value: "A Levels", label: "A Levels" },
  ];

  // Scholarship application year options: include the previous 10 years from the
  // current year and extend 5 years beyond the current year for future intakes.
  const applicationYearOptions = (() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const startYear = currentYear - 10;
    const endYear = currentYear + 5;
    const years: number[] = [];
    for (let y = startYear; y <= endYear; y++) {
      years.push(y);
    }
    return years;
  })();

  const applicationTermOptions = [
    { value: "Fall", label: "Fall" },
    { value: "Spring", label: "Spring" },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (profileCgpa == null) {
      toast.error("Please add your CGPA in your alumni profile before applying.", {
        duration: 5000 });
      return;
    }

    if (!applicationYear) {
      toast.error("Please select the application Year.", {
        duration: 4000 });
      return;
    }

    if (!applicationTerm) {
      toast.error("Please select the application Term.", {
        duration: 4000 });
      return;
    }

    if (!formData.discountType) {
      toast.error("Please select a discount category.", {
        duration: 4000 });
      return;
    }

    if (applicableDiscountPercent == null) {
      toast.error(
        "No discount tier applies to your CGPA for this category. Contact the alumni office or choose another category.",
        {
          duration: 5000 },
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
        duration: 4000 }
      );
      return;
    }

    // Additional validation for fee discount (admission letter, uploads, declaration)
    if (isFeeFlow) {
      // Ensure org data is ready
      if (orgLoading || faculties.length === 0) {
        toast.error("Please wait while options are loading. Try again in a moment.", {
          duration: 4000 });
        return;
      }

      if (
        !admissionFacultyId ||
        !admissionDepartmentId ||
        !admissionProgramId ||
        !admissionCampus ||
        !admissionSession ||
        !admissionSemester
      ) {
        toast.error("Please complete all admission and document sections before submitting.", {
          duration: 5000 });
        return;
      }

      if (!docAdmissionLetterFile || !docAlumniProofFile || !docCnicFile) {
        toast.error("Please upload all required documents before submitting.", {
          duration: 5000 });
        return;
      }

      if (docOtherFile && !docOtherText.trim()) {
        toast.error("Please specify 'Other' document name/description.", {
          duration: 4000 });
        return;
      }

      if (!mastersDeclarationAccepted) {
        toast.error("You must accept the declaration to proceed.", {
          duration: 4000 });
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
        !formData.kinshipCnic ||
        !formData.kinshipGradeType ||
        !formData.kinshipGradeValue)
    ) {
      toast.error("Please complete all required kinship details.", {
        duration: 4000 });
      return;
    }

    if (isKinshipFlow && formData.kinshipGradeType && formData.kinshipGradeValue) {
      const gradeNum = Number(formData.kinshipGradeValue);
      if (!Number.isFinite(gradeNum) || gradeNum < 0) {
        toast.error("Please enter a valid grade value.", {
          duration: 4000 });
        return;
      }
      if (formData.kinshipGradeType === "CGPA" && gradeNum > 4) {
        toast.error("CGPA cannot exceed 4.00.", {
          duration: 4000 });
        return;
      }
      if (formData.kinshipGradeType === "Percentage" && gradeNum > 100) {
        toast.error("Percentage cannot exceed 100.0%.", {
          duration: 4000 });
        return;
      }
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
        duration: 4000 });
      return;
    }

    if (!scholarshipDisclosure.trim() || !disclosureAccepted) {
      toast.error(
        "Please disclose all scholarships / financial assistance currently availed and accept the declaration.",
        {
          duration: 5000 },
      );
      return;
    }

    if (!discountTermsAccepted) {
      toast.error(
        "Please accept the discount terms and conditions to proceed.",
        {
          duration: 5000 },
      );
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
        duration: 4000 });
      return;
    }

    if (!sapId) {
      toast.error("SAP ID not found. Please ensure you are logged in.", {
        duration: 4000 });
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
              fd.set("semester", admissionSemester);

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
              fd.set("declarationAccepted", mastersDeclarationAccepted ? "true" : "false");
              if (gradePercent.trim()) {
                fd.set("gradePercent", gradePercent.trim());
              }
              fd.set("applicationYear", applicationYear);
              fd.set("applicationTerm", applicationTerm);
              fd.set("scholarshipDisclosure", scholarshipDisclosure.trim());
              fd.set("disclosureDeclaration", "true");
              fd.set("discountTermsAccepted", "true");

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
              fd.set("kinshipGradeType", formData.kinshipGradeType);
              fd.set("kinshipGradeValue", formData.kinshipGradeValue);
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
              fd.set("applicationYear", applicationYear);
              fd.set("applicationTerm", applicationTerm);
              fd.set("scholarshipDisclosure", scholarshipDisclosure.trim());
              fd.set("disclosureDeclaration", "true");
              fd.set("discountTermsAccepted", "true");
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
                kinshipGradeType: formData.kinshipGradeType || null,
                kinshipGradeValue: formData.kinshipGradeValue || null,
                fatherCnic: formData.fatherCnic || null,
                gradePercent: gradePercent.trim() || null,
                applicationYear: applicationYear || null,
                applicationTerm: applicationTerm || null,
                scholarshipDisclosure: scholarshipDisclosure.trim(),
                disclosureDeclaration: true,
                discountTermsAccepted: true }) });

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
            duration: 8000 }
        );
      } else if (result.emailSent === true) {
        // Email sent successfully
        toast.success("Application submitted successfully! Please check your email for the confirmation document.", {
          duration: 6000 });
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
            duration: 6000 }
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
        kinshipGradeType: "",
        kinshipGradeValue: "",
        fatherCnic: data?.father_cnic || "" });

      // Reset Masters/PhD uploads & declaration
      setAdmissionFacultyId("");
      setAdmissionDepartmentId("");
      setAdmissionProgramId("");
      setAdmissionCampus("");
      setAdmissionSession("");
      setAdmissionSemester("");
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
      setGradePercent("");
      setMastersDeclarationAccepted(false);
      setScholarshipDisclosure("None");
      setDisclosureAccepted(false);
      setDiscountTermsAccepted(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to submit application. Please try again.", {
        duration: 4000 });
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
                  <svg className="animate-spin h-12 w-12 text-brand-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
                  <p className="text-sm text-error-600 dark:text-error-400">Failed to load profile data</p>
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

      <PageBanner title="Scholarship Application" />
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-6">
            <BackButton />
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 sm:p-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Scholarship</h1>
            <span className="text-error-500 text-base"> (Applicable if your Admission in University is confirmed and not applicable for Faculty of Medicine and Dentistry)</span>
            <p className="text-gray-600 mb-8">Fill out the form below to apply for UOL Alumni Scholarship or Fee Discount.</p>

            <form onSubmit={handleSubmit} className="max-w-4xl mx-auto mt-4" aria-label="Scholarship application form">
              <div className="grid sm:grid-cols-2 gap-6">
                {profileCgpa == null && (
                  <div className="sm:col-span-2">
                    <Alert
                      variant="warning"
                      title="CGPA required"
                      message="Add your CGPA in your alumni profile before you can submit a scholarship application."
                      showLink
                      linkHref="/alumni-profile/more-details"
                      linkText="Update profile"
                    />
                  </div>
                )}

                {categoriesError && (
                  <div className="sm:col-span-2 rounded-xl border border-error-200 bg-error-50 p-3 text-sm text-error-800 dark:border-error-500/30 dark:bg-error-500/15 dark:text-error-300">
                    {categoriesError}
                  </div>
                )}

                <div className="sm:col-span-2">
                  <label htmlFor="discountType" className="field-label">
                    Discount Category <span className="text-error-500">*</span>
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
                        applyingFor: derived !== null ? derived : "" });
                    }}
                    className="field-input"
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

                <div>
                  <label htmlFor="applicationYear" className="field-label">
                    Year <span className="text-error-500">*</span>
                  </label>
                  <select
                    id="applicationYear"
                    value={applicationYear}
                    onChange={(e) => setApplicationYear(e.target.value)}
                    className="field-input"
                    required
                  >
                    <option value="">Select year</option>
                    {applicationYearOptions.map((y) => (
                      <option key={y} value={String(y)}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="applicationTerm" className="field-label">
                    Term <span className="text-error-500">*</span>
                  </label>
                  <select
                    id="applicationTerm"
                    value={applicationTerm}
                    onChange={(e) => setApplicationTerm(e.target.value)}
                    className="field-input"
                    required
                  >
                    <option value="">Select term</option>
                    {applicationTermOptions.map((option) => (
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
                              <p className="font-semibold text-brand-700 dark:text-brand-400">
                                {mergedFeeResult.admissionFeePercent != null
                                  ? formatDiscountPercentDisplay(mergedFeeResult.admissionFeePercent)
                                  : "No tier matches your CGPA"}
                              </p>
                            </div>
                          )}
                          <div>
                            <span className="text-gray-600">Tuition Fee Discount</span>
                            <p className="font-semibold text-brand-700 dark:text-brand-400">
                              {mergedFeeResult.tuitionFeePercent != null
                                ? formatDiscountPercentDisplay(mergedFeeResult.tuitionFeePercent)
                                : "No tier matches your CGPA"}
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-600">High Achiever Discount{alumniMedal ? ` (${alumniMedal})` : ""}</span>
                            <p className={`font-semibold ${isHighAchiever ? "text-brand-700 dark:text-brand-400" : "text-gray-500"}`}>
                              {isHighAchiever ? formatDiscountPercentDisplay(highAchieverPercent!) : "0%"}
                            </p>
                          </div>
                          {applicableDiscountPercent != null && (
                            <div>
                              <span className="text-gray-600">Total Tuition Fee Discount</span>
                              <p className="font-semibold text-brand-700 dark:text-brand-400">
                                {formatDiscountPercentDisplay(applicableDiscountPercent)}
                              </p>
                            </div>
                          )}
                        </div>
                        {mergedFeeResult.admissionFeePercent != null && (
                          <label className="mt-3 flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={applyAdmissionFeeDiscount}
                              onChange={(e) => setApplyAdmissionFeeDiscount(e.target.checked)}
                              className="h-4 w-4 rounded border-gray-300 text-brand-600 accent-brand-600 focus:ring-2 focus:ring-brand-500/30 dark:border-gray-600 dark:bg-gray-800"
                            />
                            Apply Admission Fee Discount
                          </label>
                        )}
                        {mergedFeeResult.tuitionFeePercent == null && !isHighAchiever && (
                          <p className="mt-2 text-xs text-warning-700 dark:text-warning-400">
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
                            <p className="font-semibold text-brand-700 dark:text-brand-400">
                              {baseDiscountPercent != null
                                ? formatDiscountPercentDisplay(baseDiscountPercent)
                                : "No tier matches your CGPA"}
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-600">High Achiever Discount{alumniMedal ? ` (${alumniMedal})` : ""}</span>
                            <p className={`font-semibold ${isHighAchiever ? "text-brand-700 dark:text-brand-400" : "text-gray-500"}`}>
                              {isHighAchiever ? formatDiscountPercentDisplay(highAchieverPercent!) : "0%"}
                            </p>
                          </div>
                          {applicableDiscountPercent != null && (
                            <div>
                              <span className="text-gray-600">Total Tution Fee Discount</span>
                              <p className="font-semibold text-brand-700 dark:text-brand-400">
                                {formatDiscountPercentDisplay(applicableDiscountPercent)}
                              </p>
                            </div>
                          )}
                        </div>
                        {baseDiscountPercent == null && !isHighAchiever && (
                          <p className="mt-2 text-xs text-warning-700 dark:text-warning-400">
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
                    <label htmlFor="applyingForKinship" className="field-label">
                      Applying For <span className="text-error-500">*</span>
                    </label>
                    <select
                      id="applyingForKinship"
                      value={formData.applyingFor}
                      onChange={(e) => setFormData({ ...formData, applyingFor: e.target.value })}
                      className="field-input"
                      required
                    >
                      <option value="">Select program level</option>
                      {currentOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <p className="field-hint">
                      Level of study for the beneficiary (kin) applying for the discount.
                    </p>
                  </div>
                )}

                {/* Fee discount detailed form (admission + documents) */}
                {isFeeFlow && (
                  <div className="sm:col-span-2 space-y-6 mt-4">
                    {/* 1. Applicant Information */}
                    <div className="card p-5 sm:p-6">
                      <h2 className="mb-4 text-base font-semibold text-gray-900 dark:text-gray-100">
                        1. Applicant Information
                      </h2>
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <label className="field-label">
                            Name of Candidate
                          </label>
                          <input
                            type="text"
                            value={missing(data?.alumniname)}
                            readOnly
                            className="field-input bg-gray-50 text-gray-600 opacity-80 dark:bg-gray-950 dark:text-gray-300"
                          />
                          <p className="field-hint">Auto-fetched from your profile</p>
                        </div>
                        <div>
                          <label className="field-label">
                            Father&apos;s / Guardian&apos;s Name
                          </label>
                          <input
                            type="text"
                            value={missing((data as any)?.fathername)}
                            readOnly
                            className="field-input bg-gray-50 text-gray-600 opacity-80 dark:bg-gray-950 dark:text-gray-300"
                          />
                          <p className="field-hint">Auto-fetched from your profile</p>
                        </div>
                        <div>
                          <label className="field-label">
                            SAP Code
                          </label>
                          <input
                            type="text"
                            value={missing(data?.sapid)}
                            readOnly
                            className="field-input bg-gray-50 text-gray-600 opacity-80 dark:bg-gray-950 dark:text-gray-300"
                          />
                          <p className="field-hint">Auto-fetched from your profile</p>
                        </div>
                        <div>
                          <label className="field-label">
                            Registration No.
                          </label>
                          <input
                            type="text"
                            value={missing(data?.registrationno)}
                            readOnly
                            className="field-input bg-gray-50 text-gray-600 opacity-80 dark:bg-gray-950 dark:text-gray-300"
                          />
                          <p className="field-hint">Auto-fetched from your profile</p>
                        </div>
                        <div>
                          <label className="field-label">
                            Year of Graduation
                          </label>
                          <input
                            type="text"
                            value={missing((data as any)?.yearofending)}
                            readOnly
                            className="field-input bg-gray-50 text-gray-600 opacity-80 dark:bg-gray-950 dark:text-gray-300"
                          />
                          <p className="field-hint">Auto-fetched from your profile</p>
                        </div>
                        <div>
                          <label className="field-label">
                            Contact Number
                          </label>
                          <input
                            type="text"
                            value={missing((data as any)?.contactno)}
                            readOnly
                            className="field-input bg-gray-50 text-gray-600 opacity-80 dark:bg-gray-950 dark:text-gray-300"
                          />
                          <p className="field-hint">Auto-fetched from your profile</p>
                        </div>
                        <div>
                          <label className="field-label">
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
                            className="field-input bg-gray-50 text-gray-600 opacity-80 dark:bg-gray-950 dark:text-gray-300"
                          />
                          <p className="field-hint">Auto-fetched from your profile</p>
                        </div>
                      </div>

                      <div className="mt-4">
                        <p className="mb-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                          Program Completed at UOL
                        </p>
                        <div className="grid sm:grid-cols-3 gap-4">
                          <div>
                            <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
                              Faculty
                            </label>
                            <input
                              type="text"
                              value={missing((data as any)?.facultyname)}
                              readOnly
                              className="field-input bg-gray-50 text-gray-600 opacity-80 dark:bg-gray-950 dark:text-gray-300"
                            />
                            <p className="field-hint">Auto-fetched from your profile</p>
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
                              Department
                            </label>
                            <input
                              type="text"
                              value={missing((data as any)?.departmentname)}
                              readOnly
                              className="field-input bg-gray-50 text-gray-600 opacity-80 dark:bg-gray-950 dark:text-gray-300"
                            />
                            <p className="field-hint">Auto-fetched from your profile</p>
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
                              Program
                            </label>
                            <input
                              type="text"
                              value={missing((data as any)?.degreetitle)}
                              readOnly
                              className="field-input bg-gray-50 text-gray-600 opacity-80 dark:bg-gray-950 dark:text-gray-300"
                            />
                            <p className="field-hint">Auto-fetched from your profile</p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4">
                        <p className="mb-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                          Educational Record (UOL)
                        </p>
                        <div className="grid sm:grid-cols-2 gap-4">
                          <div>
                            <label className="field-label">
                              CGPA
                            </label>
                            <input
                              type="text"
                              value={missing((data as any)?.cgpa)}
                              readOnly
                              className="field-input bg-gray-50 text-gray-600 opacity-80 dark:bg-gray-950 dark:text-gray-300"
                            />
                            <p className="field-hint">Auto-fetched from your profile</p>
                          </div>
                          <div>
                            <label className="field-label">
                              Grade (%)
                            </label>
                            <input
                              type="text"
                              inputMode="decimal"
                              placeholder="e.g. 95"
                              value={gradePercent}
                              onChange={(e) => setGradePercent(e.target.value)}
                              className="field-input"
                            />
                            <p className="field-hint">Optional — enter your marks percentage</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 2. Admission Details */}
                    <div className="card p-5 sm:p-6">
                      <h2 className="mb-4 text-base font-semibold text-gray-900 dark:text-gray-100">
                        2. Admission Details
                      </h2>
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="sm:col-span-2">
                          <label className="field-label">
                            Program level <span className="text-error-500">*</span>
                          </label>
                          <div className="field-input bg-gray-50 text-gray-600 opacity-80 dark:bg-gray-950 dark:text-gray-300">
                            {formData.applyingFor || "—"} (from your selected discount category)
                          </div>
                          <p className="field-hint">
                            Masters or PhD is determined by the discount category you chose above.
                          </p>
                        </div>
                        <div className="sm:col-span-2">
                          <div className="grid sm:grid-cols-3 gap-4">
                            <div>
                              <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
                                Faculty
                              </label>
                              <select
                                className="field-input bg-gray-50 text-gray-600 opacity-80 dark:bg-gray-950 dark:text-gray-300"
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
                              <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
                                Department
                              </label>
                              <select
                                className="field-input bg-gray-50 text-gray-600 opacity-80 dark:bg-gray-950 dark:text-gray-300"
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
                              <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
                                Program Applied For
                              </label>
                              <select
                                className="field-input bg-gray-50 text-gray-600 opacity-80 dark:bg-gray-950 dark:text-gray-300"
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
                          <label className="field-label">
                            Campus (if applicable)
                          </label>
                          <select
                            className="field-input bg-gray-50 text-gray-600 opacity-80 dark:bg-gray-950 dark:text-gray-300"
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
                          <label className="field-label">
                            Session / Intake
                          </label>
                          <select
                            className="field-input bg-gray-50 text-gray-600 opacity-80 dark:bg-gray-950 dark:text-gray-300"
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

                        <div>
                          <label htmlFor="admissionSemester" className="field-label">
                            Semester <span className="text-error-500">*</span>
                          </label>
                          <select
                            id="admissionSemester"
                            className="field-input"
                            value={admissionSemester}
                            onChange={(e) => setAdmissionSemester(e.target.value)}
                            required
                          >
                            <option value="">Select semester</option>
                            {semesterOptions.map((s) => (
                              <option key={s} value={s}>
                                Semester {s}
                              </option>
                            ))}
                          </select>
                        </div>

                        
                      </div>
                    </div>

                    {/* 3. List of Attached Documents */}
                    <div className="card p-5 sm:p-6">
                      <h2 className="mb-4 text-base font-semibold text-gray-900 dark:text-gray-100">
                        3. List of Attached Documents (PDF Files Only)
                      </h2>
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <label className="field-label">
                            Copy of Admission Letter<span className="text-error-500">*</span>
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
                            className="field-input bg-gray-50 text-gray-600 opacity-80 dark:bg-gray-950 dark:text-gray-300"
                            required
                          />
                        </div>
                        <div>
                          <label className="field-label">
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
                            className="field-input bg-gray-50 text-gray-600 opacity-80 dark:bg-gray-950 dark:text-gray-300"
                          />
                        </div>
                        <div>
                          <label className="field-label">
                            Alumni Card <span className="text-error-500">*</span>
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
                            className="field-input bg-gray-50 text-gray-600 opacity-80 dark:bg-gray-950 dark:text-gray-300"
                            required
                          />
                        </div>
                        <div>
                          <label className="field-label">
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
                            className="field-input bg-gray-50 text-gray-600 opacity-80 dark:bg-gray-950 dark:text-gray-300"
                          />
                        </div>
                        <div>
                          <label className="field-label">
                            CNIC Copy <span className="text-error-500">*</span>
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
                            className="field-input bg-gray-50 text-gray-600 opacity-80 dark:bg-gray-950 dark:text-gray-300"
                            required
                          />
                        </div>
                      </div>
                    </div>

                    {/* 4. Declaration */}
                    <div className="card p-5 sm:p-6">
                      <h2 className="mb-3 text-base font-semibold text-gray-900 dark:text-gray-100">
                        4. Declaration
                      </h2>
                      <AcknowledgmentCheckbox
                        checked={mastersDeclarationAccepted}
                        onChange={(e) => setMastersDeclarationAccepted(e.target.checked)}
                        checkboxLabel="I have read and agree to the above declaration."
                      >
                        I hereby declare that all information provided is true and correct.
                        I understand that the discount is subject to approval and institutional
                        policies of The University of Lahore.
                      </AcknowledgmentCheckbox>
                    </div>
                  </div>
                )}

                {isKinshipFlow && (
                  <div className="sm:col-span-2 space-y-6 mt-4">
                    <div className="card p-5 sm:p-6">
                      <h2 className="mb-4 text-base font-semibold text-gray-900 dark:text-gray-100">
                        (a) Alumni Details
                      </h2>
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <label className="field-label">Name</label>
                          <input type="text" value={missing(data?.alumniname)} readOnly className="field-input bg-gray-50 text-gray-600 opacity-80 dark:bg-gray-950 dark:text-gray-300" />
                        </div>
                        <div>
                          <label className="field-label">Father&apos;s Name</label>
                          <input type="text" value={missing((data as any)?.fathername)} readOnly className="field-input bg-gray-50 text-gray-600 opacity-80 dark:bg-gray-950 dark:text-gray-300" />
                        </div>
                        <div>
                          <label className="field-label">DOB</label>
                          <input type="text" value={missing((data as any)?.dateofbirth || (data as any)?.dob)} readOnly className="field-input bg-gray-50 text-gray-600 opacity-80 dark:bg-gray-950 dark:text-gray-300" />
                        </div>
                        <div>
                          <label className="field-label">CNIC</label>
                          <input type="text" value={missing(data?.cnicpassport)} readOnly className="field-input bg-gray-50 text-gray-600 opacity-80 dark:bg-gray-950 dark:text-gray-300" />
                        </div>
                      </div>
                    </div>

                    <div className="card p-5 sm:p-6">
                      <h2 className="mb-4 text-base font-semibold text-gray-900 dark:text-gray-100">
                        (b) Alumni Educational Record
                      </h2>
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div><label className="field-label">Campus</label><input type="text" value={missing((data as any)?.campusname || (data as any)?.campus)} readOnly className="field-input bg-gray-50 text-gray-600 opacity-80 dark:bg-gray-950 dark:text-gray-300" /></div>
                        <div><label className="field-label">Faculty</label><input type="text" value={missing((data as any)?.facultyname)} readOnly className="field-input bg-gray-50 text-gray-600 opacity-80 dark:bg-gray-950 dark:text-gray-300" /></div>
                        <div><label className="field-label">Department</label><input type="text" value={missing((data as any)?.departmentname)} readOnly className="field-input bg-gray-50 text-gray-600 opacity-80 dark:bg-gray-950 dark:text-gray-300" /></div>
                        <div><label className="field-label">Program</label><input type="text" value={missing((data as any)?.degreetitle)} readOnly className="field-input bg-gray-50 text-gray-600 opacity-80 dark:bg-gray-950 dark:text-gray-300" /></div>
                        <div><label className="field-label">SAP ID</label><input type="text" value={missing(data?.sapid)} readOnly className="field-input bg-gray-50 text-gray-600 opacity-80 dark:bg-gray-950 dark:text-gray-300" /></div>
                        <div><label className="field-label">CGPA</label><input type="text" value={missing((data as any)?.cgpa)} readOnly className="field-input bg-gray-50 text-gray-600 opacity-80 dark:bg-gray-950 dark:text-gray-300" /><p className="field-hint">Auto-fetched from your profile</p></div>
                        <div>
                          <label className="field-label">Grade (%)</label>
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="e.g. 95"
                            value={gradePercent}
                            onChange={(e) => setGradePercent(e.target.value)}
                            className="field-input"
                          />
                          <p className="field-hint">Optional — enter your marks percentage</p>
                        </div>
                        <div><label className="field-label">Passing Out Year</label><input type="text" value={missing((data as any)?.yearofending)} readOnly className="field-input bg-gray-50 text-gray-600 opacity-80 dark:bg-gray-950 dark:text-gray-300" /></div>
                        <div><label className="field-label">Discount Category</label><input type="text" value={missing(selectedCategory?.label)} readOnly className="field-input bg-gray-50 text-gray-600 opacity-80 dark:bg-gray-950 dark:text-gray-300" /></div>
                        <div><label className="field-label">Applicable Discount</label><input type="text" value={formatDiscountPercentDisplay(applicableDiscountPercent)} readOnly className="field-input bg-gray-50 text-gray-600 opacity-80 dark:bg-gray-950 dark:text-gray-300" /></div>
                        <div className="sm:col-span-2"><label className="field-label">Applying For</label><input type="text" value={missing(formData.applyingFor)} readOnly className="field-input bg-gray-50 text-gray-600 opacity-80 dark:bg-gray-950 dark:text-gray-300" /></div>
                      </div>
                    </div>

                    <div className="card p-5 sm:p-6">
                      <h2 className="mb-4 text-base font-semibold text-gray-900 dark:text-gray-100">
                        (c) Kin Details - Previous Educational Record & Program Applied For
                      </h2>
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div><label className="field-label">Name <span className="text-error-500">*</span></label><input type="text" value={formData.kinshipName} onChange={(e) => setFormData({ ...formData, kinshipName: e.target.value })} className="field-input" required /></div>
                        <div><label className="field-label">Father&apos;s Name <span className="text-error-500">*</span></label><input type="text" value={formData.kinshipFatherName} onChange={(e) => setFormData({ ...formData, kinshipFatherName: e.target.value })} className="field-input" required /></div>
                        <div>
                          <label className="field-label">Campus <span className="text-error-500">*</span></label>
                          <select
                            value={formData.kinshipCampus}
                            onChange={(e) => setFormData({ ...formData, kinshipCampus: e.target.value })}
                            className="field-input"
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
                          <label className="field-label">Faculty <span className="text-error-500">*</span></label>
                          <select
                            value={formData.kinshipFaculty}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                kinshipFaculty: e.target.value,
                                kinshipDepartment: "",
                                kinshipProgram: "" })
                            }
                            className="field-input"
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
                          <label className="field-label">Department <span className="text-error-500">*</span></label>
                          <select
                            value={formData.kinshipDepartment}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                kinshipDepartment: e.target.value,
                                kinshipProgram: "" })
                            }
                            className="field-input"
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
                          <label className="field-label">Program <span className="text-error-500">*</span></label>
                          <select
                            value={formData.kinshipProgram}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                kinshipProgram: e.target.value })
                            }
                            className="field-input"
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
                        <div><label className="field-label">Admission Ref No <span className="text-error-500">*</span></label><input type="text" value={formData.kinshipAdmissionRefNo} onChange={(e) => setFormData({ ...formData, kinshipAdmissionRefNo: e.target.value })} className="field-input" required /></div>
                        <div>
                          <label className="field-label">Last Degree/Certificate <span className="text-error-500">*</span></label>
                          <select
                            value={formData.kinshipLastDegreeCertificate}
                            onChange={(e) => setFormData({ ...formData, kinshipLastDegreeCertificate: e.target.value })}
                            className="field-input"
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
                          <label className="field-label">Passing Out Year <span className="text-error-500">*</span></label>
                          <select
                            value={formData.kinshipPassingOutYear}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                kinshipPassingOutYear: e.target.value })
                            }
                            className="field-input"
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
                        <div><label className="field-label">CNIC (Kinship) <span className="text-error-500">*</span></label><input type="text" value={formData.kinshipCnic} onChange={(e) => setFormData({ ...formData, kinshipCnic: e.target.value })} className="field-input" required /></div>
                        <div>
                          <label className="field-label">Grade Type <span className="text-error-500">*</span></label>
                          <select
                            value={formData.kinshipGradeType}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                kinshipGradeType: e.target.value,
                                kinshipGradeValue: "" })
                            }
                            className="field-input"
                            required
                          >
                            <option value="">Select grade type</option>
                            <option value="CGPA">CGPA</option>
                            <option value="Percentage">Percentage</option>
                          </select>
                        </div>
                        <div>
                          <label className="field-label">
                            {formData.kinshipGradeType === "Percentage"
                              ? "Percentage (%)"
                              : formData.kinshipGradeType === "CGPA"
                                ? "CGPA"
                                : "Grade Value"}{" "}
                            <span className="text-error-500">*</span>
                          </label>
                          <input
                            type="number"
                            inputMode="decimal"
                            step={formData.kinshipGradeType === "Percentage" ? "0.1" : "0.01"}
                            min={0}
                            max={formData.kinshipGradeType === "Percentage" ? 100 : 4}
                            value={formData.kinshipGradeValue}
                            onChange={(e) =>
                              setFormData({ ...formData, kinshipGradeValue: e.target.value })
                            }
                            placeholder={
                              formData.kinshipGradeType === "Percentage"
                                ? "0.0 - 100.0"
                                : formData.kinshipGradeType === "CGPA"
                                  ? "0.00 - 4.00"
                                  : "Select grade type first"
                            }
                            disabled={!formData.kinshipGradeType}
                            className="field-input disabled:opacity-60"
                            required
                          />
                        </div>
                      </div>
                    </div>

                    <div className="card p-5 sm:p-6">
                      <h2 className="mb-4 text-base font-semibold text-gray-900 dark:text-gray-100">
                        (d) Documents Checklist (all are required)
                      </h2>
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <label className="field-label">Copy of Admission Letter <span className="text-error-500">*</span></label>
                          <input type="file" accept="application/pdf,.pdf" onChange={(e) => setDocKinshipAdmissionLetterFile(e.target.files?.[0] ?? null)} className="field-input bg-gray-50 text-gray-600 opacity-80 dark:bg-gray-950 dark:text-gray-300" required />
                        </div>
                        <div>
                          <label className="field-label">Academic Certificates/Transcripts (Kin) <span className="text-error-500">*</span></label>
                          <input type="file" accept="application/pdf,.pdf" onChange={(e) => setDocKinshipAcademicCertificatesFile(e.target.files?.[0] ?? null)} className="field-input bg-gray-50 text-gray-600 opacity-80 dark:bg-gray-950 dark:text-gray-300" required />
                        </div>
                        <div>
                          <label className="field-label">Alumni Card <span className="text-error-500">*</span></label>
                          <input type="file" accept="application/pdf,.pdf" onChange={(e) => setDocKinshipAlumniCardFile(e.target.files?.[0] ?? null)} className="field-input bg-gray-50 text-gray-600 opacity-80 dark:bg-gray-950 dark:text-gray-300" required />
                        </div>
                        <div>
                          <label className="field-label">FRC <span className="text-error-500">*</span></label>
                          <input type="file" accept="application/pdf,.pdf" onChange={(e) => setDocKinshipFrcFile(e.target.files?.[0] ?? null)} className="field-input bg-gray-50 text-gray-600 opacity-80 dark:bg-gray-950 dark:text-gray-300" required />
                        </div>
                        <div>
                          <label className="field-label">CNIC Copy (Kinship) <span className="text-error-500">*</span></label>
                          <input type="file" accept="application/pdf,.pdf" onChange={(e) => setDocKinshipCnicKinFile(e.target.files?.[0] ?? null)} className="field-input bg-gray-50 text-gray-600 opacity-80 dark:bg-gray-950 dark:text-gray-300" required />
                        </div>
                        <div>
                          <label className="field-label">CNIC Copy (Alumni) <span className="text-error-500">*</span></label>
                          <input type="file" accept="application/pdf,.pdf" onChange={(e) => setDocKinshipCnicAlumniFile(e.target.files?.[0] ?? null)} className="field-input bg-gray-50 text-gray-600 opacity-80 dark:bg-gray-950 dark:text-gray-300" required />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Declaration — required for all scholarship applications */}
              <div className="card p-5 sm:p-6 mt-6">
                <h2 className="mb-3 text-base font-semibold text-gray-900 dark:text-gray-100">
                  Declaration <span className="text-error-500">*</span>
                </h2>
                <div className="mb-3">
                  <label className="field-label" htmlFor="scholarshipDisclosure">
                    E-Signature{" "}
                    <span className="text-error-500">*</span>
                  </label>
                  <input
                    id="scholarshipDisclosure"
                    type="text"
                    value={scholarshipDisclosure}
                    onChange={(e) => setScholarshipDisclosure(e.target.value)}
                    placeholder='e.g. None, or list scholarship names'
                    className="field-input"
                    required
                  />
                  <p className="field-hint">
                    Please Write your full name
                  </p>
                </div>
                <AcknowledgmentCheckbox
                  checked={disclosureAccepted}
                  onChange={(e) => setDisclosureAccepted(e.target.checked)}
                  checkboxLabel="I have read and agree to the above declaration."
                >
                  I hereby disclose all scholarships / financial assistance currently availed by me{" "}
                  <span className="font-semibold underline decoration-dotted">
                    {scholarshipDisclosure.trim() || "None"}
                  </span>
                  . I understand that if awarded the Alumni Scholarship, all others shall stand
                  cancelled. If any concealment is discovered later, all scholarships shall be
                  cancelled/recovered and disciplinary action including cancellation of admission
                  may be taken.
                </AcknowledgmentCheckbox>
                <div className="mt-3 border-t border-gray-200 pt-4 dark:border-gray-700">
                  <AcknowledgmentCheckbox
                    checked={discountTermsAccepted}
                    onChange={(e) => setDiscountTermsAccepted(e.target.checked)}
                    checkboxLabel="I have read and agree to the discount terms and conditions."
                  >
                    The approved discount is applicable to the new or current semester, as
                    applicable, and shall continue in subsequent semesters subject to the
                    maintenance of the required CGPA. No fee adjustment, compensation, or refund
                    shall be provided for any previous semesters.
                  </AcknowledgmentCheckbox>
                </div>
              </div>

              <FormActions
                submitLabel="Submit Application"
                submittingLabel="Submitting…"
                loading={isSubmitting}
                disabled={!canSubmitScholarship}
                className="mt-12 sm:justify-center"
              />
            </form>
          </div>
        </div>
      </div>
    </>
  );
}

export { ScholarshipApplicationContent };

