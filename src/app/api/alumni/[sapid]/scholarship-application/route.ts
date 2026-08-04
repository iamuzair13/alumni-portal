import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join, extname } from "path";
import { existsSync } from "fs";

import { uploadsImageUrl } from "@/lib/uploadsImageUrl";
import { getUploadsImagesDir } from "@/lib/uploadsDir";
import { auth } from "@/lib/auth";
import { sql } from "@/lib/dbconnect";
import { sendEmailDetailed } from "@/lib/email";
import { EMAIL_ACTION_TYPE, generateAdminActionEmail } from "@/lib/emailTemplates";
import {
  EMAIL_LOG_STATUS,
  EMAIL_TRIGGERED_BY,
  insertEmailLog,
} from "@/lib/emailLogs";
import {
  isScholarshipFeeDiscountFlow,
  isScholarshipKinshipCategory,
  normalizeGradePercent,
  isMergedScholarshipSlug,
  getMergedFeeComponentSlugs,
  isHighAchieverMedalist,
  resolveHighAchieverPercent,
} from "@/lib/scholarshipLetter";
import {
  parseCgpa,
  resolveDiscountPercent,
  type ScholarshipCgpaDiscountTier,
} from "@/lib/scholarshipDiscount";

type Payload = {
  discountType?: string;
  applyingFor?: string;
  degreeTitle?: string;
  kinshipName?: string | null;
  kinshipFatherName?: string | null;
  kinshipCampus?: string | null;
  kinshipFaculty?: string | null;
  kinshipDepartment?: string | null;
  kinshipProgram?: string | null;
  kinshipAdmissionRefNo?: string | null;
  kinshipLastDegreeCertificate?: string | null;
  kinshipPassingOutYear?: string | null;
  kinshipCnic?: string | null;
  fatherCnic?: string | null;
  gradePercent?: string | null;
  appliedDiscountPercent?: number | string | null;
  admissionFeePercent?: number | string | null;
  tuitionFeePercent?: number | string | null;
  highAchieverPercent?: number | string | null;
  applyAdmissionFeeDiscount?: boolean | string | null;
  applicationYear?: number | string | null;
  applicationTerm?: string | null;
};

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
]);

