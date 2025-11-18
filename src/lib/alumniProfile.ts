import type { Session } from "next-auth";

export function isAdminUser(user: Session["user"] | null | undefined): boolean {
  const t = String((user as unknown as { type?: string })?.type || "").toLowerCase();
  return t === "staff";
}

export function computeLoginBanner(user: Session["user"] | null | undefined): { show: boolean; message: string } {
  const email = user?.email ? String(user.email) : "";
  const type = String((user as unknown as { type?: string })?.type || "").toLowerCase();
  if (!email) return { show: true, message: "Please sign in to view your alumni profile." };
  if (type === "staff") return { show: false, message: "" };
  if (type !== "alumni") return { show: true, message: "Only alumni accounts can access this page." };
  return { show: false, message: "" };
}

export function safeText(v: unknown): string {
  const s = String(v ?? "").trim();
  return s;
}

export function formatPhone(v: unknown): string {
  const raw = safeText(v);
  if (!raw) return "";
  const cleaned = raw.replace(/\s+/g, "");
  if (!/^\+?\d{7,}$/.test(cleaned)) return raw;
  const hasPlus = cleaned.startsWith("+");
  const digits = hasPlus ? cleaned.slice(1) : cleaned;
  const code = digits.slice(0, Math.min(3, digits.length - 7));
  const num = digits.slice(code.length);
  return `+${code} ${num}`;
}

export function composeFacultyDept(fac: unknown, dep: unknown): string {
  const f = safeText(fac);
  const d = safeText(dep);
  if (f && d) return `${f} — ${d}`;
  return f || d;
}