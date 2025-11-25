import { NextResponse } from "next/server";
import { z } from "zod";
import { alumniRegistrationComprehensiveSchema } from "@/lib/alumniRegistration";
import { sql } from "@/lib/dbconnect";

// Helper: map validated payload to DB columns
function mapToDb(payload: z.infer<typeof alumniRegistrationComprehensiveSchema>) {
  const contactno = `${payload.countryCode} ${payload.phoneNumber}`.trim();
  return {
    registrationno: payload.registrationNo,
    sapid: payload.sapId,
    alumniname: payload.name,
    gender: payload.gender,
    fathername: payload.fatherName ?? null,
    dateofbirth: payload.dob ?? null,
    maritalstatus: payload.maritalStatus ?? null,
    cnicpassport: payload.cnicOrPassport,
    contactno,
    personalemail: payload.personalEmail,
    password: payload.password,
    address: payload.address ?? null,
    province: payload.province ?? null,
    city: payload.homeCity,
    country: payload.homeCountry,
    campusname: payload.campus,
    facultyname: payload.faculty,
    departmentname: payload.department,
    degreetitle: payload.program,
    yearofending: payload.passingYear,
    employeed: payload.employmentStatus,
    industry: payload.sector ?? null,
    nameoforganization: payload.organization ?? null,
    designation: payload.designation ?? null,
    totalyearsofexpereince: payload.totalExperienceYears ?? null,
    officialemail: payload.officialEmail ?? null,
    officialnumber: payload.officialPhone ?? null,
    datasource: payload.source ?? null,
    verify: payload.verified === true ? "true" : payload.verified === false ? "false" : "pending", // 'pending' for new registrations
    alumnistatus: payload.category ?? null,
    todaydate: new Date(),
  };
}

