import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { writeFile, mkdir, unlink, stat, readFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { auth } from "@/lib/auth";
import { canModify, isViewerUser } from "@/lib/alumniProfile";

export async function POST(req: Request, ctx: { params: Promise<{ sapid: string }> }) {
  const startTime = Date.now();
  console.log("[API] ========== Profile Picture Upload Started ==========");
  
  try {
    const { sapid } = await ctx.params;
    console.log("[API] Received SAP ID from params:", sapid);
    
    const session = await auth();
    console.log("[API] Session check - user exists:", !!session?.user);
    
    // SECURITY: Require authentication
    if (!session?.user) {
      console.error("[API] Unauthorized: No session user");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Normalize identifier (trim whitespace, handle encoding)
    const normalizedIdentifier = String(sapid || "").trim();
    
    console.log("[API] Profile picture upload request for identifier:", normalizedIdentifier);
    console.log("[API] Session user email:", session.user.email);
    console.log("[API] Session user SAP ID:", (session.user as { sapid?: string | null })?.sapid);
    
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
      console.log("[API] Alumni not found for identifier:", normalizedIdentifier);
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
    
    console.log("[API] Ownership check - isOwner:", isOwner, "canAccess:", canAccess, "isViewer:", isViewer, "canUpdate:", canUpdate);
    
    if (!canUpdate) {
      console.log("[API] Access denied for identifier:", normalizedIdentifier);
      return NextResponse.json({ error: "Forbidden: You don't have permission to update this profile" }, { status: 403 });
    }
    
    // Use the actual SAP ID or registration number for the filename (prioritize SAP ID)
    const identifierForFilename = (alumni.sapid && alumni.sapid.trim()) || (alumni.registrationno && alumni.registrationno.trim()) || normalizedIdentifier;

    const formData = await req.formData();
    const file = formData.get("image") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No image file provided" }, { status: 400 });
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
        console.log("[API] Found project root at:", projectRoot);
        break;
      }
      const parentPath = join(currentPath, "..");
      if (parentPath === currentPath) break; // Reached filesystem root
      currentPath = parentPath;
    }
    
    if (!foundProjectRoot) {
      console.warn("[API] Could not find project root, using cwd:", cwd);
      projectRoot = cwd;
    }
    
    // Allow override via environment variable (useful for Plesk)
    const customUploadPath = process.env.UPLOAD_DIR || process.env.IMAGES_UPLOAD_DIR;
    let uploadsDir: string;
    
    if (customUploadPath) {
      uploadsDir = customUploadPath.startsWith("/") 
        ? customUploadPath 
        : join(projectRoot, customUploadPath);
      console.log("[API] Using custom upload path from environment:", uploadsDir);
    } else {
      // Standard Next.js path - use project root
      uploadsDir = join(projectRoot, "public", "images");
      
      // Verify that public directory exists (Next.js requirement)
      const publicDir = join(projectRoot, "public");
      if (!existsSync(publicDir)) {
        console.warn("[API] WARNING: public directory not found at:", publicDir);
        console.warn("[API] Attempting to use projectRoot/public/images anyway:", uploadsDir);
      } else {
        console.log("[API] Public directory found at:", publicDir);
      }
    }
    
    console.log("[API] ========== Path Information ==========");
    console.log("[API] Current working directory (cwd):", cwd);
    console.log("[API] Project root:", projectRoot);
    console.log("[API] NODE_ENV:", process.env.NODE_ENV);
    console.log("[API] Upload directory path:", uploadsDir);
    console.log("[API] Custom upload path env:", customUploadPath || "not set");
    console.log("[API] Expected URL path: /images/" + filename);
    
    // Check if directory exists
    const dirExists = existsSync(uploadsDir);
    
    if (!dirExists) {
      console.log("[API] Upload directory not found, will attempt to create:", uploadsDir);
    } else {
      console.log("[API] Upload directory exists:", uploadsDir);
    }
    
    try {
      if (!existsSync(uploadsDir)) {
        console.log("[API] Creating upload directory:", uploadsDir);
        await mkdir(uploadsDir, { recursive: true, mode: 0o755 });
        console.log("[API] Directory created successfully");
      } else {
        console.log("[API] Upload directory exists:", uploadsDir);
      }
      
      // Verify directory is writable
      const testFile = join(uploadsDir, ".write-test");
      try {
        await writeFile(testFile, Buffer.from("test"));
        await unlink(testFile);
        console.log("[API] Directory is writable");
      } catch (testError) {
        console.error("[API] Directory is not writable:", testError);
        return NextResponse.json({ 
          error: "Upload directory is not writable. Please contact administrator." 
        }, { status: 500 });
      }
    } catch (dirError) {
      const error = dirError as NodeJS.ErrnoException;
      console.error("[API] Failed to create/access directory:", dirError);
      console.error("[API] Error details:", {
        message: error?.message,
        code: error?.code,
        path: uploadsDir,
        cwd: process.cwd(),
        errno: error?.errno,
        syscall: error?.syscall
      });
      return NextResponse.json({ 
        error: `Failed to create upload directory: ${error?.message || 'Unknown error'}. Please contact administrator.` 
      }, { status: 500 });
    }

    // Save file
    const filePath = join(uploadsDir, filename);
    console.log("[API] Saving file to:", filePath);
    console.log("[API] File size:", buffer.length, "bytes");
    
    try {
      await writeFile(filePath, buffer, { mode: 0o644 });
      console.log("[API] File saved successfully:", filename);
      
      // Verify file was written
      if (!existsSync(filePath)) {
        console.error("[API] File was not created after write operation");
        return NextResponse.json({ 
          error: "File was not saved. Please try again." 
        }, { status: 500 });
      }
      
      const stats = await stat(filePath);
      console.log("[API] File verification - Size:", stats.size, "bytes");
      console.log("[API] File exists at:", filePath);
      console.log("[API] File is readable:", stats.isFile());
      console.log("[API] File permissions:", stats.mode.toString(8));
      
      // Verify the file is in the public directory structure
      const relativePathFromCwd = filePath.replace(cwd, "").replace(/\\/g, "/");
      const relativePathFromRoot = filePath.replace(projectRoot, "").replace(/\\/g, "/");
      console.log("[API] File relative path from cwd:", relativePathFromCwd);
      console.log("[API] File relative path from project root:", relativePathFromRoot);
      
      // Check if file is accessible (try to read first few bytes)
      try {
        const testRead = await readFile(filePath);
        console.log("[API] File is readable - first 10 bytes:", Array.from(testRead.slice(0, 10)).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(' '));
      } catch (readError) {
        console.error("[API] ERROR: File cannot be read:", readError);
      }
      
      if (!relativePathFromRoot.includes("/public/images/") && !relativePathFromRoot.includes("\\public\\images\\")) {
        console.error("[API] WARNING: File is not in public/images directory structure!");
        console.error("[API] Expected path pattern: .../public/images/filename");
        console.error("[API] Actual relative path from project root:", relativePathFromRoot);
        console.error("[API] This may cause Next.js to not serve the file correctly.");
      } else {
        console.log("[API] ✓ File is in correct public/images directory structure");
        console.log("[API] File should be accessible at: /images/" + filename);
      }
    } catch (writeError) {
      const error = writeError as NodeJS.ErrnoException;
      console.error("[API] Failed to write file:", writeError);
      console.error("[API] Write error details:", {
        message: error?.message,
        code: error?.code,
        path: filePath,
        errno: error?.errno,
        syscall: error?.syscall
      });
      return NextResponse.json({ 
        error: `Failed to save image file: ${error?.message || 'Unknown error'}. Please try again.` 
      }, { status: 500 });
    }

    // Check if image1 already has a value
    // If image1 is empty/null, save to image1; otherwise save to image2
    // image1 is used in AlumniCardTemplate, so we preserve it
    const currentData = await sql/* sql */`
      SELECT image1, image2 FROM public.tbl_alumni 
      WHERE alumniid = ${alumni.alumniid} 
      LIMIT 1` as Array<{ image1: string | null; image2: string | null }>;
    
    const currentImage1 = currentData[0]?.image1;
    
    if (!currentImage1 || currentImage1.trim() === "") {
      // image1 is empty, save to image1
      await sql/* sql */`
        UPDATE public.tbl_alumni 
        SET image1 = ${filename}
        WHERE alumniid = ${alumni.alumniid}`;
    } else {
      // image1 has value, save to image2
      await sql/* sql */`
        UPDATE public.tbl_alumni 
        SET image2 = ${filename}
        WHERE alumniid = ${alumni.alumniid}`;
    }

    // Return the full path for immediate display
    const imagePath = `/images/${filename}`;
    const duration = Date.now() - startTime;
    
    console.log("[API] ========== Profile Picture Upload Success ==========");
    console.log("[API] Upload completed in:", `${duration}ms`);
    console.log("[API] Image path:", imagePath);
    console.log("[API] Filename:", filename);
    
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
    
    console.error("[API] ========== Profile Picture Upload Error ==========");
    console.error("[API] Error details:", JSON.stringify(errorDetails, null, 2));
    console.error("[API] Full error object:", err);
    
    // Return detailed error in development, generic in production
    const isDevelopment = process.env.NODE_ENV === 'development';
    const errorMessage = isDevelopment 
      ? `Failed to update profile picture: ${error.message}` 
      : "Failed to update profile picture. Please contact administrator if this persists.";
    
    return NextResponse.json({ 
      error: errorMessage,
      ...(isDevelopment && { details: errorDetails })
    }, { status: 500 });
  }
}

