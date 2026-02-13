import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { canModify } from "@/lib/alumniProfile";
import { getEmailHistory } from "@/lib/emailLogs";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!canModify(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const alumniIdRaw = searchParams.get("alumniId");
    const recipientEmail = searchParams.get("recipientEmail");
    const limitRaw = searchParams.get("limit");

    const limit = limitRaw ? Number(limitRaw) : 50;

    const alumniId = alumniIdRaw ? Number(alumniIdRaw) : null;
    if (alumniIdRaw && (!Number.isFinite(alumniId) || (alumniId as number) <= 0)) {
      return NextResponse.json({ error: "Invalid alumniId" }, { status: 400 });
    }

    if (!alumniId && !recipientEmail) {
      return NextResponse.json({ items: [] }, { status: 200 });
    }

    const items = await getEmailHistory({
      alumniId: alumniId ?? undefined,
      recipientEmail: recipientEmail ?? undefined,
      limit,
    });

    return NextResponse.json({ items }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch email history";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
