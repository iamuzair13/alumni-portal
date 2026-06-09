import { NextRequest, NextResponse } from "next/server";
import { handleBulkLeadershipScorecardDownload } from "@/lib/leadershipScorecardHandler";

export async function GET(req: NextRequest) {
  try {
    const role = req.nextUrl.searchParams.get("role") || "";
    const type = req.nextUrl.searchParams.get("type") || "";
    return await handleBulkLeadershipScorecardDownload(req, role, type);
  } catch (err) {
    console.error("[leadership/bulk-scorecard]", err);
    return NextResponse.json({ error: "Failed to generate scorecard" }, { status: 500 });
  }
}
