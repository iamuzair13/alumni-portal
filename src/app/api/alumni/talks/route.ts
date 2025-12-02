import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { validatePayload } from "./validation";
import { sendMentorshipApplicationEmail } from "@/lib/email";
import { buildAccessFilterSQL } from "@/lib/userAccess";

export async function GET() {
  try {
    const session = await auth();
    
    // Build access filter for admin/viewer users
    const accessFilter = await buildAccessFilterSQL(session, "");
    const accessFilterCondition = accessFilter.hasFilter && accessFilter.sql ? sql` AND (${accessFilter.sql})` : sql``;
    
    const rows = await sql/* sql */`
      SELECT 
        a.alumniid,
        a.sapid,
        a.alumniname,
        a.departmentname,
        a.facultyname,
        a.degreetitle,
        a.personalemail,
        a.officialemail,
        a.universityemail,
        t.topic,
        t.day,
        t.timings,
        t.activity
      FROM public.tbl_alumni a
      JOIN public.tblalumnitalks t ON t.alumniid = a.alumniid
      WHERE 1=1
        ${accessFilterCondition}
      ORDER BY t.alumniid DESC`;
    const typedRows = rows as unknown as {
      sapid: string;
      alumniname: string;
      departmentname: string | null;
      facultyname: string | null;
      degreetitle: string | null;
      personalemail: string | null;
      officialemail: string | null;
      universityemail: string | null;
      topic: string | null;
      day: string;
      timings: string;
      activity: string | null;
    }[];
    const items = typedRows.map((r) => ({
      sapid: r.sapid,
      name: r.alumniname,
      department: r.departmentname,
      faculty: r.facultyname,
      program: r.degreetitle || null,
      email: r.personalemail || r.officialemail || r.universityemail,
      topics: String(r.topic || "").split(/[,|]/).map((s) => s.trim()).filter(Boolean),
      areas: String(r.activity || "").split(/[,|]/).map((s) => s.trim()).filter(Boolean),
      day: r.day,
      time: r.timings,
    }));
    return NextResponse.json({ items }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch talks";
    return NextResponse.json({ error: msg }, { status: 500 });
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
    
    if (!email && !userSapid) {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }
    
    const body = await req.json();
    const v = validatePayload(body);
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

    // Try to find alumni by SAP ID first (more reliable), then by email
    let alumRows: Array<{ alumniid: number; facultyname: string | null; degreetitle: string | null; departmentname: string | null; linkedin?: string | null }> = [];
    
    if (userSapid) {
      alumRows = await sql/* sql */`
        SELECT alumniid, facultyname, degreetitle, departmentname, linkedin FROM public.tbl_alumni 
        WHERE sapid = ${userSapid}
        LIMIT 1`;
    }
    
    // If not found by SAP ID, try by email
    if (alumRows.length === 0 && email) {
      alumRows = await sql/* sql */`
        SELECT alumniid, facultyname, degreetitle, departmentname, linkedin FROM public.tbl_alumni 
        WHERE personalemail = ${email} OR officialemail = ${email} OR universityemail = ${email} OR alumniemail = ${email}
        ORDER BY alumniid DESC LIMIT 1`;
    }
    
    const alum = alumRows[0] as { alumniid: number; facultyname: string | null; degreetitle: string | null; departmentname: string | null; linkedin?: string | null } | undefined;
    if (!alum?.alumniid) {
      console.error("[API] Alumni not found. Email:", email, "SAP ID:", userSapid);
      return NextResponse.json({ error: "ALUMNI_NOT_FOUND", message: "Your alumni record was not found. Please ensure you are logged in with the correct account." }, { status: 404 });
    }

    const topicStr = v.data.topics.join(", ").slice(0, 500);
    const activityStr = v.data.areas.join(", ").slice(0, 50);
    const dayStr = v.data.day.slice(0, 20);
    const timeStr = v.data.time.slice(0, 20);
    const majorStr = v.data.major.slice(0, 100);

    await sql.begin(async (tx) => {
      await tx/* sql */`UPDATE public.tbl_alumni SET majorsubject = ${majorStr} WHERE alumniid = ${alum.alumniid}`;
      await tx/* sql */`INSERT INTO public.tblalumnitalks (alumniid, alumnitalks, mentorshipprogram, topic, day, timings, activity, linkedin) VALUES (
        ${alum.alumniid}, ${"yes"}, ${"yes"}, ${topicStr}, ${dayStr}, ${timeStr}, ${activityStr}, ${alum.linkedin ?? null}
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
          // Parse time string (format: "HH:MM-HH:MM")
          const timeParts = timeStr.split("-");
          const startTime = timeParts[0] || "";
          const endTime = timeParts[1] || "";
          
          // Send email asynchronously (don't wait for it to complete)
          sendMentorshipApplicationEmail(
            alumniEmail,
            alumniName,
            majorStr,
            activityStr, // This is years of experience
            topicStr,
            dayStr,
            `${startTime} - ${endTime}`
          ).catch((err) => {
            console.error("[API] Failed to send mentorship application email:", err);
          });
        }
      }
    } catch (emailError) {
      // Don't fail the request if email fails
      console.error("[API] Error sending mentorship application email:", emailError);
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
    
    if (!email && !userSapid) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    
    const body = await req.json();
    const v = validatePayload(body);
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
    
    // Try to find alumni by SAP ID first, then by email
    let alumRows: Array<{ alumniid: number; sapid: string | null; personalemail: string | null; universityemail: string | null; officialemail: string | null }> = [];
    
    if (userSapid) {
      alumRows = await sql/* sql */`
        SELECT alumniid, sapid, personalemail, universityemail, officialemail FROM public.tbl_alumni WHERE sapid = ${userSapid} LIMIT 1`;
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
      const isOwnerByEmail = email && (
        (row.personalemail && row.personalemail.toLowerCase().trim() === email.toLowerCase().trim()) ||
        (row.universityemail && row.universityemail.toLowerCase().trim() === email.toLowerCase().trim()) ||
        (row.officialemail && row.officialemail.toLowerCase().trim() === email.toLowerCase().trim())
      );
      
      if (!isOwnerBySapid && !isOwnerByEmail) {
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
    const dayStr = v.data.day.slice(0, 20);
    const timeStr = v.data.time.slice(0, 20);
    const majorStr = v.data.major.slice(0, 100);
    await sql.begin(async (tx) => {
      await tx/* sql */`UPDATE public.tbl_alumni SET majorsubject = ${majorStr} WHERE alumniid = ${alumniid}`;
      await tx/* sql */`UPDATE public.tblalumnitalks SET topic = ${topicStr}, day = ${dayStr}, timings = ${timeStr}, activity = ${activityStr} WHERE alumniid = ${alumniid}`;
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
        SELECT alumniid FROM public.tbl_alumni WHERE sapid = ${maybeSapId} LIMIT 1`;
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