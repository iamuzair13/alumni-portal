import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isSuperAdminUser } from "@/lib/alumniProfile";
import { logAdminAction } from "@/lib/adminActivityLog";
import { validateRecords, importRecords, ALLOWED_DB_COLUMNS } from "@/lib/bulk-upload";

export const dynamic = "force-dynamic";

type ImportBody = {
  rows: Array<Record<string, unknown>>;
  fileName: string;
  mapping: Record<string, string>;
};

export async function POST(req: Request) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSuperAdminUser(session.user)) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  try {
    const body = (await req.json()) as ImportBody;
    const { rows, fileName, mapping } = body;

    if (!Array.isArray(rows)) {
      return NextResponse.json({ error: "Missing rows array" }, { status: 400 });
    }

    if (!mapping || typeof mapping !== "object") {
      return NextResponse.json({ error: "Missing mapping" }, { status: 400 });
    }

    // Validate that all target columns are in the allowlist
    for (const target of Object.values(mapping)) {
      if (target !== "__skip__" && !ALLOWED_DB_COLUMNS.has(target)) {
        return NextResponse.json(
          { error: `Invalid target column "${target}"` },
          { status: 400 }
        );
      }
    }

    // Re-validate before importing (defense in depth)
    const summary = await validateRecords(mapping, rows, fileName ?? "unknown");

    if (summary.validRecords.length === 0) {
      return NextResponse.json(
        { error: "No valid records to import after validation." },
        { status: 400 }
      );
    }

    const result = await importRecords(summary.validRecords);

    await logAdminAction({
      session,
      req,
      input: {
        action: "bulk_upload.import",
        entityType: "bulk_upload",
        entityId: fileName,
        success: result.failed === 0,
        metadata: {
          fileName,
          totalRows: result.totalRows,
          inserted: result.inserted,
          skipped: result.skipped,
          failed: result.failed,
          durationMs: result.durationMs,
          errors: result.errors.slice(0, 50),
        },
      },
    });

    return NextResponse.json({
      totalRows: result.totalRows,
      inserted: result.inserted,
      skipped: result.skipped,
      failed: result.failed,
      errors: result.errors,
      durationMs: result.durationMs,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Import failed";

    await logAdminAction({
      session,
      req,
      input: {
        action: "bulk_upload.import",
        entityType: "bulk_upload",
        success: false,
        errorMessage: message,
      },
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
