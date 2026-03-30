import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDashboardAnalytics, getModuleAnalytics, parseAnalyticsParams } from "@/lib/analytics/service";
import type { AnalyticsModule } from "@/lib/analytics/types";

function hasType(u: unknown): u is { type?: string } {
  return typeof u === "object" && u !== null && "type" in u;
}

function isAdminDashboardRole(role: string) {
  const r = role.toLowerCase().trim();
  return r === "admin" || r === "superadmin" || r === "viewer" || r === "user";
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = String(hasType(session.user) ? session.user.type ?? "" : "").toLowerCase().trim();
    if (!isAdminDashboardRole(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const { module, period } = parseAnalyticsParams({
      module: searchParams.get("module"),
      period: searchParams.get("period"),
    });

    if (module === "dashboard") {
      const res = await getDashboardAnalytics(period);
      return NextResponse.json(res, { status: 200 });
    }

    const res = await getModuleAnalytics(module as Exclude<AnalyticsModule, "dashboard">, period);
    return NextResponse.json(res, { status: 200 });
  } catch (err: unknown) {
    const status = typeof err === "object" && err !== null && "status" in err ? Number((err as any).status) : 500;
    const message = err instanceof Error ? err.message : "Failed to fetch analytics";
    if (status === 400) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

