import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canModify } from "@/lib/alumniProfile";
import { erpClient } from "@/lib/erpClient";
import { compareAlumniRecords } from "@/lib/erpComparison";
import { sql } from "@/lib/dbconnect";

/**
 * GET /api/erp/compare
 * Compare ERP data with local database
 * Query params:
 *   - sapid: SAP ID to compare (optional)
 *   - registrationno: Registration number to compare (optional)
 */
export async function GET(req: Request) {
  try {
    const session = await auth();
    
    // Check authentication first
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Only admins and superadmins can access this endpoint
    // Return 403 (Forbidden) instead of 401 to avoid triggering session expiration
    if (!canModify(session.user)) {
      return NextResponse.json({ error: "Forbidden: Only admins and superadmins can access ERP data" }, { status: 403 });
    }

    const url = new URL(req.url);
    const sapId = url.searchParams.get("sapid");
    const registrationNo = url.searchParams.get("registrationno");

    if (!sapId && !registrationNo) {
      return NextResponse.json({ 
        error: "Either sapid or registrationno parameter is required" 
      }, { status: 400 });
    }

    // Fetch data from ERP
    let erpResponse;
    if (sapId) {
      erpResponse = await erpClient.fetchBySapId(sapId);
      if (erpResponse && erpResponse.success === false && erpResponse.error === "NOT_FOUND" && registrationNo) {
        erpResponse = await erpClient.fetchByRegistrationNo(registrationNo);
      }
    } else if (registrationNo) {
      erpResponse = await erpClient.fetchByRegistrationNo(registrationNo);
    } else {
      return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
    }

    if (!erpResponse.success) {
      // Handle "NOT_FOUND" error specially - return 200 with success: false
      if (erpResponse.error === "NOT_FOUND") {
        return NextResponse.json({
          success: false,
          error: "NOT_FOUND",
          message: "No record found in ERP system",
          sapid: sapId || null,
          registrationno: registrationNo || null,
          status: "missing_in_erp",
          erpRecord: null,
          localRecord: null,
          differences: [],
        }, { status: 200 });
      }
      
      return NextResponse.json({
        error: erpResponse.error || "Failed to fetch data from ERP system",
        details: erpResponse.message,
      }, { status: 500 });
    }

    if (!erpResponse.data) {
      return NextResponse.json({
        success: false,
        error: "NOT_FOUND",
        message: "No record found in ERP system",
        sapid: sapId || null,
        registrationno: registrationNo || null,
        status: "missing_in_erp",
        erpRecord: null,
        localRecord: null,
        differences: [],
      }, { status: 200 });
    }

    // Normalize ERP response - handle OData format
    // OData can return: { "d": { "results": [...] } } or { "d": { ... } }
    let erpData: Record<string, unknown> | null = null;
    
    if (Array.isArray(erpResponse.data)) {
      // Array of results - take first one
      erpData = erpResponse.data[0] as Record<string, unknown> | null;
    } else if (erpResponse.data && typeof erpResponse.data === "object") {
      // Single object or OData wrapped object
      erpData = erpResponse.data as Record<string, unknown>;
    }

    if (!erpData || Object.keys(erpData).length === 0) {
      return NextResponse.json({
        error: "No data found in ERP system for the provided identifier",
      }, { status: 404 });
    }

    // Fetch corresponding data from local database
    let localRecord;
    if (sapId) {
      const rows = await sql/* sql */`
        SELECT 
          sapid, registrationno, alumniname, personalemail, officialemail, 
          universityemail, facultyname, departmentname, degreetitle, 
          yearofending, yearofstarting, cgpa, campusname
        FROM public.tbl_alumni
        WHERE sapid = ${sapId}
        LIMIT 1
      `;
      localRecord = rows[0] as Record<string, unknown> | undefined;
    } else if (registrationNo) {
      const rows = await sql/* sql */`
        SELECT 
          sapid, registrationno, alumniname, personalemail, officialemail, 
          universityemail, facultyname, departmentname, degreetitle, 
          yearofending, yearofstarting, cgpa, campusname
        FROM public.tbl_alumni
        WHERE registrationno = ${registrationNo}
        LIMIT 1
      `;
      localRecord = rows[0] as Record<string, unknown> | undefined;
    }

    // Compare the data
    if (!localRecord) {
      // Record exists in ERP but not in local database
      return NextResponse.json({
        success: true,
        sapid: sapId || null,
        registrationno: registrationNo || null,
        status: "missing_in_local",
        message: "Record found in ERP but not in local database",
        erpRecord: erpData,
        localRecord: null,
        differences: [],
      }, { status: 200 });
    }

    // Compare records
    const comparison = compareAlumniRecords(
      localRecord as Record<string, unknown>,
      erpData as Record<string, unknown>
    );

    return NextResponse.json({
      success: true,
      ...comparison,
      message: comparison.status === "match" 
        ? "Records match" 
        : `Found ${comparison.differences.length} difference(s)`,
    }, { status: 200 });

  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Failed to compare data",
    }, { status: 500 });
  }
}

