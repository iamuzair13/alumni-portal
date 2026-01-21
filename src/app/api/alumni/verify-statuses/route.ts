import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";

type RawStatusRow = {
  verify_status: string | null;
};

type VerifyStatus = {
  key: string;
  label: string;
};

function mapVerifyToStatus(raw: string): VerifyStatus | null {
  const v = raw.trim().toLowerCase();
  if (!v) return null;

  if (v === "true") {
    return { key: "verified", label: "Verified" };
  }
  if (v === "false") {
    return { key: "unverified", label: "Unverified" };
  }
  if (v === "underapproval") {
    return { key: "underApproval", label: "Under Approval" };
  }

  // Unknown / legacy values – return as-is for debugging but with a readable label
  return { key: v, label: v.charAt(0).toUpperCase() + v.slice(1) };
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rawRows = await sql/* sql */`
      SELECT DISTINCT LOWER(TRIM(verify)) AS verify_status
      FROM public.tbl_alumni
      WHERE verify IS NOT NULL AND TRIM(verify) <> ''
    `;
    const rows = rawRows as unknown as RawStatusRow[];

    const seen = new Set<string>();
    const statuses: VerifyStatus[] = [];

    for (const row of rows) {
      if (!row.verify_status) continue;
      const mapped = mapVerifyToStatus(row.verify_status);
      if (!mapped) continue;
      if (seen.has(mapped.key)) continue;
      seen.add(mapped.key);
      statuses.push(mapped);
    }

    return NextResponse.json({ statuses }, { status: 200 });
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Failed to fetch verify statuses";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}


