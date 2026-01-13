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
  const startTime = Date.now();
  const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    console.log(`[ERP Fetch ${requestId}] Request started`);
    console.log(`[ERP Fetch ${requestId}] Request URL:`, req.url);
    
    const session = await auth();
    console.log(`[ERP Fetch ${requestId}] Session check:`, {
      hasSession: !!session,
      hasUser: !!session?.user,
      userType: (session?.user as { type?: string })?.type,
    });
    
    // Check authentication first
    if (!session?.user) {
      console.warn(`[ERP Fetch ${requestId}] Unauthenticated access attempt`);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Only admins and superadmins can access this endpoint
    // Return 403 (Forbidden) instead of 401 to avoid triggering session expiration
    if (!canModify(session.user)) {
      console.warn(`[ERP Fetch ${requestId}] Forbidden access attempt - user type: ${(session.user as { type?: string })?.type}`);
      return NextResponse.json({ error: "Forbidden: Only admins and superadmins can access ERP data" }, { status: 403 });
    }

    const url = new URL(req.url);
    const sapId = url.searchParams.get("sapid");
    const registrationNo = url.searchParams.get("registrationno");
    
    console.log(`[ERP Fetch ${requestId}] Parameters:`, { sapId, registrationNo });

    if (!sapId && !registrationNo) {
      console.warn(`[ERP Fetch ${requestId}] Missing required parameters`);
      return NextResponse.json({ 
        error: "Either sapid or registrationno parameter is required" 
      }, { status: 400 });
    }

    // Check if ERP client is properly configured
    const envCheck = {
      hasApiUrl: !!process.env.ERP_API_URL,
      hasUsername: !!process.env.ERP_USERNAME,
      hasPassword: !!process.env.ERP_PASSWORD,
      apiUrlLength: process.env.ERP_API_URL?.length || 0,
      usernameLength: process.env.ERP_USERNAME?.length || 0,
      passwordLength: process.env.ERP_PASSWORD?.length || 0,
    };
    
    console.log(`[ERP Fetch ${requestId}] Environment check:`, envCheck);
    
    if (!process.env.ERP_API_URL || !process.env.ERP_USERNAME || !process.env.ERP_PASSWORD) {
      const missing = [];
      if (!process.env.ERP_API_URL) missing.push("ERP_API_URL");
      if (!process.env.ERP_USERNAME) missing.push("ERP_USERNAME");
      if (!process.env.ERP_PASSWORD) missing.push("ERP_PASSWORD");
      console.error(`[ERP Fetch ${requestId}] Missing environment variables:`, missing);
      return NextResponse.json({
        error: "ERP system is not configured",
        details: `Missing environment variables: ${missing.join(", ")}`,
      }, { status: 500 });
    }

    // Fetch data from ERP
    console.log(`[ERP Fetch ${requestId}] Starting ERP data fetch...`, { 
      sapId, 
      registrationNo,
      identifier: sapId || registrationNo,
      identifierType: sapId ? "sapid" : "registrationno",
    });
    
    let erpResponse;
    const fetchStartTime = Date.now();
    try {
      if (sapId) {
        console.log(`[ERP Fetch ${requestId}] Calling erpClient.fetchBySapId(${sapId})`);
        erpResponse = await erpClient.fetchBySapId(sapId);
      } else if (registrationNo) {
        console.log(`[ERP Fetch ${requestId}] Calling erpClient.fetchByRegistrationNo(${registrationNo})`);
        erpResponse = await erpClient.fetchByRegistrationNo(registrationNo);
      } else {
        console.error(`[ERP Fetch ${requestId}] Invalid parameters - neither sapId nor registrationNo`);
        return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
      }
      
      const fetchDuration = Date.now() - fetchStartTime;
      console.log(`[ERP Fetch ${requestId}] ERP client response received in ${fetchDuration}ms:`, {
        success: erpResponse.success,
        hasData: !!erpResponse.data,
        error: erpResponse.error,
        dataType: erpResponse.data ? typeof erpResponse.data : "null",
        dataKeys: erpResponse.data && typeof erpResponse.data === "object" ? Object.keys(erpResponse.data).slice(0, 10) : null,
      });
    } catch (erpError) {
      const fetchDuration = Date.now() - fetchStartTime;
      console.error(`[ERP Fetch ${requestId}] ERP client error after ${fetchDuration}ms:`, {
        error: erpError instanceof Error ? erpError.message : String(erpError),
        stack: erpError instanceof Error ? erpError.stack : undefined,
      });
      return NextResponse.json({
        error: erpError instanceof Error ? erpError.message : "Failed to initialize ERP client",
        details: "Check server logs for more details",
      }, { status: 500 });
    }

    if (!erpResponse.success) {
      // Handle "NOT_FOUND" error specially - return 200 with success: false
      if (erpResponse.error === "NOT_FOUND") {
        const totalDuration = Date.now() - startTime;
        console.log(`[ERP Fetch ${requestId}] Record not found in ERP (${totalDuration}ms)`);
        return NextResponse.json({
          success: false,
          error: "NOT_FOUND",
          message: "No record found in ERP system",
          data: null,
        }, { status: 200 });
      }
      
      const totalDuration = Date.now() - startTime;
      console.error(`[ERP Fetch ${requestId}] ERP fetch failed after ${totalDuration}ms:`, {
        error: erpResponse.error,
        message: erpResponse.message,
      });
      
      return NextResponse.json({
        success: false,
        error: erpResponse.error || "Failed to fetch data from ERP system",
        details: erpResponse.message,
      }, { status: 500 });
    }

    const totalDuration = Date.now() - startTime;
    const dataSize = erpResponse.data ? JSON.stringify(erpResponse.data).length : 0;
    console.log(`[ERP Fetch ${requestId}] Successfully fetched ERP data in ${totalDuration}ms:`, {
      dataSize,
      dataKeys: erpResponse.data && typeof erpResponse.data === "object" ? Object.keys(erpResponse.data).length : 0,
    });

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

