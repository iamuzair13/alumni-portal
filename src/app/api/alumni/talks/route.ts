import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { validatePayload } from "./validation";
import { sendMentorshipApplicationEmail } from "@/lib/email";
import { buildAccessFilterSQL } from "@/lib/userAccess";

export async function GET(req: Request) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Build access filter for admin/viewer users
    let accessFilter;
    try {
      accessFilter = await buildAccessFilterSQL(session, "");
    } catch (filterError) {

      return NextResponse.json({ 
        error: "Failed to build access filter", 
        details: filterError instanceof Error ? filterError.message : String(filterError) 
      }, { status: 500 });
    }
    
    const accessFilterCondition = accessFilter.hasFilter && accessFilter.sql ? sql` AND (${accessFilter.sql})` : sql``;

    const { searchParams } = new URL(req.url);
    const sapidParam = String(searchParams.get("sapid") || "").trim();
    const sapidCondition = sapidParam
      ? sql` AND (a.sapid = ${sapidParam} OR a.registrationno = ${sapidParam})`
      : sql``;
    
    let rows;
    try {
      // Use t.* to avoid runtime failures if optional columns (day/week/month) don't exist in a given DB.
      rows = await sql/* sql */`
      SELECT 
        a.sapid,
        a.registrationno,
        a.alumniname,
        a.departmentname,
        a.facultyname,
        a.degreetitle,
        a.personalemail,
        a.officialemail,
        a.universityemail,
          t.*
      FROM public.tbl_alumni a
        INNER JOIN public.tblalumnitalks t ON t.alumniid = a.alumniid
        WHERE (
          (a.sapid IS NOT NULL AND a.sapid != '')
          OR (a.registrationno IS NOT NULL AND a.registrationno != '')
        )
        ${sapidCondition}
        ${accessFilterCondition}
        ORDER BY t.alumniid DESC
      `;
    } catch (queryError) {

      return NextResponse.json({ 
        error: "Failed to fetch talks", 
        details: queryError instanceof Error ? queryError.message : String(queryError) 
      }, { status: 500 });
    }
    const typedRows = rows as unknown as Array<Record<string, unknown> & {
      sapid: string;
      registrationno: string | null;
      alumniname: string;
      departmentname: string | null;
      facultyname: string | null;
      degreetitle: string | null;
      personalemail: string | null;
      officialemail: string | null;
      universityemail: string | null;
      alumnitalks?: string | null;
      mentorshipprogram?: string | null;
      topic?: string | null;
      activity?: string | null;
      linkedin?: string | null;
      mode?: string | null;
      brief_outline?: string | null;
      date_1?: string | null;
      timings_1?: string | null;
      date_2?: string | null;
      timings_2?: string | null;
      date_3?: string | null;
      timings_3?: string | null;
      day_2?: string | null;
      day_3?: string | null;
      week_1?: string | null;
      week_2?: string | null;
      week_3?: string | null;
      month_1?: string | null;
      month_2?: string | null;
      month_3?: string | null;
    }>;
    const items = typedRows.map((r) => ({
      sapid: r.sapid,
      registrationNo: r.registrationno,
      name: r.alumniname,
      department: r.departmentname,
      faculty: r.facultyname,
      program: r.degreetitle || null,
      email: r.personalemail || r.officialemail || r.universityemail,
      alumnitalks: (r.alumnitalks ?? null) as string | null,
      mentorshipprogram: (r.mentorshipprogram ?? null) as string | null,
      topics: String(r.topic ?? "").split(/[,|]/).map((s) => s.trim()).filter(Boolean),
      areas: String(r.activity ?? "").split(/[,|]/).map((s) => s.trim()).filter(Boolean),
      linkedin: (r.linkedin ?? null) as string | null,
      mode: (r.mode ?? null) as string | null,
      briefOutline: (r.brief_outline ?? null) as string | null,
      // Availability dates and timings
      date1: (r.date_1 ?? null) as string | null,
      timings1: (r.timings_1 ?? null) as string | null,
      date2: (r.date_2 ?? null) as string | null,
      timings2: (r.timings_2 ?? null) as string | null,
      date3: (r.date_3 ?? null) as string | null,
      timings3: (r.timings_3 ?? null) as string | null,
      // Day variations
      day2: (r.day_2 ?? null) as string | null,
      day3: (r.day_3 ?? null) as string | null,
      // Week variations
      week1: (r.week_1 ?? null) as string | null,
      week2: (r.week_2 ?? null) as string | null,
      week3: (r.week_3 ?? null) as string | null,
      // Month variations
      month1: (r.month_1 ?? null) as string | null,
      month2: (r.month_2 ?? null) as string | null,
      month3: (r.month_3 ?? null) as string | null,
    }));
    return NextResponse.json({ items }, { status: 200 });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const errorStack = err instanceof Error ? err.stack : undefined;

    return NextResponse.json({ 
      error: "Failed to fetch talks",
      message: errorMessage 
    }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }
    
    const email = session.user.email ? String(session.user.email) : null;
    const userSapid = session.user ? ((session.user as { sapid?: string | null })?.sapid ? String((session.user as { sapid?: string | null }).sapid).trim() : null) : null;
    const userRegNo = session.user ? ((session.user as { registrationno?: string | null })?.registrationno ? String((session.user as { registrationno?: string | null }).registrationno).trim() : null) : null;
    
    if (!email && !userSapid && !userRegNo) {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }
    
    const body = await req.json();
    const v = validatePayload(body);
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

    // Try to find alumni by SAP ID first (more reliable), then by registration number, then by email
    let alumRows: Array<{ alumniid: number; facultyname: string | null; degreetitle: string | null; departmentname: string | null; linkedin?: string | null }> = [];
    
    if (userSapid) {
      alumRows = await sql/* sql */`
        SELECT alumniid, facultyname, degreetitle, departmentname, linkedin FROM public.tbl_alumni 
        WHERE sapid = ${userSapid}
        LIMIT 1`;
    }
    
    // If not found by SAP ID, try by registration number
    if (alumRows.length === 0 && userRegNo) {
      alumRows = await sql/* sql */`
        SELECT alumniid, facultyname, degreetitle, departmentname, linkedin FROM public.tbl_alumni 
        WHERE registrationno = ${userRegNo}
        LIMIT 1`;
    }
    
    // If not found by SAP ID or registration number, try by email
    if (alumRows.length === 0 && email) {
      alumRows = await sql/* sql */`
        SELECT alumniid, facultyname, degreetitle, departmentname, linkedin FROM public.tbl_alumni 
        WHERE personalemail = ${email} OR officialemail = ${email} OR universityemail = ${email} OR alumniemail = ${email}
        ORDER BY alumniid DESC LIMIT 1`;
    }
    
    const alum = alumRows[0] as { alumniid: number; facultyname: string | null; degreetitle: string | null; departmentname: string | null; linkedin?: string | null } | undefined;
    if (!alum?.alumniid) {

      return NextResponse.json({ error: "ALUMNI_NOT_FOUND", message: "Your alumni record was not found. Please ensure you are logged in with the correct account." }, { status: 404 });
    }

    const topicStr = v.data.topics.join(", ").slice(0, 500);
    const activityStr = v.data.areas.join(", ").slice(0, 50);
    const majorStr = v.data.major.slice(0, 100);
    const modeStr = v.data.mode;
    const briefOutlineStr = v.data.briefOutline.slice(0, 5000);
    
    // Extract availability dates (up to 3)
    const availability = v.data.availability.slice(0, 3);
    const date1 = availability[0]?.date || null;
    const timings1 = availability[0]?.timings || null;
    const date2 = availability[1]?.date || null;
    const timings2 = availability[1]?.timings || null;
    const date3 = availability[2]?.date || null;
    const timings3 = availability[2]?.timings || null;

    await sql.begin(async (tx) => {
      await tx/* sql */`UPDATE public.tbl_alumni SET majorsubject = ${majorStr} WHERE alumniid = ${alum.alumniid}`;
      await tx/* sql */`INSERT INTO public.tblalumnitalks (
        alumniid, alumnitalks, mentorshipprogram, topic, activity, linkedin, mode, brief_outline,
        date_1, timings_1, date_2, timings_2, date_3, timings_3
      ) VALUES (
        ${alum.alumniid}, ${"yes"}, ${"yes"}, ${topicStr}, ${activityStr}, ${alum.linkedin ?? null},
        ${modeStr}, ${briefOutlineStr},
        ${date1}, ${timings1}, ${date2}, ${timings2}, ${date3}, ${timings3}
      )`;
    });

    // Send confirmation email
    try {
      const alumniRows = await sql/* sql */`
        SELECT alumniname, personalemail, officialemail, universityemail
        FROM public.tbl_alumni 
        WHERE alumniid = ${alum.alumniid}
        LIMIT 1
      `;
      const alumniInfo = alumniRows[0] as {
        alumniname: string | null;
        personalemail: string | null;
        officialemail: string | null;
        universityemail: string | null;
      } | undefined;
      
      if (alumniInfo) {
        const alumniEmail = alumniInfo.personalemail || alumniInfo.officialemail || alumniInfo.universityemail || email;
        const alumniName = alumniInfo.alumniname || "Alumni";
        
        if (alumniEmail) {
          // Format availability dates for email
          const availabilityText = availability
            .map((avail, idx) => {
              const [start, end] = avail.timings.split("-");
              return `Date ${idx + 1}: ${avail.date} (${start} - ${end})`;
            })
            .join("\n");
          
          // Send email asynchronously (don't wait for it to complete)
          sendMentorshipApplicationEmail(
            alumniEmail,
            alumniName,
            majorStr,
            activityStr, // This is years of experience
            topicStr,
            modeStr,
            availabilityText
          ).catch((err) => {

          });
        }
      }
    } catch (emailError) {
      // Don't fail the request if email fails

    }

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to submit";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    
    const email = session.user.email ? String(session.user.email) : null;
    const userSapid = session.user ? ((session.user as { sapid?: string | null })?.sapid ? String((session.user as { sapid?: string | null }).sapid).trim() : null) : null;
    const userRegNo = session.user ? ((session.user as { registrationno?: string | null })?.registrationno ? String((session.user as { registrationno?: string | null }).registrationno).trim() : null) : null;
    
    if (!email && !userSapid && !userRegNo) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    
    const body = await req.json();
    const v = validatePayload(body);
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
    
    // Try to find alumni by SAP ID first, then by registration number, then by email
    let alumRows: Array<{ alumniid: number; sapid: string | null; registrationno: string | null; personalemail: string | null; universityemail: string | null; officialemail: string | null }> = [];
    
    if (userSapid) {
      alumRows = await sql/* sql */`
        SELECT alumniid, sapid, registrationno, personalemail, universityemail, officialemail FROM public.tbl_alumni WHERE sapid = ${userSapid} LIMIT 1`;
    }
    
    // If not found by SAP ID, try by registration number
    if (alumRows.length === 0 && userRegNo) {
      alumRows = await sql/* sql */`
        SELECT alumniid, sapid, registrationno, personalemail, universityemail, officialemail FROM public.tbl_alumni WHERE registrationno = ${userRegNo} LIMIT 1`;
    }
    
    if (alumRows.length === 0 && email) {
      alumRows = await sql/* sql */`
        SELECT alumniid, sapid, personalemail, universityemail, officialemail FROM public.tbl_alumni WHERE personalemail = ${email} OR officialemail = ${email} OR universityemail = ${email} OR alumniemail = ${email}
        ORDER BY alumniid DESC LIMIT 1`;
    }
    
    const alumniid = alumRows[0]?.alumniid as number | undefined;
    if (!alumniid) return NextResponse.json({ error: "ALUMNI_NOT_FOUND" }, { status: 404 });
    
    // SECURITY: Check if user is admin/superadmin or owns this alumni record
    const { canModify } = await import("@/lib/alumniProfile");
    const isAdmin = canModify(session.user);
    
    if (!isAdmin) {
      // If not admin, verify ownership
      const row = alumRows[0];
      const isOwnerBySapid = userSapid && row.sapid && userSapid.toLowerCase().trim() === row.sapid.toLowerCase().trim();
      const isOwnerByRegNo = userRegNo && row.registrationno && userRegNo.toLowerCase().trim() === String(row.registrationno ?? "").toLowerCase().trim();
      const isOwnerByEmail = email && (
        (row.personalemail && row.personalemail.toLowerCase().trim() === email.toLowerCase().trim()) ||
        (row.universityemail && row.universityemail.toLowerCase().trim() === email.toLowerCase().trim()) ||
        (row.officialemail && row.officialemail.toLowerCase().trim() === email.toLowerCase().trim())
      );
      
      if (!isOwnerBySapid && !isOwnerByRegNo && !isOwnerByEmail) {
        return NextResponse.json({ error: "Forbidden: You can only update your own talks" }, { status: 403 });
      }
    } else {
      // For admin/viewer users, check access filter
      const { buildAccessFilterSQL } = await import("@/lib/userAccess");
      const accessFilter = await buildAccessFilterSQL(session, "");
      
      if (accessFilter.hasFilter && accessFilter.sql) {
        const accessCheck = await sql/* sql */`
          SELECT alumniid FROM public.tbl_alumni 
          WHERE alumniid = ${alumniid} 
          AND (${accessFilter.sql})
          LIMIT 1
        `;
        
        if (!accessCheck[0]) {
          return NextResponse.json({ error: "Forbidden: You don't have access to this alumni record" }, { status: 403 });
        }
      }
    }
    const topicStr = v.data.topics.join(", ").slice(0, 500);
    const activityStr = v.data.areas.join(", ").slice(0, 50);
    const majorStr = v.data.major.slice(0, 100);
    const modeStr = v.data.mode;
    const briefOutlineStr = v.data.briefOutline.slice(0, 5000);
    
    // Extract availability dates (up to 3)
    const availability = v.data.availability.slice(0, 3);
    const date1 = availability[0]?.date || null;
    const timings1 = availability[0]?.timings || null;
    const date2 = availability[1]?.date || null;
    const timings2 = availability[1]?.timings || null;
    const date3 = availability[2]?.date || null;
    const timings3 = availability[2]?.timings || null;
    
    await sql.begin(async (tx) => {
      await tx/* sql */`UPDATE public.tbl_alumni SET majorsubject = ${majorStr} WHERE alumniid = ${alumniid}`;
      await tx/* sql */`UPDATE public.tblalumnitalks SET 
        topic = ${topicStr}, 
        activity = ${activityStr},
        mode = ${modeStr},
        brief_outline = ${briefOutlineStr},
        date_1 = ${date1},
        timings_1 = ${timings1},
        date_2 = ${date2},
        timings_2 = ${timings2},
        date_3 = ${date3},
        timings_3 = ${timings3}
      WHERE alumniid = ${alumniid}`;
    });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to update";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    
    // SECURITY: Only admins/superadmins can delete talks (viewers and alumni cannot)
    const { canModify } = await import("@/lib/alumniProfile");
    if (!canModify(session.user)) {
      return NextResponse.json({ error: "Forbidden: Only admins can delete talks" }, { status: 403 });
    }
    
    const url = new URL(req.url);
    const maybeSapId = url.searchParams.get("sapid");
    
    if (maybeSapId) {
      const arows = await sql/* sql */`
        SELECT alumniid FROM public.tbl_alumni WHERE sapid = ${maybeSapId} OR registrationno = ${maybeSapId} LIMIT 1`;
      const aid = arows[0]?.alumniid as number | undefined;
      if (!aid) return NextResponse.json({ error: "ALUMNI_NOT_FOUND" }, { status: 404 });
      
      // SECURITY: Check access filter for admin/viewer users
      const { buildAccessFilterSQL } = await import("@/lib/userAccess");
      const accessFilter = await buildAccessFilterSQL(session, "");
      
      if (accessFilter.hasFilter && accessFilter.sql) {
        const accessCheck = await sql/* sql */`
          SELECT alumniid FROM public.tbl_alumni 
          WHERE alumniid = ${aid} 
          AND (${accessFilter.sql})
          LIMIT 1
        `;
        
        if (!accessCheck[0]) {
          return NextResponse.json({ error: "Forbidden: You don't have access to this alumni record" }, { status: 403 });
        }
      }
      
      await sql/* sql */`DELETE FROM public.tblalumnitalks WHERE alumniid = ${aid}`;
      return NextResponse.json({ ok: true }, { status: 200 });
    }
    
    // If no sapid parameter, this endpoint should not be used (require sapid parameter)
    return NextResponse.json({ error: "SAP ID parameter is required" }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to delete";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}