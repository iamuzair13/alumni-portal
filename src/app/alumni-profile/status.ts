export type CardStatus = "none" | "under-review" | "inprocess" | "active" | "onhold" | "received" | "full";
export type MentorshipStatus = "none" | "applied" | "conducted";

export function deriveMentorshipStatus(row: { alumnitalks?: string | null; mentorshipprogram?: string | null } | undefined): MentorshipStatus {
  const a = String(row?.alumnitalks ?? "").toLowerCase().trim();
  const m = String(row?.mentorshipprogram ?? "").toLowerCase().trim();
  const val = a || m;
  if (!val) return "none";
  if (val === "conducted") return "conducted";
  return "applied";
}