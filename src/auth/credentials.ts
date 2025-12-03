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
  // Also normalize line endings and handle potential encoding differences
  const normalizedStored = stored.trim().replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const normalizedPlain = plain.trim().replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  
  // Direct comparison
  if (normalizedStored === normalizedPlain) return true;
  
  // Try with different encodings (in case of encoding issues on different platforms)
  try {
    // Compare byte-by-byte to handle any encoding issues
    const storedBytes = Buffer.from(normalizedStored, 'utf8');
    const plainBytes = Buffer.from(normalizedPlain, 'utf8');
    if (storedBytes.equals(plainBytes)) return true;
  } catch {}
  
  return false;
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
    try { console.info(`[auth] ${ts} ${status} identifier=${identifier} (${isEmail ? 'email' : 'sapid/registrationno'}) ip=${ip} ${msg}`); } catch {}
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
      // Use case-insensitive email matching and normalize type field
      const emailLower = identifier.trim().toLowerCase();
      rows = await sql/* sql */`
        SELECT 
          userid, 
          email, 
          password, 
          firstname, 
          lastname, 
          department, 
          LOWER(TRIM(COALESCE(type, ''))) as type_normalized,
          type as type_original,
          blocked, 
          lastlogindatetime 
        FROM public.tbl_users 
        WHERE LOWER(TRIM(email)) = ${emailLower}
        LIMIT 1
      `;
    } catch (err) {
      log("FAIL", `db error: ${err instanceof Error ? err.message : String(err)}`);
      throw new Error("DB_CONNECTION_ERROR");
    }
    const dbUserRow = rows[0] as ((DbUser & { password: string | null; type_normalized: string | null; type_original: string | null }) | undefined);
    
    // If user exists in tbl_users, handle them (regardless of type)
    if (dbUserRow) {
      // Reconstruct dbUser with normalized type
      const dbUser: DbUser & { password: string | null } = {
        userid: dbUserRow.userid,
        email: dbUserRow.email,
        password: dbUserRow.password,
        firstname: dbUserRow.firstname,
        lastname: dbUserRow.lastname,
        department: dbUserRow.department,
        type: dbUserRow.type_normalized || dbUserRow.type_original || null,
        blocked: dbUserRow.blocked,
        lastlogindatetime: dbUserRow.lastlogindatetime,
      };
      
      // Check if user is blocked
      if (dbUser.blocked) {
        log("FAIL", "account blocked");
        throw new Error("USER_BLOCKED");
      }
      
      // Verify password - handle potential encoding issues
      const stored = dbUser.password || "";
      const ok = await verifyPassword(password, stored);
      if (!ok) {
        log("FAIL", `invalid password (stored length: ${stored.length}, provided length: ${password.length})`);
        throw new Error("INVALID_PASSWORD");
      }
      
      // Allow admin, superadmin, and viewer types to login via credentials
      // Super Admin has full access including user management
      // Admin has full access to data but cannot manage users
      // Viewer has view-only access
      // Note: "user" type is treated as "viewer" for backward compatibility
      // Use the normalized type from database query
      const userType = (dbUser.type || "").toLowerCase().trim();
      
      // Also check for variations like "super admin" with space
      const normalizedType = userType.replace(/\s+/g, ""); // Remove spaces
      
      if (normalizedType !== "admin" && normalizedType !== "superadmin" && normalizedType !== "viewer" && normalizedType !== "user") {
        log("FAIL", `user type is not admin, superadmin, viewer, or user: original="${dbUserRow.type_original}", normalized="${userType}", spaces_removed="${normalizedType}"`);
        throw new Error("USER_NOT_STAFF");
      }
      
      // Normalize "user" type to "viewer" for consistency
      if (normalizedType === "user") {
        dbUser.type = "viewer";
      } else {
        // Ensure type is lowercase for consistency
        dbUser.type = normalizedType;
      }
      
      const u: UserWithDbLike = {
        email: dbUser.email || identifier.trim(),
        name: `${dbUser.firstname ?? ""} ${dbUser.lastname ?? ""}`.trim() || undefined,
        dbUser,
      };
      log("OK", `${normalizedType} credentials verified (original type: ${dbUserRow.type_original})`);
      try {
        await sql/* sql */`UPDATE public.tbl_users SET lastlogindatetime = ${new Date().toISOString()} WHERE userid = ${dbUser.userid}`;
      } catch {}
      return u;
    }
  }

  // Alumni login: Use SAP ID, registration number, or email
  let arows;
  try {
    if (isEmail) {
      // Try email first (for backward compatibility)
      arows = await sql/* sql */`SELECT alumniid, sapid, registrationno, alumniemail, personalemail, officialemail, universityemail, password, alumniname, departmentname, facultyname, degreetitle, yearofending, campusname, alumnistatus, verify, lasttimelogin, logincount FROM public.tbl_alumni WHERE alumniemail = ${identifier.trim()} OR personalemail = ${identifier.trim()} OR universityemail = ${identifier.trim()} LIMIT 1`;
    } else {
      // Use SAP ID or registration number for alumni login
      arows = await sql/* sql */`SELECT alumniid, sapid, registrationno, alumniemail, personalemail, officialemail, universityemail, password, alumniname, departmentname, facultyname, degreetitle, yearofending, campusname, alumnistatus, verify, lasttimelogin, logincount FROM public.tbl_alumni WHERE sapid = ${identifier.trim()} OR registrationno = ${identifier.trim()} LIMIT 1`;
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
    log("FAIL", `${isEmail ? 'email' : 'sapid/registrationno'} not registered (alumni)`);
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