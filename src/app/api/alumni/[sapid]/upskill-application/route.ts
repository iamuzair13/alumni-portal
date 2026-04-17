
 import { NextResponse } from "next/server";
 import { sql } from "@/lib/dbconnect";
 import { auth } from "@/lib/auth";
 import { generateUpskillPDF } from "@/lib/pdfGenerator";
 import { sendEmailDetailed } from "@/lib/email";
 import { createEmailTemplate } from "@/lib/emailTemplate";

 export async function POST(
   req: Request,
   ctx: { params: Promise<{ sapid: string }> }
 ) {
   try {
     const session = await auth();
     if (!session?.user) {
       return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
     }

     const { sapid } = await ctx.params;
     const sapidTrimmed = String(sapid || "").trim();
     if (!sapidTrimmed) {
       return NextResponse.json({ error: "Missing sapid" }, { status: 400 });
     }

     const body = (await req.json().catch(() => null)) as
       | { courseName?: string; departmentName?: string }
       | null;

     const courseName = String(body?.courseName || "").trim();
     const departmentName = String(body?.departmentName || "").trim();

     if (!courseName || !departmentName) {
       return NextResponse.json(
         { error: "courseName and departmentName are required" },
         { status: 400 }
       );
     }

     const rows = await sql/* sql */`
       SELECT alumniid, alumniname, personalemail
       FROM public.tbl_alumni
       WHERE LOWER(TRIM(COALESCE(sapid, ''))) = LOWER(TRIM(${sapidTrimmed}))
       LIMIT 1
     `;

     const alumni = rows[0] as
       | { alumniid: number; alumniname: string | null; personalemail: string | null }
       | undefined;

     if (!alumni) {
       return NextResponse.json({ error: "Alumni not found" }, { status: 404 });
     }

     const alumniName = String(alumni.alumniname || "Alumni").trim() || "Alumni";
     const alumniEmail = String(alumni.personalemail || "").trim();
     if (!alumniEmail) {
       return NextResponse.json(
         { error: "Alumni email not found" },
         { status: 400 }
       );
     }

     try {
       await generateUpskillPDF({ alumniName, courseName, departmentName });
     } catch {
       // Best-effort; PDF generation is not required for a successful submission response.
     }

     const subject = "Upskill & Reskill Course Application";
     const greeting = `Dear ${alumniName},`;
     const bodyHtml = `
       <p style="margin: 0 0 10px 0; color: #333333; font-size: 16px;">
         Your application for the Upskill &amp; Reskill course has been received.
       </p>
       <p style="margin: 10px 0; color: #333333; font-size: 16px;">
         <strong>Course:</strong> ${courseName}<br/>
         <strong>Department:</strong> ${departmentName}
       </p>
       <p style="margin: 15px 0 0 0; color: #333333; font-size: 16px;">
         You will be contacted once your application is reviewed.
       </p>
     `;
     const footer =
       "Regards,<br>Office of Alumni Relations, EE2 Building 4th Floor<br>University of Lahore<br>alumni@uol.edu.pk";
     const html = createEmailTemplate(subject, greeting, bodyHtml, footer);

     const emailRes = await sendEmailDetailed({
       to: alumniEmail,
       subject,
       html,
     });

     return NextResponse.json(
       {
         ok: true,
         message: emailRes.ok
           ? "Application submitted successfully."
           : "Application submitted successfully, but email delivery failed.",
         emailSent: emailRes.ok,
         emailError: emailRes.ok ? undefined : emailRes.errorMessage,
       },
       { status: 200 }
     );
   } catch (err) {
     const message = err instanceof Error ? err.message : "Failed to submit application";
     return NextResponse.json({ error: message }, { status: 500 });
   }
 }

