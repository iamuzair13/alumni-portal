import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isSuperAdminUser } from "@/lib/alumniProfile";
import { logAdminAction } from "@/lib/adminActivityLog";
import { parseUploadedFile } from "@/lib/bulk-upload";

export const dynamic = "force-dynamic";

const ALLOWED_EXTENSIONS = new Set(["xlsx", "xls", "csv"]);
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

export async function POST(req: Request) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSuperAdminUser(session.user)) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit` },
        { status: 400 }
      );
    }

    // Validate file extension
    const fileName = file.name.toLowerCase();
    const extension = fileName.split(".").pop() ?? "";
    if (!extension || !ALLOWED_EXTENSIONS.has(extension)) {
      return NextResponse.json(
        { error: "Unsupported file type. Only .xlsx, .xls, and .csv files are allowed." },
        { status: 400 }
      );
    }

    // Read file into buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse the file server-side
    const result = parseUploadedFile(buffer, file.name, extension);

    await logAdminAction({
      session,
      req,
      input: {
        action: "bulk_upload.parse",
        entityType: "bulk_upload",
        entityId: file.name,
        success: true,
        metadata: {
          fileName: file.name,
          fileSize: file.size,
          totalRows: result.totalRows,
          headerCount: result.headers.length,
        },
      },
    });

    // Return all rows to client — stateless approach (no server-side session store)
    // The client holds the rows and sends them back for validate/import
    return NextResponse.json({
      fileName: result.fileName,
      sheetName: result.sheetName,
      headers: result.headers,
      totalRows: result.totalRows,
      sampleRows: result.sampleRows,
      headerIssues: result.headerIssues,
      rows: result.allRows,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to parse file";

    await logAdminAction({
      session,
      req,
      input: {
        action: "bulk_upload.parse",
        entityType: "bulk_upload",
        success: false,
        errorMessage: message,
      },
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
