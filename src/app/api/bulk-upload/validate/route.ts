import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isSuperAdminUser } from "@/lib/alumniProfile";
import { logAdminAction } from "@/lib/adminActivityLog";
import { validateRecords, ALLOWED_DB_COLUMNS } from "@/lib/bulk-upload";

export const dynamic = "force-dynamic";

type ValidateBody = {
  rows: Array<Record<string, unknown>>;
  fileName: string;
  mapping: Record<string, string>; // header -> dbColumn | "__skip__"
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
    const body = (await req.json()) as ValidateBody;
    const { rows, fileName, mapping } = body;

    if (!Array.isArray(rows)) {
      return NextResponse.json({ error: "Missing rows array" }, { status: 400 });
    }

    if (!mapping || typeof mapping !== "object") {
      return NextResponse.json({ error: "Missing mapping" }, { status: 400 });
    }

    // Validate that all target columns are in the allowlist
    for (const [header, target] of Object.entries(mapping)) {
      if (target !== "__skip__" && !ALLOWED_DB_COLUMNS.has(target)) {
        return NextResponse.json(
          { error: `Invalid target column "${target}" for header "${header}"` },
          { status: 400 }
        );
      }
    }

    // Check for duplicate target mappings (one destination should have one source)
    const targetCounts = new Map<string, string[]>();
    for (const [header, target] of Object.entries(mapping)) {
      if (target === "__skip__") continue;
      const sources = targetCounts.get(target) ?? [];
      sources.push(header);
      targetCounts.set(target, sources);
    }
    const duplicateMappings: Array<{ target: string; sources: string[] }> = [];
    for (const [target, sources] of targetCounts) {
      if (sources.length > 1) {
        duplicateMappings.push({ target, sources });
      }
    }

    const summary = await validateRecords(mapping, rows, fileName ?? "unknown");

    await logAdminAction({
      session,
      req,
      input: {
        action: "bulk_upload.validate",
        entityType: "bulk_upload",
        entityId: fileName,
        success: true,
        metadata: {
          totalRows: summary.totalRows,
          validRows: summary.validRows,
          invalidRows: summary.invalidRows,
          duplicateRows: summary.duplicateRows,
          duplicateMappings,
        },
      },
    });

    // Don't send validRecords to client — they're kept server-side for import
    return NextResponse.json({
      totalRows: summary.totalRows,
      validRows: summary.validRows,
      invalidRows: summary.invalidRows,
      duplicateRows: summary.duplicateRows,
      newRows: summary.newRows,
      errors: summary.errors.slice(0, 500), // Limit error details sent to client
      errorCount: summary.errors.length,
      duplicates: summary.duplicates.slice(0, 200),
      duplicateMappings,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Validation failed";

    await logAdminAction({
      session,
      req,
      input: {
        action: "bulk_upload.validate",
        entityType: "bulk_upload",
        success: false,
        errorMessage: message,
      },
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
