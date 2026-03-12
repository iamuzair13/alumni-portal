import postgres from "postgres";
import * as dotenv from "dotenv";
import path from "path";
import fs from "fs";
import nodemailer from "nodemailer";
import readline from "readline";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

type CsvRow = {
  email: string;
  line: number;
};

type DbRow = {
  alumniid: number;
  alumniname: string | null;
  sapid: string | null;
  registrationno: string | null;
  password: string | null;
  alumniemail: string | null;
  personalemail: string | null;
};

type LogRow = {
  email: string;
  status: "sent" | "failed" | "skipped";
  timestamp: string;
  reason?: string;
  error?: string;
  alumniid?: number;
  line?: number;
};

function clean(v: unknown): string {
  return String(v ?? "").trim();
}

function normalizeEmail(v: string): string {
  return clean(v).toLowerCase();
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}

function resolvePath(inputPath: string): string {
  if (path.isAbsolute(inputPath)) return inputPath;
  if (fs.existsSync(inputPath)) return path.resolve(inputPath);
  if (fs.existsSync(path.join(process.cwd(), inputPath))) return path.resolve(process.cwd(), inputPath);
  if (fs.existsSync(path.join(process.cwd(), "scripts", inputPath))) return path.resolve(process.cwd(), "scripts", inputPath);
  return path.resolve(process.cwd(), inputPath);
}

function findEmailColumnIndex(header: string[]): number {
  const normalized = header.map((h) => clean(h).toLowerCase());
  const candidates = ["email", "personalemail", "personal email", "alumniemail", "alumni email", "universityemail", "university email", "officialemail", "official email"];

  for (const name of candidates) {
    const idx = normalized.indexOf(name);
    if (idx >= 0) return idx;
  }

  return -1;
}

function readEmailListFromCsv(filePath: string): {
  rows: CsvRow[];
  skippedMissing: number;
  skippedInvalid: number;
  skippedDetails: Array<{ line: number; rawEmail: string; reason: "missing" | "invalid" }>;
} {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split(/\r?\n/);
  const headerLine = lines[0];
  if (!headerLine) throw new Error("CSV header missing");

  const header = parseCsvLine(headerLine);
  const emailIdx = findEmailColumnIndex(header);
  if (emailIdx < 0) {
    throw new Error(`Could not find an email column in CSV header. Header columns: ${header.join(", ")}`);
  }

  const seen = new Set<string>();
  const rows: CsvRow[] = [];
  let skippedMissing = 0;
  let skippedInvalid = 0;
  const skippedDetails: Array<{ line: number; rawEmail: string; reason: "missing" | "invalid" }> = [];

  for (let i = 1; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw || !raw.trim()) continue;

    const cols = parseCsvLine(raw);
    const emailRaw = clean(cols[emailIdx] ?? "");
    if (!emailRaw) {
      skippedMissing++;
      skippedDetails.push({ line: i + 1, rawEmail: "", reason: "missing" });
      continue;
    }

    const email = normalizeEmail(emailRaw);
    if (!email.includes("@")) {
      skippedInvalid++;
      skippedDetails.push({ line: i + 1, rawEmail: emailRaw, reason: "invalid" });
      continue;
    }

    if (seen.has(email)) continue;
    seen.add(email);
    rows.push({ email, line: i + 1 });
  }

  return { rows, skippedMissing, skippedInvalid, skippedDetails };
}

function toPgTextArrayLiteral(values: string[]): string {
  const escaped = values.map((v) => `'${v.replace(/'/g, "''")}'`);
  return `ARRAY[${escaped.join(", ")}]::text[]`;
}

function getSmtpConfig() {
  const SMTP_HOST = process.env.SMTP_HOST || "smtp.gmail.com";
  const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587", 10);
  const SMTP_SECURE = process.env.SMTP_SECURE === "true";
  const SMTP_USER = process.env.SMTP_USER || process.env.SMTP_EMAIL || "";
  const SMTP_PASS = process.env.SMTP_PASSWORD || process.env.SMTP_PASS || "";
  const FROM_EMAIL = process.env.FROM_EMAIL || SMTP_USER || "noreply@uol.edu.pk";
  const FROM_NAME = process.env.FROM_NAME || "UOL Alumni Portal";

  return {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_SECURE,
    SMTP_USER,
    SMTP_PASS,
    FROM_EMAIL,
    FROM_NAME,
  };
}

