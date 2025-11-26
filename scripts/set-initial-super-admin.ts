import postgres from "postgres";
import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

// Get DATABASE_URL from command line argument, environment variable, or .env file
const databaseUrl = process.argv[2] || process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("❌ Error: DATABASE_URL is not set");
  console.error("");
  console.error("Usage options:");
  console.error("  1. Pass DATABASE_URL as argument:");
  console.error("     npm run set-super-admin -- \"postgresql://user:password@host:port/database\"");
  console.error("");
  console.error("  2. Set environment variable:");
  console.error("     $env:DATABASE_URL=\"postgresql://user:password@host:port/database\"; npm run set-super-admin");
  console.error("");
  console.error("  3. Create .env.local file with:");
  console.error("     DATABASE_URL=postgresql://user:password@host:port/database");
  console.error("");
  console.error("  4. Or run the SQL directly using psql:");
  console.error("     psql \"your_connection_string\" -f migrations/set_initial_super_admin.sql");
  process.exit(1);
}

const sql = postgres(databaseUrl, {
  max: 1,
  idle_timeout: 20,
  connect_timeout: 10,
});

async function setInitialSuperAdmin() {
  try {
    console.log("Setting initial Super Admin...");
    
    // First, check if there's already a Super Admin
    const existingSuperAdmin = await sql/* sql */`
      SELECT userid, email
      FROM public.tbl_users
      WHERE LOWER(TRIM(type)) = 'superadmin'
      LIMIT 1
    ` as { userid: number; email: string | null }[];

    if (existingSuperAdmin.length > 0) {
      const existingEmail = existingSuperAdmin[0].email;
      const targetEmail = "uzair.shafqat@spmo.uol.edu.pk";
      
      // If there's an existing Super Admin that's not the target user, change it to admin
      if (existingEmail && existingEmail.toLowerCase().trim() !== targetEmail.toLowerCase().trim()) {
        console.log(`Found existing Super Admin: ${existingEmail}`);
        console.log("Changing existing Super Admin to admin...");
        
        await sql/* sql */`
          UPDATE public.tbl_users
          SET type = 'admin'
          WHERE userid = ${existingSuperAdmin[0].userid}
        `;
        
        console.log("Existing Super Admin changed to admin.");
      }
    }

    // Set the target user as Super Admin
    console.log("Setting uzair.shafqat@spmo.uol.edu.pk as Super Admin...");
    
    const result = await sql/* sql */`
      UPDATE public.tbl_users
      SET type = 'superadmin'
      WHERE LOWER(TRIM(email)) = 'uzair.shafqat@spmo.uol.edu.pk'
      RETURNING userid, email, firstname, lastname, type, blocked
    ` as { userid: number; email: string | null; firstname: string | null; lastname: string | null; type: string | null; blocked: boolean | null }[];

    if (result.length === 0) {
      console.warn("⚠️  WARNING: User with email 'uzair.shafqat@spmo.uol.edu.pk' not found in database.");
      console.warn("   Please create the user first, then run this script again.");
      process.exit(1);
    }

    const user = result[0];
    console.log("\n✅ Success! Super Admin set:");
    console.log(`   User ID: ${user.userid}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Name: ${user.firstname || ""} ${user.lastname || ""}`.trim() || "N/A");
    console.log(`   Type: ${user.type}`);
    console.log(`   Blocked: ${user.blocked ? "Yes" : "No"}`);
    
    // Verify there's only one Super Admin
    const allSuperAdmins = await sql/* sql */`
      SELECT userid, email, firstname, lastname
      FROM public.tbl_users
      WHERE LOWER(TRIM(type)) = 'superadmin'
    ` as { userid: number; email: string | null; firstname: string | null; lastname: string | null }[];

    if (allSuperAdmins.length > 1) {
      console.warn("\n⚠️  WARNING: Multiple Super Admins found!");
      allSuperAdmins.forEach((sa) => {
        console.warn(`   - ${sa.email} (ID: ${sa.userid})`);
      });
    } else {
      console.log("\n✅ Verified: Only one Super Admin exists.");
    }

    await sql.end();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error setting Super Admin:", error);
    await sql.end();
    process.exit(1);
  }
}

setInitialSuperAdmin();

