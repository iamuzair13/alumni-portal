import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canModify } from "@/lib/alumniProfile";
import { erpClient } from "@/lib/erpClient";

/**
 * GET /api/erp/discover
 * Help discover the correct field names in the ERP system
 * Returns metadata and a sample record
 */
export async function GET(req: Request) {
  try {
    const session = await auth();
    
    // Only admins and superadmins can access this endpoint
    if (!session?.user || !canModify(session.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const type = url.searchParams.get("type") || "sample"; // "sample" or "metadata"

    if (type === "metadata") {
      // Fetch metadata
      const metadataResponse = await erpClient.fetchMetadata();
      
      if (!metadataResponse.success) {
        return NextResponse.json({
          error: metadataResponse.error || "Failed to fetch metadata",
          details: metadataResponse.message,
        }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        type: "metadata",
        data: metadataResponse.data,
      }, { status: 200 });
    } else {
      // Fetch sample record
      const sampleResponse = await erpClient.fetchSampleRecord();
      
      if (!sampleResponse.success) {
        return NextResponse.json({
          error: sampleResponse.error || "Failed to fetch sample record",
          details: sampleResponse.message,
        }, { status: 500 });
      }

      // Extract field names from the sample record
      const sampleData = Array.isArray(sampleResponse.data) 
        ? sampleResponse.data[0] 
        : sampleResponse.data;
      
      const fieldNames = sampleData && typeof sampleData === "object" 
        ? Object.keys(sampleData)
        : [];

      return NextResponse.json({
        success: true,
        type: "sample",
        data: sampleData,
        fieldNames: fieldNames,
        message: "Use these field names in your queries. Look for fields that might represent SAP ID or Registration Number.",
      }, { status: 200 });
    }

  } catch (error) {
    console.error("[ERP Discover] Error:", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Failed to discover ERP structure",
    }, { status: 500 });
  }
}

