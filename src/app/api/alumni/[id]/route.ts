import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params || {};
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  // Mocked dataset; replace with real data source
  const detail = {
    id,
    name: `User ${id}`,
    password: "P@ssw0rd!",
    email: `user.${id}@example.com`,
    gender: "Prefer not to say",
    cnicOrPassport: "12345-6789012-3",
    address: "123 Main Street",
    province: "Punjab",
    homeCity: "Lahore",
    homeCountry: "Pakistan",
    maritalStatus: "Single",
    dob: "1990-01-15",
    campus: "Main Campus",
    faculty: "Computer Science",
    degreeTitle: "BSc Computer Science",
    sector: "Technology",
    subSector: "Software",
    organization: "Example Corp",
    designation: "Software Engineer",
    experienceDuration: "5 years",
    source: "Self-Reported",
    verified: id.length % 2 === 0,
    category: "Alumni",
  };

  return NextResponse.json(detail, { status: 200 });
}