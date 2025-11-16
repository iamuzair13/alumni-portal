export type AlumniDetail = {
  id: string;
  name: string;
  password?: string;
  email?: string;
  gender?: string;
  cnicOrPassport?: string;
  address?: string;
  province?: string;
  homeCity?: string;
  homeCountry?: string;
  maritalStatus?: string;
  dob?: string;
  campus?: string;
  faculty?: string;
  degreeTitle?: string;
  sector?: string;
  subSector?: string;
  organization?: string;
  designation?: string;
  experienceDuration?: string;
  source?: string;
  verified?: boolean;
  category?: string;
};

type AlumniApiResponse = { item?: Record<string, unknown> };

export async function getAlumniDetailForTest(sapid: string): Promise<AlumniDetail> {
  const res = await fetch(`/api/alumni/${encodeURIComponent(sapid)}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed (${res.status})`);
  const j = (await res.json()) as AlumniApiResponse;
  const item = j.item || {};
  return {
    id: sapid,
    name: String((item as Record<string, unknown>).name || ""),
    password: String((item as Record<string, unknown>).password || ""),
    email: String((item as Record<string, unknown>).personalEmail || (item as Record<string, unknown>).officialEmail || ""),
    gender: String((item as Record<string, unknown>).gender || ""),
    cnicOrPassport: String((item as Record<string, unknown>).cnicOrPassport || ""),
    address: String((item as Record<string, unknown>).address || ""),
    province: String((item as Record<string, unknown>).province || ""),
    homeCity: String((item as Record<string, unknown>).homeCity || ""),
    homeCountry: String((item as Record<string, unknown>).homeCountry || ""),
    maritalStatus: String((item as Record<string, unknown>).maritalStatus || ""),
    dob: String((item as Record<string, unknown>).dob || ""),
    campus: String((item as Record<string, unknown>).campus || ""),
    faculty: String((item as Record<string, unknown>).faculty || ""),
    degreeTitle: String((item as Record<string, unknown>).program || ""),
    sector: (item as Record<string, unknown>).sector ? String((item as Record<string, unknown>).sector) : undefined,
    subSector: (item as Record<string, unknown>).subSector ? String((item as Record<string, unknown>).subSector) : undefined,
    organization: (item as Record<string, unknown>).organization ? String((item as Record<string, unknown>).organization) : undefined,
    designation: (item as Record<string, unknown>).designation ? String((item as Record<string, unknown>).designation) : undefined,
    experienceDuration: (item as Record<string, unknown>).totalExperienceYears ? String((item as Record<string, unknown>).totalExperienceYears) : undefined,
    source: (item as Record<string, unknown>).source ? String((item as Record<string, unknown>).source) : undefined,
    verified: !!(item as Record<string, unknown>).verified,
    category: (item as Record<string, unknown>).category ? String((item as Record<string, unknown>).category) : undefined,
  };
}