function buildEmailText(input: {
  alumniname: string;
  personalemail: string;
  sapid: string;
  password: string;
}): string {
  return [
    `Dear ${input.alumniname},`,
    "",
    "Greetings from UOL Alumni Office!",
    "",
    `Your log-in credentials have been sent to your ${input.personalemail} registered in our database. Kindly log-in and update your profile (all essential fields * must be entered) to ensure you become part of our active alumni database and stay connected with us.`,
    `SAP ID : ${input.sapid}`,
    `Password : ${input.password}`,
    "If you intend to change your personal email, or rectify any existing data, you can do it as part of profile update.",
    "",
    "Thank you & looking forward to welcome you aboard as part of UOL vibrant alumni community",
    "",
    "UOL Alumni Office",
  ].join("\n");
}

function toHtmlFromText(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<div style=\"font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.5; white-space: pre-line;\">${escaped}</div>`;
}

async function promptYesNo(question: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer: string = await new Promise((resolve) => rl.question(question, resolve));
  rl.close();
  const a = clean(answer).toLowerCase();
  return a === "y" || a === "yes";
}

function loadSentEmailsFromLog(logPath: string): Set<string> {
  if (!fs.existsSync(logPath)) return new Set<string>();
  const content = fs.readFileSync(logPath, "utf-8");
  const lines = content.split(/\r?\n/).filter(Boolean);
  const sent = new Set<string>();

  for (const l of lines) {
    try {
      const row = JSON.parse(l) as Partial<LogRow>;
      const email = row.email ? normalizeEmail(String(row.email)) : "";
      if (!email) continue;
      if (row.status === "sent") sent.add(email);
    } catch {
      continue;
    }
  }

  return sent;
}

function appendLog(logPath: string, row: LogRow) {
  fs.appendFileSync(logPath, JSON.stringify(row) + "\n", "utf-8");
}

async function sendWithRetry(input: {
  transporter: nodemailer.Transporter;
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  retries: number;
}): Promise<{ ok: boolean; error?: string }> {
  let lastError: string | undefined;

  for (let attempt = 0; attempt <= input.retries; attempt++) {
    try {
      await input.transporter.sendMail({
        from: input.from,
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html,
      });
      return { ok: true };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      if (attempt === input.retries) break;
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
    }
  }

  return { ok: false, error: lastError ?? "Unknown error" };
}

