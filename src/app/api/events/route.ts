import { NextResponse } from "next/server";
import { eventServerSchema, type ServerEventPayload } from "@/lib/events";

type Event = {
  id: string;
  date: string;
  title: string;
  venue: string;
  shortDescription: string;
  imageUrl?: string;
  category: string;
  organizer: string;
  cityCountry: string;
  shortHtml?: string;
  description: string;
  isFeatured: boolean;
  startTimeUTC: string;
  endTimeUTC: string;
};

const EVENTS: Event[] = [
  {
    id: "E-2001",
    date: "2024-01-15",
    title: "AI Seminar",
    venue: "Main Auditorium",
    shortDescription: "Explore the latest in AI research and applications.",
    imageUrl: "https://i.pravatar.cc/64?u=E-2001",
    category: "Seminar",
    organizer: "Alumni Office",
    cityCountry: "Lahore, Pakistan",
    shortHtml: "<b>Welcome</b> to the seminar",
    description: "A deep dive into AI.",
    isFeatured: false,
    startTimeUTC: "2024-01-15T09:00:00Z",
    endTimeUTC: "2024-01-15T11:00:00Z",
  },
];

export async function GET() {
  return NextResponse.json(EVENTS, { status: 200 });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = eventServerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: "Validation failed", issues: parsed.error.format() }, { status: 422 });
    }
    const payload: ServerEventPayload = parsed.data;
    const id = `E-${Math.floor(1000 + Math.random() * 9000)}`;
    const created = { id, ...payload, shortDescription: payload.shortHtml?.slice(0, 120) || "" };
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }
}