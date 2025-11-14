import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";

function toUtcIso(date: unknown, time?: unknown): string | undefined {
  try {
    const d = date ? new Date(String(date)) : null;
    if (!d || Number.isNaN(d.getTime())) return undefined;
    if (time) {
      const [hh, mm] = String(time).split(":");
      d.setHours(Number(hh) || 0, Number(mm) || 0, 0, 0);
    }
    return d.toISOString();
  } catch {
    return undefined;
  }
}

type EventRow = {
  id: number;
  category: string | null;
  title: string | null;
  shortdescription: string | null;
  longdescription: string | null;
  fromdate: string | null;
  todate: string | null;
  eventtime: string | null;
  image1: string | null;
};

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const eid = Number(id);
    const rows = await sql/* sql */`
      SELECT id, category, title, shortdescription, longdescription, fromdate, todate, eventtime, image1
      FROM public.tbl_events WHERE id = ${eid} LIMIT 1` as EventRow[];
    const r = rows[0];
    if (!r) return NextResponse.json({ message: "Not found" }, { status: 404 });
    const result = {
      id: String(r.id ?? ""),
      title: String(r.title ?? ""),
      venue: "",
      shortDescription: String(r.shortdescription ?? ""),
      imageUrl: String(r.image1 ?? ""),
      category: String(r.category ?? ""),
      startTimeUTC: toUtcIso(r.fromdate, r.eventtime),
      endTimeUTC: toUtcIso(r.todate, r.eventtime) ?? toUtcIso(r.fromdate, r.eventtime),
    };
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch event";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const eid = Number(id);
    const res = await sql/* sql */`DELETE FROM public.tbl_events WHERE id = ${eid} RETURNING id`;
    if (!res[0]) return NextResponse.json({ message: "Not found" }, { status: 404 });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to delete";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}