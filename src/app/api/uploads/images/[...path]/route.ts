import { NextResponse } from "next/server";
import { extname } from "path";
import { readUploadFileBuffer } from "@/lib/resolveUploadFilePath";

function contentTypeFromFilename(filename: string): string {
  const ext = extname(filename).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".gif") return "image/gif";
  if (ext === ".webp") return "image/webp";
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".docx") {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (ext === ".doc") return "application/msword";
  return "application/octet-stream";
}

function isSafeFilename(filename: string): boolean {
  if (!filename) return false;
  if (filename.includes("..")) return false;
  if (filename.includes("/")) return false;
  if (filename.includes("\\")) return false;
  return true;
}

function decodeFilenameOnce(raw: string): string {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function contentDispositionFilename(filename: string): string {
  const safe = filename.replace(/[^\w.\-() ]+/g, "_");
  return `filename="${safe}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export async function GET(request: Request, ctx: { params: Promise<{ path?: string[] }> }) {
  try {
    const params = await ctx.params;
    const segments = Array.isArray(params.path) ? params.path : [];

    // Join catch-all segments (usually a single segment, e.g. "file.name.with.dots.pdf")
    let filename = segments.map((s) => String(s ?? "")).join("/").trim();

    // Fallback: derive from request URL if the matcher behaved oddly (e.g. dots in name)
    if (!filename) {
      const url = new URL(request.url);
      const prefix = "/api/uploads/images/";
      if (url.pathname.startsWith(prefix)) {
        filename = url.pathname.slice(prefix.length).replace(/\/+$/u, "");
      }
    }

    filename = decodeFilenameOnce(filename);
    filename = filename.split("?")[0]?.split("#")[0]?.trim() ?? "";

    if (!filename || !isSafeFilename(filename)) {
      return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
    }

    const resolved =
      (await readUploadFileBuffer(filename)) ??
      (await readUploadFileBuffer(segments.join("/")));
    const fileBuffer = resolved?.buffer ?? null;

    if (!fileBuffer) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const requestUrl = new URL(request.url);
    const forceDownload =
      requestUrl.searchParams.get("download") === "1" ||
      requestUrl.searchParams.get("download") === "true";
    const disposition = forceDownload ? "attachment" : "inline";

    return new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        "Content-Type": contentTypeFromFilename(filename),
        "Content-Disposition": `${disposition}; ${contentDispositionFilename(filename)}`,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to read file";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
