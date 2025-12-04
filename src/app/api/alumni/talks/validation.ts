type AvailabilityItem = {
  date: string;
  timings: string;
};

type MentorshipPayload = {
  major: string;
  areas: string[];
  topics: string[];
  mode: "Online" | "Face to Face";
  briefOutline: string;
  availability: AvailabilityItem[];
};

export function validatePayload(body: unknown): { ok: true; data: MentorshipPayload } | { ok: false; error: string } {
  const b = body as Partial<MentorshipPayload>;
  const major = String(b.major || "").trim();
  const areas = Array.isArray(b.areas) ? b.areas.map((s) => String(s).trim()).filter(Boolean) : [];
  const topics = Array.isArray(b.topics) ? b.topics.map((s) => String(s).trim()).filter(Boolean) : [];
  const mode = String(b.mode || "").trim();
  const briefOutline = String(b.briefOutline || "").trim();
  const availability = Array.isArray(b.availability) ? b.availability : [];
  
  if (!major) return { ok: false, error: "MAJOR_REQUIRED" };
  if (areas.length === 0) return { ok: false, error: "AREAS_REQUIRED" };
  if (topics.length === 0) return { ok: false, error: "TOPICS_REQUIRED" };
  if (mode !== "Online" && mode !== "Face to Face") return { ok: false, error: "MODE_INVALID" };
  if (!briefOutline) return { ok: false, error: "BRIEF_OUTLINE_REQUIRED" };
  
  // Validate availability - at least 3 dates required
  if (availability.length < 3) return { ok: false, error: "AVAILABILITY_MIN_3_REQUIRED" };
  
  // Validate each availability item
  for (let i = 0; i < availability.length; i++) {
    const avail = availability[i];
    const date = String(avail?.date || "").trim();
    const timings = String(avail?.timings || "").trim();
    
    if (!date) return { ok: false, error: `AVAILABILITY_DATE_REQUIRED_${i + 1}` };
    if (!timings) return { ok: false, error: `AVAILABILITY_TIMINGS_REQUIRED_${i + 1}` };
    
    // Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: `AVAILABILITY_DATE_INVALID_${i + 1}` };
    
    // Validate timings format (HH:MM-HH:MM)
    if (!/^\d{2}:\d{2}-\d{2}:\d{2}$/.test(timings)) return { ok: false, error: `AVAILABILITY_TIMINGS_INVALID_${i + 1}` };
    
    const [start, end] = timings.split("-");
    if (start >= end) return { ok: false, error: `AVAILABILITY_TIME_ORDER_INVALID_${i + 1}` };
    
    // Validate date is not in the past
    const selectedDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (selectedDate < today) return { ok: false, error: `AVAILABILITY_DATE_PAST_${i + 1}` };
  }
  
  return { ok: true, data: { major, areas, topics, mode: mode as "Online" | "Face to Face", briefOutline, availability } };
}