export async function GET(req: Request) {
  // Fetch alumni records with pagination and optional filtering
  // Optimized: Using indexed columns and efficient ordering
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") || "100", 10), 500); // Max 500 per page for performance
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || ""; // Filter by verify status: "verified", "unverified", "underApproval"
    const getCountsOnly = searchParams.get("countsOnly") === "true";
    const offset = (page - 1) * limit;
    
    // If only counts are needed, return early with just counts
    if (getCountsOnly) {
      const searchTermForCount = search && search.trim() ? `%${search.trim().toLowerCase()}%` : null;
      const countQuery = searchTermForCount
        ? sql/* sql */`
            SELECT COUNT(*) as total
            FROM public.tbl_alumni
            WHERE sapid IS NOT NULL AND sapid != ''
              AND (
                LOWER(sapid) LIKE ${searchTermForCount}
                OR LOWER(COALESCE(registrationno, '')) LIKE ${searchTermForCount}
                OR LOWER(COALESCE(alumniname, '')) LIKE ${searchTermForCount}
                OR LOWER(COALESCE(personalemail, '')) LIKE ${searchTermForCount}
                OR LOWER(COALESCE(officialemail, '')) LIKE ${searchTermForCount}
                OR LOWER(COALESCE(facultyname, '')) LIKE ${searchTermForCount}
                OR LOWER(COALESCE(departmentname, '')) LIKE ${searchTermForCount}
              )`
        : sql/* sql */`
            SELECT COUNT(*) as total
            FROM public.tbl_alumni
            WHERE sapid IS NOT NULL AND sapid != ''`;
      
      const countResult = await countQuery;
      const total = Number(countResult[0]?.total || 0);
      
      return NextResponse.json({ 
        total,
        page: 1,
        limit: 1,
        totalPages: 1,
        items: []
      }, { status: 200 });
    }

    // Build WHERE clause for verify status filtering
    // Verify field is now VARCHAR(10) - handle as string only
    let verifyFilter = sql``;
    if (status === "verified") {
      verifyFilter = sql`AND LOWER(COALESCE(verify, '')) = 'true'`;
      console.log("[API] Filtering for verified alumni");
    } else if (status === "unverified") {
      verifyFilter = sql`AND LOWER(COALESCE(verify, '')) = 'false'`;
      console.log("[API] Filtering for unverified alumni");
    } else if (status === "underApproval") {
      // Under Approval: verify = 'pending' (new registrations awaiting admin approval)
      // For under approval, show all records with verify = 'pending' (even if sapid/registrationno is null)
      verifyFilter = sql`AND verify = 'pending'`;
      console.log("[API] Filtering for under approval alumni (verify = 'pending', including null sapid/registrationno)");
    } else {
      // For "total" and other tabs, include records with either sapid OR registrationno
      console.log("[API] No status filter applied, status:", status);
    }

    // Build query with optional search and status filter
    let query;
    // Base WHERE clause: require either sapid OR registrationno (except for underApproval which we handle separately)
    const baseWhere = status === "underApproval" 
      ? sql`1=1` 
      : sql`(sapid IS NOT NULL AND sapid != '' OR registrationno IS NOT NULL AND registrationno != '')`;
    
    if (search && search.trim()) {
      const searchTerm = `%${search.trim().toLowerCase()}%`;
      query = sql/* sql */`
        SELECT
          alumniid,
          registrationno,
          sapid,
          alumniname,
          facultyname,
          campusname,
          departmentname,
          degreetitle,
          yearofending,
          country,
          city,
          verify,
          employeed,
          nameoforganization,
          designation,
          officialnumber,
          officialemail,
          personalemail,
          contactno,
          lasttimelogin,
          logincount
        FROM public.tbl_alumni
        WHERE ${baseWhere}
          ${verifyFilter}
          AND (
            LOWER(sapid) LIKE ${searchTerm}
            OR LOWER(COALESCE(registrationno, '')) LIKE ${searchTerm}
            OR LOWER(COALESCE(alumniname, '')) LIKE ${searchTerm}
            OR LOWER(COALESCE(personalemail, '')) LIKE ${searchTerm}
            OR LOWER(COALESCE(officialemail, '')) LIKE ${searchTerm}
            OR LOWER(COALESCE(facultyname, '')) LIKE ${searchTerm}
            OR LOWER(COALESCE(departmentname, '')) LIKE ${searchTerm}
          )
        ORDER BY alumniid DESC
        LIMIT ${limit} OFFSET ${offset}`;
    } else {
      query = sql/* sql */`
      SELECT
        alumniid,
        registrationno,
        sapid,
        alumniname,
        facultyname,
        campusname,
        departmentname,
        degreetitle,
        yearofending,
        country,
        city,
        verify,
        employeed,
        nameoforganization,
        designation,
        officialnumber,
        officialemail,
        personalemail,
        contactno,
        lasttimelogin,
        logincount
      FROM public.tbl_alumni
      WHERE ${baseWhere}
        ${verifyFilter}
        ORDER BY alumniid DESC
        LIMIT ${limit} OFFSET ${offset}`;
    }

    const rows = await query;
    
    // Debug logging
    console.log("[API] Query executed with status:", status || "none", "Returned rows:", rows.length);
    if (status === "underApproval" && rows.length > 0) {
      console.log("[API] Under approval items - verify values:", rows.map((r: Record<string, unknown>) => ({ sapid: String(r.sapid ?? ""), verify: r.verify, verifyType: typeof r.verify })));
    } else if (status === "underApproval" && rows.length === 0) {
      console.log("[API] WARNING: No under approval items found! Checking database...");
      // Quick check to see if there are any 'pending' verify records
      const checkPending = await sql/* sql */`
        SELECT COUNT(*) as count FROM public.tbl_alumni 
        WHERE sapid IS NOT NULL AND sapid != '' AND verify = 'pending'
      `;
      console.log("[API] Total records with verify = 'pending' (exact match):", checkPending[0]?.count || 0);
      
      // Get sample records to see what's actually there
      const samplePendingRecords = await sql/* sql */`
        SELECT alumniid, sapid, registrationno, verify, LENGTH(verify) as verify_length
        FROM public.tbl_alumni 
        WHERE (sapid IS NOT NULL AND sapid != '' OR registrationno IS NOT NULL AND registrationno != '')
        AND verify = 'pending'
        ORDER BY alumniid DESC
        LIMIT 5
      `;
      console.log("[API] Sample records with verify = 'pending':", samplePendingRecords);
      
      // Check specifically for the recently registered alumni (ID 30714, SAP ID 123432)
      const checkSpecificAlumni = await sql/* sql */`
        SELECT alumniid, sapid, verify, LENGTH(verify) as verify_length, createddatetime
        FROM public.tbl_alumni 
        WHERE alumniid = 30714 OR sapid = '123432'
        LIMIT 5
      `;
      console.log("[API] Check for alumni ID 30714 or SAP ID 123432:", checkSpecificAlumni);
      
      // Get sample records with 'pending' to see what's actually stored
      const samplePending = await sql/* sql */`
        SELECT sapid, verify, LENGTH(verify) as verify_length, 
               TRIM(verify) as verify_trimmed,
               LOWER(TRIM(verify)) as verify_lower_trimmed
        FROM public.tbl_alumni 
        WHERE sapid IS NOT NULL AND sapid != '' 
        AND (verify = 'pending' OR LOWER(TRIM(COALESCE(verify, ''))) = 'pending')
        LIMIT 5
      `;
      console.log("[API] Sample records with 'pending':", samplePending);
      
      // Check the most recently registered alumni (last 10 by alumniid DESC)
      const recentAlumni = await sql/* sql */`
        SELECT alumniid, sapid, verify, LENGTH(verify) as verify_length,
               TRIM(verify) as verify_trimmed,
               LOWER(TRIM(verify)) as verify_lower_trimmed,
               createddatetime
        FROM public.tbl_alumni 
        WHERE sapid IS NOT NULL AND sapid != ''
        ORDER BY alumniid DESC
        LIMIT 10
      `;
      console.log("[API] Most recently registered alumni (last 10):", recentAlumni);
      
      // Check for case variations
      const checkCaseVariations = await sql/* sql */`
        SELECT verify, LENGTH(verify) as verify_length, COUNT(*) as count
        FROM public.tbl_alumni 
        WHERE sapid IS NOT NULL AND sapid != '' 
        AND (LOWER(verify) LIKE '%pending%' OR verify LIKE '%pending%')
        GROUP BY verify, LENGTH(verify)
        ORDER BY count DESC
        LIMIT 10
      `;
      console.log("[API] Records containing 'pending' (any case):", checkCaseVariations);
      
      // Also check what verify values actually exist
      const verifySamples = await sql/* sql */`
        SELECT verify, pg_typeof(verify) as verify_type, COUNT(*) as count
        FROM public.tbl_alumni 
        WHERE sapid IS NOT NULL AND sapid != ''
        GROUP BY verify, pg_typeof(verify)
        ORDER BY count DESC
        LIMIT 10
      `;
      console.log("[API] Sample verify values in database:", verifySamples);
    }
    
    // Get total count for pagination (only if needed)
    const searchTermForCount = search && search.trim() ? `%${search.trim().toLowerCase()}%` : null;
    const countQuery = searchTermForCount
      ? sql/* sql */`
          SELECT COUNT(*) as total
          FROM public.tbl_alumni
          WHERE ${baseWhere}
            ${verifyFilter}
            AND (
              LOWER(sapid) LIKE ${searchTermForCount}
              OR LOWER(COALESCE(registrationno, '')) LIKE ${searchTermForCount}
              OR LOWER(COALESCE(alumniname, '')) LIKE ${searchTermForCount}
              OR LOWER(COALESCE(personalemail, '')) LIKE ${searchTermForCount}
              OR LOWER(COALESCE(officialemail, '')) LIKE ${searchTermForCount}
              OR LOWER(COALESCE(facultyname, '')) LIKE ${searchTermForCount}
              OR LOWER(COALESCE(departmentname, '')) LIKE ${searchTermForCount}
            )`
          : sql/* sql */`
              SELECT COUNT(*) as total
              FROM public.tbl_alumni
              WHERE ${baseWhere}
                ${verifyFilter}`;
    
    const countResult = await countQuery;
    const total = countResult[0]?.total || 0;

    return NextResponse.json({ 
      items: rows, 
      total: Number(total),
      page,
      limit,
      totalPages: Math.ceil(Number(total) / limit)
    }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch alumni";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = alumniRegistrationComprehensiveSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const v = parsed.data;
    const d = mapToDb(v);
    const rows = await sql/* sql */`
      INSERT INTO public.tbl_alumni (
        registrationno, sapid, alumniname, gender, fathername, dateofbirth, maritalstatus,
        cnicpassport, contactno, personalemail, password, address, province, city, country,
        campusname, facultyname, departmentname, degreetitle, yearofending, employeed, industry,
        nameoforganization, designation, totalyearsofexpereince, officialemail, officialnumber,
        datasource, verify, alumnistatus, todaydate
      ) VALUES (
        ${d.registrationno}, ${d.sapid}, ${d.alumniname}, ${d.gender}, ${d.fathername}, ${d.dateofbirth}, ${d.maritalstatus},
        ${d.cnicpassport}, ${d.contactno}, ${d.personalemail}, ${d.password}, ${d.address}, ${d.province}, ${d.city}, ${d.country},
        ${d.campusname}, ${d.facultyname}, ${d.departmentname}, ${d.degreetitle}, ${d.yearofending}, ${d.employeed}, ${d.industry},
        ${d.nameoforganization}, ${d.designation}, ${d.totalyearsofexpereince}, ${d.officialemail}, ${d.officialnumber},
        ${d.datasource}, ${d.verify}, ${d.alumnistatus}, ${d.todaydate}
      )
      RETURNING alumniid, registrationno, sapid`;
    const created = rows[0];
    return NextResponse.json({ ok: true, created }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create alumni";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}