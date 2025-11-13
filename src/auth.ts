import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import type { User } from "next-auth";
import type { JWT } from "next-auth/jwt";
import type { Session } from "next-auth";
import { sql } from "@/lib/dbconnect";

type DbUser = {
  userid: number;
  email: string | null;
  firstname: string | null;
  lastname: string | null;
  department: string | null;
  type: string | null;
  blocked: boolean | null;
  lastlogindatetime: string | null;
};

interface UserWithDb extends User {
  dbUser?: DbUser;
}

interface AugmentedToken extends JWT {
  userId?: number;
  department?: string | null;
  type?: string | null;
  blocked?: boolean | null;
  firstName?: string | null;
  lastName?: string | null;
}

interface AugmentedSession extends Session {
  user: Session["user"] & {
    userId?: number;
    department?: string | null;
    type?: string | null;
    blocked?: boolean | null;
    firstName?: string | null;
    lastName?: string | null;
  };
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.AUTH_GOOGLE_ID || process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.AUTH_GOOGLE_SECRET || process.env.GOOGLE_CLIENT_SECRET || "",
      authorization: {
        params: {
          prompt: "consent",
          access_type: "online",
        },
      },
      checks: ["pkce", "state"],
    }),
    CredentialsProvider({
      name: "Email and Password",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        const email = String(credentials?.email || "").trim();
        const password = String(credentials?.password || "").trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const ip = (req as unknown as { ip?: string }).ip || req?.headers?.get?.("x-forwarded-for") || "unknown";

        const log = (status: string, msg: string) => {
          const ts = new Date().toISOString();
          console.info(`[auth] ${ts} ${status} email=${email} ip=${ip} ${msg}`);
        };

        if (!emailRegex.test(email)) {
          log("FAIL", "invalid email format");
          throw new Error("INVALID_EMAIL_FORMAT");
        }

        // Simple rate limit: max 5 attempts in 5 minutes per email+ip
        const key = `${email}|${String(ip)}`;
        rateLimitPrune();
        const rl = RATE_LIMIT.get(key) || { count: 0, last: Date.now() };
        const now = Date.now();
        if (now - rl.last > RATE_WINDOW_MS) {
          rl.count = 0;
        }
        rl.last = now;
        rl.count += 1;
        RATE_LIMIT.set(key, rl);
        if (rl.count > RATE_LIMIT_MAX) {
          log("FAIL", "rate limited");
          throw new Error("RATE_LIMITED");
        }

        const rows = await sql/* sql */`SELECT userid, email, password, firstname, lastname, department, type, blocked, lastlogindatetime FROM public.tbl_users WHERE email = ${email} LIMIT 1`;
        const dbUser: DbUser | undefined = rows[0] as (DbUser & { password: string | null }) | undefined;
        if (!dbUser) {
          log("FAIL", "email not registered");
          throw new Error("EMAIL_NOT_REGISTERED");
        }
        if (dbUser.blocked) {
          log("FAIL", "account blocked");
          throw new Error("USER_BLOCKED");
        }

        const stored = (rows[0] as { password: string | null }).password || "";
        const ok = await verifyPassword(password, stored);
        if (!ok) {
          log("FAIL", "invalid password");
          throw new Error("INVALID_PASSWORD");
        }
        if (stored && !stored.startsWith("scrypt:")) {
          try {
            const newHash = await hashPassword(password);
            await sql/* sql */`UPDATE public.tbl_users SET password = ${newHash} WHERE userid = ${dbUser.userid}`;
          } catch {}
        }

        const u: UserWithDb = {
          email: dbUser.email || email,
          name: `${dbUser.firstname ?? ""} ${dbUser.lastname ?? ""}`.trim() || undefined,
        } as UserWithDb;
        u.dbUser = dbUser;
        log("OK", "credentials verified");
        try {
          await sql/* sql */`UPDATE public.tbl_users SET lastlogindatetime = ${new Date().toISOString()} WHERE userid = ${dbUser.userid}`;
        } catch {}
        return u;
      },
    }),
  ],
  session: { strategy: "jwt" },
  jwt: { maxAge: 60 * 60 },
  pages: { signIn: "/signin" },
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  trustHost: true,
  callbacks: {
    async signIn({ user, account }) {
      if (!account || account.provider !== "google") return false;
      const email = user?.email ?? "";
      if (!email) return "/signin?error=INVALID_EMAIL";
      const rows = await sql/* sql */`SELECT userid, email, firstname, lastname, department, type, blocked, lastlogindatetime FROM public.tbl_users WHERE email = ${email} LIMIT 1`;
      let dbUser: DbUser | undefined = rows[0] as DbUser | undefined;
      if (!dbUser) {
        const fullName = String(user?.name || "").trim();
        const parts = fullName ? fullName.split(/\s+/) : [];
        const first = parts[0] || null;
        const last = parts.length > 1 ? parts.slice(1).join(" ") : null;
        const inserted = await sql/* sql */`INSERT INTO public.tbl_users (email, firstname, lastname, department, type, blocked, lastlogindatetime) VALUES (${email}, ${first}, ${last}, ${null}, ${"google"}, ${false}, ${new Date().toISOString()}) RETURNING userid, email, firstname, lastname, department, type, blocked, lastlogindatetime`;
        dbUser = inserted[0] as DbUser | undefined;
        if (!dbUser) return "/signin?error=USER_NOT_FOUND";
      }
      if (dbUser.blocked) return "/signin?error=USER_BLOCKED";
      const u: UserWithDb = user as UserWithDb;
      u.dbUser = dbUser;
      try {
        await sql/* sql */`UPDATE public.tbl_users SET lastlogindatetime = ${new Date().toISOString()} WHERE userid = ${dbUser.userid}`;
      } catch {}
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        const uw: UserWithDb = user as UserWithDb;
        const db = uw.dbUser;
        if (db) {
          const at: AugmentedToken = token as AugmentedToken;
          at.userId = db.userid;
          at.department = db.department;
          at.type = db.type;
          at.blocked = db.blocked;
          at.firstName = db.firstname;
          at.lastName = db.lastname;
          token.email = db.email || token.email;
          token.name = `${db.firstname ?? ""} ${db.lastname ?? ""}`.trim() || token.name;
          try {
            console.info(`[auth] jwt set userId=${String(at.userId)} email=${String(token.email)}`);
          } catch {}
        }
      } else {
        try {
          console.warn(`[auth] jwt without user, token email=${String(token.email)}`);
        } catch {}
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        const at: AugmentedToken = token as AugmentedToken;
        const s: AugmentedSession = session as AugmentedSession;
        s.user.email = String(token.email || s.user.email || "");
        s.user.userId = at.userId;
        s.user.department = at.department;
        s.user.type = at.type;
        s.user.blocked = at.blocked;
        s.user.firstName = at.firstName;
        s.user.lastName = at.lastName;
        s.user.name = String(token.name || s.user.name || "");
        try {
          console.info(`[auth] session set userId=${String(s.user.userId)} email=${String(s.user.email)}`);
        } catch {}
      } else {
        try {
          console.warn(`[auth] session without user`);
        } catch {}
      }
      return session;
    },
  },
  
});

