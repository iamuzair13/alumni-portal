import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { buildAccessFilterSQL } from "@/lib/userAccess";
import { buildMasterFilterConditions } from "@/lib/master-filter-utils";

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const masterFilterConditions = buildMasterFilterConditions(searchParams, "photoConsent");

    // Build access filter
    let accessFilterCondition = sql``;
    try {
      const accessFilter = await buildAccessFilterSQL(session, "");
      accessFilterCondition = accessFilter.hasFilter && accessFilter.sql ? sql` AND (${accessFilter.sql})` : sql``;
    } catch (filterError) {
      return NextResponse.json({ error: "Failed to build access filter" }, { status: 500 });
    }

    // Fetch unique photo consent values with counts
    // true -> "Allowed", false -> "Not Allowed", null -> "Null"
    const rows = await sql/* sql */`
      SELECT 
        CASE 
          WHEN a.alumni_consent_pic IS NULL 
          THEN 'Null'
          WHEN a.alumni_consent_pic = true 
          THEN 'Allowed'
          WHEN a.alumni_consent_pic = false 
          THEN 'Not Allowed'
          ELSE 'Null'
        END as consent_value,
        COUNT(*) as count
      FROM public.tbl_alumni a
      WHERE (a.sapid IS NOT NULL AND a.sapid != '' OR a.registrationno IS NOT NULL AND a.registrationno != '')
        ${accessFilterCondition}
        ${masterFilterConditions}
      GROUP BY 
        CASE 
          WHEN a.alumni_consent_pic IS NULL 
          THEN 'Null'
          WHEN a.alumni_consent_pic = true 
          THEN 'Allowed'
          WHEN a.alumni_consent_pic = false 
          THEN 'Not Allowed'
          ELSE 'Null'
        END
      ORDER BY 
        CASE 
          WHEN a.alumni_consent_pic IS NULL 
          THEN 'Null'
          WHEN a.alumni_consent_pic = true 
          THEN 'Allowed'
          WHEN a.alumni_consent_pic = false 
          THEN 'Not Allowed'
          ELSE 'Null'
        END ASC
    `;
    if (rows.length === 0) {
    }

    const photoConsents = (rows as unknown as Array<{ consent_value: string; count: number | string | bigint }>).map((row) => {
      const consentValue = row.consent_value || 'Null';
      const isNull = consentValue === 'Null';
      return {
        value: isNull ? 'NULL' : consentValue,
        label: consentValue,
        count: Number(row.count || 0)
      };
    });
    return NextResponse.json({
      success: true,
      photoConsents
    }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch photo consent";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


