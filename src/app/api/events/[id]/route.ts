import { NextResponse } from "next/server";

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

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const evt = EVENTS.find((e) => e.id === params.id);
  if (!evt) return NextResponse.json({ message: "Not found" }, { status: 404 });
  return NextResponse.json(evt, { status: 200 });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const exists = EVENTS.some((e) => e.id === params.id);
  if (!exists) return NextResponse.json({ message: "Not found" }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}