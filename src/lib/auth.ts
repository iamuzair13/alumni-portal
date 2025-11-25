import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import type { User } from "next-auth";
import type { JWT } from "next-auth/jwt";
import type { Session } from "next-auth";
import { authenticateCredentials } from "../auth/credentials";

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
  alumniDb?: {
    alumniid: number;
    alumniname: string | null;
    departmentname: string | null;
    facultyname: string | null;
    degreetitle: string | null;
    yearofending: number | null;
    campusname: string | null;
    alumnistatus: string | null;
    verify: string | boolean | null;
    alumniemail: string | null;
    personalemail: string | null;
    officialemail: string | null;
    universityemail: string | null;
  };
}

interface AugmentedToken extends JWT {
  userId?: number;
  department?: string | null;
  type?: string | null;
  blocked?: boolean | null;
  firstName?: string | null;
  lastName?: string | null;
  sapid?: string | null; // Add SAP ID for alumni
}

interface AugmentedSession extends Session {
  user: Session["user"] & {
    userId?: number;
    department?: string | null;
    type?: string | null;
    blocked?: boolean | null;
    firstName?: string | null;
    lastName?: string | null;
    sapid?: string | null; // Add SAP ID for alumni
  };
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.AUTH_GOOGLE_ID || process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.AUTH_GOOGLE_SECRET || process.env.GOOGLE_CLIENT_SECRET || "",
      checks: ["pkce", "state"],
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        identifier: { label: "SAP ID or Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        const identifier = String(credentials?.identifier || "").trim();
        const password = String(credentials?.password || "").trim();
        
        if (!identifier || !password) {
          throw new Error("INVALID_IDENTIFIER");
        }
        
        const ip = (req as unknown as { ip?: string }).ip || req?.headers?.get?.("x-forwarded-for") || "unknown";
        
        try {
          const result = await authenticateCredentials(identifier, password, String(ip));
          
          // Return user object that NextAuth expects
          return result as User | null;
        } catch (error) {
          // Re-throw the error so NextAuth can capture the error message
          // The error message will be available in result.error in the client
          throw error;
        }
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
      if (!account) return false;
      if (account.provider === "google") {
        const email = user?.email ?? "";
        if (!email) return "/signin?error=INVALID_EMAIL";
        const { sql } = await import("@/lib/dbconnect");
        const rows = await sql/* sql */`SELECT userid, email, firstname, lastname, department, type, blocked, lastlogindatetime FROM public.tbl_users WHERE email = ${email} LIMIT 1`;
        const dbUser: DbUser | undefined = rows[0] as DbUser | undefined;
        if (!dbUser) return "/signin?error=USER_NOT_FOUND";
        if (dbUser.blocked) return "/signin?error=USER_BLOCKED";
        const u: UserWithDb = user as UserWithDb;
        u.dbUser = dbUser;
        try {
          const { sql } = await import("@/lib/dbconnect");
          await sql/* sql */`UPDATE public.tbl_users SET lastlogindatetime = ${new Date().toISOString()} WHERE userid = ${dbUser.userid}`;
        } catch {}
        return "/";
      }
      if (account.provider === "credentials") {
        const uw: UserWithDb = user as UserWithDb;
        const db = uw.dbUser;
        const alumniDb = uw.alumniDb;
        
        // Check if user is admin or viewer
        // Admin has full access, viewer has view-only access
        // Note: "user" type is treated as "viewer" for backward compatibility
        if (db) {
          const userType = String(db.type || "").toLowerCase().trim();
          if (userType === "admin" || userType === "viewer" || userType === "user") {
          if (db.blocked) {
            return "/signin?error=USER_BLOCKED";
          }
          return true; // Allow sign in, redirect handled by client
          }
        }
        
        // Check if user is alumni
        if (alumniDb) {
          if (String(alumniDb.alumnistatus || "").toLowerCase() === "blocked") {
            return "/signin?error=USER_BLOCKED";
          }
          return true; // Allow sign in, redirect handled by client
        }
        
        // If neither staff/viewer nor alumni, deny sign in
        return false;
      }
      return false;
    },
    async jwt({ token, user }) {
      if (user) {
        const uw: UserWithDb = user as UserWithDb;
        const db = uw.dbUser;
        if (db) {
          const at: AugmentedToken = token as AugmentedToken;
          at.userId = db.userid;
          at.department = db.department;
          // Normalize "user" type to "viewer" for consistency
          const userType = String(db.type || "").toLowerCase().trim();
          at.type = userType === "user" ? "viewer" : db.type;
          at.blocked = db.blocked;
          at.firstName = db.firstname;
          at.lastName = db.lastname;
          token.email = db.email || token.email;
          token.name = `${db.firstname ?? ""} ${db.lastname ?? ""}`.trim();
          try {
            console.info(`[auth] jwt set userId=${String(at.userId)} email=${String(token.email)} type=${String(at.type)}`);
          } catch {}
        } else {
          const au = (user as unknown as { sapid?: string | null; alumniDb?: {
            alumniid: number;
            sapid: string | null;
            alumniname: string | null;
            departmentname: string | null;
            facultyname: string | null;
            degreetitle: string | null;
            yearofending: number | null;
            campusname: string | null;
            alumnistatus: string | null;
            verify: string | boolean | null;
            alumniemail: string | null;
            personalemail: string | null;
            officialemail: string | null;
            universityemail: string | null;
          } }).alumniDb;
          if (au) {
            const at: AugmentedToken = token as AugmentedToken;
            at.userId = au.alumniid;
            at.department = au.departmentname ?? null;
            at.type = "alumni";
            at.blocked = String(au.alumnistatus || "").toLowerCase() === "blocked";
            at.sapid = au.sapid ?? null; // Store SAP ID in token
            const fullName = String(au.alumniname || "").trim();
            const [firstName, ...rest] = fullName.split(" ");
            at.firstName = firstName || null;
            at.lastName = rest.join(" ") || null;
            token.email = (au.alumniemail || au.personalemail || au.officialemail || au.universityemail || token.email) || undefined;
            token.name = fullName || token.name;
          } else {
            // Check if user has sapid at top level (from credentials)
            const userSapid = (user as unknown as { sapid?: string | null }).sapid;
            if (userSapid) {
              const at: AugmentedToken = token as AugmentedToken;
              at.sapid = userSapid;
            }
            
            // Fallback: try to find by email if we don't have alumniDb or sapid
            if (!au && !userSapid) {
              const email = String(user.email || token.email || "");
              if (email) {
                try {
                  const { sql } = await import("@/lib/dbconnect");
                  const rows = await sql/* sql */`SELECT userid, email, firstname, lastname, department, type, blocked FROM public.tbl_users WHERE email = ${email} LIMIT 1`;
                  const dbUser: DbUser | undefined = rows[0] as DbUser | undefined;
                  if (dbUser) {
                    const at: AugmentedToken = token as AugmentedToken;
                    at.userId = dbUser.userid;
                    at.department = dbUser.department;
                    // Normalize "user" type to "viewer" for consistency
                    const userType = String(dbUser.type || "").toLowerCase().trim();
                    at.type = userType === "user" ? "viewer" : dbUser.type;
                    at.blocked = dbUser.blocked;
                    at.firstName = dbUser.firstname;
                    at.lastName = dbUser.lastname;
                    token.email = dbUser.email || token.email;
                    token.name = `${dbUser.firstname ?? ""} ${dbUser.lastname ?? ""}`.trim();
                  } else {
                    const { sql } = await import("@/lib/dbconnect");
                    const arows = await sql/* sql */`SELECT alumniid, sapid, alumniname, departmentname, facultyname, degreetitle, yearofending, campusname, alumnistatus, verify, alumniemail, personalemail, officialemail, universityemail FROM public.tbl_alumni WHERE alumniemail = ${email} OR personalemail = ${email} OR universityemail = ${email} LIMIT 1`;
                    const a = arows[0] as {
                      alumniid: number;
                      sapid: string | null;
                      alumniname: string | null;
                      departmentname: string | null;
                      facultyname: string | null;
                      degreetitle: string | null;
                      yearofending: number | null;
                      campusname: string | null;
                      alumnistatus: string | null;
                      verify: string | boolean | null;
                      alumniemail: string | null;
                      personalemail: string | null;
                      officialemail: string | null;
                      universityemail: string | null;
                    } | undefined;
                    if (a) {
                      const at: AugmentedToken = token as AugmentedToken;
                      at.userId = a.alumniid;
                      at.department = a.departmentname ?? null;
                      at.type = "alumni";
                      at.blocked = String(a.alumnistatus || "").toLowerCase() === "blocked";
                      at.sapid = a.sapid ?? null; // Store SAP ID in token
                      const fullName = String(a.alumniname || "").trim();
                      const [firstName, ...rest] = fullName.split(" ");
                      at.firstName = firstName || null;
                      at.lastName = rest.join(" ") || null;
                      token.email = (a.alumniemail || a.personalemail || a.officialemail || a.universityemail || token.email) || undefined;
                      token.name = fullName || token.name;
                    }
                  }
                } catch {}
              }
            }
          }
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
        // Normalize "user" type to "viewer" for consistency (already normalized in JWT, but ensure it here too)
        const tokenType = String(at.type || "").toLowerCase().trim();
        s.user.type = tokenType === "user" ? "viewer" : at.type;
        s.user.blocked = at.blocked;
        s.user.firstName = at.firstName;
        s.user.lastName = at.lastName;
        s.user.sapid = at.sapid ?? null; // Store SAP ID in session
        s.user.name = `${at.firstName ?? ""} ${at.lastName ?? ""}`.trim();
        try {
          console.info(`[auth] session set userId=${String(s.user.userId)} email=${String(s.user.email)} sapid=${String(s.user.sapid || '')}`);
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