import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      items: [
        { id: "chapter-leadership", name: "Chapter Leadership" },
        { id: "association-leadership", name: "Association Leadership" },
        { id: "scholarship-application", name: "Scholarship Application" },
        { id: "gym-membership", name: "Gym Membership" },
        { id: "swimming-pool-membership", name: "Swimming Pool Membership" },
        { id: "cricket-membership", name: "Cricket Membership" },
      ],
    },
    { status: 200 }
  );
}
