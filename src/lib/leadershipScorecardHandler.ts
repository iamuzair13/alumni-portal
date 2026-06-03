import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canModify } from "@/lib/alumniProfile";
import { logAdminAction } from "@/lib/adminActivityLog";
import { fetchLeadershipScorecardPayload } from "@/lib/leadershipScorecardData";
import { generateLeadershipScorecardPDF } from "@/lib/scorecardGenerator";

export async function handleLeadershipScorecardDownload(
  req: NextRequest,
  type: "chapter" | "association",
  applicationId: number
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canModify(session.user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = await fetchLeadershipScorecardPayload({
    session,
    type,
    applicationId,
  });

  if (!payload) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  const pdfBuffer = await generateLeadershipScorecardPDF(payload);

  await logAdminAction({
    session,
    req,
    input: {
      action: "leadership.scorecard_download",
      entityType: "leadership_application",
      entityId: `${type}:${applicationId}`,
      success: true,
      metadata: {
        action: "SCORECARD_DOWNLOADED",
        applicationId,
        leadershipType: type,
        downloadedBy: (session.user as { email?: string }).email ?? null,
        downloadedAt: new Date().toISOString(),
      },
    },
  });

  const filename = `leadership-scorecard-${type}-${applicationId}.pdf`;
  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
