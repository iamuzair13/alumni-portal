import type { AlumniRegistrationComprehensiveForm as AlumniForm } from "@/lib/alumniRegistration";

export async function createAlumni(payload: AlumniForm) {
  const res = await fetch("/api/alumni", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ? JSON.stringify(data.error) : "Failed to create alumni");
  return data as { ok: boolean; created: { alumniid: number; registrationno: string; sapid: string } };
}

export async function getAlumniBySapId(sapId: string) {
  const res = await fetch(`/api/alumni/${encodeURIComponent(sapId)}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? "Failed to fetch alumni");
  return data as { item: AlumniForm };
}

export async function updateAlumniBySapId(sapId: string, payload: AlumniForm) {
  const res = await fetch(`/api/alumni/${encodeURIComponent(sapId)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ? JSON.stringify(data.error) : "Failed to update alumni");
  return data as { ok: boolean; updated: { alumniid: number; sapid: string } };
}

export async function deleteAlumniBySapId(sapId: string) {
  const res = await fetch(`/api/alumni/${encodeURIComponent(sapId)}`, { method: "DELETE" });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? "Failed to delete alumni");
  return data as { ok: boolean };
}