function sanitizeFilename(name: string): string {
  const base = String(name || "file")
    .replace(/\\/g, "_")
    .replace(/\//g, "_")
    .replace(/\.+/g, ".")
    .replace(/[^a-zA-Z0-9._-]/g, "_");

  return base.length > 120 ? base.slice(-120) : base;
}

function safeExt(file: File): string {
  const byName = extname(file.name || "").toLowerCase();
  if (byName === ".pdf") return ".pdf";
  if (file.type === "application/pdf") return ".pdf";
  return "";
}

async function saveFileToUploads(opts: { file: File; prefix: string; slot: string }) {
  const { file, prefix, slot } = opts;

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new Error("Unsupported file type. Only PDF is allowed.");
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error("File size exceeds 5MB limit");
  }

  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).slice(2, 9);
  const ext = safeExt(file);
  if (!ext) throw new Error("Unsupported file extension");

  const safeOriginal = sanitizeFilename(file.name);
  const baseNoExt = safeOriginal.replace(/\.[^.]+$/, "");
  const filename = `${prefix}-${slot}-${timestamp}-${randomSuffix}-${baseNoExt}${ext}`.slice(0, 180);

  const uploadsDir = getUploadsImagesDir();
  if (!existsSync(uploadsDir)) {
    await mkdir(uploadsDir, { recursive: true });
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const filePath = join(uploadsDir, filename);
  await writeFile(filePath, buffer);

  return {
    filename,
    // Use API route so runtime uploads work on production (immutable deploys); same dir as GET /api/uploads/images/[filename]
    url: uploadsImageUrl(filename),
    size: file.size,
    type: file.type,
  };
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ sapid: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }

    const { sapid } = await ctx.params;
    const normalizedSapid = String(sapid || "").trim();
    if (!normalizedSapid) {
      return NextResponse.json({ error: "Invalid SAP ID" }, { status: 400 });
    }

    const contentType = req.headers.get("content-type") || "";
    const isMultipart = contentType.includes("multipart/form-data");

    let payload: Payload = {};
    let discountType = "";
    let applyingFor = "";
    let degreeTitle = "";

    let mastersDetails: Record<string, unknown> | null = null;
    let kinshipDetails: Record<string, unknown> | null = null;
    let uploadedDocuments: Array<{ label: string; url: string; filename: string; type: string; size: number }> | null =
      null;
    let admissionApplicationRef: string | null = null;
    let gradePercent: string | null = null;
    let applicationYear: number | null = null;
    let applicationTerm: string | null = null;
    let clientAppliedPercent: number | null = null;
    let clientAdmissionFeePercent: number | null = null;
    let clientTuitionFeePercent: number | null = null;
    let clientHighAchieverPercent: number | null = null;
    let clientApplyAdmissionFeeDiscount = false;
    let serverAdmissionFeePercent: number | null = null;
    let serverTuitionFeePercent: number | null = null;
    let serverHighAchieverPercent: number | null = null;

    if (isMultipart) {
      const formData = await req.formData();
      discountType = String(formData.get("discountType") || "").trim();
      applyingFor = String(formData.get("applyingFor") || "").trim();
      degreeTitle = String(formData.get("degreeTitle") || "").trim();
      gradePercent = normalizeGradePercent(formData.get("gradePercent"));
      const rawYear = formData.get("applicationYear");
      if (rawYear != null && String(rawYear).trim() !== "") {
        const y = Number(rawYear);
        if (Number.isFinite(y) && y > 0) applicationYear = Math.trunc(y);
      }
      const rawTerm = String(formData.get("applicationTerm") || "").trim();
      if (rawTerm) applicationTerm = rawTerm;
      const rawPct = formData.get("appliedDiscountPercent");
      if (rawPct != null && String(rawPct).trim() !== "") {
        const n = Number(rawPct);
        if (Number.isFinite(n)) clientAppliedPercent = n;
      }
      const rawAdmPct = formData.get("admissionFeePercent");
      if (rawAdmPct != null && String(rawAdmPct).trim() !== "") {
        const n = Number(rawAdmPct);
        if (Number.isFinite(n)) clientAdmissionFeePercent = n;
      }
      const rawTuiPct = formData.get("tuitionFeePercent");
      if (rawTuiPct != null && String(rawTuiPct).trim() !== "") {
        const n = Number(rawTuiPct);
        if (Number.isFinite(n)) clientTuitionFeePercent = n;
      }
      const rawHaPct = formData.get("highAchieverPercent");
      if (rawHaPct != null && String(rawHaPct).trim() !== "") {
        const n = Number(rawHaPct);
        if (Number.isFinite(n)) clientHighAchieverPercent = n;
      }
      const rawApplyAdm = formData.get("applyAdmissionFeeDiscount");
      if (rawApplyAdm != null && String(rawApplyAdm).trim().toLowerCase() === "true") {
        clientApplyAdmissionFeeDiscount = true;
      }

      if (isScholarshipFeeDiscountFlow(discountType)) {
        const admissionFacultyId = String(formData.get("admissionFacultyId") || "").trim();
        const admissionDepartmentId = String(formData.get("admissionDepartmentId") || "").trim();
        const admissionProgramId = String(formData.get("admissionProgramId") || "").trim();
        const admissionCampus = String(formData.get("admissionCampus") || "").trim();
        const admissionSession = String(formData.get("admissionSession") || "").trim();
        const declarationAccepted = String(formData.get("declarationAccepted") || "").trim();
        admissionApplicationRef = String(formData.get("admissionApplicationRef") || "").trim() || null;

        mastersDetails = {
          admissionFacultyId,
          admissionDepartmentId,
          admissionProgramId,
          admissionCampus,
          admissionSession,
          declarationAccepted: declarationAccepted === "true",
        };

        const requiredFiles: Array<{ key: string; label: string; slot: string }> = [
          { key: "docAdmissionLetter", label: "Copy of Admission Letter (PhD – UOL)", slot: "admission-letter" },
          { key: "docAlumniProof", label: "Alumni Card", slot: "alumni-card" },
          { key: "docCnic", label: "CNIC Copy", slot: "cnic" },
        ];
        const optionalFiles: Array<{ key: string; label: string; slot: string }> = [
          { key: "docTranscripts", label: "Academic Transcripts and Certificates", slot: "transcripts" },
          { key: "docCv", label: "Curriculum Vitae (CV)", slot: "cv" },
        ];

        const prefix = `scholarship-${normalizedSapid}`;
        const uploaded: Array<{ label: string; url: string; filename: string; type: string; size: number }> = [];

        for (const rf of requiredFiles) {
          const f = formData.get(rf.key) as File | null;
          if (!f || f.size <= 0) {
            return NextResponse.json({ error: `${rf.label} file is required` }, { status: 400 });
          }
          const saved = await saveFileToUploads({ file: f, prefix, slot: rf.slot });
          uploaded.push({ label: rf.label, url: saved.url, filename: saved.filename, type: saved.type, size: saved.size });
        }
        for (const ofile of optionalFiles) {
          const f = formData.get(ofile.key) as File | null;
          if (!f || f.size <= 0) continue;
          const saved = await saveFileToUploads({ file: f, prefix, slot: ofile.slot });
          uploaded.push({
            label: ofile.label,
            url: saved.url,
            filename: saved.filename,
            type: saved.type,
            size: saved.size,
          });
        }

        const otherFile = formData.get("docOther") as File | null;
        const otherText = String(formData.get("docOtherText") || "").trim();
        if (otherFile && otherFile.size > 0) {
          if (!otherText) {
            return NextResponse.json({ error: "Other document description is required" }, { status: 400 });
          }
          const saved = await saveFileToUploads({ file: otherFile, prefix, slot: "other" });
          uploaded.push({ label: `Other: ${otherText}`, url: saved.url, filename: saved.filename, type: saved.type, size: saved.size });
        }

        uploadedDocuments = uploaded;
      } else if (isScholarshipKinshipCategory(discountType)) {
        payload.kinshipName = String(formData.get("kinshipName") || "").trim() || null;
        payload.kinshipFatherName =
          String(formData.get("kinshipFatherName") || "").trim() || null;
        payload.kinshipCampus = String(formData.get("kinshipCampus") || "").trim() || null;
        payload.kinshipFaculty = String(formData.get("kinshipFaculty") || "").trim() || null;
        payload.kinshipDepartment =
          String(formData.get("kinshipDepartment") || "").trim() || null;
        payload.kinshipProgram = String(formData.get("kinshipProgram") || "").trim() || null;
        payload.kinshipAdmissionRefNo =
          String(formData.get("kinshipAdmissionRefNo") || "").trim() || null;
        payload.kinshipLastDegreeCertificate =
          String(formData.get("kinshipLastDegreeCertificate") || "").trim() || null;
        payload.kinshipPassingOutYear =
          String(formData.get("kinshipPassingOutYear") || "").trim() || null;
        payload.kinshipCnic = String(formData.get("kinshipCnic") || "").trim() || null;
        payload.fatherCnic = String(formData.get("fatherCnic") || "").trim() || null;
        const requiredFiles: Array<{ key: string; label: string; slot: string }> = [
          {
            key: "docKinshipAdmissionLetter",
            label: "Copy of Admission Letter",
            slot: "kinship-admission-letter",
          },
          {
            key: "docKinshipAcademicCertificates",
            label: "Academic Certificates/Transcripts (Kin)",
            slot: "kinship-academic-certificates",
          },
          { key: "docKinshipAlumniCard", label: "Alumni Card", slot: "kinship-alumni-card" },
          { key: "docKinshipFrc", label: "FRC", slot: "kinship-frc" },
          { key: "docKinshipCnicKin", label: "CNIC Copy (Kinship)", slot: "kinship-cnic-kin" },
          {
            key: "docKinshipCnicAlumni",
            label: "CNIC Copy (Alumni)",
            slot: "kinship-cnic-alumni",
          },
        ];

        const prefix = `scholarship-${normalizedSapid}`;
        const uploaded: Array<{ label: string; url: string; filename: string; type: string; size: number }> = [];
        for (const rf of requiredFiles) {
          const f = formData.get(rf.key) as File | null;
          if (!f || f.size <= 0) {
            return NextResponse.json({ error: `${rf.label} file is required` }, { status: 400 });
          }
          const saved = await saveFileToUploads({ file: f, prefix, slot: rf.slot });
          uploaded.push({ label: rf.label, url: saved.url, filename: saved.filename, type: saved.type, size: saved.size });
        }
        kinshipDetails = {
          kinshipFatherName: payload.kinshipFatherName,
          kinshipCampus: payload.kinshipCampus,
          kinshipFaculty: payload.kinshipFaculty,
          kinshipDepartment: payload.kinshipDepartment,
          kinshipProgram: payload.kinshipProgram,
          kinshipAdmissionRefNo: payload.kinshipAdmissionRefNo,
          kinshipLastDegreeCertificate: payload.kinshipLastDegreeCertificate,
          kinshipPassingOutYear: payload.kinshipPassingOutYear,
          fatherCnic: payload.fatherCnic,
        };
        uploadedDocuments = uploaded;
      }
    } else {
      payload = (await req.json()) as Payload;
      discountType = String(payload.discountType || "").trim();
      applyingFor = String(payload.applyingFor || "").trim();
      degreeTitle = String(payload.degreeTitle || "").trim();
      gradePercent = normalizeGradePercent(payload.gradePercent);
      if (payload.applicationYear != null && payload.applicationYear !== "") {
        const y = Number(payload.applicationYear);
        if (Number.isFinite(y) && y > 0) applicationYear = Math.trunc(y);
      }
      const termVal = String(payload.applicationTerm || "").trim();
      if (termVal) applicationTerm = termVal;
      if (payload.appliedDiscountPercent != null && payload.appliedDiscountPercent !== "") {
        const n = Number(payload.appliedDiscountPercent);
        if (Number.isFinite(n)) clientAppliedPercent = n;
      }
      if (payload.admissionFeePercent != null && payload.admissionFeePercent !== "") {
        const n = Number(payload.admissionFeePercent);
        if (Number.isFinite(n)) clientAdmissionFeePercent = n;
      }
      if (payload.tuitionFeePercent != null && payload.tuitionFeePercent !== "") {
        const n = Number(payload.tuitionFeePercent);
        if (Number.isFinite(n)) clientTuitionFeePercent = n;
      }
      if (payload.highAchieverPercent != null && payload.highAchieverPercent !== "") {
        const n = Number(payload.highAchieverPercent);
        if (Number.isFinite(n)) clientHighAchieverPercent = n;
      }
      if (payload.applyAdmissionFeeDiscount === true || payload.applyAdmissionFeeDiscount === "true") {
        clientApplyAdmissionFeeDiscount = true;
      }
    }

    if (!discountType || !applyingFor || !degreeTitle) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const alumniRows = await sql/* sql */`
      SELECT
        alumniid,
        sapid,
        registrationno,
        alumniname,
        personalemail,
        officialemail,
        universityemail,
        alumniemail,
        cgpa,
        medal
      FROM public.tbl_alumni
      WHERE TRIM(COALESCE(sapid, '')) = ${normalizedSapid}
         OR TRIM(COALESCE(registrationno, '')) = ${normalizedSapid}
      ORDER BY alumniid DESC
      LIMIT 1
    `;

    const alumni = alumniRows[0] as
      | {
          alumniid: number;
          sapid: string | null;
          registrationno: string | null;
          alumniname: string | null;
          personalemail: string | null;
          officialemail: string | null;
          universityemail: string | null;
          alumniemail: string | null;
          cgpa: number | null;
          medal: string | null;
        }
      | undefined;

    if (!alumni?.alumniid) {
      return NextResponse.json({ error: "Alumni not found" }, { status: 404 });
    }

    const userEmail = session.user.email
      ? String(session.user.email).toLowerCase().trim()
      : null;
    const userSapid = (session.user as { sapid?: string | null })?.sapid
      ? String((session.user as { sapid?: string | null }).sapid)
          .toLowerCase()
          .trim()
      : null;
    const userRegNo = (session.user as { registrationno?: string | null })?.registrationno
      ? String((session.user as { registrationno?: string | null }).registrationno)
          .toLowerCase()
          .trim()
      : null;

    const isOwnerBySapid =
      userSapid &&
      String(alumni.sapid ?? "").toLowerCase().trim() === userSapid;
    const isOwnerByRegNo =
      userRegNo &&
      String(alumni.registrationno ?? "").toLowerCase().trim() === userRegNo;
    const isOwnerByEmail = userEmail
      ? [alumni.personalemail, alumni.officialemail, alumni.universityemail, alumni.alumniemail]
          .filter(Boolean)
          .some((e) => String(e).toLowerCase().trim() === userEmail)
      : false;

    const isOwner = Boolean(isOwnerBySapid || isOwnerByRegNo || isOwnerByEmail);
    if (!isOwner) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const alumniCgpa = parseCgpa((alumni as { cgpa?: number | null }).cgpa);
    if (alumniCgpa == null) {
      return NextResponse.json(
        { error: "Please add your CGPA in your alumni profile before applying." },
        { status: 400 },
      );
    }

    let categoryId: number | null = null;
    let categoryFlowType: string | null = null;

    if (isMergedScholarshipSlug(discountType)) {
      // For merged slugs, validate that at least one component category exists
      const componentSlugs = getMergedFeeComponentSlugs(discountType);
      if (componentSlugs) {
        const admCatRows = await sql/* sql */`
          SELECT id, slug, flow_type, is_active
          FROM public.scholarship_discount_categories
          WHERE slug = ${componentSlugs.admissionSlug}
            AND is_active = true
          LIMIT 1
        `;
        const admCat = admCatRows?.[0] as
          | { id: number; slug: string; flow_type: string; is_active: boolean }
          | undefined;
        if (admCat?.id) {
          categoryId = admCat.id;
          categoryFlowType = admCat.flow_type;
        }
      }
      if (!categoryId) {
        return NextResponse.json({ error: "Invalid or inactive discount category" }, { status: 400 });
      }
    } else {
      const categoryRows = await sql/* sql */`
        SELECT id, slug, flow_type, is_active
        FROM public.scholarship_discount_categories
        WHERE slug = ${discountType}
          AND is_active = true
        LIMIT 1
      `;
      const category = categoryRows?.[0] as
        | { id: number; slug: string; flow_type: string; is_active: boolean }
        | undefined;
      if (!category?.id) {
        return NextResponse.json({ error: "Invalid or inactive discount category" }, { status: 400 });
      }
      categoryId = category.id;
      categoryFlowType = category.flow_type;
    }

    const tierRows = await sql/* sql */`
      SELECT id, category_id, cgpa_min, cgpa_max, discount_percent, sort_order
      FROM public.scholarship_cgpa_discount_tiers
      WHERE category_id = ${categoryId}
      ORDER BY sort_order ASC, id ASC
    `;
    const tiers = (tierRows as Record<string, unknown>[]).map(
      (r): ScholarshipCgpaDiscountTier => ({
        id: Number(r.id),
        category_id: Number(r.category_id),
        cgpa_min: Number(r.cgpa_min),
        cgpa_max: Number(r.cgpa_max),
        discount_percent: Number(r.discount_percent),
        sort_order: Number(r.sort_order) || 0,
      }),
    );

    // Resolve high achiever discount from alumni medal
    serverHighAchieverPercent = resolveHighAchieverPercent(alumni.medal);

    let appliedDiscountPercent = resolveDiscountPercent(alumniCgpa, tiers);

    // For merged scholarship slugs, resolve both admission and tuition component categories
    if (isMergedScholarshipSlug(discountType)) {
      const componentSlugs = getMergedFeeComponentSlugs(discountType);
      if (componentSlugs) {
        const admCatRows = await sql/* sql */`
          SELECT id FROM public.scholarship_discount_categories
          WHERE slug = ${componentSlugs.admissionSlug} AND is_active = true
          LIMIT 1
        `;
        const admCat = admCatRows?.[0] as { id: number } | undefined;
        if (admCat?.id) {
          const admTierRows = await sql/* sql */`
            SELECT id, category_id, cgpa_min, cgpa_max, discount_percent, sort_order
            FROM public.scholarship_cgpa_discount_tiers
            WHERE category_id = ${admCat.id}
            ORDER BY sort_order ASC, id ASC
          `;
          const admTiers = (admTierRows as Record<string, unknown>[]).map(
            (r): ScholarshipCgpaDiscountTier => ({
              id: Number(r.id),
              category_id: Number(r.category_id),
              cgpa_min: Number(r.cgpa_min),
              cgpa_max: Number(r.cgpa_max),
              discount_percent: Number(r.discount_percent),
              sort_order: Number(r.sort_order) || 0,
            }),
          );
          serverAdmissionFeePercent = resolveDiscountPercent(alumniCgpa, admTiers);
        }

        const tuiCatRows = await sql/* sql */`
          SELECT id FROM public.scholarship_discount_categories
          WHERE slug = ${componentSlugs.tuitionSlug} AND is_active = true
          LIMIT 1
        `;
        const tuiCat = tuiCatRows?.[0] as { id: number } | undefined;
        if (tuiCat?.id) {
          const tuiTierRows = await sql/* sql */`
            SELECT id, category_id, cgpa_min, cgpa_max, discount_percent, sort_order
            FROM public.scholarship_cgpa_discount_tiers
            WHERE category_id = ${tuiCat.id}
            ORDER BY sort_order ASC, id ASC
          `;
          const tuiTiers = (tuiTierRows as Record<string, unknown>[]).map(
            (r): ScholarshipCgpaDiscountTier => ({
              id: Number(r.id),
              category_id: Number(r.category_id),
              cgpa_min: Number(r.cgpa_min),
              cgpa_max: Number(r.cgpa_max),
              discount_percent: Number(r.discount_percent),
              sort_order: Number(r.sort_order) || 0,
            }),
          );
          serverTuitionFeePercent = resolveDiscountPercent(alumniCgpa, tuiTiers);
        }

        // Use tuition fee as the base applied discount percent (admission fee is standalone)
        if (serverTuitionFeePercent != null) {
          appliedDiscountPercent = serverTuitionFeePercent;
        }
      }
    }

    // Add high achiever discount to the total
    if (serverHighAchieverPercent != null) {
      appliedDiscountPercent = (appliedDiscountPercent ?? 0) + serverHighAchieverPercent;
    }

    if (appliedDiscountPercent == null) {
      return NextResponse.json(
        { error: "No discount tier applies to your CGPA for this category." },
        { status: 400 },
      );
    }

    if (
      clientAppliedPercent != null &&
      Math.abs(clientAppliedPercent - appliedDiscountPercent) > 0.001
    ) {
      return NextResponse.json({ error: "Discount percent mismatch. Please refresh and try again." }, { status: 400 });
    }

    // Validate merged fee component percents if provided by client
    if (isMergedScholarshipSlug(discountType)) {
      if (
        clientAdmissionFeePercent != null &&
        serverAdmissionFeePercent != null &&
        Math.abs(clientAdmissionFeePercent - serverAdmissionFeePercent) > 0.001
      ) {
        return NextResponse.json({ error: "Admission fee percent mismatch. Please refresh and try again." }, { status: 400 });
      }
      if (
        clientTuitionFeePercent != null &&
        serverTuitionFeePercent != null &&
        Math.abs(clientTuitionFeePercent - serverTuitionFeePercent) > 0.001
      ) {
        return NextResponse.json({ error: "Tuition fee percent mismatch. Please refresh and try again." }, { status: 400 });
      }
      // Store fee breakdown in masters_details
      if (mastersDetails) {
        mastersDetails.admissionFeePercent = clientApplyAdmissionFeeDiscount ? serverAdmissionFeePercent : null;
        mastersDetails.tuitionFeePercent = serverTuitionFeePercent;
        mastersDetails.applyAdmissionFeeDiscount = clientApplyAdmissionFeeDiscount;
      }
    }

    // Store high achiever discount in masters_details (for both fee and kinship flows)
    if (mastersDetails) {
      mastersDetails.highAchieverPercent = serverHighAchieverPercent;
      mastersDetails.medal = alumni.medal;
    } else if (kinshipDetails) {
      kinshipDetails.highAchieverPercent = serverHighAchieverPercent;
      kinshipDetails.medal = alumni.medal;
    } else {
      // Create mastersDetails if none exists (e.g. kinship flow without mastersDetails)
      mastersDetails = { highAchieverPercent: serverHighAchieverPercent, medal: alumni.medal };
    }

    // Validate high achiever percent if provided by client
    if (
      clientHighAchieverPercent != null &&
      serverHighAchieverPercent != null &&
      Math.abs(clientHighAchieverPercent - serverHighAchieverPercent) > 0.001
    ) {
      return NextResponse.json({ error: "High achiever percent mismatch. Please refresh and try again." }, { status: 400 });
    }

    const fullKinshipName = payload.kinshipName ? String(payload.kinshipName).trim() : "";
    const kinshipNameParts = fullKinshipName.split(/\s+/).filter(Boolean);
    const kinshipFirstName = kinshipNameParts.length > 0 ? kinshipNameParts[0] : null;
    const kinshipLastName =
      kinshipNameParts.length > 1 ? kinshipNameParts.slice(1).join(" ") : null;
    const kinshipCnic = payload.kinshipCnic ? String(payload.kinshipCnic).trim() : null;

    await sql/* sql */`
      INSERT INTO public.alumni_scholarships (
        id,
        created_at,
        kinship_firstname,
        kinship_lastname,
        kinship_cnic,
        discount_type,
        apply_for,
        degree_title,
        masters_details,
        kinship_details,
        uploaded_documents,
        admission_application_ref,
        grade_percent,
        applied_discount_percent,
        application_year,
        application_term,
        status
      ) VALUES (
        ${alumni.alumniid},
        NOW(),
        ${kinshipFirstName},
        ${kinshipLastName},
        ${kinshipCnic},
        ${discountType},
        ${applyingFor},
        ${degreeTitle},
        ${mastersDetails ? JSON.stringify(mastersDetails) : null},
        ${kinshipDetails ? JSON.stringify(kinshipDetails) : null},
        ${uploadedDocuments ? JSON.stringify(uploadedDocuments) : null},
        ${admissionApplicationRef},
        ${gradePercent},
        ${appliedDiscountPercent},
        ${applicationYear},
        ${applicationTerm},
        'pending'
      )
      ON CONFLICT (id) DO UPDATE SET
        created_at = EXCLUDED.created_at,
        kinship_firstname = EXCLUDED.kinship_firstname,
        kinship_lastname = EXCLUDED.kinship_lastname,
        kinship_cnic = EXCLUDED.kinship_cnic,
        discount_type = EXCLUDED.discount_type,
        apply_for = EXCLUDED.apply_for,
        degree_title = EXCLUDED.degree_title,
        masters_details = EXCLUDED.masters_details,
        kinship_details = EXCLUDED.kinship_details,
        uploaded_documents = EXCLUDED.uploaded_documents,
        admission_application_ref = EXCLUDED.admission_application_ref,
        grade_percent = EXCLUDED.grade_percent,
        applied_discount_percent = EXCLUDED.applied_discount_percent,
        application_year = EXCLUDED.application_year,
        application_term = EXCLUDED.application_term,
        status = 'pending',
        reason = NULL
    `;

    const alumniName = String(alumni.alumniname || "Alumni").trim() || "Alumni";
    const recipientEmail = String(
      alumni.personalemail || alumni.officialemail || alumni.universityemail || alumni.alumniemail || ""
    ).trim();

    let emailSent: boolean | null = null;
    let emailError: string | null = null;

    if (recipientEmail && recipientEmail.includes("@")) {
      const tpl = generateAdminActionEmail({
        actionType: EMAIL_ACTION_TYPE.ALUMNI_SCHOLARSHIP_RECEIVED,
        alumniName,
      });

      const emailRes = await sendEmailDetailed({
        to: recipientEmail,
        subject: tpl.subject,
        html: tpl.html,
      });

      emailSent = emailRes.ok;
      emailError = emailRes.ok ? null : emailRes.errorMessage ?? "Unknown error";

      await insertEmailLog({
        recipientEmail,
        alumniId: alumni.alumniid,
        subject: tpl.subject,
        body: tpl.html,
        status: emailRes.ok ? EMAIL_LOG_STATUS.SENT : EMAIL_LOG_STATUS.FAILED,
        errorMessage: emailRes.ok ? null : emailError,
        triggeredBy: EMAIL_TRIGGERED_BY.AUTO,
        actionType: EMAIL_ACTION_TYPE.ALUMNI_SCHOLARSHIP_RECEIVED,
      });
    }

    return NextResponse.json(
      {
        ok: true,
        message: "Scholarship application submitted successfully",
        emailSent,
        emailError,
      },
      { status: 201 }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to submit scholarship application";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
