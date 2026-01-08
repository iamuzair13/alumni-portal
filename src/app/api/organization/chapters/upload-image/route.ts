import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { auth } from "@/lib/auth";
import { isSuperAdminUser, isAdminUser } from "@/lib/alumniProfile";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admin and superadmin can upload images
    if (!isSuperAdminUser(session.user) && !isAdminUser(session.user)) {
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get("image") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No image file provided" }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ 
        error: "Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed." 
      }, { status: 400 });
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return NextResponse.json({ 
        error: "File size exceeds 5MB limit" 
      }, { status: 400 });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 9);
    const extension = file.name.split(".").pop() || "jpg";
    const filename = `chapter-${timestamp}-${randomSuffix}.${extension}`;
    
    // Create uploads directory if it doesn't exist
    // Images are stored in /public/images/
    const uploadsDir = join(process.cwd(), "public", "images");
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
    }

    // Save file
    const filePath = join(uploadsDir, filename);
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    return NextResponse.json({ 
      success: true,
      filename: filename
    }, { status: 200 });
  } catch (error) {
    console.error("Error uploading chapter image:", error);
    const message = error instanceof Error ? error.message : "Failed to upload image";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

