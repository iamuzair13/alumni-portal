import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAlumniTrends } from "@/services/dashboardService";
import type { AnalyticsPeriod } from "@/lib/analytics/types";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const periodRaw = (searchParams.get("period") || "monthly").toLowerCase();
    const allowed: AnalyticsPeriod[] = ["daily", "weekly", "monthly", "yearly"];
    const period: AnalyticsPeriod = allowed.includes(periodRaw as AnalyticsPeriod)
      ? (periodRaw as AnalyticsPeriod)
      : "monthly";

    const data = await getAlumniTrends(period);
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch alumni trends";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

