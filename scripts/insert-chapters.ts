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
  console.error("     npm run insert-chapters -- \"postgresql://user:password@host:port/database\"");
  console.error("");
  console.error("  2. Set environment variable:");
  console.error("     $env:DATABASE_URL=\"postgresql://user:password@host:port/database\"; npm run insert-chapters");
  console.error("");
  console.error("  3. Create .env.local file with:");
  console.error("     DATABASE_URL=postgresql://user:password@host:port/database");
  console.error("");
  console.error("  4. Or run the SQL directly using psql:");
  console.error("     psql \"your_connection_string\" -f migrations/insert_chapters.sql");
  process.exit(1);
}

const sql = postgres(databaseUrl, {
  max: 1,
  idle_timeout: 20,
  connect_timeout: 10,
});

// National chapters from AlumniChaptersForm.tsx
const nationalChapters = [
  'Lahore & Surrounding Chapter',
  'RGujranwala–Gujrat–Sialkot Chapter',
  'Faisalabad Chapter',
  'Sargodha–Khushab Chapter',
  'Multan Chapter',
  'Bahawalpur–Bahawalnagar Chapter',
  'Sahiwal–Pakpattan Chapter',
  'Southern Punjab Chapter',
  'Islamabad–Rawalpindi Chapter',
  'Peshawar & Northern KP Chapter',
  'Kashmir Chapter',
  'Sindh Chapter',
  'Balochistan Chapter',
  'Northern Pakistan Chapter',
];

// International chapters from AlumniChaptersForm.tsx
const internationalChapters = [
  'KSA',
  'Kuwait',
  'UAE',
  'UK',
  'Bahrain',
  'Canada',
  'USA',
  'Qatar',
  'Germany & Austria',
];

async function insertChapters() {
  try {
    console.log("Inserting chapters into tblchapters...");
    console.log(`  National chapters: ${nationalChapters.length}`);
    console.log(`  International chapters: ${internationalChapters.length}`);
    console.log("");

    // Check if chapters already exist
    const existingChapters = await sql/* sql */`
      SELECT COUNT(*) as count
      FROM public.tblchapters
    ` as { count: number }[];

    const existingCount = Number(existingChapters[0]?.count || 0);
    if (existingCount > 0) {
      console.log(`⚠️  WARNING: Found ${existingCount} existing chapter(s) in tblchapters.`);
      console.log("   The script will add new chapters. Duplicates may be created if chapters already exist.");
      console.log("   To avoid duplicates, you may want to clear the table first.");
      console.log("");
    }

    // Insert national chapters
    console.log("Inserting national chapters...");
    for (const chapter of nationalChapters) {
      try {
        await sql/* sql */`
          INSERT INTO public.tblchapters (national_chapter, international_chapter, chapter_whatsapp)
          VALUES (${chapter}, NULL, NULL)
        `;
        console.log(`  ✓ ${chapter}`);
      } catch (error) {
        console.error(`  ✗ Failed to insert "${chapter}":`, error instanceof Error ? error.message : String(error));
      }
    }

    console.log("");

    // Insert international chapters
    console.log("Inserting international chapters...");
    for (const chapter of internationalChapters) {
      try {
        await sql/* sql */`
          INSERT INTO public.tblchapters (national_chapter, international_chapter, chapter_whatsapp)
          VALUES (NULL, ${chapter}, NULL)
        `;
        console.log(`  ✓ ${chapter}`);
      } catch (error) {
        console.error(`  ✗ Failed to insert "${chapter}":`, error instanceof Error ? error.message : String(error));
      }
    }

    console.log("");

    // Verify the inserts
    console.log("Verifying inserted chapters...");
    const allChapters = await sql/* sql */`
      SELECT 
        id,
        national_chapter,
        international_chapter,
        chapter_whatsapp
      FROM public.tblchapters
      ORDER BY 
        CASE WHEN national_chapter IS NOT NULL THEN 1 ELSE 2 END,
        COALESCE(national_chapter, international_chapter)
    ` as {
      id: number;
      national_chapter: string | null;
      international_chapter: string | null;
      chapter_whatsapp: string | null;
    }[];

    const nationalCount = allChapters.filter((c) => c.national_chapter !== null).length;
    const internationalCount = allChapters.filter((c) => c.international_chapter !== null).length;

    console.log(`\n✅ Success! Chapters inserted:`);
    console.log(`   Total chapters: ${allChapters.length}`);
    console.log(`   National chapters: ${nationalCount}`);
    console.log(`   International chapters: ${internationalCount}`);
    console.log("");

    if (allChapters.length > 0) {
      console.log("Sample of inserted chapters:");
      allChapters.slice(0, 5).forEach((chapter) => {
        const name = chapter.national_chapter || chapter.international_chapter || "N/A";
        const type = chapter.national_chapter ? "National" : "International";
        console.log(`   - [${type}] ${name} (ID: ${chapter.id})`);
      });
      if (allChapters.length > 5) {
        console.log(`   ... and ${allChapters.length - 5} more`);
      }
    }

    await sql.end();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error inserting chapters:", error);
    await sql.end();
    process.exit(1);
  }
}

insertChapters();


