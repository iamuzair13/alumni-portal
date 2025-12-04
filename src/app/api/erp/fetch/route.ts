import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canModify } from "@/lib/alumniProfile";
import { erpClient } from "@/lib/erpClient";

/**
 * GET /api/erp/fetch
 * Fetch data from ERP system without comparing
 * Query params:
 *   - sapid: SAP ID to fetch (optional)
 *   - registrationno: Registration number to fetch (optional)
 */
export async function GET(req: Request) {
  try {
    const session = await auth();
    
    // Only admins and superadmins can access this endpoint
    if (!session?.user || !canModify(session.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    console.log("[ERP Fetch] Fetching data from ERP system...", { sapId, registrationNo });
    
    let erpResponse;
    if (sapId) {
      erpResponse = await erpClient.fetchBySapId(sapId);
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
          data: null,
        }, { status: 200 });
      }
      
      return NextResponse.json({
        success: false,
        error: erpResponse.error || "Failed to fetch data from ERP system",
        details: erpResponse.message,
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: erpResponse.data,
    }, { status: 200 });

  } catch (error) {
    console.error("[ERP Fetch] Error:", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Failed to fetch data from ERP",
    }, { status: 500 });
  }
}

