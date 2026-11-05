/**
 * Mint a local NextAuth v5 session cookie for perf measurement.
 * Uses the project's own AUTH_SECRET — dev/local use only.
 *   npx tsx scripts/make-session.ts [type]
 *   type: superadmin (default) | admin | viewer | alumni
 */
import { encode } from "next-auth/jwt";

async function main() {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET not set");
  const type = process.argv[2] || "superadmin";
  const presets: Record<string, object> = {
    superadmin: { userId: 103, type: "superadmin", email: "superadmin@test.local", name: "Perf Super", sub: "u:103" },
    admin: { userId: 102, type: "admin", email: "admin@test.local", name: "Perf Admin", sub: "u:102" },
    viewer: { userId: 101, type: "viewer", email: "viewer@test.local", name: "Perf Viewer", sub: "u:101" },
    alumni: { userId: 1, type: "alumni", sapid: "SAP-A-001", registrationno: "REG-A-1", email: "a@test.local", name: "Alumni A", sub: "a:1" },
  };
  const token = await encode({
    token: { ...(presets[type] ?? presets.superadmin), iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 },
    secret,
    salt: "authjs.session-token",
    maxAge: 3600,
  });
  console.log(`authjs.session-token=${token}`);
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });
