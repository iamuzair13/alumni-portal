import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { isAdminUser, isViewerUser, isSuperAdminUser } from "@/lib/alumniProfile";
import { hashPassword } from "@/auth/credentials";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

type DbUser = {
  userid: number;
  email: string | null;
  firstname: string | null;
  lastname: string | null;
  department: string | null;
  type: string | null;
  blocked: boolean | null;
  lastlogindatetime: string | null;
  user_image: string | null;
};

export async function GET() {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const currentUserId = (session?.user as { userId?: number })?.userId;
    
    if (!currentUserId) {
      return NextResponse.json({ error: "User ID not found in session" }, { status: 400 });
    }
    
    // Check if user is admin/viewer/superadmin
    const isSuperAdmin = isSuperAdminUser(session?.user);
    const isAdmin = isAdminUser(session?.user);
    const isViewer = isViewerUser(session?.user);
    
    if (!isSuperAdmin && !isAdmin && !isViewer) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    
    // Fetch current user data with plain text password from users.password
    const rows = await sql/* sql */`
      SELECT 
        id as userid, 
        email, 
        firstname, 
        lastname, 
        department, 
        COALESCE(type, legacy_type) as type, 
        COALESCE(blocked, NOT is_active) as blocked, 
        lastlogindatetime,
        user_image,
        password
      FROM public.users 
      WHERE id = ${currentUserId} OR legacy_userid = ${currentUserId}
      LIMIT 1
    ` as Array<DbUser & { password?: string | null }>;
    
    const user = rows[0] ?? null;
    
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    
    // Return user with plain text password from users.password
    // If password is hashed (starts with "scrypt:"), it means it was migrated and plain text is not available
    return NextResponse.json({ 
      user: {
        ...user,
        password: user.password && !user.password.startsWith("scrypt:") ? user.password : null
      } 
    }, { status: 200 });
  } catch (error) {

    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const currentUserId = (session?.user as { userId?: number })?.userId;
    
    if (!currentUserId) {
      return NextResponse.json({ error: "User ID not found in session" }, { status: 400 });
    }
    
    // Check if user is admin/viewer/superadmin
    const isSuperAdmin = isSuperAdminUser(session?.user);
    const isAdmin = isAdminUser(session?.user);
    const isViewer = isViewerUser(session?.user);
    
    if (!isSuperAdmin && !isAdmin && !isViewer) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    
    // Parse form data (supports both JSON and FormData)
    const contentType = req.headers.get("content-type") || "";
    let body: Record<string, any> = {};
    
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      body = {
        email: formData.get("email"),
        newPassword: formData.get("newPassword"),
        firstname: formData.get("firstname"),
        lastname: formData.get("lastname"),
        department: formData.get("department"),
      };
      
      // Handle image upload
      const imageFile = formData.get("image") as File | null;
      if (imageFile && imageFile.size > 0) {
        const bytes = await imageFile.arrayBuffer();
        const buffer = Buffer.from(bytes);
        
        // Generate unique filename
        const timestamp = Date.now();
        const originalName = imageFile.name;
        const ext = originalName.split('.').pop() || 'jpg';
        const filename = `user-${currentUserId}-${timestamp}.${ext}`;
        
        // Ensure /public/images directory exists
        const imagesDir = join(process.cwd(), "public", "images");
        if (!existsSync(imagesDir)) {
          await mkdir(imagesDir, { recursive: true });
        }
        
        // Save file
        const filepath = join(imagesDir, filename);
        await writeFile(filepath, buffer);
        
        // Save image name to database
        body.user_image = filename;
      }
    } else {
      body = await req.json();
    }
    
    // Validate email if provided
    if (body.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(String(body.email))) {
        return NextResponse.json({ error: "INVALID_EMAIL_FORMAT" }, { status: 400 });
      }
    }
    
    // Validate and process new password if provided
    let plainTextPassword: string | undefined = undefined;
    let hashedPassword: string | undefined = undefined;
    if (body.newPassword && String(body.newPassword).trim().length > 0) {
      const newPasswordStr = String(body.newPassword).trim();
      if (newPasswordStr.length < 8) {
        return NextResponse.json({ error: "WEAK_PASSWORD" }, { status: 400 });
      }
      // Store plain text in password field and hash in password_hash field
      plainTextPassword = newPasswordStr;
      hashedPassword = await hashPassword(newPasswordStr);

    } else {

    }
    
    // Build update query - only include fields that are provided
    // Use conditional SQL fragments, ensuring proper comma placement
    await sql/* sql */`
      UPDATE public.users
      SET
        ${body.email !== undefined ? sql`email = ${body.email},` : sql``}
        ${plainTextPassword !== undefined && hashedPassword !== undefined ? sql`password = ${plainTextPassword}, password_hash = ${hashedPassword},` : sql``}
        ${body.firstname !== undefined ? sql`firstname = ${body.firstname},` : sql``}
        ${body.lastname !== undefined ? sql`lastname = ${body.lastname},` : sql``}
        ${body.department !== undefined && isSuperAdmin ? sql`department = ${body.department},` : sql``}
        ${body.user_image !== undefined ? sql`user_image = ${body.user_image},` : sql``}
        updated_at = now()
      WHERE id = ${currentUserId} OR legacy_userid = ${currentUserId}
    `;
    
    if (plainTextPassword !== undefined) {

    }
    
    // Fetch updated user data with password
    const rows = await sql/* sql */`
      SELECT 
        id as userid, 
        email, 
        firstname, 
        lastname, 
        department, 
        COALESCE(type, legacy_type) as type, 
        COALESCE(blocked, NOT is_active) as blocked, 
        lastlogindatetime,
        user_image,
        password
      FROM public.users 
      WHERE id = ${currentUserId} OR legacy_userid = ${currentUserId}
      LIMIT 1
    ` as Array<DbUser & { password?: string | null }>;
    
    const updatedUser = rows[0];
    
    // Return plain text password (exclude if hashed)
    return NextResponse.json({ 
      user: {
        ...updatedUser,
        password: updatedUser.password && !updatedUser.password.startsWith("scrypt:") ? updatedUser.password : null
      } 
    }, { status: 200 });
  } catch (error) {

    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
