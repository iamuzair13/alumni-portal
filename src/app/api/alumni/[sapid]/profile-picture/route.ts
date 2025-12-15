import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

export async function POST(req: Request, ctx: { params: Promise<{ sapid: string }> }) {
  try {
    const { sapid } = await ctx.params;
    
    // Verify alumni exists
    const alumniRows = await sql/* sql */`
      SELECT alumniid FROM public.tbl_alumni WHERE sapid = ${sapid} LIMIT 1`;
    
    if (!alumniRows[0]) {
      return NextResponse.json({ error: "Alumni not found" }, { status: 404 });
    }

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

    // Generate unique filename
    const timestamp = Date.now();
    const finalExtension = extension || "jpg";
    const filename = `${sapid}-${timestamp}.${finalExtension}`;
    
    // Create uploads directory if it doesn't exist
    const uploadsDir = join(process.cwd(), "public", "images");
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
    }

    // Save file
    const filePath = join(uploadsDir, filename);
    await writeFile(filePath, buffer);

    // Check if image1 already has a value
    // If image1 is empty/null, save to image1; otherwise save to image2
    // image1 is used in AlumniCardTemplate, so we preserve it
    const currentData = await sql/* sql */`
      SELECT image1, image2 FROM public.tbl_alumni 
      WHERE sapid = ${sapid} LIMIT 1` as Array<{ image1: string | null; image2: string | null }>;
    
    const currentImage1 = currentData[0]?.image1;
    
    if (!currentImage1 || currentImage1.trim() === "") {
      // image1 is empty, save to image1
      await sql/* sql */`
        UPDATE public.tbl_alumni 
        SET image1 = ${filename}
        WHERE sapid = ${sapid}`;
    } else {
      // image1 has value, save to image2
      await sql/* sql */`
        UPDATE public.tbl_alumni 
        SET image2 = ${filename}
        WHERE sapid = ${sapid}`;
    }

    // Return the full path for immediate display
    const imagePath = `/images/${filename}`;
    return NextResponse.json({ 
      ok: true, 
      imagePath,
      message: "Profile picture updated successfully" 
    }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update profile picture";
    console.error("[API] Profile picture upload error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

