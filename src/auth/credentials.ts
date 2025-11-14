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

export async function authenticateCredentials(email: string, password: string, ip: string): Promise<UserWithDbLike> {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const log = (status: string, msg: string) => {
    const ts = new Date().toISOString();
    try { console.info(`[auth] ${ts} ${status} email=${email} ip=${ip} ${msg}`); } catch {}
  };
  if (!emailRegex.test(email)) {
    log("FAIL", "invalid email format");
    throw new Error("INVALID_EMAIL_FORMAT");
  }
  rateLimitPrune();
  const key = `${email}|${String(ip)}`;
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
  let rows;
  try {
    rows = await sql/* sql */`SELECT userid, email, password, firstname, lastname, department, type, blocked, lastlogindatetime FROM public.tbl_users WHERE email = ${email} LIMIT 1`;
  } catch (err) {
    log("FAIL", `db error: ${err instanceof Error ? err.message : String(err)}`);
    throw new Error("DB_CONNECTION_ERROR");
  }
  const dbUser: (DbUser & { password: string | null }) | undefined = rows[0] as (DbUser & { password: string | null }) | undefined;
  if (dbUser && (dbUser.type || "").toLowerCase() === "staff") {
    if (dbUser.blocked) {
      log("FAIL", "account blocked");
      throw new Error("USER_BLOCKED");
    }
    const stored = dbUser.password || "";
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
    const u: UserWithDbLike = {
      email: dbUser.email || email,
      name: `${dbUser.firstname ?? ""} ${dbUser.lastname ?? ""}`.trim() || undefined,
      dbUser,
    };
    log("OK", "staff credentials verified");
    try {
      await sql/* sql */`UPDATE public.tbl_users SET lastlogindatetime = ${new Date().toISOString()} WHERE userid = ${dbUser.userid}`;
    } catch {}
    return u;
  }

  let arows;
  try {
    arows = await sql/* sql */`SELECT alumniid, alumniemail, personalemail, officialemail, universityemail, password, alumniname, departmentname, facultyname, degreetitle, yearofending, campusname, alumnistatus, verify, lasttimelogin, logincount FROM public.tbl_alumni WHERE alumniemail = ${email} OR personalemail = ${email} OR universityemail = ${email} LIMIT 1`;
  } catch (err) {
    log("FAIL", `alumni db error: ${err instanceof Error ? err.message : String(err)}`);
    throw new Error("DB_CONNECTION_ERROR");
  }
  const a = arows[0] as {
    alumniid: number;
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
    log("FAIL", "email not registered (alumni)");
    throw new Error("EMAIL_NOT_REGISTERED");
  }
  if ((a.alumnistatus || "").toLowerCase() === "blocked") {
    log("FAIL", "alumni blocked");
    throw new Error("USER_BLOCKED");
  }
  const storedA = a.password || "";
  const okA = await verifyPassword(password, storedA);
  if (!okA) {
    log("FAIL", "alumni invalid password");
    throw new Error("INVALID_PASSWORD");
  }
  const userEmail = a.alumniemail || a.personalemail || a.officialemail || a.universityemail || email;
  const u: UserWithDbLike = {
    email: userEmail,
    name: String(a.alumniname || "") || undefined,
    alumniDb: {
      alumniid: a.alumniid,
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