/**
 * Diagnostic script to test Super Admin login
 * Run with: npx tsx scripts/test-super-admin-login.ts <email> <password>
 */

import "dotenv/config";
import postgres from "postgres";

const email = process.argv[2];
const password = process.argv[3];

if (!email || !password) {
  console.error("Usage: npx tsx scripts/test-super-admin-login.ts <email> <password>");
  process.exit(1);
}

async function testLogin() {
  if (!process.env.DATABASE_URL) {
    console.error("ERROR: DATABASE_URL environment variable is not set");
    process.exit(1);
  }

  console.log("Testing Super Admin login...");
  console.log(`Email: ${email}`);
  console.log(`Database URL: ${process.env.DATABASE_URL.replace(/:[^:@]+@/, ":****@")}`);
  console.log("");

  const sql = postgres(process.env.DATABASE_URL, {
    max: 1,
    connect_timeout: 30,
  });

  try {
    // Test database connection
    console.log("1. Testing database connection...");
    await sql`SELECT 1 as test`;
    console.log("   ✓ Database connection successful");
    console.log("");

    // Query user
    console.log("2. Querying user from database...");
    const rows = await sql/* sql */`
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
      WHERE LOWER(TRIM(email)) = ${email.toLowerCase()}
      LIMIT 1
    `;

    if (rows.length === 0) {
      console.error("   ✗ User not found in database");
      process.exit(1);
    }

    const user = rows[0] as {
      userid: number;
      email: string | null;
      password: string | null;
      firstname: string | null;
      lastname: string | null;
      department: string | null;
      type_normalized: string | null;
      type_original: string | null;
      blocked: boolean | null;
      lastlogindatetime: string | null;
    };

    console.log("   ✓ User found:");
    console.log(`     - User ID: ${user.userid}`);
    console.log(`     - Email: ${user.email}`);
    console.log(`     - Name: ${user.firstname} ${user.lastname}`);
    console.log(`     - Type (original): "${user.type_original}"`);
    console.log(`     - Type (normalized): "${user.type_normalized}"`);
    console.log(`     - Blocked: ${user.blocked}`);
    console.log(`     - Password length: ${user.password?.length || 0}`);
    console.log("");

    // Check if blocked
    if (user.blocked) {
      console.error("   ✗ User account is blocked");
      process.exit(1);
    }

    // Check type
    const normalizedType = (user.type_normalized || "").replace(/\s+/g, "");
    console.log("3. Checking user type...");
    console.log(`   - Normalized type: "${normalizedType}"`);
    
    if (normalizedType !== "admin" && normalizedType !== "superadmin" && normalizedType !== "viewer" && normalizedType !== "user") {
      console.error(`   ✗ Invalid user type: "${normalizedType}"`);
      console.error(`   ✗ Expected: admin, superadmin, viewer, or user`);
      process.exit(1);
    }
    console.log(`   ✓ User type is valid: "${normalizedType}"`);
    console.log("");

    // Verify password
    console.log("4. Verifying password...");
    const stored = user.password || "";
    const normalizedStored = stored.trim().replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const normalizedPlain = password.trim().replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    
    console.log(`   - Stored password length: ${stored.length}`);
    console.log(`   - Provided password length: ${password.length}`);
    console.log(`   - Stored (normalized) length: ${normalizedStored.length}`);
    console.log(`   - Provided (normalized) length: ${normalizedPlain.length}`);
    
    let passwordMatch = false;
    if (normalizedStored === normalizedPlain) {
      passwordMatch = true;
      console.log("   ✓ Password matches (string comparison)");
    } else {
      try {
        const storedBytes = Buffer.from(normalizedStored, 'utf8');
        const plainBytes = Buffer.from(normalizedPlain, 'utf8');
        if (storedBytes.equals(plainBytes)) {
          passwordMatch = true;
          console.log("   ✓ Password matches (byte comparison)");
        }
      } catch {}
    }

    if (!passwordMatch) {
      console.error("   ✗ Password does not match");
      console.error(`   - Stored (first 10 chars): "${stored.substring(0, 10)}..."`);
      console.error(`   - Provided (first 10 chars): "${password.substring(0, 10)}..."`);
      process.exit(1);
    }
    console.log("");

    console.log("✓ All checks passed! Super Admin should be able to login.");
    console.log("");
    console.log("Summary:");
    console.log(`  - User exists: ✓`);
    console.log(`  - User not blocked: ✓`);
    console.log(`  - User type valid: ✓ (${normalizedType})`);
    console.log(`  - Password matches: ✓`);

  } catch (error) {
    console.error("ERROR:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    await sql.end();
  }
}

testLogin().catch((error) => {
  console.error("FATAL ERROR:", error);
  process.exit(1);
});

