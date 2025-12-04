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

    // Check if ERP client is properly configured
    if (!process.env.ERP_API_URL || !process.env.ERP_USERNAME || !process.env.ERP_PASSWORD) {
      const missing = [];
      if (!process.env.ERP_API_URL) missing.push("ERP_API_URL");
      if (!process.env.ERP_USERNAME) missing.push("ERP_USERNAME");
      if (!process.env.ERP_PASSWORD) missing.push("ERP_PASSWORD");
      console.error("[ERP Fetch] Missing environment variables:", missing);
      return NextResponse.json({
        error: "ERP system is not configured",
        details: `Missing environment variables: ${missing.join(", ")}`,
      }, { status: 500 });
    }

    // Fetch data from ERP
    console.log("[ERP Fetch] Fetching data from ERP system...", { sapId, registrationNo });
    
    let erpResponse;
    try {
      if (sapId) {
        erpResponse = await erpClient.fetchBySapId(sapId);
      } else if (registrationNo) {
        erpResponse = await erpClient.fetchByRegistrationNo(registrationNo);
      } else {
        return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
      }
    } catch (erpError) {
      console.error("[ERP Fetch] ERP client error:", erpError);
      return NextResponse.json({
        error: erpError instanceof Error ? erpError.message : "Failed to initialize ERP client",
        details: "Check server logs for more details",
      }, { status: 500 });
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
    const errorMessage = error instanceof Error ? error.message : "Failed to fetch data from ERP";
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    // Get URL params again for logging (in case error happened before they were extracted)
    let logSapId: string | null = null;
    let logRegNo: string | null = null;
    try {
      const errorUrl = new URL(req.url);
      logSapId = errorUrl.searchParams.get("sapid");
      logRegNo = errorUrl.searchParams.get("registrationno");
    } catch {
      // Ignore URL parsing errors
    }
    
    // Log detailed error for debugging on server
    console.error("[ERP Fetch] Error details:", {
      message: errorMessage,
      stack: errorStack,
      sapId: logSapId,
      registrationNo: logRegNo,
      hasApiUrl: !!process.env.ERP_API_URL,
      hasUsername: !!process.env.ERP_USERNAME,
      hasPassword: !!process.env.ERP_PASSWORD,
      apiUrlPreview: process.env.ERP_API_URL ? process.env.ERP_API_URL.substring(0, 50) : "not set",
    });
    
    return NextResponse.json({
      error: errorMessage,
      details: process.env.NODE_ENV === "development" ? errorStack : undefined,
    }, { status: 500 });
  }
}

