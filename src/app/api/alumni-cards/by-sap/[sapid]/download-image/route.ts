import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { canModify } from "@/lib/alumniProfile";
import { resolvePreferredCardImage } from "@/lib/alumniCardImage";

export async function GET(_: Request, ctx: { params: Promise<{ sapid: string }> }) {
  try {
    const { sapid } = await ctx.params;
    const session = await auth();
    
    // SECURITY: Verify authentication
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // SECURITY: Only admins can download images
    if (!canModify(session.user)) {
      return NextResponse.json({ error: "Forbidden: Only admins can download card images" }, { status: 403 });
    }
    
    const normalizedSapid = String(sapid || "").trim();
    
    // Fetch image data from both tblcard and tbl_alumni
    const rows = await sql/* sql */`
      SELECT 
        c.card_image,
        c.cardpicture,
        a.image1,
        a.image2,
        a.sapid,
        a.registrationno,
        a.alumniid
      FROM public.tbl_alumni a
      LEFT JOIN public.tblcard c ON c.alumniid = a.alumniid
      WHERE TRIM(COALESCE(a.sapid, '')) = ${normalizedSapid}
         OR TRIM(COALESCE(a.registrationno, '')) = ${normalizedSapid}
      LIMIT 1
    ` as Array<{
      card_image: string | null;
      cardpicture: string | null;
      image1: string | null;
      image2: string | null;
      sapid: string | null;
      registrationno: string | null;
      alumniid: number;
    }>;
    
    if (!rows[0]) {
      return NextResponse.json({ error: "Alumni not found" }, { status: 404 });
    }
    
    const data = rows[0];
    
    // Backward-compatible fallback:
    // 1) tblcard image, 2) tbl_alumni image, 3) legacy path values
    const imageName = resolvePreferredCardImage({
      cardImage: data.card_image,
      cardPicture: data.cardpicture,
      alumniImage2: data.image2,
      alumniImage1: data.image1,
    });
    
    // If no image found in tbl_alumni, return error
    if (!imageName) {
      return NextResponse.json({ error: "Image not found in alumni profile" }, { status: 404 });
    }
    
    // Determine download filename: use SAP ID if exists, otherwise use registration number
    // This is only for the downloaded file name, NOT for storing in tblcard
    const downloadFilename = (data.sapid && String(data.sapid).trim() !== "")
      ? `${String(data.sapid).trim()}.jpg`
      : (data.registrationno && String(data.registrationno).trim() !== "") 
      ? `${String(data.registrationno).trim()}.jpg`
      : "alumni-image.jpg";
    
    // Keep tblcard synced with resolved picture for legacy records.
    try {
      const alumniId = data.alumniid;
      const originalImageFilename = imageName; // Keep the original filename from tbl_alumni
      
      // Check if card exists
      const cardExists = await sql/* sql */`
        SELECT cardid FROM public.tblcard 
        WHERE alumniid = ${alumniId} 
        LIMIT 1
      ` as Array<{ cardid: number }>;
      
      if (cardExists[0]) {
        // Card exists, update both card_image and cardpicture with original filename from tbl_alumni
        await sql/* sql */`
          UPDATE public.tblcard 
          SET card_image = ${originalImageFilename}, cardpicture = ${originalImageFilename}
          WHERE alumniid = ${alumniId}
        `;
      } else {
        // Card doesn't exist, create it with the original image filename from tbl_alumni
        await sql/* sql */`
          INSERT INTO public.tblcard (alumniid, card_image, cardpicture, status, createdat)
          VALUES (${alumniId}, ${originalImageFilename}, ${originalImageFilename}, 'UnderReview', NOW())
          ON CONFLICT (alumniid) DO UPDATE
          SET card_image = EXCLUDED.card_image,
              cardpicture = EXCLUDED.cardpicture
        `;
      }
    } catch (saveError) {
      // Don't fail the download if saving to tblcard fails
      // The download should still proceed even if database update fails
    }
    
    return NextResponse.json({ 
      imageName, // Original filename from tbl_alumni (for fetching the image)
      filename: downloadFilename, // Renamed filename for download (sapid or registration number)
      sapid: data.sapid,
      registrationno: data.registrationno
    }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch image data";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
