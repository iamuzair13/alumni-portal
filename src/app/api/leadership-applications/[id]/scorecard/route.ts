import { NextRequest, NextResponse } from "next/server";
import { handleLeadershipScorecardDownload } from "@/lib/leadershipScorecardHandler";

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const type = req.nextUrl.searchParams.get("type");

    if (type !== "chapter" && type !== "association") {
      return NextResponse.json({ error: "Invalid type. Use ?type=chapter or ?type=association" }, { status: 400 });
    }

    const applicationId = Number(id);
    if (!Number.isFinite(applicationId) || applicationId <= 0) {
      return NextResponse.json({ error: "Invalid application id" }, { status: 400 });
    }

    return await handleLeadershipScorecardDownload(req, type, applicationId);
  } catch (err: unknown) {
    console.error("[leadership-applications/scorecard]", err);
    return NextResponse.json({ error: "Failed to generate scorecard" }, { status: 500 });
  }
}
