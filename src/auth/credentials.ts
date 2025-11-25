import { sql } from "@/lib/dbconnect";

export type DbUser = {
  userid: number;
  email: string | null;
  firstname: string | null;
  lastname: string | null;
  department: string | null;
  type: string | null;
  blocked: boolean | null;
  lastlogindatetime: string | null;
};

export async function hashPassword(plain: string): Promise<string> {
  const { randomBytes, scrypt } = await import("crypto");
  const salt = randomBytes(16);
  const buf: Buffer = await new Promise((resolve, reject) => {
    scrypt(plain, salt, 64, (err, derivedKey) => (err ? reject(err) : resolve(derivedKey as Buffer)));
  });
  return `scrypt:${salt.toString("hex")}:${buf.toString("hex")}`;
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  if (!stored) return false;
  // Compare as plain text (trim both to handle whitespace issues)
  return stored.trim() === plain.trim();
}

const RATE_LIMIT = new Map<string, { count: number; last: number }>();
const RATE_LIMIT_MAX = 5;
const RATE_WINDOW_MS = 5 * 60 * 1000;
function rateLimitPrune() {
  const now = Date.now();
  for (const [k, v] of RATE_LIMIT.entries()) {
    if (now - v.last > RATE_WINDOW_MS) RATE_LIMIT.delete(k);
  }
}

