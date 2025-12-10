import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { sendAssociationApplicationEmail } from "@/lib/email";
import { buildAccessFilterSQL } from "@/lib/userAccess";

export async function GET(request: NextRequest) {
  console.log("[API] Alumni Association GET request received");
  try {
    console.log("[API] Getting session...");
    const session = await auth();
    console.log("[API] Session obtained:", session?.user?.email || "no user");
    const { searchParams } = new URL(request.url);
    console.log("[API] URL search params:", Object.fromEntries(searchParams.entries()));
    
    // Get filter parameters (arrays for multi-select)
    const facultiesParam = searchParams.get("faculties");
    const departmentsParam = searchParams.get("departments");
    const associationsParam = searchParams.get("associations");
    const membershipFilter = searchParams.get("membershipFilter") || "members"; // "all", "members", "non-members"
    
    const selectedFaculties = facultiesParam ? facultiesParam.split(',').map(s => s.trim()).filter(Boolean) : [];
    const selectedDepartments = departmentsParam ? departmentsParam.split(',').map(s => s.trim()).filter(Boolean) : [];
    const selectedAssociations = associationsParam ? associationsParam.split(',').map(s => s.trim()).filter(Boolean).map(Number).filter(n => !isNaN(n)) : [];
    
    // Pagination parameters
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") || "100", 10), 500); // Max 500 per page
    const offset = (page - 1) * limit;
    
    // Debug logging
    console.log("[API] Alumni Association Filters:", {
      faculties: selectedFaculties.length > 0 ? selectedFaculties : "none",
      departments: selectedDepartments.length > 0 ? selectedDepartments : "none",
      associations: selectedAssociations.length > 0 ? selectedAssociations : "none",
      membershipFilter,
      page,
      limit,
    });
    
    // Build access filter for admin/viewer users
    const accessFilter = await buildAccessFilterSQL(session, "");
    const accessFilterCondition = accessFilter.hasFilter && accessFilter.sql ? sql` AND (${accessFilter.sql})` : sql``;
    
    // Helper function to combine OR conditions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const combineOrConditions = (conditions: any[]): any => {
      if (conditions.length === 0) return sql``;
      if (conditions.length === 1) return conditions[0];
      if (conditions.length === 2) return sql`${conditions[0]} OR ${conditions[1]}`;
      const mid = Math.ceil(conditions.length / 2);
      const left = combineOrConditions(conditions.slice(0, mid));
      const right = combineOrConditions(conditions.slice(mid));
      return sql`${left} OR ${right}`;
    };
    
    // Build faculty filter condition (case-insensitive with trim) - handle multiple
    let facultyFilterCondition = sql``;
    if (selectedFaculties.length > 0) {
      const normalizedFaculties = selectedFaculties.map(f => f.toLowerCase());
      const facultyConditions = normalizedFaculties.map(f => sql`LOWER(TRIM(COALESCE(a.facultyname, ''))) = ${f}`);
      if (facultyConditions.length === 1) {
        facultyFilterCondition = sql` AND ${facultyConditions[0]}`;
      } else if (facultyConditions.length > 1) {
        const combinedCondition = combineOrConditions(facultyConditions);
        facultyFilterCondition = sql` AND (${combinedCondition})`;
      }
    }
    
    // Build department filter condition (case-insensitive with trim) - handle multiple
    let departmentFilterCondition = sql``;
    if (selectedDepartments.length > 0) {
      const normalizedDepartments = selectedDepartments.map(d => d.toLowerCase());
      const departmentConditions = normalizedDepartments.map(d => sql`LOWER(TRIM(COALESCE(a.departmentname, ''))) = ${d}`);
      if (departmentConditions.length === 1) {
        departmentFilterCondition = sql` AND ${departmentConditions[0]}`;
      } else if (departmentConditions.length > 1) {
        const combinedCondition = combineOrConditions(departmentConditions);
        departmentFilterCondition = sql` AND (${combinedCondition})`;
      }
    }
    
    // Build association filter condition - handle multiple
    let associationFilterCondition = sql``;
    if (selectedAssociations.length > 0) {
      // Build OR conditions for multiple associations
      const associationConditions = selectedAssociations.map(id => sql`a.association_id = ${id}`);
      if (associationConditions.length === 1) {
        associationFilterCondition = sql` AND ${associationConditions[0]}`;
      } else if (associationConditions.length > 1) {
        const combinedCondition = combineOrConditions(associationConditions);
        associationFilterCondition = sql` AND (${combinedCondition})`;
      }
    }
    
    // Build membership filter condition
    const membershipJoinType: "JOIN" | "LEFT JOIN" = membershipFilter === "members" ? "JOIN" : "LEFT JOIN";
    let membershipWhereCondition = sql``;
    
    if (membershipFilter === "non-members") {
      // For non-members: must not have any association
      membershipWhereCondition = sql` AND a.association_id IS NULL`;
    } else if (membershipFilter === "members") {
      // For members: must have at least one association
      membershipWhereCondition = sql` AND a.association_id IS NOT NULL`;
    }
    // For "all": no additional condition needed, just use LEFT JOIN
    
    // Build the query based on membership filter
    const baseQuery = membershipJoinType === "JOIN"
      ? sql`FROM public.tbl_alumni a
      JOIN public.tbl_associations assoc ON assoc.id = a.association_id`
      : sql`FROM public.tbl_alumni a
      LEFT JOIN public.tbl_associations assoc ON assoc.id = a.association_id`;
    
    console.log("[API] Executing query with filters:", {
      hasFacultyFilter: selectedFaculties.length > 0,
      hasDepartmentFilter: selectedDepartments.length > 0,
      hasAssociationFilter: selectedAssociations.length > 0,
      membershipFilter,
      page,
      limit,
      offset,
    });
    
    // First, get the total count
    let countResult;
    try {
      countResult = await sql/* sql */`
        SELECT COUNT(*) as total
        ${baseQuery}
        WHERE 1=1
          ${accessFilterCondition}
          ${facultyFilterCondition}
          ${departmentFilterCondition}
          ${associationFilterCondition}
          ${membershipWhereCondition}
      `;
    } catch (countError) {
      console.error("[API] Count Query Error:", countError);
      throw countError;
    }
    
    const total = Number(countResult[0]?.total || 0);
    const totalPages = Math.max(1, Math.ceil(total / limit));
    
    // Then get the paginated results
    let rows;
    try {
      rows = await sql/* sql */`
        SELECT 
          a.alumniid,
          a.sapid,
          a.alumniname,
          a.departmentname,
          a.facultyname,
          a.degreetitle,
          a.personalemail,
          a.officialemail,
          a.universityemail,
          a.registrationno,
          a.association_id,
          assoc.title as association_title,
          assoc.description as association_description,
          assoc.dean as association_dean,
          assoc.phone as association_phone,
          assoc.email as association_email,
          assoc.address as association_address,
          assoc.created_at as association_created_at
        ${baseQuery}
        WHERE 1=1
          ${accessFilterCondition}
          ${facultyFilterCondition}
          ${departmentFilterCondition}
          ${associationFilterCondition}
          ${membershipWhereCondition}
        ORDER BY a.alumniid DESC
        LIMIT ${limit} OFFSET ${offset}`;
    } catch (queryError) {
      console.error("[API] SQL Query Error:", queryError);
      throw queryError;
    }
    
    console.log("[API] Alumni Association Query Result:", {
      rowCount: rows.length,
      total,
      totalPages,
      page,
    });
    
    const items = rows.map((r: Record<string, unknown>) => ({
      sapid: String(r.sapid ?? ""),
      registrationNo: r.registrationno ? String(r.registrationno) : null,
      name: String(r.alumniname ?? ""),
      department: r.departmentname ? String(r.departmentname) : null,
      faculty: r.facultyname ? String(r.facultyname) : null,
      program: r.degreetitle ? String(r.degreetitle) : null,
      email: (r.personalemail ? String(r.personalemail) : null) || (r.officialemail ? String(r.officialemail) : null) || (r.universityemail ? String(r.universityemail) : null),
      associationTitle: r.association_title ? String(r.association_title) : null,
      associationId: r.association_id ? Number(r.association_id) : null,
      createdAt: r.association_created_at || null,
    }));
    
    console.log("[API] Returning items:", items.length);
    return NextResponse.json({ 
      items,
      total,
      page,
      limit,
      totalPages,
    }, { status: 200 });
  } catch (err) {
    console.error("[API] Error fetching alumni association:", err);
    const msg = err instanceof Error ? err.message : "Failed to fetch association";
    const errorDetails = err instanceof Error ? err.stack : String(err);
    console.error("[API] Error details:", errorDetails);
    return NextResponse.json({ error: msg, details: process.env.NODE_ENV === "development" ? errorDetails : undefined }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const userSapid = session?.user ? ((session.user as { sapid?: string | null })?.sapid ? String((session.user as { sapid?: string | null }).sapid) : null) : null;
    const userRegNo = session?.user ? ((session.user as { registrationno?: string | null })?.registrationno ? String((session.user as { registrationno?: string | null }).registrationno) : null) : null;
    if (!session?.user?.email && !userSapid && !userRegNo) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { alumniId, role } = body;

    if (!alumniId) {
      return NextResponse.json({ error: "Alumni ID is required" }, { status: 400 });
    }

    if (!role) {
      return NextResponse.json({ error: "Role is required" }, { status: 400 });
    }

    // Validate role
    const validRoles = ["president", "vicePresident", "coordinator"];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: "Invalid role selected" }, { status: 400 });
    }

    // Map role values to display names
    const roleDisplayNames: Record<string, string> = {
      president: "President",
      vicePresident: "Vice President",
      coordinator: "Coordinator",
    };

    const roleDisplayName = roleDisplayNames[role] || role;
    const alumniIdNum = Number(alumniId);
    if (isNaN(alumniIdNum) || alumniIdNum <= 0) {
      return NextResponse.json({ error: "Invalid alumni ID" }, { status: 400 });
    }

    // Check if alumni already has a pending application (by alumni_id)
    const pendingApp = await sql/* sql */`
      SELECT id, status FROM public.tblalumniassociation 
      WHERE alumni_id = ${alumniIdNum} AND status = 'pending'
      LIMIT 1
    `;
    
    if (pendingApp && pendingApp.length > 0) {
      return NextResponse.json({ 
        error: "You already have a pending application. Please wait for admin approval." 
      }, { status: 400 });
    }

    // Check if alumni already has an approved leadership position
    const approvedApp = await sql/* sql */`
      SELECT ass.id, ass.status 
      FROM public.tblalumniassociation ass
      INNER JOIN public.tbl_alumni a ON a.association_job = ass.id
      WHERE a.alumniid = ${alumniIdNum} AND ass.status = 'approved'
      LIMIT 1
    `;
    
    if (approvedApp && approvedApp.length > 0) {
      return NextResponse.json({ 
        error: "You are already approved as a leader. No further application is required." 
      }, { status: 400 });
    }

    // Insert new record with status='pending' (DO NOT link to tbl_alumni yet)
    // Aligned with schema - add status, rejection_reason, updated_at, alumni_id
    const insertResult = await sql/* sql */`
      INSERT INTO public.tblalumniassociation (q3, createddatetime, status, alumni_id)
      VALUES (${roleDisplayName}, NOW(), 'pending', ${alumniIdNum})
      RETURNING id, status
    `;
    
    if (!insertResult || insertResult.length === 0) {
      throw new Error("Failed to create association leadership record");
    }
    
    const createdRecord = insertResult[0] as { id: number; status: string };
    console.log(`[Association Leadership] Application created - ID: ${createdRecord.id}, Status: ${createdRecord.status}, Alumni ID: ${alumniIdNum}`);
    
    // Verify the record was created with 'pending' status
    if (createdRecord.status !== 'pending') {
      console.error(`[Association Leadership] WARNING: Application was created with status '${createdRecord.status}' instead of 'pending'!`);
    }

    // Send confirmation email
    try {
      const alumniRows = await sql/* sql */`
        SELECT alumniname, personalemail, officialemail, universityemail
        FROM public.tbl_alumni 
        WHERE alumniid = ${alumniId}
        LIMIT 1
      `;
      const alumni = alumniRows[0] as {
        alumniname: string | null;
        personalemail: string | null;
        officialemail: string | null;
        universityemail: string | null;
      } | undefined;
      
      if (alumni) {
        const alumniEmail = alumni.personalemail || alumni.officialemail || alumni.universityemail;
        const alumniName = alumni.alumniname || "Alumni";
        
        if (alumniEmail) {
          // Send email asynchronously (don't wait for it to complete)
          sendAssociationApplicationEmail(alumniEmail, alumniName, roleDisplayName).catch((err) => {
            console.error("[API] Failed to send association application email:", err);
          });
        }
      }
    } catch (emailError) {
      // Don't fail the request if email fails
      console.error("[API] Error sending association application email:", emailError);
    }

    return NextResponse.json({ 
      success: true, 
      message: "Application submitted successfully. It is now pending admin approval." 
    });
  } catch (error) {
    console.error("Error submitting alumni association application:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to submit application";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

