import { NextResponse } from "next/server";
import { eventServerSchema, type ServerEventPayload } from "@/lib/events";
import { sql } from "@/lib/dbconnect";

type EventListItem = {
  id: string;
  title: string;
  venue: string;
  shortDescription: string;
  imageUrl?: string;
  category?: string;
  startTimeUTC?: string;
  endTimeUTC?: string;
};

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

export async function GET() {
  try {
    const rows = await sql/* sql */`
      SELECT id, category, title, shortdescription, longdescription, fromdate, todate, eventtime, image1
      FROM public.tbl_events
      ORDER BY fromdate DESC
      LIMIT 200` as EventRow[];
    const items = rows.map((r): EventListItem => {
      const id = String(r.id ?? "");
      const title = String(r.title ?? "");
      const venue = ""; // not present in schema
      const shortDescription = String(r.shortdescription ?? "");
      const imageUrl = String(r.image1 ?? "");
      const category = String(r.category ?? "");
      const startTimeUTC = toUtcIso(r.fromdate, r.eventtime);
      const endTimeUTC = toUtcIso(r.todate, r.eventtime) ?? startTimeUTC;
      return { id, title, venue, shortDescription, imageUrl, category, startTimeUTC, endTimeUTC };
    });
    return NextResponse.json({ items }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch events";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = eventServerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: "Validation failed", issues: parsed.error.format() }, { status: 422 });
    }
    const v: ServerEventPayload = parsed.data;
    const extractDate = (iso?: string | null) => {
      if (!iso) return null;
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return null;
      return d.toISOString().slice(0, 10);
    };
    const extractTimeHM = (iso?: string | null) => {
      if (!iso) return null;
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return null;
      const hh = String(d.getUTCHours()).padStart(2, "0");
      const mm = String(d.getUTCMinutes()).padStart(2, "0");
      return `${hh}:${mm}`;
    };
    const fromDate = extractDate(v.startTimeUTC) ?? extractDate(v.date);
    const toDate = extractDate(v.endTimeUTC) ?? fromDate;
    const eventTime = extractTimeHM(v.startTimeUTC);
    await sql/* sql */`
      INSERT INTO public.tbl_events (category, title, shortdescription, longdescription, fromdate, todate, eventtime, image1)
      VALUES (${v.category}, ${v.title}, ${v.shortHtml?.slice(0, 500) || null}, ${v.description || null}, ${fromDate}, ${toDate}, ${eventTime}, ${v.imageUrl || null})`;
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Invalid JSON";
    return NextResponse.json({ message: msg }, { status: 400 });
  }
}