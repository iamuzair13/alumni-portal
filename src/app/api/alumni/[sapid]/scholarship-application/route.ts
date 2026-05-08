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
} from "@/lib/scholarshipLetter";

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

    if (isMultipart) {
      const formData = await req.formData();
      discountType = String(formData.get("discountType") || "").trim();
      applyingFor = String(formData.get("applyingFor") || "").trim();
      degreeTitle = String(formData.get("degreeTitle") || "").trim();

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
        alumniemail
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
