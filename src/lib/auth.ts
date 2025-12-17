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
    sapid?: string | null;
    registrationno?: string | null;
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
  registrationno?: string | null; // Add registration number for alumni
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
    registrationno?: string | null; // Add registration number for alumni
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
        
        // Check if user is admin, superadmin, or viewer
        // Super Admin has full access including user management
        // Admin has full access to data but cannot manage users
        // Viewer has view-only access
        // Note: "user" type is treated as "viewer" for backward compatibility
        if (db) {
          const userType = String(db.type || "").toLowerCase().trim();
          if (userType === "admin" || userType === "superadmin" || userType === "viewer" || userType === "user") {
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
      // If user is provided (initial sign-in), use that data
      if (user) {
        const uw: UserWithDb = user as UserWithDb;
        const db = uw.dbUser;
        const at: AugmentedToken = token as AugmentedToken;

        // Clear fields that can persist across logins and cause identity mixups
        at.userId = undefined;
        at.department = null;
        at.type = null;
        at.blocked = null;
        at.firstName = null;
        at.lastName = null;
        at.sapid = null;
        at.registrationno = null;

        if (db) {
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
          token.sub = `u:${String(db.userid)}`;
          try {
            console.info(`[auth] jwt set userId=${String(at.userId)} email=${String(token.email)} type=${String(at.type)}`);
          } catch {}
        } else {
          const au = (user as unknown as { sapid?: string | null; registrationno?: string | null; alumniDb?: {
            alumniid: number;
            sapid: string | null;
            registrationno: string | null;
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
            at.userId = au.alumniid;
            at.department = au.departmentname ?? null;
            at.type = "alumni";
            at.blocked = String(au.alumnistatus || "").toLowerCase() === "blocked";
            const topSapid = (user as unknown as { sapid?: string | null }).sapid ?? null;
            const topRegNo = (user as unknown as { registrationno?: string | null }).registrationno ?? null;
            at.sapid = au.sapid ?? topSapid ?? null; // Store SAP ID in token
            at.registrationno = au.registrationno ?? topRegNo ?? null; // Store registration number in token
            const fullName = String(au.alumniname || "").trim();
            const [firstName, ...rest] = fullName.split(" ");
            at.firstName = firstName || null;
            at.lastName = rest.join(" ") || null;
            // Always overwrite token.email for alumni sign-in to avoid inheriting a previous user's email
            const alumniEmail =
              au.alumniemail || au.personalemail || au.officialemail || au.universityemail || `alumni:${String(au.alumniid)}`;
            token.email = alumniEmail || undefined;
            token.name = fullName || token.name;
            token.sub = `a:${String(au.alumniid)}`;
            try {
              console.info(
                `[auth] jwt set alumniId=${String(at.userId)} sapid=${String(at.sapid || "")} registrationno=${String(at.registrationno || "")} email=${String(
                  token.email || ""
                )}`
              );
            } catch {}
          } else {
            // Check if user has sapid or registrationno at top level (from credentials)
            const userSapid = (user as unknown as { sapid?: string | null }).sapid;
            const userRegistrationNo = (user as unknown as { registrationno?: string | null }).registrationno;
            if (userSapid || userRegistrationNo) {
              at.type = "alumni";
              at.sapid = userSapid ?? null;
              at.registrationno = userRegistrationNo ?? null;
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
                    const arows = await sql/* sql */`SELECT alumniid, sapid, registrationno, alumniname, departmentname, facultyname, degreetitle, yearofending, campusname, alumnistatus, verify, alumniemail, personalemail, officialemail, universityemail FROM public.tbl_alumni WHERE alumniemail = ${email} OR personalemail = ${email} OR universityemail = ${email} LIMIT 1`;
                    const a = arows[0] as {
                      alumniid: number;
                      sapid: string | null;
                      registrationno: string | null;
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
                      at.registrationno = a.registrationno ?? null; // Store registration number in token
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
        // Token refresh: keep the session in sync with DB changes.
        // IMPORTANT: at.userId is used for BOTH staff.userid and alumni.alumniid, so we must branch by at.type to avoid identity mixups.
        const at: AugmentedToken = token as AugmentedToken;
        const tokenType = String(at.type || "").toLowerCase().trim();

        try {
          const { sql } = await import("@/lib/dbconnect");

          if (tokenType === "alumni" || at.sapid || at.registrationno) {
            // Alumni refresh: prefer alumniid, then sapid, then registrationno
            const alumniById = at.userId
              ? await sql/* sql */`
                  SELECT alumniid, sapid, registrationno, alumniname, departmentname, alumnistatus, alumniemail, personalemail, officialemail, universityemail
                  FROM public.tbl_alumni
                  WHERE alumniid = ${at.userId}
                  LIMIT 1
                `
              : [];
            const alumniBySapid = !at.userId && at.sapid
              ? await sql/* sql */`
                  SELECT alumniid, sapid, registrationno, alumniname, departmentname, alumnistatus, alumniemail, personalemail, officialemail, universityemail
                  FROM public.tbl_alumni
                  WHERE sapid IS NOT NULL AND TRIM(sapid) = ${String(at.sapid).trim()}
                  LIMIT 1
                `
              : [];
            const alumniByReg = !at.userId && !at.sapid && at.registrationno
              ? await sql/* sql */`
                  SELECT alumniid, sapid, registrationno, alumniname, departmentname, alumnistatus, alumniemail, personalemail, officialemail, universityemail
                  FROM public.tbl_alumni
                  WHERE registrationno IS NOT NULL AND TRIM(registrationno) = ${String(at.registrationno).trim()}
                  LIMIT 1
                `
              : [];

            const alumni = (alumniById[0] || alumniBySapid[0] || alumniByReg[0]) as
              | {
                  alumniid: number;
                  sapid: string | null;
                  registrationno: string | null;
                  alumniname: string | null;
                  departmentname: string | null;
                  alumnistatus: string | null;
                  alumniemail: string | null;
                  personalemail: string | null;
                  officialemail: string | null;
                  universityemail: string | null;
                }
              | undefined;

            if (alumni) {
              at.userId = alumni.alumniid;
              at.department = alumni.departmentname ?? null;
              at.type = "alumni";
              at.blocked = String(alumni.alumnistatus || "").toLowerCase() === "blocked";
              at.sapid = alumni.sapid ?? at.sapid ?? null;
              at.registrationno = alumni.registrationno ?? at.registrationno ?? null;
              const fullName = String(alumni.alumniname || "").trim();
              const [firstName, ...rest] = fullName.split(" ");
              at.firstName = firstName || null;
              at.lastName = rest.join(" ") || null;
              token.email =
                (alumni.alumniemail || alumni.personalemail || alumni.officialemail || alumni.universityemail || `alumni:${String(alumni.alumniid)}`) ||
                undefined;
              token.name = fullName || token.name;
              token.sub = `a:${String(alumni.alumniid)}`;
              try {
                console.info(`[auth] jwt refreshed alumniId=${String(at.userId)} sapid=${String(at.sapid || "")}`);
              } catch {}
            }
          } else {
            // Staff refresh
            if (at.userId) {
              const rows = await sql/* sql */`
                SELECT userid, email, firstname, lastname, department, type, blocked
                FROM public.tbl_users
                WHERE userid = ${at.userId}
                LIMIT 1
              `;
              const dbUser = rows[0] as DbUser | undefined;
              if (dbUser) {
                at.userId = dbUser.userid;
                at.department = dbUser.department;
                const userType = String(dbUser.type || "").toLowerCase().trim();
                at.type = userType === "user" ? "viewer" : dbUser.type;
                at.blocked = dbUser.blocked;
                at.firstName = dbUser.firstname;
                at.lastName = dbUser.lastname;
                token.email = dbUser.email || token.email;
                token.name = `${dbUser.firstname ?? ""} ${dbUser.lastname ?? ""}`.trim();
                token.sub = `u:${String(dbUser.userid)}`;
                try {
                  console.info(`[auth] jwt refreshed userId=${String(at.userId)} email=${String(token.email)} type=${String(at.type)}`);
                } catch {}
              }
            }
          }
        } catch {
          try {
            console.warn(`[auth] jwt refresh failed; keeping existing token data (type=${String((token as AugmentedToken).type || "")})`);
          } catch {}
        }
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
        s.user.registrationno = at.registrationno ?? null; // Store registration number in session
        s.user.name = `${at.firstName ?? ""} ${at.lastName ?? ""}`.trim();
        try {
          console.info(`[auth] session set userId=${String(s.user.userId)} email=${String(s.user.email)} sapid=${String(s.user.sapid || '')} registrationno=${String(s.user.registrationno || '')}`);
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