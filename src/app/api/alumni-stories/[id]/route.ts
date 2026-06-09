import { NextResponse } from "next/server";
import { sql, retryDbOperation } from "@/lib/dbconnect";
import { storyServerSchema } from "@/lib/alumniStories";
import { auth } from "@/lib/auth";



import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { sanitizeStoryHtml } from "@/lib/sanitizeStoryHtml";




export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const storyId = Number(id);
    
    if (isNaN(storyId)) {
      return NextResponse.json({ message: "Invalid story ID" }, { status: 400 });
    }
    
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
      WHERE s.id = ${storyId}
        AND s.alumnistories IS NOT NULL
        AND s.alumnistories != ''
        AND TRIM(s.alumnistories) != ''
        AND a.alumniname IS NOT NULL
        AND TRIM(a.alumniname) != ''
      LIMIT 1`);
    
    const r = rows[0] as {
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
    } | undefined;
    
    if (!r) {
      return NextResponse.json({ 
        message: "Story not found. This story may not exist or may have been removed.",
        error: "NOT_FOUND"
      }, { status: 404 });
    }
    
    const result = {
      id: String(r.id ?? ""),
      date: r.createdat ? new Date(r.createdat).toISOString() : new Date().toISOString(),
      title: String(r.storytitle ?? r.alumniname ?? ""),
      name: String(r.alumniname ?? ""),
      program: String(r.degreetitle ?? ""),
      session: String(r.academicsession ?? ""),
      shortDescription: String(r.alumnistories ?? ""),
      imageUrl: String(r.story_image ?? r.image1 ?? ""),
    };
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch story";

    // Check for connection timeout errors
    const isConnectionError = err instanceof Error && (
      err.message.includes('CONNECT_TIMEOUT') ||
      err.message.includes('ETIMEDOUT') ||
      err.message.includes('timeout') ||
      (err as Error & { code?: string }).code === 'CONNECT_TIMEOUT' ||
      (err as Error & { code?: string }).code === 'ETIMEDOUT'
    );
    
    if (isConnectionError) {
      return NextResponse.json({ 
        error: "Database connection timeout. Please try again in a moment.",
        retryable: true
      }, { status: 503 });
    }
    
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    
    // SECURITY: Require authentication
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const { id } = await ctx.params;
    const storyId = Number(id);
    
    if (isNaN(storyId)) {
      return NextResponse.json({ message: "Invalid story ID" }, { status: 400 });
    }
    
    // Get the story to find alumni ID and verify ownership
    const storyRows = await sql/* sql */`
      SELECT s.alumniid, a.sapid, a.personalemail, a.officialemail, a.universityemail
      FROM public.tblalumnistories s
      INNER JOIN public.tbl_alumni a ON a.alumniid = s.alumniid
      WHERE s.id = ${storyId}
      LIMIT 1
    `;
    
    if (!storyRows[0]) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }
    
    const story = storyRows[0] as {
      alumniid: number;
      sapid: string | null;
      personalemail: string | null;
      officialemail: string | null;
      universityemail: string | null;
    };
    
    const alumniId = Number(story.alumniid);
    
    // Check authorization - allow if admin or if user owns the story
    const userType = session?.user ? String((session.user as { type?: string })?.type || "").toLowerCase().trim() : "";
    const isAdmin = userType === "admin" || userType === "superadmin";
    
    if (!isAdmin) {
      // Verify ownership
      const userEmail = session.user.email ? String(session.user.email) : null;
      const userSapid = (session.user as { sapid?: string | null })?.sapid ? String((session.user as { sapid?: string | null }).sapid).trim() : null;
      
      const isOwnerBySapid = userSapid && story.sapid && userSapid.toLowerCase().trim() === story.sapid.toLowerCase().trim();
      const isOwnerByEmail = userEmail && (
        (story.personalemail && story.personalemail.toLowerCase().trim() === userEmail.toLowerCase().trim()) ||
        (story.officialemail && story.officialemail.toLowerCase().trim() === userEmail.toLowerCase().trim()) ||
        (story.universityemail && story.universityemail.toLowerCase().trim() === userEmail.toLowerCase().trim())
      );
      
      if (!isOwnerBySapid && !isOwnerByEmail) {
        return NextResponse.json({ error: "Forbidden: You can only update your own stories" }, { status: 403 });
      }
    }
    
    // Check if request is FormData (for image upload) or JSON
    const contentType = req.headers.get("content-type") || "";
    let v: ReturnType<typeof storyServerSchema.parse>;
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
      // Handle JSON request
      const body = await req.json();
      const parsed = storyServerSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ 
          message: "Validation failed", 
          issues: parsed.error.format()
        }, { status: 422 });
      }
      v = parsed.data;
    }
    
    const cleanHtml = sanitizeStoryHtml(v.storyHtml);
    
    
    // Update story
    const updateQuery = storyImageFilename
      ? sql/* sql */`
        UPDATE public.tblalumnistories 
        SET alumnistories = ${cleanHtml},
            story_image = ${storyImageFilename},
            storytitle = ${v.storyTitle},
            createdat = NOW()
        WHERE id = ${storyId}
        RETURNING id`
      : sql/* sql */`
        UPDATE public.tblalumnistories 
        SET alumnistories = ${cleanHtml},
            storytitle = ${v.storyTitle},
            createdat = NOW()
        WHERE id = ${storyId}
        RETURNING id`;
    
    const result = await retryDbOperation(async () => await updateQuery);
    
    if (!result[0]) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }
    
    // Update contact number if provided
    if (v.contactNumber) {
      await sql/* sql */`
        UPDATE public.tbl_alumni 
        SET contactno = ${v.contactNumber}
        WHERE alumniid = ${alumniId}`;
    }
    
    return NextResponse.json({ 
      message: "Story updated successfully",
      id: String(storyId)
    }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to update story";

    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const storyId = Number(id);
    
    if (isNaN(storyId)) {
      return NextResponse.json({ message: "Invalid story ID" }, { status: 400 });
    }
    
    const res = await retryDbOperation(async () => await sql/* sql */`
      DELETE FROM public.tblalumnistories WHERE id = ${storyId} RETURNING id`);
    
    if (!res[0]) {
      return NextResponse.json({ 
        message: "Story not found",
        error: "NOT_FOUND"
      }, { status: 404 });
    }
    
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to delete";

    // Check for connection timeout errors
    const isConnectionError = err instanceof Error && (
      err.message.includes('CONNECT_TIMEOUT') ||
      err.message.includes('ETIMEDOUT') ||
      err.message.includes('timeout') ||
      (err as Error & { code?: string }).code === 'CONNECT_TIMEOUT' ||
      (err as Error & { code?: string }).code === 'ETIMEDOUT'
    );
    
    if (isConnectionError) {
      return NextResponse.json({ 
        error: "Database connection timeout. Please try again in a moment.",
        retryable: true
      }, { status: 503 });
    }
    
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}