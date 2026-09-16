import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isSuperAdminUser } from "@/lib/alumniProfile";
import { IMPORTABLE_COLUMNS, buildMappingSuggestions } from "@/lib/bulk-upload";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSuperAdminUser(session.user)) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  // Return the importable column definitions for the UI
  const columns = IMPORTABLE_COLUMNS.map((col) => ({
    dbColumn: col.dbColumn,
    label: col.label,
    type: col.type,
    required: col.required,
    maxLength: col.maxLength,
    aliases: col.aliases,
    group: col.group,
    description: col.description,
  }));

  return NextResponse.json({ columns });
}

export async function POST(req: Request) {
  // POST is used for auto-suggesting mappings given a set of headers
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSuperAdminUser(session.user)) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  try {
    const body = (await req.json()) as { headers: string[] };
    const { headers } = body;

    if (!Array.isArray(headers)) {
      return NextResponse.json({ error: "Missing headers array" }, { status: 400 });
    }

    const suggestions = buildMappingSuggestions(headers);

    return NextResponse.json({ mapping: suggestions });
  } catch {
    return NextResponse.json({ error: "Failed to generate suggestions" }, { status: 500 });
  }
}