export interface UserWithDbLike {
  email?: string | null;
  name?: string | null;
  sapid?: string | null; // Add SAP ID for alumni
  dbUser?: DbUser;
  alumniDb?: {
    alumniid: number;
    sapid: string | null; // Add SAP ID to alumni DB object
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

export async function authenticateCredentials(identifier: string, password: string, ip: string): Promise<UserWithDbLike> {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isEmail = emailRegex.test(identifier);
  
  const log = (status: string, msg: string) => {
    const ts = new Date().toISOString();
    try { console.info(`[auth] ${ts} ${status} identifier=${identifier} (${isEmail ? 'email' : 'sapid'}) ip=${ip} ${msg}`); } catch {}
  };
  
  if (!identifier || !identifier.trim()) {
    log("FAIL", "empty identifier");
    throw new Error("INVALID_IDENTIFIER");
  }
  
  rateLimitPrune();
  const key = `${identifier}|${String(ip)}`;
  const rl = RATE_LIMIT.get(key) || { count: 0, last: Date.now() };
  const now = Date.now();
  if (now - rl.last > RATE_WINDOW_MS) rl.count = 0;
  rl.last = now;
  rl.count += 1;
  RATE_LIMIT.set(key, rl);
  if (rl.count > RATE_LIMIT_MAX) {
    log("FAIL", "rate limited");
    throw new Error("RATE_LIMITED");
  }

  // Try staff login first (always uses email)
  if (isEmail) {
    let rows;
    try {
      rows = await sql/* sql */`SELECT userid, email, password, firstname, lastname, department, type, blocked, lastlogindatetime FROM public.tbl_users WHERE email = ${identifier.trim()} LIMIT 1`;
    } catch (err) {
      log("FAIL", `db error: ${err instanceof Error ? err.message : String(err)}`);
      throw new Error("DB_CONNECTION_ERROR");
    }
    const dbUser: (DbUser & { password: string | null }) | undefined = rows[0] as (DbUser & { password: string | null }) | undefined;
    
    // If user exists in tbl_users, handle them (regardless of type)
    if (dbUser) {
      // Check if user is blocked
      if (dbUser.blocked) {
        log("FAIL", "account blocked");
        throw new Error("USER_BLOCKED");
      }
      
      // Verify password
      const stored = dbUser.password || "";
      const ok = await verifyPassword(password, stored);
      if (!ok) {
        log("FAIL", "invalid password");
        throw new Error("INVALID_PASSWORD");
      }
      
      // Allow admin and viewer types to login via credentials
      // Admin has full access, viewer has view-only access
      // Note: "user" type is treated as "viewer" for backward compatibility
      const userType = (dbUser.type || "").toLowerCase().trim();
      if (userType !== "admin" && userType !== "viewer" && userType !== "user") {
        log("FAIL", `user type is not admin, viewer, or user: ${userType}`);
        throw new Error("USER_NOT_STAFF");
      }
      
      // Normalize "user" type to "viewer" for consistency
      if (userType === "user") {
        dbUser.type = "viewer";
      }
      
      const u: UserWithDbLike = {
        email: dbUser.email || identifier.trim(),
        name: `${dbUser.firstname ?? ""} ${dbUser.lastname ?? ""}`.trim() || undefined,
        dbUser,
      };
      log("OK", `${userType} credentials verified`);
      try {
        await sql/* sql */`UPDATE public.tbl_users SET lastlogindatetime = ${new Date().toISOString()} WHERE userid = ${dbUser.userid}`;
      } catch {}
      return u;
    }
  }

  // Alumni login: Use SAP ID (or email if provided, but prioritize SAP ID)
  let arows;
  try {
    if (isEmail) {
      // Try email first (for backward compatibility)
      arows = await sql/* sql */`SELECT alumniid, sapid, alumniemail, personalemail, officialemail, universityemail, password, alumniname, departmentname, facultyname, degreetitle, yearofending, campusname, alumnistatus, verify, lasttimelogin, logincount FROM public.tbl_alumni WHERE alumniemail = ${identifier.trim()} OR personalemail = ${identifier.trim()} OR universityemail = ${identifier.trim()} LIMIT 1`;
    } else {
      // Use SAP ID for alumni login
      arows = await sql/* sql */`SELECT alumniid, sapid, alumniemail, personalemail, officialemail, universityemail, password, alumniname, departmentname, facultyname, degreetitle, yearofending, campusname, alumnistatus, verify, lasttimelogin, logincount FROM public.tbl_alumni WHERE sapid = ${identifier.trim()} LIMIT 1`;
    }
  } catch (err) {
    log("FAIL", `alumni db error: ${err instanceof Error ? err.message : String(err)}`);
    throw new Error("DB_CONNECTION_ERROR");
  }
  const a = arows[0] as {
    alumniid: number;
    sapid: string | null;
    alumniemail: string | null;
    personalemail: string | null;
    officialemail: string | null;
    universityemail: string | null;
    password: string | null;
    alumniname: string | null;
    departmentname: string | null;
    facultyname: string | null;
    degreetitle: string | null;
    yearofending: number | null;
    campusname: string | null;
    alumnistatus: string | null;
    verify: string | boolean | null;
    lasttimelogin: string | null;
    logincount: number | null;
  } | undefined;
  if (!a) {
    log("FAIL", `${isEmail ? 'email' : 'sapid'} not registered (alumni)`);
    throw new Error(isEmail ? "EMAIL_NOT_REGISTERED" : "SAPID_NOT_REGISTERED");
  }
  if ((a.alumnistatus || "").toLowerCase() === "blocked") {
    log("FAIL", "alumni blocked");
    throw new Error("USER_BLOCKED");
  }
  // Check if alumni is under approval (verify = 'pending')
  // Alumni with verify = 'pending' cannot log in until admin verifies or unverifies them
  const verifyValue = a.verify;
  const isUnderApproval = verifyValue === null || verifyValue === undefined || 
                          String(verifyValue).trim().toLowerCase() === 'pending' || 
                          String(verifyValue).trim() === "";
  if (isUnderApproval) {
    log("FAIL", "alumni under approval - cannot login until verified/unverified by admin");
    throw new Error("UNDER_APPROVAL");
  }
  const storedA = a.password || "";
  const okA = await verifyPassword(password, storedA);
  if (!okA) {
    log("FAIL", "alumni invalid password");
    throw new Error("INVALID_PASSWORD");
  }
  const userEmail = a.alumniemail || a.personalemail || a.officialemail || a.universityemail || identifier.trim();
  const u: UserWithDbLike = {
    email: userEmail,
    name: String(a.alumniname || "") || undefined,
    sapid: a.sapid ?? null, // Store SAP ID at top level
    alumniDb: {
      alumniid: a.alumniid,
      sapid: a.sapid ?? null, // Store SAP ID in alumni DB object
      alumniname: a.alumniname ?? null,
      departmentname: a.departmentname ?? null,
      facultyname: a.facultyname ?? null,
      degreetitle: a.degreetitle ?? null,
      yearofending: a.yearofending ?? null,
      campusname: a.campusname ?? null,
      alumnistatus: a.alumnistatus ?? null,
      verify: a.verify ?? null,
      alumniemail: a.alumniemail ?? null,
      personalemail: a.personalemail ?? null,
      officialemail: a.officialemail ?? null,
      universityemail: a.universityemail ?? null,
    },
  };
  log("OK", "alumni credentials verified");
  try {
    await sql/* sql */`UPDATE public.tbl_alumni SET lasttimelogin = ${new Date().toISOString()}, logincount = COALESCE(logincount, 0) + 1 WHERE alumniid = ${a.alumniid}`;
  } catch {}
  return u;
}