const RATE_LIMIT = new Map<string, { count: number; last: number }>();
const RATE_LIMIT_MAX = 5;
const RATE_WINDOW_MS = 5 * 60 * 1000;
function rateLimitPrune() {
  const now = Date.now();
  for (const [k, v] of RATE_LIMIT.entries()) {
    if (now - v.last > RATE_WINDOW_MS) RATE_LIMIT.delete(k);
  }
}

async function hashPassword(plain: string): Promise<string> {
  const { randomBytes, scrypt } = await import("crypto");
  const salt = randomBytes(16);
  const buf: Buffer = await new Promise((resolve, reject) => {
    scrypt(plain, salt, 64, (err, derivedKey) => (err ? reject(err) : resolve(derivedKey as Buffer)));
  });
  return `scrypt:${salt.toString("hex")}:${buf.toString("hex")}`;
}

async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  if (!stored) return false;
  if (stored.startsWith("scrypt:")) {
    const parts = stored.split(":");
    const saltHex = parts[1];
    const hashHex = parts[2];
    const { scrypt } = await import("crypto");
    const salt = Buffer.from(saltHex, "hex");
    const buf: Buffer = await new Promise((resolve, reject) => {
      scrypt(plain, salt, 64, (err, derivedKey) => (err ? reject(err) : resolve(derivedKey as Buffer)));
    });
    return buf.toString("hex") === hashHex;
  }
  return stored === plain;
}