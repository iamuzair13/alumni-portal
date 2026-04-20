import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { canModify } from "@/lib/alumniProfile";
import { generateScholarshipLetterPDF, generateScholarshipPDF } from "@/lib/pdfGenerator";
import {
  discountCategoryLabel,
  discountTypeOptionLabel,
  isScholarshipFeeDiscountFlow,
  parseMastersDetails,
  parseUploadedDocuments,
} from "@/lib/scholarshipLetter";
import { resolveStoredUploadUrl } from "@/lib/uploadsImageUrl";

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
        asch.uploaded_documents,
        asch.admission_application_ref,
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
        a.officialemail
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
      uploaded_documents: unknown;
      admission_application_ref: string | null;
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
    };

    const alumniName = String(app.alumniname || "");
    const alumniEmail = String(app.personalemail || app.universityemail || app.officialemail || "");

    const kinshipFirstName = app.kinship_firstname;
    const kinshipLastName = app.kinship_lastname;
    const hasKinship = !!(kinshipFirstName && kinshipLastName);
    const discountTypeStored = String(app.discount_type || "").trim();
    const discountTypeForPdf =
      discountTypeStored ||
      (hasKinship ? "kinship" : "alumni");

    if (mode === "pdf") {
      const pdfBuffer = await generateScholarshipPDF({
        alumniName,
        discountType: discountTypeForPdf,
        applyingFor: String(app.apply_for || ""),
        degreeTitle: String(app.degree_title || ""),
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
        masters.admissionStatus ? `Admission status: ${masters.admissionStatus}` : null,
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
    const dobFormatted = app.dateofbirth
      ? new Date(app.dateofbirth).toLocaleDateString("en-PK", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : "Data unavailable";

    const cgpaDisplay =
      app.cgpa != null && Number.isFinite(Number(app.cgpa))
        ? String(app.cgpa)
        : "Data is missing";

    const passingOutYearDisplay =
      app.yearofending != null && Number.isFinite(Number(app.yearofending))
        ? String(Number(app.yearofending))
        : "Data unavailable";

    const admissionRefDisplay = String(app.admission_application_ref ?? "").trim() || null;

    const applyingForDisplay = discountTypeOptionLabel(app.discount_type, app.apply_for);

    const applicationLetter = {
      title: "Alumni Scholarship Application",
      dateFormatted,
      status: String(app.status || "pending").toLowerCase(),
      studentName: alumniName || "Data is missing",
      scholarshipType: discountCategoryLabel(app.discount_type, app.apply_for),
      applyingFor: applyingForDisplay,
      previousDegree: String(app.degreetitle || "").trim() || "Data is missing",
      cgpaLastDegree: cgpaDisplay,
      requestedDiscount: applyingForDisplay,
      documentsAttached: documentsLines,
      uploadedDocuments,
      sapCode: String(app.sapid || "").trim() || "Data is missing",
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
      mastersAdmissionSummary,
      passingOutYear: passingOutYearDisplay,
      admissionApplicationRef: admissionRefDisplay,
    };

    if (mode === "letter-pdf") {
      const pdfBuffer = await generateScholarshipLetterPDF({
        dateFormatted: applicationLetter.dateFormatted,
        studentName: applicationLetter.studentName,
        scholarshipType: applicationLetter.scholarshipType,
        applyingFor: applicationLetter.applyingFor,
        previousDegree: applicationLetter.previousDegree,
        cgpaLastDegree: applicationLetter.cgpaLastDegree,
        requestedDiscount: applicationLetter.requestedDiscount,
        documentsAttached: applicationLetter.documentsAttached,
        sapCode: applicationLetter.sapCode,
        passingOutYear: applicationLetter.passingOutYear,
        admissionApplicationRef: applicationLetter.admissionApplicationRef,
        requestedProgramDegree: applicationLetter.requestedProgramDegree,
        faculty: applicationLetter.faculty,
        department: applicationLetter.department,
        program: applicationLetter.program,
        campus: applicationLetter.campus,
        fatherName: applicationLetter.fatherName,
        dob: applicationLetter.dob,
        cnic: applicationLetter.cnic,
        uploadedDocuments: applicationLetter.uploadedDocuments,
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
  try {
    const session = await auth();
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
    const { status, rejectionReason, documentChecklist } = body as {
      status?: string;
      rejectionReason?: string;
      documentChecklist?: Array<{ label: string; verified: "YES" | "NO" }>;
    };

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

      return NextResponse.json({ success: true }, { status: 200 });
    }

    // Validate status
    const validStatuses = ["pending", "approved", "not-approved"];
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
        SET status = ${status}, reason = ${rejectionReasonText}
        WHERE id = ${alumniIdNum}
      `;
    } else {
      // Clear rejection reason when approving or setting to pending
      await sql/* sql */`
        UPDATE public.alumni_scholarships
        SET status = ${status}, reason = NULL
        WHERE id = ${alumniIdNum}
      `;
    }

    return NextResponse.json(
      { 
        success: true, 
        status,
      },
      { status: 200 }
    );
  } catch (err) {

    const msg = err instanceof Error ? err.message : "Failed to update scholarship status";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  ctx: { params: Promise<{ alumniId: string }> }
) {
  try {
    const session = await auth();
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

    return NextResponse.json({ success: true, message: "Scholarship application deleted successfully" }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to delete scholarship application";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
