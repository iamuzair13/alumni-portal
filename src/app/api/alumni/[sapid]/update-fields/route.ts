import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { canModify } from "@/lib/alumniProfile";
import { logAdminAction } from "@/lib/adminActivityLog";
import { resolveValidFacultyId } from "@/lib/alumniAssociation";

function parseJsonbRecord(v: unknown): Record<string, unknown> {
  if (!v) return {};
  if (typeof v === "object") return v as Record<string, unknown>;
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return {};
    try {
      const parsed = JSON.parse(s) as unknown;
      if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
      return {};
    } catch {
      return {};
    }
  }
  return {};
}

export async function PUT(req: Request, ctx: { params: Promise<{ sapid: string }> }) {
  try {
    const { sapid } = await ctx.params;
    const session = await auth();
    
    const normalizedIdentifier = String(sapid || "").trim();
    
    // Verify the user is authenticated (by email, SAP ID, or registration number)
    const userEmail = session?.user?.email ? String(session.user.email) : null;
    const userSapid = session?.user ? ((session.user as { sapid?: string | null })?.sapid ? String((session.user as { sapid?: string | null }).sapid) : null) : null;
    const userRegNo = session?.user ? ((session.user as { registrationno?: string | null })?.registrationno ? String((session.user as { registrationno?: string | null }).registrationno) : null) : null;
    
    if (!userEmail && !userSapid && !userRegNo) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify alumni exists - try SAP ID first, then registration number
    let rows = await sql/* sql */`
      SELECT alumniid, sapid, registrationno, personalemail, universityemail, officialemail, password 
      FROM public.tbl_alumni 
      WHERE sapid = ${normalizedIdentifier} 
      LIMIT 1`;
    
    // If not found by SAP ID, try registration number
    if (!rows[0]) {
      rows = await sql/* sql */`
        SELECT alumniid, sapid, registrationno, personalemail, universityemail, officialemail, password 
        FROM public.tbl_alumni 
        WHERE registrationno = ${normalizedIdentifier} 
        LIMIT 1`;
    }

    // If still not found, try alumniid (if identifier is numeric)
    if (!rows[0] && !Number.isNaN(Number(normalizedIdentifier))) {
      rows = await sql/* sql */`
        SELECT alumniid, sapid, registrationno, personalemail, universityemail, officialemail, password 
        FROM public.tbl_alumni 
        WHERE alumniid = ${Number(normalizedIdentifier)} 
        LIMIT 1`;
    }
    
    if (!rows[0]) {
      return NextResponse.json({ error: "Alumni not found" }, { status: 404 });
    }

    const row = rows[0] as Record<string, unknown>;
    const currentPassword = row.password ? String(row.password) : null;
    const alumniId = Number(row.alumniid); // Use alumniid (primary key) for all updates
    
    // Note: userEmail, userSapid, and userRegNo are already declared above in the authentication check
    // Check ownership by SAP ID
    const isOwnerBySapid = userSapid && String(row.sapid ?? "").toLowerCase().trim() === userSapid.toLowerCase().trim();
    
    // Check ownership by registration number
    const isOwnerByRegNo = userRegNo && String(row.registrationno ?? "").toLowerCase().trim() === userRegNo.toLowerCase().trim();
    
    // Check ownership by email (backward compatibility)
    const isOwnerByEmail = userEmail && (
      String(row.personalemail ?? "").toLowerCase().trim() === userEmail.toLowerCase().trim() ||
      String(row.universityemail ?? "").toLowerCase().trim() === userEmail.toLowerCase().trim() ||
      String(row.officialemail ?? "").toLowerCase().trim() === userEmail.toLowerCase().trim()
    );
    
    const isOwner = isOwnerBySapid || isOwnerByRegNo || isOwnerByEmail;

    if (!isOwner && !canModify(session?.user)) {
      await logAdminAction({
        session,
        req,
        input: {
          action: "alumni.update_fields",
          entityType: "tbl_alumni",
          entityId: alumniId,
          success: false,
          errorMessage: "FORBIDDEN",
        },
      });
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    
    const isAdmin = canModify(session?.user);
    
    const body = await req.json();
    
    // Validate email format if email fields are being updated
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (body.personalemail !== undefined && body.personalemail !== null && body.personalemail !== "" && !emailPattern.test(String(body.personalemail))) {
      return NextResponse.json({ 
        error: "Invalid personal email format",
        field: "personalemail",
        reason: "INVALID_FORMAT",
        message: "Please enter a valid email address (e.g., user@example.com)"
      }, { status: 400 });
    }
    if (body.universityemail !== undefined && body.universityemail !== null && body.universityemail !== "" && !emailPattern.test(String(body.universityemail))) {
      return NextResponse.json({ 
        error: "Invalid university email format",
        field: "universityemail",
        reason: "INVALID_FORMAT",
        message: "Please enter a valid email address (e.g., user@example.com)"
      }, { status: 400 });
    }
    if (body.officialemail !== undefined && body.officialemail !== null && body.officialemail !== "" && !emailPattern.test(String(body.officialemail))) {
      return NextResponse.json({ 
        error: "Invalid Wrok Email format",
        field: "officialemail",
        reason: "INVALID_FORMAT",
        message: "Please enter a valid email address (e.g., user@example.com)"
      }, { status: 400 });
    }

    // Validate URL format for social media fields
    const urlPattern = /^https?:\/\/.+/;
    if (body.facebook !== undefined && body.facebook !== null && body.facebook !== "" && !urlPattern.test(String(body.facebook))) {
      return NextResponse.json({ 
        error: "Invalid Facebook URL format",
        field: "facebook",
        reason: "INVALID_FORMAT",
        message: "URL must start with http:// or https:// (e.g., https://facebook.com/username)"
      }, { status: 400 });
    }
    if (body.instagram !== undefined && body.instagram !== null && body.instagram !== "" && !urlPattern.test(String(body.instagram))) {
      return NextResponse.json({ 
        error: "Invalid Instagram URL format",
        field: "instagram",
        reason: "INVALID_FORMAT",
        message: "URL must start with http:// or https:// (e.g., https://instagram.com/username)"
      }, { status: 400 });
    }
    if (body.youtube !== undefined && body.youtube !== null && body.youtube !== "" && !urlPattern.test(String(body.youtube))) {
      return NextResponse.json({ 
        error: "Invalid YouTube URL format",
        field: "youtube",
        reason: "INVALID_FORMAT",
        message: "URL must start with http:// or https:// (e.g., https://youtube.com/username)"
      }, { status: 400 });
    }
    if (body.linkedin !== undefined && body.linkedin !== null && body.linkedin !== "" && !urlPattern.test(String(body.linkedin))) {
      return NextResponse.json({ 
        error: "Invalid LinkedIn URL format",
        field: "linkedin",
        reason: "INVALID_FORMAT",
        message: "URL must start with http:// or https:// (e.g., https://linkedin.com/in/username)"
      }, { status: 400 });
    }

    // Password validation will happen later when we determine if it needs to be updated

    // Prepare values for each allowed field
    const cleanValue = (key: string, value: unknown): unknown => {
      if (value === null || value === undefined || value === "") return null;
      
      // Handle boolean fields
      if (key === "contactno1show" || key === "personalemailshow" || key === "alumni_consent_info") {
        if (value === null || value === undefined || value === "") return null;
        return value === true || value === "true" || value === 1 || value === "1";
      }
      
      // Handle CGPA as number
      if (key === "cgpa") {
        const num = parseFloat(String(value));
        return isNaN(num) ? null : num;
      }
      
      // Handle string fields with length constraints
      let strValue = String(value).trim();
      
      if (key === "employeed") {
        if (strValue === "Employed" || strValue === "Employed/Business") {
          strValue = "Employed";
        } else if (strValue === "Self-Emplo") {
          strValue = "Self-Employed/Enterpreneur";
        } else if (strValue.toLowerCase() === "highered") {
          strValue = "Pursuing Higher Education";
        } else if (
          strValue === "Self-Employed" ||
          strValue === "Self employed" ||
          strValue === "Self-employed" ||
          strValue === "Self-Employed/Enterpreneur"
        ) {
          strValue = "Self-Employed/Enterpreneur";
        } else if (strValue === "Unemployed(By Choice)" || strValue === "Unemployed By choice") {
          strValue = "Unemployed(By Choice)";
        } else if (
          strValue === "Unemployed (Searching for Job)" ||
          strValue === "Unemployed(Searching for Job)" ||
          strValue === "Unemployed (Searching Job)" ||
          strValue === "Unemployed, searching for job" ||
          strValue === "Unemployed(Searching for job))"
        ) {
          strValue = "Unemployed(Searching for job)";
        }
      }
      
      if (key === "totalyearsofexpereince" && strValue.length > 10) {
        strValue = strValue.substring(0, 10);
      }
      
      return strValue;
    };

    // Prepare values for each allowed field
    // Admins can update sapid and registrationno, regular users cannot
    const sapidVal = isAdmin && "sapid" in body ? cleanValue("sapid", body.sapid) : undefined;
    const registrationnoVal = isAdmin && "registrationno" in body ? cleanValue("registrationno", body.registrationno) : undefined;
    const alumninameVal = "alumniname" in body ? cleanValue("alumniname", body.alumniname) : undefined;
    const genderVal = "gender" in body ? cleanValue("gender", body.gender) : undefined;
    const fathernameVal = "fathername" in body ? cleanValue("fathername", body.fathername) : undefined;
    const dateofbirthVal = "dateofbirth" in body ? cleanValue("dateofbirth", body.dateofbirth) : undefined;
    const cnicpassportVal = "cnicpassport" in body ? cleanValue("cnicpassport", body.cnicpassport) : undefined;
    const maritalstatusVal = "maritalstatus" in body ? cleanValue("maritalstatus", body.maritalstatus) : undefined;
    const contactnoVal = "contactno" in body ? cleanValue("contactno", body.contactno) : undefined;
    const contactno1Val = "contactno1" in body ? cleanValue("contactno1", body.contactno1) : undefined;
    const contactno1showVal = "contactno1show" in body ? cleanValue("contactno1show", body.contactno1show) : undefined;
    const personalemailVal = "personalemail" in body ? cleanValue("personalemail", body.personalemail) : undefined;
    const personalemailshowVal = "personalemailshow" in body ? cleanValue("personalemailshow", body.personalemailshow) : undefined;
    const universityemailVal = "universityemail" in body ? cleanValue("universityemail", body.universityemail) : undefined;
    const officialemailVal = "officialemail" in body ? cleanValue("officialemail", body.officialemail) : undefined;
    const officialnumberVal = "officialnumber" in body ? cleanValue("officialnumber", body.officialnumber) : undefined;
    const workCityVal = "work_city" in body ? cleanValue("work_city", body.work_city) : undefined;
    const workCountryVal = "work_country" in body ? cleanValue("work_country", body.work_country) : undefined;
    const organizationAddressVal = "organization_address" in body ? cleanValue("organization_address", body.organization_address) : undefined;
    const countryVal = "country" in body ? cleanValue("country", body.country) : undefined;
    const provinceVal = "province" in body ? cleanValue("province", body.province) : undefined;
    const cityVal = "city" in body ? cleanValue("city", body.city) : undefined;
    const addressVal = "address" in body ? cleanValue("address", body.address) : undefined;
    const cgpaVal = "cgpa" in body ? cleanValue("cgpa", body.cgpa) : undefined;
    const employeedVal = "employeed" in body ? cleanValue("employeed", body.employeed) : undefined;
    const occupationTransitionTimingVal = "occupation_transition_timing" in body ? cleanValue("occupation_transition_timing", body.occupation_transition_timing) : undefined;
    const industryVal = "industry" in body ? cleanValue("industry", body.industry) : undefined;
    const nameoforganizationVal = "nameoforganization" in body ? cleanValue("nameoforganization", body.nameoforganization) : undefined;
    const designationVal = "designation" in body ? cleanValue("designation", body.designation) : undefined;
    const totalyearsofexpereinceVal = "totalyearsofexpereince" in body ? cleanValue("totalyearsofexpereince", body.totalyearsofexpereince) : undefined;
    const startOfCareerVal = "startOfCareer" in body ? (body.startOfCareer !== null && body.startOfCareer !== undefined && body.startOfCareer !== "" ? Number(body.startOfCareer) : null) : undefined;
    const majorsubjectVal = "majorsubject" in body ? cleanValue("majorsubject", body.majorsubject) : undefined;
    const aboutmeVal = "aboutme" in body ? cleanValue("aboutme", body.aboutme) : undefined;
    const aboutVal = "about" in body ? cleanValue("about", body.about) : undefined;
    const yearofstartingVal = "yearofstarting" in body ? (body.yearofstarting !== null && body.yearofstarting !== undefined && body.yearofstarting !== "" ? Number(body.yearofstarting) : null) : undefined;
    const yearofendingVal = "yearofending" in body ? (body.yearofending !== null && body.yearofending !== undefined && body.yearofending !== "" ? Number(body.yearofending) : null) : undefined;
    const facultynameVal = "facultyname" in body ? cleanValue("facultyname", body.facultyname) : undefined;
    const departmentnameVal = "departmentname" in body ? cleanValue("departmentname", body.departmentname) : undefined;
    const degreetitleVal = "degreetitle" in body ? cleanValue("degreetitle", body.degreetitle) : undefined;
    const campusnameVal = "campusname" in body ? cleanValue("campusname", body.campusname) : undefined;
    const datasourceVal = "datasource" in body ? cleanValue("datasource", body.datasource) : undefined;
    const alumnistatusVal = "alumnistatus" in body ? cleanValue("alumnistatus", body.alumnistatus) : undefined;
    const facebookVal = "facebook" in body ? cleanValue("facebook", body.facebook) : undefined;
    const instagramVal = "instagram" in body ? cleanValue("instagram", body.instagram) : undefined;
    const youtubeVal = "youtube" in body ? cleanValue("youtube", body.youtube) : undefined;
    const linkedinVal = "linkedin" in body ? cleanValue("linkedin", body.linkedin) : undefined;
    // Higher Education fields
    const degreeTitleVal = "degree_title" in body ? cleanValue("degree_title", body.degree_title) : undefined;
    const higherEducationInstituteNameVal = "higher_education_institute_name" in body ? cleanValue("higher_education_institute_name", body.higher_education_institute_name) : undefined;
    const higherEducationProgramVal = "higher_education_program" in body ? cleanValue("higher_education_program", body.higher_education_program) : undefined;
    const higherEducationInstituteCountryVal = "higher_education_institute_country" in body ? cleanValue("higher_education_institute_country", body.higher_education_institute_country) : undefined;
    const higherEducationInstituteCityVal = "higher_education_institute_city" in body ? cleanValue("higher_education_institute_city", body.higher_education_institute_city) : undefined;
    const isScholarshipVal = "is_scholarship" in body ? cleanValue("is_scholarship", body.is_scholarship) : undefined;
    // Association field
    let associationIdVal: number | null | undefined = undefined;
    if ("association_id" in body) {
      if (body.association_id === null || body.association_id === undefined || body.association_id === "") {
        associationIdVal = null;
      } else {
        const resolved = await resolveValidFacultyId(body.association_id);
        if (!resolved) {
          return NextResponse.json(
            { error: "Invalid association. Select a faculty from the list.", field: "association_id", reason: "INVALID_FK" },
            { status: 400 }
          );
        }
        associationIdVal = resolved;
      }
    }
    // System fields
    const verifyVal = "verify" in body ? cleanValue("verify", body.verify) : undefined;
    const lasttimeloginVal = undefined;
    const logincountVal = undefined;
    const createddatetimeVal = "createddatetime" in body ? cleanValue("createddatetime", body.createddatetime) : undefined;
    const academicsessionVal = "academicsession" in body ? cleanValue("academicsession", body.academicsession) : undefined;
    const fatherCnicVal = "father_cnic" in body ? cleanValue("father_cnic", body.father_cnic) : undefined;
    const categoryVal = "category" in body ? cleanValue("category", body.category) : undefined;
    const medalVal = "medal" in body ? cleanValue("medal", body.medal) : undefined;
    const medalDocumentVal = "medal_document" in body ? cleanValue("medal_document", body.medal_document) : undefined;
    // Consent field
    const alumniConsentInfoVal = "alumni_consent_info" in body ? cleanValue("alumni_consent_info", body.alumni_consent_info) : undefined;
    // Profile updated flag (admin-only)
    const profileUpdatedVal = isAdmin && "profile_updated" in body
      ? (body.profile_updated === true || body.profile_updated === "true" || body.profile_updated === 1 || body.profile_updated === "1")
      : undefined;
    // Chapter fields
    const chapter1IdVal = "chapter1_id" in body ? (body.chapter1_id !== null && body.chapter1_id !== undefined && body.chapter1_id !== "" ? Number(body.chapter1_id) : null) : undefined;
    const chapter2IdVal = "chapter2_id" in body ? (body.chapter2_id !== null && body.chapter2_id !== undefined && body.chapter2_id !== "" ? Number(body.chapter2_id) : null) : undefined;
    const chapter3IdVal = "chapter3_id" in body ? (body.chapter3_id !== null && body.chapter3_id !== undefined && body.chapter3_id !== "" ? Number(body.chapter3_id) : null) : undefined;
    // New foreign key fields (faculty, department, program)
    const facultyIdVal = "faculty" in body ? (body.faculty !== null && body.faculty !== undefined && body.faculty !== "" ? Number(body.faculty) : null) : undefined;
    const departmentIdVal = "department" in body ? (body.department !== null && body.department !== undefined && body.department !== "" ? Number(body.department) : null) : undefined;
    const programIdVal = "program" in body ? (body.program !== null && body.program !== undefined && body.program !== "" ? Number(body.program) : null) : undefined;
    
    // Handle password separately - store as plain text
    let passwordVal: string | undefined = undefined;
    if ("password" in body && body.password !== undefined && body.password !== null && body.password !== "") {
      if (!isAdmin) {
        return NextResponse.json({
          error: "Password cannot be changed from this screen. Use Change Password.",
          field: "password",
          reason: "FORBIDDEN",
        }, { status: 403 });
      }
      const passwordStr = String(body.password).trim();
      
      // Check if it's the same as current password
      const isSameAsCurrent = currentPassword && passwordStr === currentPassword;
      
      if (isSameAsCurrent) {
        // Password is same, skip update
      } else {
        // Password is different, validate minimum length (4 characters)
        if (passwordStr.length < 4) {
          return NextResponse.json({ 
            error: "Password must be at least 4 characters long",
            field: "password",
            reason: "MIN_LENGTH"
          }, { status: 400 });
        }
        passwordVal = passwordStr;
      }
    }

    // Check if at least one field is being updated
    const updateFields = {
      sapid: sapidVal,
      registrationno: registrationnoVal,
      alumniname: alumninameVal,
      gender: genderVal,
      fathername: fathernameVal,
      dateofbirth: dateofbirthVal,
      cnicpassport: cnicpassportVal,
      maritalstatus: maritalstatusVal,
      contactno: contactnoVal,
      contactno1: contactno1Val,
      contactno1show: contactno1showVal,
      personalemail: personalemailVal,
      personalemailshow: personalemailshowVal,
      universityemail: universityemailVal,
      officialemail: officialemailVal,
      officialnumber: officialnumberVal,
      work_city: workCityVal,
      work_country: workCountryVal,
      organization_address: organizationAddressVal,
      country: countryVal,
      province: provinceVal,
      city: cityVal,
      address: addressVal,
      cgpa: cgpaVal,
      employeed: employeedVal,
      occupation_transition_timing: occupationTransitionTimingVal,
      industry: industryVal,
      nameoforganization: nameoforganizationVal,
      designation: designationVal,
      totalyearsofexpereince: totalyearsofexpereinceVal,
      majorsubject: majorsubjectVal,
      aboutme: aboutmeVal,
      yearofstarting: yearofstartingVal,
      yearofending: yearofendingVal,
      facultyname: facultynameVal,
      departmentname: departmentnameVal,
      degreetitle: degreetitleVal,
      campusname: campusnameVal,
      datasource: datasourceVal,
      alumnistatus: alumnistatusVal,
      facebook: facebookVal,
      instagram: instagramVal,
      youtube: youtubeVal,
      linkedin: linkedinVal,
      password: passwordVal,
      degree_title: degreeTitleVal,
      higher_education_institute_name: higherEducationInstituteNameVal,
      higher_education_program: higherEducationProgramVal,
      higher_education_institute_country: higherEducationInstituteCountryVal,
      higher_education_institute_city: higherEducationInstituteCityVal,
      is_scholarship: isScholarshipVal,
      association_id: associationIdVal,
      verify: verifyVal,
      lasttimelogin: lasttimeloginVal,
      logincount: logincountVal,
      createddatetime: createddatetimeVal,
      academicsession: academicsessionVal,
      father_cnic: fatherCnicVal,
      category: categoryVal,
      medal: medalVal,
      medal_document: medalDocumentVal,
      alumni_consent_info: alumniConsentInfoVal,
      profile_updated: profileUpdatedVal,
      chapter1_id: chapter1IdVal,
      chapter2_id: chapter2IdVal,
      chapter3_id: chapter3IdVal,
      faculty: facultyIdVal,
      department: departmentIdVal,
      program: programIdVal,
    };
    
    const fieldsToUpdate = Object.entries(updateFields).filter(([, val]) => val !== undefined);
    if (fieldsToUpdate.length === 0) {
      // Return success if no fields need updating (all values are the same as current)
      return NextResponse.json({ 
        ok: true, 
        updated: { alumniid: Number(row.alumniid), sapid: String(row.sapid) },
        message: "No changes to update"
      }, { status: 200 });
    }

    // Alumni change-approval workflow (do not apply updates immediately)
    if (!isAdmin) {
      const normalizeForCompare = (v: unknown): unknown => {
        if (v === undefined || v === null) return null;
        if (typeof v === "string") {
          const t = v.trim();
          return t.length === 0 ? null : t;
        }
        return v;
      };

      const currentAlumniRows = await sql/* sql */`
        SELECT a.*
        FROM public.tbl_alumni a
        WHERE a.alumniid = ${alumniId}
        LIMIT 1`;
      if (!currentAlumniRows[0]) {
        return NextResponse.json({ error: "Alumni not found" }, { status: 404 });
      }
      const currentAlumni = currentAlumniRows[0] as Record<string, unknown>;

      const currentChapterRows = await sql/* sql */`
        SELECT chapter1, chapter2, chapter3
        FROM public.alumni_chapter
        WHERE id = ${alumniId}
        LIMIT 1`;
      const currentChapters = (currentChapterRows[0] ?? { chapter1: null, chapter2: null, chapter3: null }) as {
        chapter1: number | null;
        chapter2: number | null;
        chapter3: number | null;
      };

      const proposed: Record<string, unknown> = {};
      for (const [k, v] of fieldsToUpdate) {
        proposed[k] = v;
      }

      // Compare only submitted keys and keep only truly changed fields
      const oldData: Record<string, unknown> = {};
      const newData: Record<string, unknown> = {};

      for (const [key, nextValRaw] of Object.entries(proposed)) {
        if (key === "updated_at") continue;
        if (key === "verify") continue;
        if (key === "password") continue;
        if (key === "image1" || key === "image2") continue;
        if (key === "chapter1_id" || key === "chapter2_id" || key === "chapter3_id") {
          const idx = key === "chapter1_id" ? "chapter1" : key === "chapter2_id" ? "chapter2" : "chapter3";
          const currentVal = (currentChapters as any)[idx] as unknown;
          const cur = normalizeForCompare(currentVal);
          const nxt = normalizeForCompare(nextValRaw);
          if (cur !== nxt) {
            oldData[key] = currentVal;
            newData[key] = nextValRaw;
          }
          continue;
        }

        const currentVal = currentAlumni[key];
        const cur = normalizeForCompare(currentVal);
        const nxt = normalizeForCompare(nextValRaw);
        if (cur !== nxt) {
          oldData[key] = currentVal ?? null;
          newData[key] = nextValRaw;
        }
      }

      if (Object.keys(newData).length === 0) {
        return NextResponse.json({
          ok: true,
          updated: { alumniid: Number(row.alumniid), sapid: String(row.sapid) },
          message: "No changes to submit",
        }, { status: 200 });
      }

      await sql.begin(async (tx) => {
        // Keep a single pending request per alumni; merge new changes into the existing pending one
        const existingPending = await tx/* sql */`
          SELECT id, old_data, new_data
          FROM public.tbl_alumni_change_requests
          WHERE alumni_id = ${alumniId} AND status = 'pending'
          ORDER BY created_at DESC
          LIMIT 1`;

        const pendingRow = existingPending[0] as undefined | { id: number; old_data?: unknown; new_data?: unknown };

        if (pendingRow?.id) {
          const existingOld = parseJsonbRecord(pendingRow.old_data);
          const existingNew = parseJsonbRecord(pendingRow.new_data);

          // Preserve original old values; only add old values for newly introduced keys.
          const mergedOld: Record<string, unknown> = { ...existingOld };
          for (const [k, v] of Object.entries(oldData)) {
            if (!(k in mergedOld)) mergedOld[k] = v;
          }

          // Always update the requested values for submitted keys.
          const mergedNew: Record<string, unknown> = { ...existingNew, ...newData };

          const oldDataJson = JSON.stringify(mergedOld);
          const newDataJson = JSON.stringify(mergedNew);

          await tx/* sql */`
            UPDATE public.tbl_alumni_change_requests
            SET old_data = ${oldDataJson}::jsonb,
                new_data = ${newDataJson}::jsonb,
                created_at = now(),
                approved_by = NULL,
                approved_at = NULL
            WHERE id = ${pendingRow.id}`;
        } else {
          const oldDataJson = JSON.stringify(oldData);
          const newDataJson = JSON.stringify(newData);

          await tx/* sql */`
            INSERT INTO public.tbl_alumni_change_requests (alumni_id, old_data, new_data, status)
            VALUES (${alumniId}, ${oldDataJson}::jsonb, ${newDataJson}::jsonb, 'pending')`;
        }

        await tx/* sql */`
          UPDATE public.tbl_alumni
          SET change_approval = 'pending'
          WHERE alumniid = ${alumniId}`;
      });

      return NextResponse.json({
        ok: true,
        updated: { alumniid: Number(row.alumniid), sapid: String(row.sapid) },
        message: "Changes submitted for approval",
        change_approval: "pending",
      }, { status: 200 });
    }

    const updatedAt = new Date().toISOString().split("T")[0];

    // Build a single optimized UPDATE query instead of multiple individual updates
    // Use alumniid (primary key) for WHERE clause to ensure we update the correct record
    const result = await sql.begin(async (tx) => {
      // Collect all fields that need to be updated
      const updates: Array<[string, unknown]> = [];
      
      // Helper to add field to update list
      const addUpdate = (fieldName: string, value: unknown) => {
        if (value !== undefined) {
          updates.push([fieldName, value]);
        }
      };
      
      // If faculty ID is being updated and facultyname is not explicitly provided, fetch and update facultyname
      if (facultyIdVal !== undefined && facultyIdVal !== null && facultynameVal === undefined) {
        try {
          const facultyRow = await tx`SELECT faculty_name FROM public.tbl_faculties WHERE id = ${facultyIdVal}`;
          if (facultyRow && facultyRow.length > 0) {
            addUpdate("facultyname", facultyRow[0].faculty_name);
          }
        } catch (err) {
        }
      }
      
      // If department ID is being updated and departmentname is not explicitly provided, fetch and update departmentname
      if (departmentIdVal !== undefined && departmentIdVal !== null && departmentnameVal === undefined) {
        try {
          const deptRow = await tx`SELECT department_name FROM public.tbl_departments WHERE id = ${departmentIdVal}`;
          if (deptRow && deptRow.length > 0) {
            addUpdate("departmentname", deptRow[0].department_name);
          }
        } catch (err) {
        }
      }
      
      // If program ID is being updated and degreetitle is not explicitly provided, fetch and update degreetitle
      if (programIdVal !== undefined && programIdVal !== null && degreetitleVal === undefined) {
        try {
          const programRow = await tx`SELECT program_name FROM public.tbl_programs WHERE id = ${programIdVal}`;
          if (programRow && programRow.length > 0) {
            addUpdate("degreetitle", programRow[0].program_name);
          }
        } catch (err) {
        }
      }
      
      // Add all fields that need updating
      addUpdate("sapid", sapidVal);
      addUpdate("registrationno", registrationnoVal);
      addUpdate("alumniname", alumninameVal);
      addUpdate("gender", genderVal);
      addUpdate("fathername", fathernameVal);
      addUpdate("dateofbirth", dateofbirthVal);
      addUpdate("cnicpassport", cnicpassportVal);
      addUpdate("maritalstatus", maritalstatusVal);
      addUpdate("contactno", contactnoVal);
      addUpdate("contactno1", contactno1Val);
      addUpdate("contactno1show", contactno1showVal);
      addUpdate("personalemail", personalemailVal);
      addUpdate("personalemailshow", personalemailshowVal);
      addUpdate("universityemail", universityemailVal);
      addUpdate("officialemail", officialemailVal);
      addUpdate("officialnumber", officialnumberVal);
      addUpdate("work_city", workCityVal);
      addUpdate("work_country", workCountryVal);
      addUpdate("organization_address", organizationAddressVal);
      addUpdate("country", countryVal);
      addUpdate("province", provinceVal);
      addUpdate("city", cityVal);
      addUpdate("address", addressVal);
      addUpdate("cgpa", cgpaVal);
      addUpdate("employeed", employeedVal);
      addUpdate("occupation_transition_timing", occupationTransitionTimingVal);
      addUpdate("industry", industryVal);
      addUpdate("nameoforganization", nameoforganizationVal);
      addUpdate("designation", designationVal);
      // Handle totalyearsofexpereince: prioritize startOfCareer if provided
      if (startOfCareerVal !== undefined && startOfCareerVal !== null) {
        // If startOfCareer is provided, calculate totalyearsofexpereince from it
        const currentYear = new Date().getFullYear();
        const calculatedYears = currentYear - startOfCareerVal;
        if (calculatedYears > 0) {
          addUpdate("totalyearsofexpereince", String(calculatedYears));
        }
      } else if (totalyearsofexpereinceVal !== undefined) {
        // Only add totalyearsofexpereince if startOfCareer is not provided
        addUpdate("totalyearsofexpereince", totalyearsofexpereinceVal);
      }
      addUpdate("majorsubject", majorsubjectVal);
      addUpdate("aboutme", aboutmeVal);
      addUpdate("about", aboutVal);
      addUpdate("yearofstarting", yearofstartingVal);
      addUpdate("yearofending", yearofendingVal);
      addUpdate("facultyname", facultynameVal);
      addUpdate("departmentname", departmentnameVal);
      addUpdate("degreetitle", degreetitleVal);
      addUpdate("campusname", campusnameVal);
      addUpdate("datasource", datasourceVal);
      addUpdate("alumnistatus", alumnistatusVal);
      addUpdate("facebook", facebookVal);
      addUpdate("instagram", instagramVal);
      addUpdate("youtube", youtubeVal);
      addUpdate("linkedin", linkedinVal);
      addUpdate("degree_title", degreeTitleVal);
      addUpdate("higher_education_institute_name", higherEducationInstituteNameVal);
      addUpdate("higher_education_program", higherEducationProgramVal);
      addUpdate("higher_education_institute_country", higherEducationInstituteCountryVal);
      addUpdate("higher_education_institute_city", higherEducationInstituteCityVal);
      addUpdate("is_scholarship", isScholarshipVal);
      addUpdate("association_id", associationIdVal);
      addUpdate("verify", verifyVal);
      addUpdate("lasttimelogin", lasttimeloginVal);
      addUpdate("logincount", logincountVal);
      addUpdate("createddatetime", createddatetimeVal);
      addUpdate("academicsession", academicsessionVal);
      addUpdate("father_cnic", fatherCnicVal);
      addUpdate("category", categoryVal);
      addUpdate("medal", medalVal);
      addUpdate("medal_document", medalDocumentVal);
      addUpdate("alumni_consent_info", alumniConsentInfoVal);
      addUpdate("profile_updated", profileUpdatedVal);
      addUpdate("faculty", facultyIdVal);
      addUpdate("department", departmentIdVal);
      addUpdate("program", programIdVal);
      addUpdate("updated_at", updatedAt);
      
      // Execute single UPDATE query if there are fields to update
      if (updates.length > 0) {
        // Build SET clause with parameterized values - quote column names to handle special characters
        const setClause = updates.map(([field], idx) => `"${field}" = $${idx + 1}`).join(", ");
        const values = updates.map(([, val]) => val) as (string | number | boolean | null)[];
        
        // Execute single UPDATE query using tx.unsafe for dynamic queries
        const updateQuery = `UPDATE public.tbl_alumni SET ${setClause} WHERE alumniid = $${updates.length + 1} RETURNING alumniid, sapid, registrationno`;
        await tx.unsafe(updateQuery, [...values, alumniId] as (string | number | boolean | null)[]);
      }
      
      // Handle password update separately (if needed) - keep separate for security/logging
      if (passwordVal !== undefined) {
        await tx`UPDATE public.tbl_alumni SET password = ${passwordVal as string} WHERE alumniid = ${alumniId}`;
        // Verify the update
        const verify = await tx`SELECT password FROM public.tbl_alumni WHERE alumniid = ${alumniId} LIMIT 1`;
      }
      
      // Update chapters in alumni_chapter table
      if (chapter1IdVal !== undefined || chapter2IdVal !== undefined || chapter3IdVal !== undefined) {
        // Check if alumni_chapter record exists
        const existingChapter = await tx`
          SELECT id FROM public.alumni_chapter WHERE id = ${alumniId} LIMIT 1
        `;
        
        if (existingChapter[0]) {
          // Update existing record - get current values first
          const currentChapter = await tx`
            SELECT chapter1, chapter2, chapter3 FROM public.alumni_chapter WHERE id = ${alumniId} LIMIT 1
          `;
          const current = currentChapter[0] as { chapter1: number | null; chapter2: number | null; chapter3: number | null } | undefined;
          
          const finalChapter1 = chapter1IdVal !== undefined ? chapter1IdVal : (current?.chapter1 ?? null);
          const finalChapter2 = chapter2IdVal !== undefined ? chapter2IdVal : (current?.chapter2 ?? null);
          const finalChapter3 = chapter3IdVal !== undefined ? chapter3IdVal : (current?.chapter3 ?? null);
          
          await tx`
            UPDATE public.alumni_chapter 
            SET chapter1 = ${finalChapter1}, chapter2 = ${finalChapter2}, chapter3 = ${finalChapter3}
            WHERE id = ${alumniId}
          `;
        } else {
          // Create new record
          const finalChapter1 = chapter1IdVal !== undefined ? chapter1IdVal : null;
          const finalChapter2 = chapter2IdVal !== undefined ? chapter2IdVal : null;
          const finalChapter3 = chapter3IdVal !== undefined ? chapter3IdVal : null;
          
          await tx`
            INSERT INTO public.alumni_chapter (id, chapter1, chapter2, chapter3)
            VALUES (${alumniId}, ${finalChapter1}, ${finalChapter2}, ${finalChapter3})
          `;
        }
      }
      
      // Return the updated record using alumniid (primary key)
      const updated = await tx`
        SELECT alumniid, sapid, registrationno FROM public.tbl_alumni WHERE alumniid = ${alumniId} LIMIT 1
      `;
      return updated[0];
    });

    if (!result) {
      return NextResponse.json({ error: "Failed to update" }, { status: 500 });
    }

    await logAdminAction({
      session,
      req,
      input: {
        action: "alumni.update_fields",
        entityType: "tbl_alumni",
        entityId: (result as any).alumniid,
        metadata: {
          sapid: (result as any).sapid,
          registrationno: (result as any).registrationno,
          passwordChanged: body.password !== undefined,
          actorMode: isAdmin ? "admin" : "alumni",
        },
      },
    });

    return NextResponse.json({ 
      ok: true, 
      updated: result as { alumniid: number; sapid: string },
      message: "Profile updated successfully"
    }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update profile";
    return NextResponse.json({ 
      error: message,
      details: err instanceof Error ? err.stack : String(err)
    }, { status: 500 });
  }
}

