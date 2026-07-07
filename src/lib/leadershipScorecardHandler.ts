import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canModify } from "@/lib/alumniProfile";
import { logAdminAction } from "@/lib/adminActivityLog";
import { fetchBulkLeadershipScorecardPayload } from "@/lib/leadershipScorecardData";
import { generateBulkLeadershipScorecardPDF } from "@/lib/scorecardGenerator";

const VALID_ROLES = new Set(["president", "vice_president", "coordinator", "all_roles"]);
const VALID_TYPES = new Set(["chapter", "association"]);
const ALL_SCORECARD_ROLES = ["president", "vice_president", "coordinator"] as const;

function parsePositiveInt(value: string | null): number | null {
  if (!value) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.trunc(n);
}

export async function handleBulkLeadershipScorecardDownload(
  req: NextRequest,
  role: string,
  type: string
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canModify(session.user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!VALID_ROLES.has(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  if (!VALID_TYPES.has(type)) {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }

  const nationalChapterId = parsePositiveInt(req.nextUrl.searchParams.get("nationalChapterId"));
  const internationalChapterId = parsePositiveInt(req.nextUrl.searchParams.get("internationalChapterId"));
  const associationId = parsePositiveInt(req.nextUrl.searchParams.get("associationId"));

  if (type === "chapter") {
    if (!nationalChapterId && !internationalChapterId) {
      return NextResponse.json({ error: "Chapter selection is required" }, { status: 400 });
    }
    if (nationalChapterId && internationalChapterId) {
      return NextResponse.json({ error: "Provide only one chapter filter" }, { status: 400 });
    }
  } else if (!associationId) {
    return NextResponse.json({ error: "Association selection is required" }, { status: 400 });
  }

  const fetchInput = {
    session,
    type: type as "chapter" | "association",
    nationalChapterId,
    internationalChapterId,
    associationId,
  };

  const payloads =
    role === "all_roles"
      ? await Promise.all(
          ALL_SCORECARD_ROLES.map((scorecardRole) =>
            fetchBulkLeadershipScorecardPayload({ ...fetchInput, role: scorecardRole })
          )
        )
      : [
          await fetchBulkLeadershipScorecardPayload({
            ...fetchInput,
            role: role as "president" | "vice_president" | "coordinator",
          }),
        ];

  const pdfBuffer = await generateBulkLeadershipScorecardPDF(
    role === "all_roles" ? payloads : payloads[0]
  );

  const primaryPayload = payloads[0];
  const totalApplicantCount = payloads.reduce((sum, p) => sum + p.applicants.length, 0);

  await logAdminAction({
    session,
    req,
    input: {
      action: "leadership.bulk_scorecard_download",
      entityType: "leadership_scorecard",
      entityId: `${type}:${role}`,
      success: true,
      metadata: {
        action: "BULK_SCORECARD_DOWNLOADED",
        role,
        leadershipType: type,
        nationalChapterId,
        internationalChapterId,
        associationId,
        categoryLabel: primaryPayload.categoryLabel,
        applicantCount: totalApplicantCount,
        ...(role === "all_roles"
          ? {
              rolesIncluded: ALL_SCORECARD_ROLES,
              applicantCountByRole: Object.fromEntries(
                payloads.map((p) => [p.role, p.applicants.length])
              ),
            }
          : {}),
        downloadedBy: (session.user as { email?: string }).email ?? null,
        downloadedAt: new Date().toISOString(),
      },
    },
  });

  const dateStamp = new Date().toISOString().slice(0, 10);
  const slug = primaryPayload.categoryLabel
    ? primaryPayload.categoryLabel.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase()
    : type;
  const filename = `leadership-scorecard-${type}-${role}-${slug}-${dateStamp}.pdf`;
  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
