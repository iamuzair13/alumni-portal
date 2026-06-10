import postgres from "postgres";
import dotenv from "dotenv";
import readline from "readline";
import crypto from "node:crypto";

dotenv.config();

const databaseUrl = process.argv[2] || process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("❌ Error: DATABASE_URL is not set");
  console.error("");
  console.error("Usage options:");
  console.error("  1. Pass DATABASE_URL as argument:");
  console.error('     npm run reset-super-admin-password -- "postgresql://user:password@host:port/database"');
  console.error("");
  console.error("  2. Set environment variable:");
  console.error('     $env:DATABASE_URL="postgresql://user:password@host:port/database"; npm run reset-super-admin-password');
  console.error("");
  console.error("  3. Create .env.local file with DATABASE_URL");
  process.exit(1);
}

const sql = postgres(databaseUrl, {
  max: 1,
  idle_timeout: 20,
  connect_timeout: 10,
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query: string): Promise<string> {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function hashAdminPassword(plain: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const N = 16384;
  const r = 8;
  const p = 1;
  const keylen = 64;

  const key = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(plain, salt, keylen, { N, r, p }, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey as Buffer);
    });
  });

  return `scrypt:${salt.toString("base64")}:${key.toString("base64")}:${N},${r},${p},${keylen}`;
}

async function resetSuperAdminPassword() {
  try {
    console.log("🔐 Super Admin Password Reset Tool\n");

    const superAdmin = await sql/* sql */`
      SELECT id, email, firstname, lastname, password
      FROM public.users
      WHERE LOWER(TRIM(COALESCE(type, legacy_type, ''))) = 'superadmin'
      LIMIT 1
    ` as { id: number; email: string | null; firstname: string | null; lastname: string | null; password: string | null }[];

    if (superAdmin.length === 0) {
      console.error("❌ No Super Admin found in database.");
      console.error("   Please run the set-super-admin migration first.");
      process.exit(1);
    }

    const user = superAdmin[0];
    console.log("Found Super Admin:");
    console.log(`   User ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Name: ${user.firstname || ""} ${user.lastname || ""}`.trim() || "N/A");
    console.log(`   Current Password: ${user.password ? "***" + user.password.slice(-2) : "(empty)"}`);
    console.log("");

    const newPassword = await question("Enter new password (min 8 characters): ");

    if (newPassword.length < 8) {
      console.error("❌ Password must be at least 8 characters long.");
      process.exit(1);
    }

    const confirmPassword = await question("Confirm new password: ");

    if (newPassword !== confirmPassword) {
      console.error("❌ Passwords do not match.");
      process.exit(1);
    }

    const passwordHash = await hashAdminPassword(newPassword);

    console.log("\nUpdating password...");
    await sql/* sql */`
      UPDATE public.users
      SET password = ${newPassword}, password_hash = ${passwordHash}, updated_at = now()
      WHERE id = ${user.id}
    `;

    console.log("\n✅ Password updated successfully!");
    console.log(`   You can now login with email: ${user.email}`);
    console.log(`   Password: ${newPassword}`);

    await sql.end();
    rl.close();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error resetting password:", error);
    await sql.end();
    rl.close();
    process.exit(1);
  }
}

resetSuperAdminPassword();
