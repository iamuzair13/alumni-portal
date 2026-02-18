import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { isAdminUser, isViewerUser, isSuperAdminUser } from "@/lib/alumniProfile";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { hashAdminPassword } from "@/lib/adminPassword";

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
    
    return NextResponse.json({ 
      user: {
        ...user,
        password: user.password ?? null
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

    const isRestrictedStaff = (isAdmin || isViewer) && !isSuperAdmin;
    const nonEmptyKeys = Object.keys(body || {}).filter((k) => {
      if (k === "newPassword") return false;
      if (k === "user_image") return false;
      const v = (body as Record<string, unknown>)[k];
      if (v === undefined || v === null) return false;
      if (typeof v === "string") return v.trim().length > 0;
      if (Array.isArray(v)) return v.length > 0;
      if (typeof v === "object") return true;
      return true;
    });

    if (isRestrictedStaff && nonEmptyKeys.length > 0) {
      return NextResponse.json({ error: "FORBIDDEN: You can only update your password and image" }, { status: 403 });
    }
    
    // Validate email if provided
    if (body.email && !isRestrictedStaff) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(String(body.email))) {
        return NextResponse.json({ error: "INVALID_EMAIL_FORMAT" }, { status: 400 });
      }
    }
    
    // Validate and process new password if provided
    let plainTextPassword: string | undefined = undefined;
    let storedPasswordHash: string | undefined = undefined;
    if (body.newPassword && String(body.newPassword).trim().length > 0) {
      const newPasswordStr = String(body.newPassword).trim();
      if (newPasswordStr.length < 8) {
        return NextResponse.json({ error: "WEAK_PASSWORD" }, { status: 400 });
      }
      // Store plain text in password field (system rule: plain text everywhere)
      plainTextPassword = newPasswordStr;
      storedPasswordHash = (isAdmin || isSuperAdmin || isViewer) ? await hashAdminPassword(newPasswordStr) : newPasswordStr;

    } else {

    }
    
    const passwordUpdateFragment =
      plainTextPassword !== undefined && storedPasswordHash !== undefined
        ? sql`password = ${plainTextPassword}, password_hash = ${storedPasswordHash},`
        : sql``;

    // Build update query - only include fields that are provided
    // Use conditional SQL fragments, ensuring proper comma placement
    await sql/* sql */`
      UPDATE public.users
      SET
        ${body.email !== undefined && !isRestrictedStaff ? sql`email = ${body.email},` : sql``}
        ${passwordUpdateFragment}
        ${body.firstname !== undefined && !isRestrictedStaff ? sql`firstname = ${body.firstname},` : sql``}
        ${body.lastname !== undefined && !isRestrictedStaff ? sql`lastname = ${body.lastname},` : sql``}
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
    
    return NextResponse.json({ 
      user: {
        ...updatedUser,
        password: updatedUser.password ?? null
      } 
    }, { status: 200 });
  } catch (error) {

    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
