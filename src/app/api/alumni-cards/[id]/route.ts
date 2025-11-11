import { NextResponse } from "next/server";
import { alumniCardServerSchema, type ServerAlumniCardPayload } from "@/lib/alumniCards";

type AlumniCard = ServerAlumniCardPayload & { id: string };

// Simple per-route storage; in a real app, share a store or use DB.
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
];

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params;
  const item = ALUMNI_CARDS.find((c) => c.id === params.id);
  if (!item) return NextResponse.json({ message: "Not found" }, { status: 404 });
  return NextResponse.json(item, { status: 200 });
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const params = await ctx.params;
    const body = await req.json();
    const parsed = alumniCardServerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: "Validation failed", issues: parsed.error.format() }, { status: 422 });
    }
    const idx = ALUMNI_CARDS.findIndex((c) => c.id === params.id);
    if (idx === -1) return NextResponse.json({ message: "Not found" }, { status: 404 });
    const payload: ServerAlumniCardPayload = parsed.data;
    const updated: AlumniCard = { id: params.id, ...payload };
    ALUMNI_CARDS[idx] = updated;
    return NextResponse.json(updated, { status: 200 });
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }
}

export async function DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params;
  const idx = ALUMNI_CARDS.findIndex((c) => c.id === params.id);
  if (idx === -1) return NextResponse.json({ message: "Not found" }, { status: 404 });
  ALUMNI_CARDS.splice(idx, 1);
  return new NextResponse(null, { status: 204 });
}