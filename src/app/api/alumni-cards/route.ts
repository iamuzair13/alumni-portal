import { NextResponse } from "next/server";
import { alumniCardServerSchema, type ServerAlumniCardPayload } from "@/lib/alumniCards";

type AlumniCard = ServerAlumniCardPayload & { id: string };

// In-memory mock storage, consistent with events and alumniStories routes
const ALUMNI_CARDS: AlumniCard[] = [
  {
    id: "AC-2001",
    name: "Ayesha Khan",
    email: "ayesha.khan@example.com",
    program: "MBA",
    campus: "Lahore",
    faculty: "Management Sciences",
    passingYear: 2020,
    workCountry: "Pakistan",
    status: "active",
    createdAt: new Date(2020, 5, 12).toISOString(),
  },
  {
    id: "AC-2002",
    name: "Usman Ali",
    email: "usman.ali@example.com",
    program: "BSCS",
    campus: "Karachi",
    faculty: "Computer Science",
    passingYear: 2019,
    workCountry: "UAE",
    status: "pending",
    createdAt: new Date(2019, 3, 18).toISOString(),
  },
  {
    id: "AC-2003",
    name: "Zainab Ahmad",
    email: "zainab.ahmad@example.com",
    program: "BA English",
    campus: "Islamabad",
    faculty: "Arts & Humanities",
    passingYear: 2018,
    workCountry: "UK",
    status: "declined",
    createdAt: new Date(2018, 10, 3).toISOString(),
  },
];

export async function GET() {
  // Parity with other card APIs: return full list without server-side filters
  return NextResponse.json(ALUMNI_CARDS, { status: 200 });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = alumniCardServerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: "Validation failed", issues: parsed.error.format() }, { status: 422 });
    }
    const payload: ServerAlumniCardPayload = parsed.data;
    const id = payload.id && payload.id.trim().length ? payload.id : `AC-${Math.floor(1000 + Math.random() * 9000)}`;
    const created: AlumniCard = { id, ...payload };
    ALUMNI_CARDS.push(created);
    return NextResponse.json(created, { status: 201 });
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }
}