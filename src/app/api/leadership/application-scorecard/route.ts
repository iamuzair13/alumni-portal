import { NextRequest, NextResponse } from "next/server";
import { handleLeadershipScorecardDownload } from "@/lib/leadershipScorecardHandler";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const type = searchParams.get("type");
    const applicationIdRaw = searchParams.get("applicationId");

    if (type !== "chapter" && type !== "association") {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    const applicationId = Number(applicationIdRaw);
    if (!Number.isFinite(applicationId) || applicationId <= 0) {
      return NextResponse.json({ error: "Invalid applicationId" }, { status: 400 });
    }

    return await handleLeadershipScorecardDownload(req, type, applicationId);
  } catch (err: unknown) {
    console.error("[leadership/application-scorecard]", err);
    return NextResponse.json({ error: "Failed to generate scorecard" }, { status: 500 });
  }
}
