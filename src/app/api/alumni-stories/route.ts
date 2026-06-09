import { NextResponse } from "next/server";
import { storyServerSchema, type ServerStoryPayload } from "@/lib/alumniStories";
import { sql, retryDbOperation } from "@/lib/dbconnect";

import { sendSuccessStoryEmail } from "@/lib/email";
import { auth } from "@/lib/auth";
import { buildAccessFilterSQL } from "@/lib/userAccess";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { sanitizeStoryHtml, storyHtmlTextContent } from "@/lib/sanitizeStoryHtml";


type StoryItem = {
  id: string;
  date: string;
  title: string;
  name: string;
  program: string;
  session: string;
  shortDescription: string;
  imageUrl: string;
};

type StoryRow = {
  id: number;
  alumniid: number;
  alumnistories: string | null;
  story_image: string | null;
  status: string | null;
  createdat: string | null;
  storytitle: string | null;
  alumniname: string | null;
  degreetitle: string | null;
  academicsession: string | null;
  image1: string | null;
};

export async function GET() {
  try {
    const session = await auth();
    
    // Check if user is alumni - alumni users should see only their own story
    const userType = session?.user ? String((session.user as { type?: string })?.type || "").toLowerCase().trim() : "";
    const isAlumni = userType === "alumni";
    
    // For alumni users, get their alumni ID to filter stories
    let alumniIdFilter: ReturnType<typeof sql> | null = null;
    if (isAlumni && session?.user) {
      // Get SAP ID from session
      const userSapid = (session.user as { sapid?: string | null })?.sapid ? String((session.user as { sapid?: string | null }).sapid).trim() : null;
      const userEmail = session.user.email ? String(session.user.email) : null;
      
      if (userSapid) {
        // Try to get alumni ID from SAP ID
        const sapRows = await sql/* sql */`
          SELECT alumniid FROM public.tbl_alumni 
          WHERE sapid = ${userSapid} 
          LIMIT 1
        `;
        if (sapRows[0]) {
          const alumniId = Number((sapRows[0] as { alumniid: number }).alumniid);
          alumniIdFilter = sql` AND s.alumniid = ${alumniId}`;

        }
      }
      
      // Fallback to email lookup if SAP ID not found
      if (!alumniIdFilter && userEmail) {
        const emailRows = await sql/* sql */`
          SELECT alumniid FROM public.tbl_alumni 
          WHERE personalemail = ${userEmail} OR officialemail = ${userEmail} OR universityemail = ${userEmail}
          ORDER BY alumniid DESC 
          LIMIT 1
        `;
        if (emailRows[0]) {
          const alumniId = Number((emailRows[0] as { alumniid: number }).alumniid);
          alumniIdFilter = sql` AND s.alumniid = ${alumniId}`;

        }
      }
      
      if (!alumniIdFilter) {

        // Return empty array if alumni ID not found
        return NextResponse.json({ items: [] }, { status: 200 });
      }
    }
    
    // Build access filter only for admin/viewer users (not for alumni)
    const accessFilter = isAlumni 
      ? { hasFilter: false, sql: null } 
      : await buildAccessFilterSQL(session, "");
    const accessFilterCondition = accessFilter.hasFilter && accessFilter.sql ? sql` AND (${accessFilter.sql})` : sql``;
    
    const rows = await retryDbOperation(async () => await sql/* sql */`
      SELECT 
        s.id,
        s.alumniid,
        s.alumnistories,
        s.story_image,
        s.status,
        s.createdat,
        s.storytitle,
        a.alumniname,
        a.degreetitle,
        a.academicsession,
        a.image1
      FROM public.tblalumnistories s
      INNER JOIN public.tbl_alumni a ON a.alumniid = s.alumniid
      WHERE s.alumnistories IS NOT NULL 
        AND s.alumnistories != ''
        AND TRIM(s.alumnistories) != ''
        AND LENGTH(TRIM(REGEXP_REPLACE(s.alumnistories, '<[^>]+>', '', 'g'))) > 0
        AND COALESCE(a.alumniname, '') != ''
        ${alumniIdFilter || sql``}
        ${accessFilterCondition}
      ORDER BY s.createdat DESC NULLS LAST
      LIMIT 200` as StoryRow[]);
    
    const items = rows.map((r): StoryItem => {
      const id = String(r.id ?? "");
      const date = r.createdat ? new Date(r.createdat).toISOString() : new Date().toISOString();
      const title = String(r.storytitle ?? r.alumniname ?? "");
      const name = String(r.alumniname ?? "");
      const program = String(r.degreetitle ?? "");
      const session = String(r.academicsession ?? "");
      const shortDescription = String(r.alumnistories ?? "");
      const imageUrl = String(r.story_image ?? r.image1 ?? "");
      return { id, date, title, name, program, session, shortDescription, imageUrl };
    });
    
    // Always return items array, even if empty (no stories is a valid state)
    return NextResponse.json({ items }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch stories";

    // Check for connection timeout errors
    const isConnectionError = err instanceof Error && (
      err.message.includes('CONNECT_TIMEOUT') ||
      err.message.includes('ETIMEDOUT') ||
      err.message.includes('timeout') ||
      (err as Error & { code?: string }).code === 'CONNECT_TIMEOUT' ||
      (err as Error & { code?: string }).code === 'ETIMEDOUT'
    );
    
    // For any error, return empty array so UI can handle it gracefully
    // This prevents the "Failed to fetch" error from breaking the page
    if (isConnectionError) {

      return NextResponse.json({ 
        items: [], // Return empty array so UI shows "no stories" instead of error
        error: "Database connection timeout. Please try again in a moment.",
        retryable: true
      }, { status: 200 }); // Return 200 with empty array so client doesn't treat it as error
    }
    
    // For other errors, also return empty array with 200 status
    // The client can check if items.length === 0 to show appropriate message

    return NextResponse.json({ 
      items: [], // Return empty array so UI shows "no stories" instead of error
      error: msg 
    }, { status: 200 }); // Return 200 so client doesn't treat it as error
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    
    // SECURITY: Require authentication
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Check if request is FormData (for image upload) or JSON
    const contentType = req.headers.get("content-type") || "";
    let v: ServerStoryPayload;
    let storyImageFilename: string | null = null;
    
    if (contentType.includes("multipart/form-data")) {
      // Handle FormData with image upload
      const formData = await req.formData();
      
      // Extract form fields
      const sapId = String(formData.get("sapId") || "");
      const name = String(formData.get("name") || "");
      const email = String(formData.get("email") || "");
      const faculty = String(formData.get("faculty") || "");
      const department = String(formData.get("department") || "");
      const passingYear = formData.get("passingYear") ? Number(formData.get("passingYear")) : null;
      const contactNumber = formData.get("contactNumber") ? String(formData.get("contactNumber")) : null;
      const storyTitle = String(formData.get("storyTitle") || "");
      const storyHtml = String(formData.get("storyHtml") || "");
      const imageFile = formData.get("storyImage") as File | null;
      
      // Validate and save image if provided
      if (imageFile && imageFile.size > 0) {
        // Validate file type
        const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
        if (!allowedTypes.includes(imageFile.type)) {
          return NextResponse.json({ 
            error: "Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed." 
          }, { status: 400 });
        }
        
        // Validate file size (max 5MB)
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (imageFile.size > maxSize) {
          return NextResponse.json({ 
            error: "File size exceeds 5MB limit" 
          }, { status: 400 });
        }
        
        // Generate unique filename (max 50 chars as per schema VARCHAR(50))
        const timestamp = Date.now();
        const extension = imageFile.name.split(".").pop() || "jpg";
        // Format: story-{timestamp}.{ext} - ensure it fits in VARCHAR(50)
        const baseFilename = `story-${timestamp}.${extension}`;
        storyImageFilename = baseFilename.length > 50 ? baseFilename.slice(0, 50) : baseFilename;
        
        // Create uploads directory if it doesn't exist
        const uploadsDir = join(process.cwd(), "public", "images");
        if (!existsSync(uploadsDir)) {
          await mkdir(uploadsDir, { recursive: true });
        }
        
        // Save file
        const filePath = join(uploadsDir, storyImageFilename);
        const bytes = await imageFile.arrayBuffer();
        const buffer = Buffer.from(bytes);
        await writeFile(filePath, buffer);

      }
      
      // Build payload object for validation
      const payload = {
        sapId,
        name,
        email,
        faculty,
        department,
        passingYear,
        contactNumber,
        storyTitle,
        storyHtml,
      };
      
      const parsed = storyServerSchema.safeParse(payload);
      if (!parsed.success) {

        return NextResponse.json({ 
          message: "Validation failed", 
          issues: parsed.error.format()
        }, { status: 422 });
      }
      v = parsed.data;
    } else {
      // Handle JSON request (backward compatibility)
      const body = await req.json();
      const parsed = storyServerSchema.safeParse(body);
      if (!parsed.success) {


        return NextResponse.json({ 
          message: "Validation failed", 
          issues: parsed.error.format(),
          received: body 
        }, { status: 422 });
      }
      v = parsed.data;
    }
    
    const cleanHtml = sanitizeStoryHtml(v.storyHtml);
    const textContent = storyHtmlTextContent(v.storyHtml);
    if (!textContent || textContent.length === 0) {
      return NextResponse.json({ 
        message: "Story content is required and cannot be empty after sanitization" 
      }, { status: 400 });
    }

    const alumniRows = await sql/* sql */`
      SELECT alumniid, sapid, personalemail, universityemail, officialemail FROM public.tbl_alumni WHERE sapid = ${v.sapId} LIMIT 1` as { alumniid: number; sapid: string | null; personalemail: string | null; universityemail: string | null; officialemail: string | null }[];
    const alumniId = alumniRows[0]?.alumniid;
    if (!alumniId) {
      return NextResponse.json({ message: "SAP ID not found in tbl_alumni" }, { status: 404 });
    }
    
    // SECURITY: Check if user is admin/superadmin or owns this alumni record
    const { canModify } = await import("@/lib/alumniProfile");
    const isAdmin = canModify(session.user);
    
    if (!isAdmin) {
      // If not admin, verify ownership
      const userEmail = session.user.email ? String(session.user.email) : null;
      const userSapid = (session.user as { sapid?: string | null })?.sapid ? String((session.user as { sapid?: string | null }).sapid) : null;
      const row = alumniRows[0];
      
      const isOwnerBySapid = userSapid && row.sapid && userSapid.toLowerCase().trim() === row.sapid.toLowerCase().trim();
      const isOwnerByEmail = userEmail && (
        (row.personalemail && row.personalemail.toLowerCase().trim() === userEmail.toLowerCase().trim()) ||
        (row.universityemail && row.universityemail.toLowerCase().trim() === userEmail.toLowerCase().trim()) ||
        (row.officialemail && row.officialemail.toLowerCase().trim() === userEmail.toLowerCase().trim())
      );
      
      if (!isOwnerBySapid && !isOwnerByEmail) {
        return NextResponse.json({ error: "Forbidden: You can only create stories for your own profile" }, { status: 403 });
      }
    } else {
      // For admin/viewer users, check access filter
      const { buildAccessFilterSQL } = await import("@/lib/userAccess");
      const accessFilter = await buildAccessFilterSQL(session, "");
      
      if (accessFilter.hasFilter && accessFilter.sql) {
        const accessCheck = await sql/* sql */`
          SELECT alumniid FROM public.tbl_alumni 
          WHERE alumniid = ${alumniId} 
          AND (${accessFilter.sql})
          LIMIT 1
        `;
        
        if (!accessCheck[0]) {
          return NextResponse.json({ error: "Forbidden: You don't have access to this alumni record" }, { status: 403 });
        }
      }
    }

    // Update contact number if provided
    if (v.contactNumber) {
      await sql/* sql */`
        UPDATE public.tbl_alumni 
        SET contactno = ${v.contactNumber}
        WHERE alumniid = ${alumniId}`;
    }

    try {
      // Insert new story - allow multiple stories per alumni
      // Schema columns: id (PK, auto-increment), alumniid (FK), alumnistories (TEXT), story_image (VARCHAR(50)), status (VARCHAR(20)), createdat (TIMESTAMP), storytitle (TEXT)



      const result = await sql/* sql */`
        INSERT INTO public.tblalumnistories (alumniid, alumnistories, story_image, status, createdat, storytitle)
        VALUES (${alumniId}, ${cleanHtml}, ${storyImageFilename}, NULL, NOW(), ${v.storyTitle})
        RETURNING id`;
      
      const newStoryId = result[0] ? Number((result[0] as { id: number }).id) : null;

      // Verify the story was saved by querying it back
      if (newStoryId) {
        const verifyQuery = await sql/* sql */`
          SELECT s.id, s.alumniid, s.alumnistories, a.alumniname
          FROM public.tblalumnistories s
          INNER JOIN public.tbl_alumni a ON a.alumniid = s.alumniid
          WHERE s.id = ${newStoryId}
          LIMIT 1
        `;

        if (verifyQuery.length > 0) {
          const story = verifyQuery[0] as { id: number; alumniid: number; alumnistories: string | null; alumniname: string | null };

        }
      }
    } catch (dbError) {


      return NextResponse.json({ 
        message: "Failed to save story to database",
        error: dbError instanceof Error ? dbError.message : "Unknown database error",
        details: process.env.NODE_ENV === 'development' ? (dbError instanceof Error ? dbError.stack : undefined) : undefined
      }, { status: 500 });
    }
    
    // Send confirmation email
    try {
      const alumniRows = await sql/* sql */`
        SELECT alumniname, personalemail, officialemail, universityemail
        FROM public.tbl_alumni 
        WHERE alumniid = ${alumniId}
        LIMIT 1
      `;
      const alumni = alumniRows[0] as {
        alumniname: string | null;
        personalemail: string | null;
        officialemail: string | null;
        universityemail: string | null;
      } | undefined;
      
      if (alumni) {
        const alumniEmail = alumni.personalemail || alumni.officialemail || alumni.universityemail;
        const alumniName = alumni.alumniname || "Alumni";
        
        if (alumniEmail) {
          // Send email asynchronously (don't wait for it to complete)
          sendSuccessStoryEmail(alumniEmail, alumniName).catch((err) => {

          });
        }
      }
    } catch (emailError) {
      // Don't fail the request if email fails

    }
    
    return NextResponse.json({ ok: true, alumniid: alumniId, message: "Story saved successfully" }, { status: 201 });
  } catch (err) {

    const msg = err instanceof Error ? err.message : "Invalid JSON";
    const statusCode = err instanceof Error && msg.includes("Unauthorized") ? 401 :
                      err instanceof Error && msg.includes("Forbidden") ? 403 :
                      err instanceof Error && msg.includes("not found") ? 404 : 400;
    return NextResponse.json({ message: msg, error: err instanceof Error ? err.stack : undefined }, { status: statusCode });
  }
}