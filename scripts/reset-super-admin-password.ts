import postgres from "postgres";
import dotenv from "dotenv";
import readline from "readline";

// Load environment variables from .env file
dotenv.config();

// Get DATABASE_URL from command line argument, environment variable, or .env file
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

async function resetSuperAdminPassword() {
  try {
    console.log("🔐 Super Admin Password Reset Tool\n");

    // Find the Super Admin
    const superAdmin = await sql/* sql */`
      SELECT userid, email, firstname, lastname, password
      FROM public.tbl_users
      WHERE LOWER(TRIM(type)) = 'superadmin'
      LIMIT 1
    ` as { userid: number; email: string | null; firstname: string | null; lastname: string | null; password: string | null }[];

    if (superAdmin.length === 0) {
      console.error("❌ No Super Admin found in database.");
      console.error("   Please run the set-super-admin migration first.");
      process.exit(1);
    }

    const user = superAdmin[0];
    console.log("Found Super Admin:");
    console.log(`   User ID: ${user.userid}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Name: ${user.firstname || ""} ${user.lastname || ""}`.trim() || "N/A");
    console.log(`   Current Password: ${user.password ? "***" + user.password.slice(-2) : "(empty)"}`);
    console.log("");

    // Get new password
    const newPassword = await question("Enter new password (min 8 characters): ");
    
    if (newPassword.length < 8) {
      console.error("❌ Password must be at least 8 characters long.");
      process.exit(1);
    }

    // Confirm password
    const confirmPassword = await question("Confirm new password: ");
    
    if (newPassword !== confirmPassword) {
      console.error("❌ Passwords do not match.");
      process.exit(1);
    }

    // Update password
    console.log("\nUpdating password...");
    await sql/* sql */`
      UPDATE public.tbl_users
      SET password = ${newPassword}
      WHERE userid = ${user.userid}
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

