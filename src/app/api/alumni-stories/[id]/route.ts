import { NextResponse } from "next/server";
import { storyServerSchema } from "@/lib/alumniStories";

type Story = {
  id: string;
  date: string;
  name: string;
  program: string;
  session: string;
  shortDescription: string;
  imageUrl: string;
};

const STORIES: Story[] = [
  {
    id: "S-1001",
    date: "2023-09-12",
    name: "Ali Raza",
    program: "BSCS",
    session: "2021",
    shortDescription: "Explored AI and ML during final year; now at a local startup.",
    imageUrl: "https://i.pravatar.cc/64?u=S-1001",
  },
  {
    id: "S-1002",
    date: "2022-01-05",
    name: "Sara Khan",
    program: "BBA",
    session: "2020",
    shortDescription: "Finance enthusiast who led student investment club initiatives.",
    imageUrl: "https://i.pravatar.cc/64?u=S-1002",
  },
  {
    id: "S-1003",
    date: "2021-11-20",
    name: "Hassan Ali",
    program: "BEE",
    session: "2019",
    shortDescription: "Designed solar microgrid projects during capstone.",
    imageUrl: "https://i.pravatar.cc/64?u=S-1003",
  },
  {
    id: "S-1004",
    date: "2024-02-18",
    name: "Fatima Noor",
    program: "BS Biology",
    session: "2022",
    shortDescription: "Worked on CRISPR research as a lab assistant.",
    imageUrl: "https://i.pravatar.cc/64?u=S-1004",
  },
];

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const story = STORIES.find((s) => s.id === params.id);
  if (!story) return NextResponse.json({ message: "Not found" }, { status: 404 });
  return NextResponse.json(story, { status: 200 });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  // Stubbed delete endpoint: in a real implementation, remove from database.
  const exists = STORIES.some((s) => s.id === params.id);
  if (!exists) return NextResponse.json({ message: "Not found" }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const parsed = storyServerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: "Validation failed", issues: parsed.error.format() }, { status: 422 });
    }
    const updated = { id: params.id, ...parsed.data };
    return NextResponse.json(updated, { status: 200 });
  } catch (e) {
    return NextResponse.json({ message: "Invalid payload" }, { status: 400 });
  }
}