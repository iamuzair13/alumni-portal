import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import type { User } from "next-auth";
import type { JWT } from "next-auth/jwt";
import type { Session } from "next-auth";
import { sql } from "@/lib/dbconnect";
import { authenticateCredentials } from "./auth/credentials";

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
        const ip = (req as unknown as { ip?: string }).ip || req?.headers?.get?.("x-forwarded-for") || "unknown";
        return authenticateCredentials(email, password, String(ip));
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
      const dbUser: DbUser | undefined = rows[0] as DbUser | undefined;
      if (!dbUser) return "/signin?error=USER_NOT_FOUND";
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
          token.name = `${db.firstname ?? ""} ${db.lastname ?? ""}`.trim();
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
        s.user.email = String(token.email || "");
        s.user.userId = at.userId;
        s.user.department = at.department;
        s.user.type = at.type;
        s.user.blocked = at.blocked;
        s.user.firstName = at.firstName;
        s.user.lastName = at.lastName;
        s.user.name = `${at.firstName ?? ""} ${at.lastName ?? ""}`.trim();
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