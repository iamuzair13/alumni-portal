import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { isAdminUser } from "@/lib/alumniProfile";

export async function PUT(req: Request, ctx: { params: Promise<{ sapid: string }> }) {
  try {
    const { sapid } = await ctx.params;
    const session = await auth();
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify alumni exists and user has access
    const rows = await sql/* sql */`
      SELECT alumniid, personalemail, universityemail, officialemail FROM public.tbl_alumni WHERE sapid = ${sapid} LIMIT 1`;
    
    if (!rows[0]) {
      return NextResponse.json({ error: "Alumni not found" }, { status: 404 });
    }

    const row = rows[0] as Record<string, unknown>;
    const userEmail = String(session.user.email);
    const isOwner = 
      row.personalemail === userEmail ||
      row.universityemail === userEmail ||
      row.officialemail === userEmail;

    if (!isOwner && !isAdminUser(session?.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    
    // Validate email format if email fields are being updated
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (body.personalemail !== undefined && body.personalemail !== null && body.personalemail !== "" && !emailPattern.test(String(body.personalemail))) {
      return NextResponse.json({ error: "Invalid personal email format" }, { status: 400 });
    }
    if (body.universityemail !== undefined && body.universityemail !== null && body.universityemail !== "" && !emailPattern.test(String(body.universityemail))) {
      return NextResponse.json({ error: "Invalid university email format" }, { status: 400 });
    }
    if (body.officialemail !== undefined && body.officialemail !== null && body.officialemail !== "" && !emailPattern.test(String(body.officialemail))) {
      return NextResponse.json({ error: "Invalid official email format" }, { status: 400 });
    }

    // Validate URL format for social media fields
    const urlPattern = /^https?:\/\/.+/;
    if (body.facebook !== undefined && body.facebook !== null && body.facebook !== "" && !urlPattern.test(String(body.facebook))) {
      return NextResponse.json({ error: "Invalid Facebook URL format. Must start with http:// or https://" }, { status: 400 });
    }
    if (body.instagram !== undefined && body.instagram !== null && body.instagram !== "" && !urlPattern.test(String(body.instagram))) {
      return NextResponse.json({ error: "Invalid Instagram URL format. Must start with http:// or https://" }, { status: 400 });
    }
    if (body.youtube !== undefined && body.youtube !== null && body.youtube !== "" && !urlPattern.test(String(body.youtube))) {
      return NextResponse.json({ error: "Invalid YouTube URL format. Must start with http:// or https://" }, { status: 400 });
    }
    if (body.linkedin !== undefined && body.linkedin !== null && body.linkedin !== "" && !urlPattern.test(String(body.linkedin))) {
      return NextResponse.json({ error: "Invalid LinkedIn URL format. Must start with http:// or https://" }, { status: 400 });
    }

    // Prepare values for each allowed field
    const cleanValue = (key: string, value: unknown): unknown => {
      if (value === null || value === undefined || value === "") return null;
      
      // Handle boolean fields
      if (key === "contactno1show" || key === "personalemailshow") {
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
        // Map "Pursuing Higher Education" to "HigherEd" for VARCHAR(10) constraint
        if (strValue === "Pursuing Higher Education") {
          strValue = "HigherEd";
        } else if (strValue.length > 10) {
          strValue = strValue.substring(0, 10);
        }
      }
      
      if (key === "totalyearsofexpereince" && strValue.length > 10) {
        strValue = strValue.substring(0, 10);
      }
      
      return strValue;
    };

    // Prepare values for each allowed field
    const maritalstatusVal = "maritalstatus" in body ? cleanValue("maritalstatus", body.maritalstatus) : undefined;
    const contactnoVal = "contactno" in body ? cleanValue("contactno", body.contactno) : undefined;
    const contactno1Val = "contactno1" in body ? cleanValue("contactno1", body.contactno1) : undefined;
    const contactno1showVal = "contactno1show" in body ? cleanValue("contactno1show", body.contactno1show) : undefined;
    const personalemailVal = "personalemail" in body ? cleanValue("personalemail", body.personalemail) : undefined;
    const personalemailshowVal = "personalemailshow" in body ? cleanValue("personalemailshow", body.personalemailshow) : undefined;
    const universityemailVal = "universityemail" in body ? cleanValue("universityemail", body.universityemail) : undefined;
    const officialemailVal = "officialemail" in body ? cleanValue("officialemail", body.officialemail) : undefined;
    const officialnumberVal = "officialnumber" in body ? cleanValue("officialnumber", body.officialnumber) : undefined;
    const countryVal = "country" in body ? cleanValue("country", body.country) : undefined;
    const provinceVal = "province" in body ? cleanValue("province", body.province) : undefined;
    const cityVal = "city" in body ? cleanValue("city", body.city) : undefined;
    const addressVal = "address" in body ? cleanValue("address", body.address) : undefined;
    const cgpaVal = "cgpa" in body ? cleanValue("cgpa", body.cgpa) : undefined;
    const employeedVal = "employeed" in body ? cleanValue("employeed", body.employeed) : undefined;
    const industryVal = "industry" in body ? cleanValue("industry", body.industry) : undefined;
    const nameoforganizationVal = "nameoforganization" in body ? cleanValue("nameoforganization", body.nameoforganization) : undefined;
    const designationVal = "designation" in body ? cleanValue("designation", body.designation) : undefined;
    const totalyearsofexpereinceVal = "totalyearsofexpereince" in body ? cleanValue("totalyearsofexpereince", body.totalyearsofexpereince) : undefined;
    const facebookVal = "facebook" in body ? cleanValue("facebook", body.facebook) : undefined;
    const instagramVal = "instagram" in body ? cleanValue("instagram", body.instagram) : undefined;
    const youtubeVal = "youtube" in body ? cleanValue("youtube", body.youtube) : undefined;
    const linkedinVal = "linkedin" in body ? cleanValue("linkedin", body.linkedin) : undefined;

    // Check if at least one field is being updated
    const hasUpdates = [
      maritalstatusVal, contactnoVal, contactno1Val, contactno1showVal,
      personalemailVal, personalemailshowVal, universityemailVal,
      officialemailVal, officialnumberVal, countryVal, provinceVal,
      cityVal, addressVal, cgpaVal, employeedVal, industryVal,
      nameoforganizationVal, designationVal, totalyearsofexpereinceVal,
      facebookVal, instagramVal, youtubeVal, linkedinVal
    ].some(val => val !== undefined);

    if (!hasUpdates) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    // Build the UPDATE query by executing individual updates in a transaction
    // This is safer and more reliable than building a dynamic query
    const result = await sql.begin(async (tx) => {
      // Execute individual UPDATE statements for each field
      if (maritalstatusVal !== undefined) {
        await tx`UPDATE public.tbl_alumni SET maritalstatus = ${maritalstatusVal as string | null} WHERE sapid = ${sapid}`;
      }
      if (contactnoVal !== undefined) {
        await tx`UPDATE public.tbl_alumni SET contactno = ${contactnoVal as string | null} WHERE sapid = ${sapid}`;
      }
      if (contactno1Val !== undefined) {
        await tx`UPDATE public.tbl_alumni SET contactno1 = ${contactno1Val as string | null} WHERE sapid = ${sapid}`;
      }
      if (contactno1showVal !== undefined) {
        await tx`UPDATE public.tbl_alumni SET contactno1show = ${contactno1showVal as boolean | null} WHERE sapid = ${sapid}`;
      }
      if (personalemailVal !== undefined) {
        await tx`UPDATE public.tbl_alumni SET personalemail = ${personalemailVal as string | null} WHERE sapid = ${sapid}`;
      }
      if (personalemailshowVal !== undefined) {
        await tx`UPDATE public.tbl_alumni SET personalemailshow = ${personalemailshowVal as boolean | null} WHERE sapid = ${sapid}`;
      }
      if (universityemailVal !== undefined) {
        await tx`UPDATE public.tbl_alumni SET universityemail = ${universityemailVal as string | null} WHERE sapid = ${sapid}`;
      }
      if (officialemailVal !== undefined) {
        await tx`UPDATE public.tbl_alumni SET officialemail = ${officialemailVal as string | null} WHERE sapid = ${sapid}`;
      }
      if (officialnumberVal !== undefined) {
        await tx`UPDATE public.tbl_alumni SET officialnumber = ${officialnumberVal as string | null} WHERE sapid = ${sapid}`;
      }
      if (countryVal !== undefined) {
        await tx`UPDATE public.tbl_alumni SET country = ${countryVal as string | null} WHERE sapid = ${sapid}`;
      }
      if (provinceVal !== undefined) {
        await tx`UPDATE public.tbl_alumni SET province = ${provinceVal as string | null} WHERE sapid = ${sapid}`;
      }
      if (cityVal !== undefined) {
        await tx`UPDATE public.tbl_alumni SET city = ${cityVal as string | null} WHERE sapid = ${sapid}`;
      }
      if (addressVal !== undefined) {
        await tx`UPDATE public.tbl_alumni SET address = ${addressVal as string | null} WHERE sapid = ${sapid}`;
      }
      if (cgpaVal !== undefined) {
        await tx`UPDATE public.tbl_alumni SET cgpa = ${cgpaVal as number | null} WHERE sapid = ${sapid}`;
      }
      if (employeedVal !== undefined) {
        await tx`UPDATE public.tbl_alumni SET employeed = ${employeedVal as string | null} WHERE sapid = ${sapid}`;
      }
      if (industryVal !== undefined) {
        await tx`UPDATE public.tbl_alumni SET industry = ${industryVal as string | null} WHERE sapid = ${sapid}`;
      }
      if (nameoforganizationVal !== undefined) {
        await tx`UPDATE public.tbl_alumni SET nameoforganization = ${nameoforganizationVal as string | null} WHERE sapid = ${sapid}`;
      }
      if (designationVal !== undefined) {
        await tx`UPDATE public.tbl_alumni SET designation = ${designationVal as string | null} WHERE sapid = ${sapid}`;
      }
      if (totalyearsofexpereinceVal !== undefined) {
        await tx`UPDATE public.tbl_alumni SET totalyearsofexpereince = ${totalyearsofexpereinceVal as string | null} WHERE sapid = ${sapid}`;
      }
      if (facebookVal !== undefined) {
        await tx`UPDATE public.tbl_alumni SET facebook = ${facebookVal as string | null} WHERE sapid = ${sapid}`;
      }
      if (instagramVal !== undefined) {
        await tx`UPDATE public.tbl_alumni SET instagram = ${instagramVal as string | null} WHERE sapid = ${sapid}`;
      }
      if (youtubeVal !== undefined) {
        await tx`UPDATE public.tbl_alumni SET youtube = ${youtubeVal as string | null} WHERE sapid = ${sapid}`;
      }
      if (linkedinVal !== undefined) {
        await tx`UPDATE public.tbl_alumni SET linkedin = ${linkedinVal as string | null} WHERE sapid = ${sapid}`;
      }
      
      // Return the updated record
      const updated = await tx`
        SELECT alumniid, sapid FROM public.tbl_alumni WHERE sapid = ${sapid} LIMIT 1
      `;
      return updated[0];
    });

    if (!result) {
      return NextResponse.json({ error: "Failed to update" }, { status: 500 });
    }

    return NextResponse.json({ 
      ok: true, 
      updated: result as { alumniid: number; sapid: string },
      message: "Profile updated successfully"
    }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update profile";
    console.error("[API] Update fields error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

