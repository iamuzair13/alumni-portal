import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { writeFile, mkdir, unlink, stat, readFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { auth } from "@/lib/auth";
import { logAdminAction } from "@/lib/adminActivityLog";
import { canModify, isViewerUser } from "@/lib/alumniProfile";
import { uploadsImageUrl } from "@/lib/uploadsImageUrl";

export async function POST(req: Request, ctx: { params: Promise<{ sapid: string }> }) {
  const startTime = Date.now();

  try {
    const { sapid } = await ctx.params;

    const session = await auth();

    // SECURITY: Require authentication
    if (!session?.user) {

      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Normalize identifier (trim whitespace, handle encoding)
    const normalizedIdentifier = String(sapid || "").trim();

    // Try to find alumni by SAP ID first, then by registration number (like other routes)
    // Use TRIM() and case-insensitive comparison for better matching
    let alumniRows = await sql/* sql */`
      SELECT alumniid, sapid, registrationno FROM public.tbl_alumni 
      WHERE TRIM(COALESCE(sapid, '')) = ${normalizedIdentifier} 
      LIMIT 1`;
    
    // If not found by SAP ID, try registration number
    if (!alumniRows[0]) {
      alumniRows = await sql/* sql */`
        SELECT alumniid, sapid, registrationno FROM public.tbl_alumni 
        WHERE TRIM(COALESCE(registrationno, '')) = ${normalizedIdentifier} 
        LIMIT 1`;
    }
    
    // If still not found, try case-insensitive matching (for edge cases)
    if (!alumniRows[0]) {
      alumniRows = await sql/* sql */`
        SELECT alumniid, sapid, registrationno FROM public.tbl_alumni 
        WHERE LOWER(TRIM(COALESCE(sapid, ''))) = LOWER(${normalizedIdentifier})
        LIMIT 1`;
    }
    
    if (!alumniRows[0]) {
      alumniRows = await sql/* sql */`
        SELECT alumniid, sapid, registrationno FROM public.tbl_alumni 
        WHERE LOWER(TRIM(COALESCE(registrationno, ''))) = LOWER(${normalizedIdentifier})
        LIMIT 1`;
    }
    
    if (!alumniRows[0]) {

      return NextResponse.json({ error: "Alumni not found" }, { status: 404 });
    }
    
    const alumni = alumniRows[0] as { alumniid: number; sapid: string | null; registrationno: string | null };
    
    // SECURITY: Verify the user has permission to update this profile
    // Get user identifiers from session
    const userEmail = session.user.email ? String(session.user.email) : null;
    const userSapid = (session.user as { sapid?: string | null })?.sapid ? String((session.user as { sapid?: string | null }).sapid).trim() : null;
    const userRegNo = (session.user as { registrationno?: string | null })?.registrationno ? String((session.user as { registrationno?: string | null }).registrationno).trim() : null;
    
    // Check if user is admin or can modify (superadmin)
    const canAccess = canModify(session.user);
    const isViewer = isViewerUser(session.user);
    
    // Check ownership by SAP ID
    const dbSapid = String(alumni.sapid ?? "").trim();
    const dbRegNo = String(alumni.registrationno ?? "").trim();
    const isOwnerBySapid = userSapid && dbSapid && dbSapid.toLowerCase() === userSapid.toLowerCase();
    const isOwnerByRegNo = userRegNo && dbRegNo && dbRegNo.toLowerCase() === userRegNo.toLowerCase();
    
    // Check ownership by identifier match (when user passes their own identifier)
    const identifierMatchesRow = normalizedIdentifier && (
      (dbSapid && dbSapid.toLowerCase() === normalizedIdentifier.toLowerCase()) ||
      (dbRegNo && dbRegNo.toLowerCase() === normalizedIdentifier.toLowerCase())
    );
    
    // For alumni users, also check by email if available (get email from database)
    let isOwnerByEmail = false;
    if (userEmail && !isOwnerBySapid && !isOwnerByRegNo) {
      const emailRows = await sql/* sql */`
        SELECT personalemail, universityemail, officialemail FROM public.tbl_alumni 
        WHERE alumniid = ${alumni.alumniid} 
        LIMIT 1` as Array<{ personalemail: string | null; universityemail: string | null; officialemail: string | null }>;
      
      if (emailRows[0]) {
        const emails = [
          emailRows[0].personalemail,
          emailRows[0].universityemail,
          emailRows[0].officialemail
        ].filter(Boolean).map(e => String(e).toLowerCase().trim());
        isOwnerByEmail = emails.includes(userEmail.toLowerCase().trim());
      }
    }
    
    const isOwner = isOwnerBySapid || isOwnerByRegNo || isOwnerByEmail || identifierMatchesRow;
    const canUpdate = isOwner || canAccess || isViewer;

    if (!canUpdate) {

      return NextResponse.json({ error: "Forbidden: You don't have permission to update this profile" }, { status: 403 });
    }
    
    // Use the actual SAP ID or registration number for the filename (prioritize SAP ID)
    const identifierForFilename = (alumni.sapid && alumni.sapid.trim()) || (alumni.registrationno && alumni.registrationno.trim()) || normalizedIdentifier;

    const formData = await req.formData();
    const file = formData.get("image") as File | null;
    const consentPic = formData.get("alumni_consent_pic");

    if (!file) {
      return NextResponse.json({ error: "No image file provided" }, { status: 400 });
    }

    // Parse consent value - convert string to boolean
    let consentPicValue: boolean | null = null;
    if (consentPic !== null && consentPic !== undefined) {
      const consentStr = String(consentPic).toLowerCase().trim();
      if (consentStr === "true" || consentStr === "1") {
        consentPicValue = true;
      } else if (consentStr === "false" || consentStr === "0") {
        consentPicValue = false;
      }
    }

    // Validate file size first (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: "File size exceeds 5MB limit" }, { status: 400 });
    }

    // Get file extension
    const fileName = file.name.toLowerCase();
    const extension = fileName.split(".").pop() || "";
    const allowedExtensions = ["jpg", "jpeg", "png", "gif", "webp"];
    
    // Validate by extension (more reliable on Plesk)
    if (!extension || !allowedExtensions.includes(extension)) {
      return NextResponse.json({ 
        error: "Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed." 
      }, { status: 400 });
    }

    // Validate MIME type (if available)
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
    if (file.type && !allowedTypes.includes(file.type)) {
      return NextResponse.json({ 
        error: "Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed." 
      }, { status: 400 });
    }

    // Validate file content by checking magic bytes (file signature)
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Check file signature (first few bytes)
    const isValidImage = 
      // JPEG: FF D8 FF
      (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) ||
      // PNG: 89 50 4E 47
      (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) ||
      // GIF: 47 49 46 38 (GIF8)
      (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) ||
      // WebP: RIFF...WEBP (check for "RIFF" at start and "WEBP" at offset 8)
      (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
       buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50);
    
    if (!isValidImage) {
      return NextResponse.json({ 
        error: "The requested resource isn't a valid image. Please upload a valid image file." 
      }, { status: 400 });
    }

    // Generate unique filename using the identifier (identifierForFilename is already defined above)
    const timestamp = Date.now();
    const finalExtension = extension || "jpg";
    const filename = `${identifierForFilename}-${timestamp}.${finalExtension}`;
    
    // Create uploads directory if it doesn't exist (images directory in public folder)
    // Support environment variable for Plesk deployments where path might differ
    const cwd = process.cwd();
    
    // Try to find the actual project root by looking for package.json or next.config
    // This is more reliable on Plesk where cwd might be different
    let projectRoot = cwd;
    let currentPath = cwd;
    let foundProjectRoot = false;
    
    // Look for package.json or next.config.mjs to find project root
    for (let i = 0; i < 5; i++) {
      if (existsSync(join(currentPath, "package.json")) || existsSync(join(currentPath, "next.config.mjs"))) {
        projectRoot = currentPath;
        foundProjectRoot = true;

        break;
      }
      const parentPath = join(currentPath, "..");
      if (parentPath === currentPath) break; // Reached filesystem root
      currentPath = parentPath;
    }
    
    if (!foundProjectRoot) {

      projectRoot = cwd;
    }
    
    const uploadsDir = join(projectRoot, "public", "images");

    // Check if directory exists
    const dirExists = existsSync(uploadsDir);
    
    if (!dirExists) {

    } else {

    }
    
    try {
      if (!existsSync(uploadsDir)) {

        await mkdir(uploadsDir, { recursive: true, mode: 0o755 });

      } else {

      }
      
      // Verify directory is writable
      const testFile = join(uploadsDir, ".write-test");
      try {
        await writeFile(testFile, Buffer.from("test"));
        await unlink(testFile);

      } catch (testError) {

        return NextResponse.json({ 
          error: "Upload directory is not writable. Please contact administrator." 
        }, { status: 500 });
      }
    } catch (dirError) {
      const error = dirError as NodeJS.ErrnoException;

      return NextResponse.json({ 
        error: `Failed to create upload directory: ${error?.message || 'Unknown error'}. Please contact administrator.` 
      }, { status: 500 });
    }

    // Save file
    const filePath = join(uploadsDir, filename);


    try {
      await writeFile(filePath, buffer, { mode: 0o644 });

      // Verify file was written
      if (!existsSync(filePath)) {

        return NextResponse.json({ 
          error: "File was not saved. Please try again." 
        }, { status: 500 });
      }
      
      const stats = await stat(filePath);


      // Verify the file is in the public directory structure
      const relativePathFromCwd = filePath.replace(cwd, "").replace(/\\/g, "/");
      const relativePathFromRoot = filePath.replace(projectRoot, "").replace(/\\/g, "/");


      // Check if file is accessible (try to read first few bytes)
      try {
        const testRead = await readFile(filePath);

      } catch (readError) {

      }
      
      if (!relativePathFromRoot.includes("/public/images/") && !relativePathFromRoot.includes("\\public\\images\\")) {




      } else {


      }
    } catch (writeError) {
      const error = writeError as NodeJS.ErrnoException;


      return NextResponse.json({ 
        error: `Failed to save image file: ${error?.message || 'Unknown error'}. Please try again.` 
      }, { status: 500 });
    }

    // Update both image1 and image2 in tbl_alumni with the new image filename
    // IMPORTANT: Profile picture updates should ONLY affect tbl_alumni, NOT tblcard
    // Image path will be "/images" as per requirement, but we store just the filename
    await sql/* sql */`
      UPDATE public.tbl_alumni 
      SET image1 = ${filename},
          image2 = ${filename},
          alumni_consent_pic = ${consentPicValue},
          change_approval = CASE
            WHEN LOWER(COALESCE(change_approval, '')) = 'rejected' THEN NULL
            ELSE change_approval
          END
      WHERE alumniid = ${alumni.alumniid}`;

    const imagePath = uploadsImageUrl(filename);
    const duration = Date.now() - startTime;




    await logAdminAction({
      session,
      req,
      input: {
        action: "alumni.update_profile_picture",
        entityType: "tbl_alumni",
        entityId: String(alumni.alumniid),
        success: true,
        metadata: {
          sapid: normalizedIdentifier,
          filename,
        },
      },
    });
    return NextResponse.json({
      ok: true,
      imagePath,
      message: "Profile picture updated successfully"
    }, { status: 200 });
  } catch (err) {
    const duration = Date.now() - startTime;
    const error = err instanceof Error ? err : new Error(String(err));
    const errorDetails = {
      message: error.message,
      stack: error.stack,
      name: error.name,
      duration: `${duration}ms`
    };

    // Return detailed error in development, generic in production
    const isDevelopment = process.env.NODE_ENV === 'development';
    const errorMessage = isDevelopment
      ? `Failed to update profile picture: ${error.message}`
      : "Failed to update profile picture. Please contact administrator if this persists.";

    await logAdminAction({
      session: await auth(),
      req,
      input: {
        action: "alumni.update_profile_picture",
        entityType: "tbl_alumni",
        success: false,
        errorMessage: error.message,
      },
    });
    return NextResponse.json({
      error: errorMessage,
      ...(isDevelopment && { details: errorDetails })
    }, { status: 500 });
  }
}

