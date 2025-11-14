type MentorshipPayload = {
  major: string;
  areas: string[];
  topics: string[];
  day: string;
  time: string;
};

const WEEKDAYS = new Set(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]);

export function validatePayload(body: unknown): { ok: true; data: MentorshipPayload } | { ok: false; error: string } {
  const b = body as Partial<MentorshipPayload>;
  const major = String(b.major || "").trim();
  const areas = Array.isArray(b.areas) ? b.areas.map((s) => String(s).trim()).filter(Boolean) : [];
  const topics = Array.isArray(b.topics) ? b.topics.map((s) => String(s).trim()).filter(Boolean) : [];
  const day = String(b.day || "").trim();
  const time = String(b.time || "").trim();
  if (!major) return { ok: false, error: "MAJOR_REQUIRED" };
  if (areas.length === 0) return { ok: false, error: "AREAS_REQUIRED" };
  if (topics.length === 0) return { ok: false, error: "TOPICS_REQUIRED" };
  if (!WEEKDAYS.has(day)) return { ok: false, error: "DAY_WEEKDAY_ONLY" };
  if (!/^\d{2}:\d{2}-\d{2}:\d{2}$/.test(time)) return { ok: false, error: "TIME_RANGE_INVALID" };
  const [start, end] = time.split("-");
  if (start >= end) return { ok: false, error: "TIME_RANGE_ORDER" };
  return { ok: true, data: { major, areas, topics, day, time } };
}