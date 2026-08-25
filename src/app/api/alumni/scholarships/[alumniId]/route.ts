import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { canModify } from "@/lib/alumniProfile";
import { generateScholarshipLetterPDF, generateScholarshipPDF } from "@/lib/pdfGenerator";
import {
  discountCategoryLabel,
  discountTypeOptionLabel,
  formatAlumniScholarshipApplicationPdfId,
  formatScholarshipCgpaGradeDisplay,
  requestedPercent,
  isScholarshipFeeDiscountFlow,
  isScholarshipKinshipCategory,
  isMergedScholarshipSlug,
  getMergedFeeComponentSlugs,
  parseMastersDetails,
  parseUploadedDocuments,
  resolveFeeBreakdownDisplay,
  resolveHighAchieverPercent,
} from "@/lib/scholarshipLetter";
import { resolveStoredUploadUrl } from "@/lib/uploadsImageUrl";
import { logAdminAction } from "@/lib/adminActivityLog";
import type { Session } from "next-auth";
import {
  mapTiersForPdf,
  parseCgpa,
  parseDiscountPercentValue,
  resolveDiscountPercent,
  type ScholarshipCgpaDiscountTier,
  type ScholarshipDiscountTierPdfRow,
} from "@/lib/scholarshipDiscount";

type ScholarshipUploadedDocDb = {
  label?: unknown;
  url?: unknown;
  filename?: unknown;
  adminVerified?: unknown;
};

