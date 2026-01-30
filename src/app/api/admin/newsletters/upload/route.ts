import { NextResponse } from "next/server";
import path from "path";
import { mkdir, writeFile } from "fs/promises";
import { auth } from "@/lib/auth";
import { isSuperAdminUser } from "@/lib/alumniProfile";
import crypto from "crypto";

export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024; // 5MB

function safeExtFromName(name: string): string {
  const ext = path.extname(name || "").toLowerCase();
  if (!ext) return "";
  // allow common image extensions only
  if ([".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(ext)) return ext;
  return "";
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    const canAccess = isSuperAdminUser(session?.user);
    if (!canAccess) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "FILE_REQUIRED" }, { status: 400 });
    }

    if (!String(file.type || "").toLowerCase().startsWith("image/")) {
      return NextResponse.json({ error: "INVALID_FILE_TYPE" }, { status: 400 });
    }

    if (typeof file.size === "number" && file.size > MAX_BYTES) {
      return NextResponse.json({ error: "FILE_TOO_LARGE" }, { status: 400 });
    }

    const extFromName = safeExtFromName(file.name);
    const extFromMime = (() => {
      const t = String(file.type || "").toLowerCase();
      if (t === "image/png") return ".png";
      if (t === "image/jpeg") return ".jpg";
      if (t === "image/webp") return ".webp";
      if (t === "image/gif") return ".gif";
      return "";
    })();

    const ext = extFromName || extFromMime || ".png";
    const filename = `${crypto.randomUUID()}${ext}`;

    const publicDir = path.join(process.cwd(), "public");
    const imagesDir = path.join(publicDir, "images");
    await mkdir(imagesDir, { recursive: true });

    const bytes = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(imagesDir, filename), bytes);

    return NextResponse.json({ url: `/images/${filename}`, filename }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
