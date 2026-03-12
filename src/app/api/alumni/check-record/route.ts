import { NextRequest, NextResponse } from "next/server";

import { sql } from "@/lib/dbconnect";

const RATE_LIMIT = new Map<string, { count: number; last: number }>();
const RATE_LIMIT_MAX = 20;
const RATE_WINDOW_MS = 5 * 60 * 1000;

function rateLimitPrune() {
  const now = Date.now();
  for (const [k, v] of RATE_LIMIT.entries()) {
    if (now - v.last > RATE_WINDOW_MS) RATE_LIMIT.delete(k);
  }
}

function normalizeIdentifier(input: unknown): string {
  const raw = typeof input === "string" ? input : "";
  const v = raw.trim();
  if (!v) return "";
  if (v.length > 50) return "";
  if (!/^[a-zA-Z0-9\-_/]+$/.test(v)) return "";
  return v;
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") || "unknown";

    rateLimitPrune();
    const rlKey = `alumni-check-record|${String(ip)}`;
    const now = Date.now();
    const rl = RATE_LIMIT.get(rlKey) || { count: 0, last: now };
    if (now - rl.last > RATE_WINDOW_MS) rl.count = 0;
    rl.last = now;
    rl.count += 1;
    RATE_LIMIT.set(rlKey, rl);
    if (rl.count > RATE_LIMIT_MAX) {
      return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
    }

    if (process.env.NODE_ENV === "production") {
      const proto = req.headers.get("x-forwarded-proto") || "";
      if (proto.toLowerCase() !== "https") {
        return NextResponse.json({ error: "HTTPS_REQUIRED" }, { status: 400 });
      }
    }

    const body = (await req.json().catch(() => null)) as { identifier?: unknown } | null;
    const identifier = normalizeIdentifier(body?.identifier);
    if (!identifier) {
      return NextResponse.json({ error: "INVALID_IDENTIFIER" }, { status: 400 });
    }

    const rows = await sql/* sql */`
      SELECT 1
      FROM public.tbl_alumni
      WHERE sapid = ${identifier}
         OR registrationno = ${identifier}
      LIMIT 1
    `;

    return NextResponse.json({ exists: Boolean(rows && rows.length > 0) }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to check record";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