function normDocLabel(s: string): string {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function parseUploadedDocumentsWithAdmin(raw: unknown): Array<{ label: string; url: string; filename?: string; adminVerified?: "YES" | "NO" | null }> {
  // Keep backwards compatibility with existing parseUploadedDocuments(),
  // but also extract any admin verification flags if present.
  if (raw == null) return [];
  let arr: unknown = raw;
  if (typeof raw === "string") {
    try {
      arr = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(arr)) return [];
  return (arr as ScholarshipUploadedDocDb[])
    .map((x) => {
      if (!x || typeof x !== "object") return null;
      const label = String((x as ScholarshipUploadedDocDb).label ?? "").trim() || "Document";
      const url = String((x as ScholarshipUploadedDocDb).url ?? "").trim();
      const filenameRaw = (x as ScholarshipUploadedDocDb).filename;
      const filename = filenameRaw != null ? String(filenameRaw).trim() : undefined;
      const v = String((x as ScholarshipUploadedDocDb).adminVerified ?? "").trim().toUpperCase();
      const adminVerified = v === "YES" ? "YES" : v === "NO" ? "NO" : null;
      return { label, url, filename: filename || undefined, adminVerified };
    })
    .filter(Boolean) as Array<{ label: string; url: string; filename?: string; adminVerified?: "YES" | "NO" | null }>;
}

async function resolveFacultyName(idStr: string | undefined): Promise<string | null> {
  if (!idStr || !/^\d+$/u.test(String(idStr).trim())) return null;
  const id = Number(String(idStr).trim());
  const rows = await sql/* sql */`
    SELECT faculty_name FROM public.tbl_faculties WHERE id = ${id} LIMIT 1
  `;
  const r = rows[0] as { faculty_name: string | null } | undefined;
  return r?.faculty_name ? String(r.faculty_name).trim() : null;
}

async function resolveDepartmentName(idStr: string | undefined): Promise<string | null> {
  if (!idStr || !/^\d+$/u.test(String(idStr).trim())) return null;
  const id = Number(String(idStr).trim());
  const rows = await sql/* sql */`
    SELECT department_name FROM public.tbl_departments WHERE id = ${id} LIMIT 1
  `;
  const r = rows[0] as { department_name: string | null } | undefined;
  return r?.department_name ? String(r.department_name).trim() : null;
}

async function resolveProgramName(idStr: string | undefined): Promise<string | null> {
  if (!idStr || !/^\d+$/u.test(String(idStr).trim())) return null;
  const id = Number(String(idStr).trim());
  const rows = await sql/* sql */`
    SELECT program_name FROM public.tbl_programs WHERE id = ${id} LIMIT 1
  `;
  const r = rows[0] as { program_name: string | null } | undefined;
  return r?.program_name ? String(r.program_name).trim() : null;
}

async function loadDiscountTiersForPdf(
  discountType: string | null | undefined,
  applyFor?: string | null,
): Promise<{
  tiers: ScholarshipDiscountTierPdfRow[];
  cgpaTiers: ScholarshipCgpaDiscountTier[];
  admissionCgpaTiers: ScholarshipCgpaDiscountTier[];
  tuitionCgpaTiers: ScholarshipCgpaDiscountTier[];
}> {
  const slug = String(discountType || "").trim();
  if (!slug) return { tiers: [], cgpaTiers: [], admissionCgpaTiers: [], tuitionCgpaTiers: [] };

  // For merged scholarship slugs, load tiers from both component categories
  if (isMergedScholarshipSlug(slug)) {
    const componentSlugs = getMergedFeeComponentSlugs(slug);
    if (!componentSlugs) return { tiers: [], cgpaTiers: [], admissionCgpaTiers: [], tuitionCgpaTiers: [] };

    const allTiers: ScholarshipCgpaDiscountTier[] = [];
    const allPdfTiers: ScholarshipDiscountTierPdfRow[] = [];
    let admissionCgpaTiers: ScholarshipCgpaDiscountTier[] = [];
    let tuitionCgpaTiers: ScholarshipCgpaDiscountTier[] = [];

    for (const componentSlug of [componentSlugs.admissionSlug, componentSlugs.tuitionSlug]) {
      const catRows = await sql/* sql */`
        SELECT id, label FROM public.scholarship_discount_categories
        WHERE LOWER(slug) = LOWER(${componentSlug})
        LIMIT 1
      `;
      const catRow = catRows[0] as { id: unknown; label?: unknown } | undefined;
      if (!catRow) continue;
      const catId = Number(catRow.id);
      if (!Number.isFinite(catId)) continue;

      const catLabel = String(catRow.label || "").trim() || discountCategoryLabel(componentSlug, applyFor);
      const tierRows = await sql/* sql */`
        SELECT id, category_id, cgpa_min, cgpa_max, discount_percent, sort_order
        FROM public.scholarship_cgpa_discount_tiers
        WHERE category_id = ${catId}
        ORDER BY sort_order ASC, id ASC
      `;
      const cgpaTiers = (tierRows as Record<string, unknown>[]).map(
        (row): ScholarshipCgpaDiscountTier => ({
          id: Number(row.id),
          category_id: catId,
          cgpa_min: Number(row.cgpa_min),
          cgpa_max: Number(row.cgpa_max),
          discount_percent: Number(row.discount_percent),
          sort_order: Number(row.sort_order) || 0,
        }),
      );
      allTiers.push(...cgpaTiers);
      allPdfTiers.push(...mapTiersForPdf(cgpaTiers, catLabel));

      // Track admission vs tuition tiers separately for CGPA-based resolution
      if (componentSlug === componentSlugs.admissionSlug) {
        admissionCgpaTiers = cgpaTiers;
      } else if (componentSlug === componentSlugs.tuitionSlug) {
        tuitionCgpaTiers = cgpaTiers;
      }
    }

    return { tiers: allPdfTiers, cgpaTiers: allTiers, admissionCgpaTiers, tuitionCgpaTiers };
  }

  const categoryRows = await sql/* sql */`
    SELECT id, label FROM public.scholarship_discount_categories
    WHERE LOWER(slug) = LOWER(${slug})
    LIMIT 1
  `;
  const categoryRow = categoryRows[0] as { id: unknown; label?: unknown } | undefined;
  if (!categoryRow) return { tiers: [], cgpaTiers: [], admissionCgpaTiers: [], tuitionCgpaTiers: [] };

  const categoryId = Number(categoryRow.id);
  if (!Number.isFinite(categoryId)) return { tiers: [], cgpaTiers: [], admissionCgpaTiers: [], tuitionCgpaTiers: [] };

  const categoryLabel =
    String(categoryRow.label || "").trim() || discountCategoryLabel(discountType, applyFor);

  const tierRows = await sql/* sql */`
    SELECT id, category_id, cgpa_min, cgpa_max, discount_percent, sort_order
    FROM public.scholarship_cgpa_discount_tiers
    WHERE category_id = ${categoryId}
    ORDER BY sort_order ASC, id ASC
  `;

  const cgpaTiers = (tierRows as Record<string, unknown>[]).map(
    (row): ScholarshipCgpaDiscountTier => ({
      id: Number(row.id),
      category_id: categoryId,
      cgpa_min: Number(row.cgpa_min),
      cgpa_max: Number(row.cgpa_max),
      discount_percent: Number(row.discount_percent),
      sort_order: Number(row.sort_order) || 0,
    }),
  );

  return {
    tiers: mapTiersForPdf(cgpaTiers, categoryLabel),
    cgpaTiers,
    admissionCgpaTiers: [],
    tuitionCgpaTiers: cgpaTiers,
  };
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ alumniId: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!canModify(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { alumniId } = await ctx.params;
    const alumniIdNum = parseInt(String(alumniId), 10);
    if (isNaN(alumniIdNum) || alumniIdNum <= 0) {
      return NextResponse.json({ error: "Invalid alumni ID" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const mode = (searchParams.get("mode") || "").toLowerCase();
    const download = (searchParams.get("download") || "").toLowerCase();

    const applicationRows = await sql/* sql */`
      SELECT
        asch.created_at,
        COALESCE(asch.status, 'pending') AS status,
        asch.discount_type,
        asch.kinship_firstname,
        asch.kinship_lastname,
        asch.kinship_cnic,
        asch.apply_for,
        asch.degree_title,
        asch.masters_details,
        asch.kinship_details,
        asch.uploaded_documents,
        asch.admission_application_ref,
        asch.grade_percent,
        asch.applied_discount_percent,
        asch.application_year,
        asch.application_term,
        asch.withdrawn_at,
        asch.withdrawn_by,
        asch.withdrawal_reason,
        a.alumniname,
        a.sapid,
        a.registrationno,
        a.fathername,
        a.dateofbirth,
        a.cnicpassport,
        a.cgpa,
        a.degreetitle,
        a.yearofending,
        COALESCE(NULLIF(TRIM(a.facultyname), ''), f.faculty_name) AS faculty_name,
        COALESCE(NULLIF(TRIM(a.departmentname), ''), d.department_name) AS department_name,
        COALESCE(NULLIF(TRIM(a.degreetitle), ''), p.program_name) AS program_name,
        a.campusname,
        a.personalemail,
        a.universityemail,
        a.officialemail,
        a.medal,
        a.profile_updated
      FROM public.alumni_scholarships asch
      JOIN public.tbl_alumni a ON a.alumniid = asch.id
      LEFT JOIN public.tbl_faculties f ON f.id = a.faculty
      LEFT JOIN public.tbl_departments d ON d.id = a.department
      LEFT JOIN public.tbl_programs p ON p.id = a.program
      WHERE asch.id = ${alumniIdNum}
      LIMIT 1
    `;

    if (!applicationRows[0]) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    const app = applicationRows[0] as {
      created_at: string | null;
      status: string | null;
      discount_type: string | null;
      kinship_firstname: string | null;
      kinship_lastname: string | null;
      kinship_cnic: string | null;
      apply_for: string | null;
      degree_title: string | null;
      masters_details: unknown;
      kinship_details: unknown;
      uploaded_documents: unknown;
      admission_application_ref: string | null;
      grade_percent: string | null;
      applied_discount_percent: number | null;
      application_year: number | null;
      application_term: string | null;
      withdrawn_at: string | null;
      withdrawn_by: string | null;
      withdrawal_reason: string | null;
      alumniname: string | null;
      sapid: string | null;
      registrationno: string | null;
      fathername: string | null;
      dateofbirth: string | null;
      cnicpassport: string | null;
      cgpa: number | null;
      degreetitle: string | null;
      yearofending: number | null;
      faculty_name: string | null;
      department_name: string | null;
      program_name: string | null;
      campusname: string | null;
      personalemail: string | null;
      universityemail: string | null;
      officialemail: string | null;
      medal: string | null;
      profile_updated: boolean | null;
    };

    const alumniName = String(app.alumniname || "");
    const alumniEmail = String(app.personalemail || app.universityemail || app.officialemail || "");

    const kinshipFirstName = app.kinship_firstname;
    const kinshipLastName = app.kinship_lastname;
    const hasKinship = !!(kinshipFirstName && kinshipLastName);
    const discountTypeStored = String(app.discount_type || "").trim();
    const isKinship = isScholarshipKinshipCategory(discountTypeStored);
    const discountTypeForPdf =
      discountTypeStored ||
      (hasKinship ? "kinship" : "alumni");

    if (mode === "pdf") {
      const pdfBuffer = await generateScholarshipPDF({
        alumniName,
        discountType: discountTypeForPdf,
        applyingFor: String(app.apply_for || ""),
        degreeTitle: String(app.degree_title || ""),
        appliedDiscountPercent: app.applied_discount_percent,
        kinshipRelation: null,
        kinshipFirstName: kinshipFirstName || null,
        kinshipLastName: kinshipLastName || null,
        kinshipName: hasKinship ? `${kinshipFirstName} ${kinshipLastName}` : null,
      });

      return new NextResponse(new Uint8Array(pdfBuffer), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `${download === "1" || download === "true" ? "attachment" : "inline"}; filename=Scholarship_Application_${alumniIdNum}.pdf`,
          "Cache-Control": "no-store",
        },
      });
    }

    const pdfUrl = `/api/alumni/scholarships/${alumniIdNum}?mode=pdf`;

    const fileNameFromUrl = (url: string): string => {
      try {
        const u = String(url || "").trim();
        if (!u) return "";
        const pathOnly = u.split("?")[0].split("#")[0];
        const parts = pathOnly.split("/").filter(Boolean);
        const last = parts[parts.length - 1] || "";
        return last ? decodeURIComponent(last) : "";
      } catch {
        return "";
      }
    };

    const docItems = parseUploadedDocuments(app.uploaded_documents);
    const docItemsWithAdmin = parseUploadedDocumentsWithAdmin(app.uploaded_documents);
    const uploadedDocuments =
      docItems.length > 0 || docItemsWithAdmin.length > 0
        ? (
            [
              ...docItems.map((d) => {
                const labelStr = String(d.label || "Document").trim() || "Document";
                const adminVerified =
                  docItemsWithAdmin.find((x) => normDocLabel(x.label) === normDocLabel(labelStr))?.adminVerified ??
                  null;
                const filename =
                  (d.filename && String(d.filename).trim()) ||
                  fileNameFromUrl(String(d.url || ""));
                const url = resolveStoredUploadUrl(String(d.url || "").trim());
                if (!filename && !url && adminVerified !== "YES" && adminVerified !== "NO") {
                  return null;
                }
                return {
                  label: labelStr,
                  filename: filename || "",
                  url: url || "",
                  adminVerified,
                };
              }),
              ...docItemsWithAdmin
                .filter(
                  (a) =>
                    !docItems.some((b) => normDocLabel(b.label) === normDocLabel(a.label)),
                )
                .map((a) => ({
                  label: String(a.label || "Document").trim() || "Document",
                  filename: String(a.filename ?? "").trim(),
                  url: resolveStoredUploadUrl(String(a.url ?? "").trim()),
                  adminVerified: a.adminVerified ?? null,
                })),
            ] as Array<{
              label: string;
              filename: string;
              url: string;
              adminVerified: "YES" | "NO" | null;
            } | null>
          ).filter(
            (
              x
            ): x is {
              label: string;
              filename: string;
              url: string;
              adminVerified: "YES" | "NO" | null;
            } => x !== null
          )
        : [];
    const documentsLines =
      docItems.length > 0
        ? docItems.map((d) => {
            const name = (d.filename && String(d.filename).trim()) || fileNameFromUrl(String(d.url || ""));
            return name ? `${d.label}: ${name}` : d.label;
          })
        : ["As per application record (legacy or no uploads on file)"];

    const masters = parseMastersDetails(app.masters_details);
    const kinshipDetailsRaw = parseMastersDetails(app.kinship_details) || parseMastersDetails(app.masters_details);
    let mastersAdmissionSummary: string | null = null;
    if (masters && isScholarshipFeeDiscountFlow(String(app.discount_type || "").trim())) {
      const [fn, dn, pn] = await Promise.all([
        resolveFacultyName(masters.admissionFacultyId),
        resolveDepartmentName(masters.admissionDepartmentId),
        resolveProgramName(masters.admissionProgramId),
      ]);
      const parts = [
        fn ? `Faculty: ${fn}` : null,
        dn ? `Department: ${dn}` : null,
        pn ? `Program applied for: ${pn}` : null,
        masters.admissionCampus ? `Campus: ${masters.admissionCampus}` : null,
        masters.admissionSession ? `Session / Intake: ${masters.admissionSession}` : null,
      ].filter(Boolean);
      mastersAdmissionSummary = parts.length ? parts.join(" | ") : null;
    }

    const dateRaw = app.created_at ? new Date(app.created_at) : new Date();
    const dateFormatted = dateRaw.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const scholarshipApplicationPdfId = formatAlumniScholarshipApplicationPdfId({
      discountType: app.discount_type,
      applicationId: alumniIdNum,
      submissionYear: dateRaw.getFullYear(),
    });
    const dobFormatted = app.dateofbirth
      ? new Date(app.dateofbirth).toLocaleDateString("en-PK", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : "Data unavailable";

    const cgpaGradeDisplay = formatScholarshipCgpaGradeDisplay(app.cgpa, app.grade_percent);

    const passingOutYearDisplay =
      app.yearofending != null && Number.isFinite(Number(app.yearofending))
        ? String(Number(app.yearofending))
        : "Data unavailable";

    const admissionRefDisplay = String(app.admission_application_ref ?? "").trim() || null;

    const withdrawnAtDisplay = app.withdrawn_at
      ? new Date(app.withdrawn_at).toLocaleDateString("en-PK", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : null;

    const applyingForDisplay = discountTypeOptionLabel(app.discount_type, app.apply_for);

    const kinshipDetails = {
      kinName:
        `${String(app.kinship_firstname || "").trim()} ${String(app.kinship_lastname || "").trim()}`.trim() ||
        "Data is missing",
      kinFatherName:
        String((kinshipDetailsRaw as Record<string, unknown> | null)?.kinshipFatherName || "").trim() ||
        "Data is missing",
      kinCampus:
        String((kinshipDetailsRaw as Record<string, unknown> | null)?.kinshipCampus || "").trim() ||
        "Data is missing",
      kinFaculty:
        String((kinshipDetailsRaw as Record<string, unknown> | null)?.kinshipFaculty || "").trim() ||
        "Data is missing",
      kinDepartment:
        String((kinshipDetailsRaw as Record<string, unknown> | null)?.kinshipDepartment || "").trim() ||
        "Data is missing",
      kinProgram:
        String((kinshipDetailsRaw as Record<string, unknown> | null)?.kinshipProgram || "").trim() ||
        "Data is missing",
      kinAdmissionRefNo:
        String((kinshipDetailsRaw as Record<string, unknown> | null)?.kinshipAdmissionRefNo || "").trim() ||
        "Data is missing",
      kinLastDegreeCertificate:
        String((kinshipDetailsRaw as Record<string, unknown> | null)?.kinshipLastDegreeCertificate || "").trim() ||
        "Data is missing",
      kinPassingOutYear:
        String((kinshipDetailsRaw as Record<string, unknown> | null)?.kinshipPassingOutYear || "").trim() ||
        "Data is missing",
      kinCnic: String(app.kinship_cnic || "").trim() || "Data is missing",
      kinGradeType:
        String((kinshipDetailsRaw as Record<string, unknown> | null)?.kinshipGradeType || "").trim() ||
        "Data is missing",
      kinGradeValue:
        String((kinshipDetailsRaw as Record<string, unknown> | null)?.kinshipGradeValue || "").trim() ||
        "Data is missing",
    };

    const applicationLetter = {
      title: "Alumni Scholarship Application",
      dateFormatted,
      status: String(app.status || "pending").toLowerCase(),
      studentName: alumniName || "Data is missing",
      scholarshipType: discountCategoryLabel(app.discount_type, app.apply_for),
      applyingFor: applyingForDisplay,
      previousDegree: String(app.degreetitle || "").trim() || "Data is missing",
      cgpaLastDegree: cgpaGradeDisplay,
      requestedDiscount: requestedPercent(
        app.discount_type,
        app.apply_for,
        app.applied_discount_percent,
      ),
      appliedDiscountPercent: app.applied_discount_percent,
      admissionFeePercent: masters?.admissionFeePercent ?? null,
      tuitionFeePercent: masters?.tuitionFeePercent ?? null,
      highAchieverPercent: masters?.highAchieverPercent ?? null,
      applyAdmissionFeeDiscount: masters?.applyAdmissionFeeDiscount ?? null,
      medal: app.medal ?? null,
      feeBreakdown: resolveFeeBreakdownDisplay({
        discountType: app.discount_type,
        admissionFeePercent: masters?.admissionFeePercent ?? null,
        tuitionFeePercent: masters?.tuitionFeePercent ?? null,
        highAchieverPercent: masters?.highAchieverPercent ?? null,
        applyAdmissionFeeDiscount: masters?.applyAdmissionFeeDiscount ?? null,
        legacyAppliedPercent: parseDiscountPercentValue(app.applied_discount_percent),
      }),
      documentsAttached: documentsLines,
      uploadedDocuments,
      sapCode: String(app.sapid || "").trim() || "Data is missing",
      registrationNo: String(app.registrationno || "").trim() || null,
      requestedProgramDegree: String(app.degree_title || "").trim() || "Data is missing",
      faculty: String(app.faculty_name || "").trim() || "Data is missing",
      department: String(app.department_name || "").trim() || "Data is missing",
      program: String(app.program_name || "").trim() || "Data is missing",
      campus: String(app.campusname || "").trim() || "Data is missing",
      fatherName: String(app.fathername || "").trim() || "Data unavailable",
      dob: dobFormatted,
      cnic: String(app.cnicpassport || "").trim() || "Data unavailable",
      kinship:
        hasKinship || app.kinship_cnic
          ? {
              firstName: kinshipFirstName || "",
              lastName: kinshipLastName || "",
              cnic: String(app.kinship_cnic || "").trim() || "Data is missing",
            }
          : null,
      isKinship,
      kinshipDetails,
      mastersAdmissionSummary,
      passingOutYear: passingOutYearDisplay,
      admissionApplicationRef: admissionRefDisplay,
      withdrawnAt: withdrawnAtDisplay,
      withdrawnBy: app.withdrawn_by ?? null,
      withdrawalReason: app.withdrawal_reason ?? null,
      applicationYear:
        app.application_year != null && Number.isFinite(Number(app.application_year))
          ? String(Number(app.application_year))
          : null,
      applicationTerm: String(app.application_term || "").trim() || null,
      scholarshipApplicationPdfId,
      profileUpdated: app.profile_updated === true,
    };

    if (mode === "letter-pdf") {
      const { tiers: discountTiers, cgpaTiers, admissionCgpaTiers, tuitionCgpaTiers } =
        await loadDiscountTiersForPdf(app.discount_type, app.apply_for);
      const alumniCgpa = parseCgpa(app.cgpa);

      // For merged scholarship slugs, resolve admission and tuition fee discounts
      // from their respective CGPA tiers so the "Discount Information" section above
      // the table matches the checked row in the discount tier table below.
      let resolvedAdmissionFeePercent = applicationLetter.admissionFeePercent;
      let resolvedTuitionFeePercent = applicationLetter.tuitionFeePercent;
      if (isMergedScholarshipSlug(String(app.discount_type || "").trim()) && alumniCgpa != null) {
        // Override stale/missing stored values with CGPA-resolved values
        const admissionFromTier =
          admissionCgpaTiers.length > 0
            ? resolveDiscountPercent(alumniCgpa, admissionCgpaTiers)
            : null;
        const tuitionFromTier =
          tuitionCgpaTiers.length > 0
            ? resolveDiscountPercent(alumniCgpa, tuitionCgpaTiers)
            : null;
        if (admissionFromTier != null) resolvedAdmissionFeePercent = admissionFromTier;
        if (tuitionFromTier != null) resolvedTuitionFeePercent = tuitionFromTier;
      }

      const applicableDiscountPercent =
        parseDiscountPercentValue(app.applied_discount_percent) ??
        (alumniCgpa != null
          ? isMergedScholarshipSlug(String(app.discount_type || "").trim()) &&
            tuitionCgpaTiers.length > 0
            ? resolveDiscountPercent(alumniCgpa, tuitionCgpaTiers)
            : resolveDiscountPercent(alumniCgpa, cgpaTiers)
          : null) ??
        parseDiscountPercentValue(applicationLetter.requestedDiscount);

      // Rebuild fee breakdown with CGPA-resolved values for merged slugs
      const resolvedFeeBreakdown = isMergedScholarshipSlug(String(app.discount_type || "").trim())
        ? resolveFeeBreakdownDisplay({
            discountType: app.discount_type,
            admissionFeePercent: resolvedAdmissionFeePercent,
            tuitionFeePercent: resolvedTuitionFeePercent,
            highAchieverPercent: applicationLetter.highAchieverPercent,
            applyAdmissionFeeDiscount: applicationLetter.applyAdmissionFeeDiscount,
            legacyAppliedPercent: parseDiscountPercentValue(app.applied_discount_percent),
          })
        : applicationLetter.feeBreakdown;

      const pdfBuffer = await generateScholarshipLetterPDF({
        dateFormatted: applicationLetter.dateFormatted,
        studentName: applicationLetter.studentName,
        scholarshipType: applicationLetter.scholarshipType,
        applyingFor: applicationLetter.applyingFor,
        previousDegree: applicationLetter.previousDegree,
        cgpaLastDegree: applicationLetter.cgpaLastDegree,
        requestedDiscount: applicationLetter.requestedDiscount,
        appliedDiscountPercent: applicableDiscountPercent,
        admissionFeePercent: resolvedAdmissionFeePercent,
        tuitionFeePercent: resolvedTuitionFeePercent,
        highAchieverPercent: applicationLetter.highAchieverPercent,
        applyAdmissionFeeDiscount: applicationLetter.applyAdmissionFeeDiscount,
        medal: applicationLetter.medal,
        feeBreakdown: resolvedFeeBreakdown,
        discountTiers,
        documentsAttached: applicationLetter.documentsAttached,
        sapCode: applicationLetter.sapCode,
        registrationNo: applicationLetter.registrationNo ?? null,
        passingOutYear: applicationLetter.passingOutYear,
        admissionApplicationRef: applicationLetter.admissionApplicationRef,
        applicationYear: applicationLetter.applicationYear ?? null,
        applicationTerm: applicationLetter.applicationTerm ?? null,
        scholarshipApplicationPdfId: applicationLetter.scholarshipApplicationPdfId ?? null,
        discountType: app.discount_type,
        requestedProgramDegree: applicationLetter.requestedProgramDegree,
        faculty: applicationLetter.faculty,
        department: applicationLetter.department,
        program: applicationLetter.program,
        campus: applicationLetter.campus,
        fatherName: applicationLetter.fatherName,
        dob: applicationLetter.dob,
        cnic: applicationLetter.cnic,
        uploadedDocuments: applicationLetter.uploadedDocuments,
        isKinship: applicationLetter.isKinship,
        kinshipDetails: applicationLetter.kinshipDetails,
        withdrawnAt: applicationLetter.withdrawnAt,
        withdrawnBy: applicationLetter.withdrawnBy,
        withdrawalReason: applicationLetter.withdrawalReason,
        profileUpdated: applicationLetter.profileUpdated,
      });

      return new NextResponse(new Uint8Array(pdfBuffer), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `${download === "1" || download === "true" ? "attachment" : "inline"}; filename=Scholarship_Application_Form_${alumniIdNum}.pdf`,
          "Cache-Control": "no-store",
        },
      });
    }

    return NextResponse.json(
      {
        email: alumniEmail,
        pdfUrl,
        application: applicationLetter,
      },
      { status: 200 }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch application preview";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ alumniId: string }> }
) {
  let session: Session | null = null;
  try {
    session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admins can update scholarship status
    if (!canModify(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { alumniId } = await ctx.params;
    const alumniIdNum = parseInt(String(alumniId), 10);
    
    if (isNaN(alumniIdNum) || alumniIdNum <= 0) {
      return NextResponse.json({ error: "Invalid alumni ID" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const { status, rejectionReason, documentChecklist, admissionApplicationRef, withdrawalReason } = body as {
      status?: string;
      rejectionReason?: string;
      documentChecklist?: Array<{ label: string; verified: "YES" | "NO" }>;
      admissionApplicationRef?: string | null;
      withdrawalReason?: string;
    };

    // Admin-only update of Admission Reference No / Application ID
    if (admissionApplicationRef !== undefined) {
      const refValue =
        typeof admissionApplicationRef === "string" ? admissionApplicationRef.trim() : null;

      const rows = await sql/* sql */`
        SELECT id
        FROM public.alumni_scholarships
        WHERE id = ${alumniIdNum}
        LIMIT 1
      `;
      if (!rows[0]) {
        return NextResponse.json({ error: "Application not found" }, { status: 404 });
      }

      await sql/* sql */`
        UPDATE public.alumni_scholarships
        SET admission_application_ref = ${refValue}
        WHERE id = ${alumniIdNum}
      `;

      await logAdminAction({
        session,
        req: request,
        input: {
          action: "scholarships.update_status",
          entityType: "alumni_scholarships",
          entityId: alumniIdNum,
          success: true,
          metadata: { alumniId: alumniIdNum, detail: "admissionApplicationRef updated" },
        },
      });

      return NextResponse.json({ success: true, admissionApplicationRef: refValue }, { status: 200 });
    }

    // Admin document checklist update (stored inside uploaded_documents JSONB; no schema changes)
    if (Array.isArray(documentChecklist) && documentChecklist.length > 0) {
      const normalizedChecklist = documentChecklist
        .map((x) => {
          const label = String(x?.label ?? "").trim();
          const verified = String(x?.verified ?? "").trim().toUpperCase();
          if (!label) return null;
          if (verified !== "YES" && verified !== "NO") return null;
          return { label, verified: verified as "YES" | "NO" };
        })
        .filter(Boolean) as Array<{ label: string; verified: "YES" | "NO" }>;

      if (normalizedChecklist.length === 0) {
        return NextResponse.json({ error: "Invalid documentChecklist payload" }, { status: 400 });
      }

      const rows = await sql/* sql */`
        SELECT uploaded_documents
        FROM public.alumni_scholarships
        WHERE id = ${alumniIdNum}
        LIMIT 1
      `;
      if (!rows[0]) return NextResponse.json({ error: "Application not found" }, { status: 404 });

      const current = (rows[0] as { uploaded_documents: unknown }).uploaded_documents;
      let arr: any[] = [];
      if (current == null) arr = [];
      else if (typeof current === "string") {
        try {
          const parsed = JSON.parse(current);
          arr = Array.isArray(parsed) ? parsed : [];
        } catch {
          arr = [];
        }
      } else if (Array.isArray(current)) {
        arr = current as any[];
      } else {
        arr = [];
      }

      const byLabel = new Map<string, any>();
      for (const it of arr) {
        if (!it || typeof it !== "object") continue;
        const l = String((it as any).label ?? "").trim();
        if (l) byLabel.set(l, it);
      }

      for (const c of normalizedChecklist) {
        const existing = byLabel.get(c.label);
        if (existing && typeof existing === "object") {
          (existing as any).adminVerified = c.verified;
        } else {
          arr.push({ label: c.label, url: "", filename: "", adminVerified: c.verified });
        }
      }

      await sql/* sql */`
        UPDATE public.alumni_scholarships
        SET uploaded_documents = ${JSON.stringify(arr)}
        WHERE id = ${alumniIdNum}
      `;

      await logAdminAction({
        session,
        req: request,
        input: {
          action: "scholarships.update_status",
          entityType: "alumni_scholarships",
          entityId: alumniIdNum,
          success: true,
          metadata: { alumniId: alumniIdNum, detail: "documentChecklist updated" },
        },
      });

      return NextResponse.json({ success: true }, { status: 200 });
    }

    // Validate status
    const validStatuses = ["pending", "approved", "not-approved", "not-applicable", "withdrawn"];
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Status must be one of: ${validStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    // If status is "not-approved", rejectionReason is required
    if (status === "not-approved" && (!rejectionReason || rejectionReason.trim() === "")) {
      return NextResponse.json(
        { error: "Rejection reason is required when marking application as not approved" },
        { status: 400 }
      );
    }

    // If status is "withdrawn", withdrawalReason is required
    if (status === "withdrawn" && (!withdrawalReason || withdrawalReason.trim() === "")) {
      return NextResponse.json(
        { error: "Withdrawal reason is required when withdrawing an application" },
        { status: 400 }
      );
    }

    // Fetch application and alumni details before updating
    const applicationRows = await sql/* sql */`
      SELECT
        asch.kinship_firstname,
        asch.kinship_lastname,
        asch.kinship_cnic,
        asch.apply_for,
        asch.degree_title,
        a.alumniname,
        a.personalemail,
        a.universityemail,
        a.officialemail,
        a.cnicpassport,
        a.father_cnic
      FROM public.alumni_scholarships asch
      JOIN public.tbl_alumni a ON a.alumniid = asch.id
      WHERE asch.id = ${alumniIdNum}
      LIMIT 1
    `;

    if (!applicationRows[0]) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    const app = applicationRows[0] as {
      kinship_firstname: string | null;
      kinship_lastname: string | null;
      kinship_cnic: string | null;
      apply_for: string | null;
      degree_title: string | null;
      alumniname: string | null;
      personalemail: string | null;
      universityemail: string | null;
      officialemail: string | null;
      cnicpassport: string | null;
      father_cnic: string | null;
    };

    const alumniName = String(app.alumniname || "");
    const alumniEmail = String(app.personalemail || app.universityemail || app.officialemail || "");
    const applyFor = String(app.apply_for || "");
    const degreeTitle = String(app.degree_title || "");
    const kinshipFirstName = app.kinship_firstname;
    const kinshipLastName = app.kinship_lastname;
    const kinshipCnic = app.kinship_cnic;
    const hasKinship = !!(kinshipFirstName && kinshipLastName);

    // Determine discount type based on kinship data
    const discountType = hasKinship ? "kinship" : "alumni";

    // Update scholarship status and rejection reason
    if (status === "not-approved") {
      const rejectionReasonText = typeof rejectionReason === "string" ? rejectionReason.trim() : "";
      await sql/* sql */`
        UPDATE public.alumni_scholarships
        SET status = ${status}, reason = ${rejectionReasonText}, withdrawn_at = NULL, withdrawn_by = NULL, withdrawal_reason = NULL
        WHERE id = ${alumniIdNum}
      `;
    } else if (status === "withdrawn") {
      const withdrawnBy = session.user?.email ? String(session.user.email) : null;
      const withdrawalReasonText = typeof withdrawalReason === "string" ? withdrawalReason.trim() : "";
      await sql/* sql */`
        UPDATE public.alumni_scholarships
        SET status = ${status}, reason = NULL, withdrawn_at = NOW(), withdrawn_by = ${withdrawnBy}, withdrawal_reason = ${withdrawalReasonText}
        WHERE id = ${alumniIdNum}
      `;
    } else if (status === "not-applicable") {
      await sql/* sql */`
        UPDATE public.alumni_scholarships
        SET status = ${status}, reason = NULL, withdrawn_at = NULL, withdrawn_by = NULL, withdrawal_reason = NULL
        WHERE id = ${alumniIdNum}
      `;
    } else {
      // Clear rejection reason when approving or setting to pending
      await sql/* sql */`
        UPDATE public.alumni_scholarships
        SET status = ${status}, reason = NULL, withdrawn_at = NULL, withdrawn_by = NULL, withdrawal_reason = NULL
        WHERE id = ${alumniIdNum}
      `;
    }

    await logAdminAction({
      session,
      req: request,
      input: {
        action: "scholarships.update_status",
        entityType: "alumni_scholarships",
        entityId: alumniIdNum,
        success: true,
        metadata: { alumniId: alumniIdNum, status, detail: `status set to ${status}` },
      },
    });

    return NextResponse.json(
      { 
        success: true, 
        status,
      },
      { status: 200 }
    );
  } catch (err) {
    await logAdminAction({
      session,
      req: request,
      input: {
        action: "scholarships.update_status",
        entityType: "alumni_scholarships",
        success: false,
        errorMessage: err instanceof Error ? err.message : "Failed to update scholarship status",
      },
    });

    const msg = err instanceof Error ? err.message : "Failed to update scholarship status";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  ctx: { params: Promise<{ alumniId: string }> }
) {
  let session: Session | null = null;
  try {
    session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admins can delete scholarship applications
    if (!canModify(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { alumniId } = await ctx.params;
    const scholarshipId = parseInt(String(alumniId), 10);
    
    if (isNaN(scholarshipId) || scholarshipId <= 0) {
      return NextResponse.json({ error: "Invalid scholarship ID" }, { status: 400 });
    }

    // Check if scholarship application exists
    const scholarshipRows = await sql/* sql */`
      SELECT id
      FROM public.alumni_scholarships
      WHERE id = ${scholarshipId}
      LIMIT 1
    `;

    if (!scholarshipRows[0]) {
      return NextResponse.json({ error: "Scholarship application not found" }, { status: 404 });
    }

    // Delete the scholarship application
    await sql/* sql */`
      DELETE FROM public.alumni_scholarships
      WHERE id = ${scholarshipId}
    `;

    await logAdminAction({
      session,
      req: request,
      input: {
        action: "scholarships.delete",
        entityType: "alumni_scholarships",
        entityId: scholarshipId,
        success: true,
        metadata: { alumniId: scholarshipId },
      },
    });

    return NextResponse.json({ success: true, message: "Scholarship application deleted successfully" }, { status: 200 });
  } catch (err) {
    await logAdminAction({
      session,
      req: request,
      input: {
        action: "scholarships.delete",
        entityType: "alumni_scholarships",
        success: false,
        errorMessage: err instanceof Error ? err.message : "Failed to delete scholarship application",
      },
    });
    const msg = err instanceof Error ? err.message : "Failed to delete scholarship application";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