function describeDatabaseUrl(databaseUrl: string): string {
  try {
    const u = new URL(databaseUrl);
    const host = u.hostname;
    const port = u.port || "5432";
    const database = u.pathname?.replace(/^\//, "") || "";
    const username = decodeURIComponent(u.username || "");
    return `host=${host} port=${port} db=${database} user=${username}`;
  } catch {
    return "(unable to parse DATABASE_URL)";
  }
}

async function main() {
  const csvArg = process.argv.find((a) => a.startsWith("--csv="));
  const apply = process.argv.includes("--apply");
  const logArg = process.argv.find((a) => a.startsWith("--log="));
  const retriesArg = process.argv.find((a) => a.startsWith("--retries="));

  if (!csvArg) {
    console.error('Usage: tsx scripts/send-credentials-from-csv.ts --csv="<path>" [--log="<path>"] [--retries=3] [--apply]');
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    console.error("❌ DATABASE_URL environment variable is not set");
    console.error("Please set DATABASE_URL in your .env.local file");
    process.exit(1);
  }

  const csvPathInput = csvArg.slice("--csv=".length).replace(/^"|"$/g, "");
  const csvPath = resolvePath(csvPathInput);
  if (!fs.existsSync(csvPath)) {
    console.error(`❌ CSV file not found: ${csvPath}`);
    process.exit(1);
  }

  const logPathInput = logArg ? logArg.slice("--log=".length).replace(/^"|"$/g, "") : path.resolve(process.cwd(), "scripts", "sent-credential-emails.jsonl");
  const logPath = path.isAbsolute(logPathInput) ? logPathInput : path.resolve(process.cwd(), logPathInput);

  const retries = retriesArg ? Math.max(0, Number(retriesArg.slice("--retries=".length))) : 3;

  console.log(`DB target: ${describeDatabaseUrl(process.env.DATABASE_URL)}`);
  console.log(`CSV: ${csvPath}`);
  console.log(`Log: ${logPath}`);

  const { rows: csvRows, skippedMissing, skippedInvalid, skippedDetails } = readEmailListFromCsv(csvPath);

  console.log("\n==== CSV SANITY CHECK ====");
  console.log(`Unique emails parsed: ${csvRows.length}`);
  console.log(`Skipped (missing email): ${skippedMissing}`);
  console.log(`Skipped (invalid email): ${skippedInvalid}`);

  const alreadySent = loadSentEmailsFromLog(logPath);
  console.log(`Already sent (from log): ${alreadySent.size}`);

  const pendingEmails = csvRows.map((r) => r.email).filter((e) => !alreadySent.has(e));
  if (pendingEmails.length === 0) {
    console.log("\nNothing to send. All CSV emails are already marked as sent in the log.");
    return;
  }

  const sql = postgres(process.env.DATABASE_URL, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 30,
    prepare: false,
  });

  console.log("\n==== DB LOOKUP ====");

  const arrayLiteral = toPgTextArrayLiteral(pendingEmails);
  const dbRows = (await sql.unsafe(`
    SELECT alumniid, alumniname, sapid, registrationno, password, alumniemail, personalemail
    FROM public.tbl_alumni
    WHERE lower(trim(coalesce(personalemail, ''))) = ANY(${arrayLiteral})
  `)) as unknown as DbRow[];

  const dbByEmail = new Map<string, DbRow>();
  for (const r of dbRows) {
    const key = normalizeEmail(String(r.personalemail ?? ""));
    if (!key) continue;
    if (!dbByEmail.has(key)) dbByEmail.set(key, r);
  }

  const validRecipients: Array<{ csvEmail: string; db: DbRow }> = [];
  const notFound: string[] = [];
  const missingDbFields: Array<{ email: string; reason: string }> = [];

  for (const email of pendingEmails) {
    const db = dbByEmail.get(email);
    if (!db) {
      notFound.push(email);
      continue;
    }

    const alumniname = clean(db.alumniname) || "Alumni";
    const sapid = clean(db.sapid);
    const password = clean(db.password);
    const personalemail = clean(db.personalemail);

    if (!personalemail || !personalemail.includes("@")) {
      missingDbFields.push({ email, reason: "db.personalemail_missing" });
      continue;
    }
    if (!sapid) {
      missingDbFields.push({ email, reason: "db.sapid_missing" });
      continue;
    }
    if (!password) {
      missingDbFields.push({ email, reason: "db.password_missing" });
      continue;
    }

    validRecipients.push({ csvEmail: email, db: { ...db, alumniname, sapid, password, personalemail } });
  }

  console.log(`Pending emails (after resume): ${pendingEmails.length}`);
  console.log(`Matched in DB (by personalemail): ${dbRows.length}`);
  console.log(`Valid recipients (all required DB fields present): ${validRecipients.length}`);
  console.log(`Not found in DB: ${notFound.length}`);
  console.log(`Skipped due to missing DB fields: ${missingDbFields.length}`);

  if (validRecipients.length === 0) {
    console.log("\nNo valid recipients found. Nothing to send.");
    await sql.end({ timeout: 5 });
    return;
  }

  const first = validRecipients[0]!.db;
  const previewText = buildEmailText({
    alumniname: clean(first.alumniname) || "Alumni",
    personalemail: clean(first.personalemail),
    sapid: clean(first.sapid),
    password: clean(first.password),
  });

  console.log("\n==== EMAIL PREVIEW (FIRST VALID RECIPIENT) ====");
  console.log(`To: ${clean(first.personalemail)}`);
  console.log("Subject: UOL Alumni Portal Login Credentials");
  console.log("\n" + previewText);

  if (!apply) {
    console.log("\nDry-run complete. No emails were sent.");
    console.log("Re-run with --apply to enable sending (you will still be asked to confirm)." );
    await sql.end({ timeout: 5 });
    return;
  }

  // Log parse-level skips only when actually applying (so dry-runs don't pollute logs)
  for (const s of skippedDetails) {
    appendLog(logPath, {
      email: normalizeEmail(s.rawEmail),
      status: "skipped",
      reason: s.reason === "missing" ? "csv_missing_email" : "csv_invalid_email",
      timestamp: new Date().toISOString(),
      line: s.line,
    });
  }

  const okToProceed = await promptYesNo("\nProceed with sending emails now? (y/N): ");
  if (!okToProceed) {
    console.log("Cancelled. No emails were sent.");
    await sql.end({ timeout: 5 });
    return;
  }

  // Log DB-level skips for auditability
  for (const email of notFound) {
    appendLog(logPath, {
      email,
      status: "skipped",
      reason: "db_not_found",
      timestamp: new Date().toISOString(),
    });
  }
  for (const m of missingDbFields) {
    appendLog(logPath, {
      email: m.email,
      status: "skipped",
      reason: m.reason,
      timestamp: new Date().toISOString(),
    });
  }

  const smtp = getSmtpConfig();
  if (!smtp.SMTP_USER || !smtp.SMTP_PASS) {
    console.error("\n❌ SMTP not configured. Missing SMTP_USER (or SMTP_EMAIL) or SMTP_PASS (or SMTP_PASSWORD).");
    await sql.end({ timeout: 5 });
    process.exit(1);
  }

  const transporter = nodemailer.createTransport({
    host: smtp.SMTP_HOST,
    port: smtp.SMTP_PORT,
    secure: smtp.SMTP_SECURE,
    auth: {
      user: smtp.SMTP_USER,
      pass: smtp.SMTP_PASS,
    },
  });

  const from = `"${smtp.FROM_NAME}" <${smtp.FROM_EMAIL}>`;
  const subject = "UOL Alumni Portal Login Credentials";

  console.log("\n==== SENDING ====");

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < validRecipients.length; i++) {
    const { db } = validRecipients[i]!;

    const to = normalizeEmail(String(db.personalemail ?? ""));
    const logEmailKey = to;

    if (!to || !to.includes("@")) {
      skipped++;
      appendLog(logPath, {
        email: logEmailKey || "(missing)",
        status: "skipped",
        timestamp: new Date().toISOString(),
        error: "Invalid recipient email",
        alumniid: db.alumniid,
      });
      continue;
    }

    if (alreadySent.has(logEmailKey)) {
      skipped++;
      appendLog(logPath, {
        email: logEmailKey,
        status: "skipped",
        reason: "already_sent",
        timestamp: new Date().toISOString(),
        alumniid: db.alumniid,
      });
      continue;
    }

    console.log(`Sending email ${i + 1}/${validRecipients.length} to ${to} ...`);

    const text = buildEmailText({
      alumniname: clean(db.alumniname) || "Alumni",
      personalemail: to,
      sapid: clean(db.sapid),
      password: clean(db.password),
    });

    const html = toHtmlFromText(text);

    const res = await sendWithRetry({
      transporter,
      from,
      to,
      subject,
      text,
      html,
      retries,
    });

    if (res.ok) {
      sent++;
      alreadySent.add(logEmailKey);
      appendLog(logPath, {
        email: logEmailKey,
        status: "sent",
        timestamp: new Date().toISOString(),
        alumniid: db.alumniid,
      });
    } else {
      failed++;
      appendLog(logPath, {
        email: logEmailKey,
        status: "failed",
        timestamp: new Date().toISOString(),
        error: res.error,
        alumniid: db.alumniid,
      });
      console.error(`Failed: ${to} - ${res.error}`);
    }
  }

  console.log("\n==== SUMMARY ====");
  console.log(`Valid recipients: ${validRecipients.length}`);
  console.log(`Sent: ${sent}`);
  console.log(`Failed: ${failed}`);
  console.log(`Skipped: ${skipped}`);

  await sql.end({ timeout: 5 });
}

main().catch((err) => {
  console.error("❌ Failed:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
