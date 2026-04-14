import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import {
  asImageUploadPart,
  assertEventImageBlob,
  extensionForEventImage,
} from "@/lib/formDataImagePart";
import { normalizePublicImageFilename } from "@/lib/uploadsImageUrl";
import { getUploadsImagesDir } from "@/lib/uploadsDir";

type EventListItem = {
  id: string;
  title: string;
  venue: string;
  shortDescription: string;
  imageUrl?: string;
  category?: string;
  type?: string;
  startTimeUTC?: string;
  endTimeUTC?: string;
  chapterName?: string | null;
  chapterType?: string | null;
  associationTitle?: string | null;
};

function toUtcIso(date: unknown, time?: unknown): string | undefined {
  try {
    const d = date ? new Date(String(date)) : null;
    if (!d || Number.isNaN(d.getTime())) return undefined;
    if (time) {
      const [hh, mm] = String(time).split(":");
      d.setHours(Number(hh) || 0, Number(mm) || 0, 0, 0);
    }
    return d.toISOString();
  } catch {
    return undefined;
  }
}

type EventRow = {
  id: number;
  category: string | null;
  type: string | null;
  title: string | null;
  shortdescription: string | null;
  longdescription: string | null;
  fromdate: string | null;
  todate: string | null;
  eventtime: string | null;
  image1: string | null;
  image2: string | null;
  image3: string | null;
  image4: string | null;
  image5: string | null;
  chapter_id: number | null;
  association_id: number | null;
  chapter_name: string | null;
  chapter_type: string | null;
  association_title: string | null;
};

export async function GET() {
  try {
    const rows = await sql/* sql */`
      SELECT 
        e.id, 
        e.category, 
        e.type,
        e.title, 
        e.shortdescription, 
        e.longdescription, 
        e.fromdate, 
        e.todate, 
        e.eventtime, 
        e.image1, 
        e.image2, 
        e.image3, 
        e.image4, 
        e.image5,
        e.chapter_id,
        e.association_id,
        CASE 
          WHEN c.national_chapter IS NOT NULL THEN c.national_chapter
          WHEN c.international_chapter IS NOT NULL THEN c.international_chapter
          ELSE NULL
        END as chapter_name,
        CASE 
          WHEN c.national_chapter IS NOT NULL THEN 'national'
          WHEN c.international_chapter IS NOT NULL THEN 'international'
          ELSE NULL
        END as chapter_type,
        a.faculty_name as association_title
      FROM public.tbl_events e
      LEFT JOIN public.tblchapters c ON e.chapter_id = c.id
      LEFT JOIN public.tbl_faculties a ON e.association_id = a.id
      ORDER BY e.fromdate DESC
      LIMIT 200` as EventRow[];
    const items = rows.map((r): EventListItem => {
      const id = String(r.id ?? "");
      const title = String(r.title ?? "");
      const venue = ""; // not present in schema
      const shortDescription = String(r.shortdescription ?? "");
      const imageUrl = normalizePublicImageFilename(r.image1) || "";
      const category = String(r.category ?? "");
      const type = r.type ? String(r.type) : undefined;
      const startTimeUTC = toUtcIso(r.fromdate, r.eventtime);
      const endTimeUTC = toUtcIso(r.todate, r.eventtime) ?? startTimeUTC;
      const chapterName = r.chapter_name ? String(r.chapter_name) : null;
      const chapterType = r.chapter_type ? String(r.chapter_type) : null;
      const associationTitle = r.association_title ? String(r.association_title) : null;
      return { 
        id, 
        title, 
        venue, 
        shortDescription, 
        imageUrl, 
        category,
        type,
        startTimeUTC, 
        endTimeUTC,
        chapterName,
        chapterType,
        associationTitle,
      };
    });
    return NextResponse.json({ items }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch events";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    
    // SECURITY: Require authentication
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // SECURITY: Only admins/superadmins can create events
    const { canModify } = await import("@/lib/alumniProfile");
    if (!canModify(session.user)) {
      return NextResponse.json({ error: "Forbidden: Only admins can create events" }, { status: 403 });
    }
    
    // Parse FormData
    const formData = await req.formData();

    // Extract text fields
    const title = String(formData.get("title") || "").trim();
    const category = String(formData.get("category") || "").trim();
    const type = formData.get("type") ? String(formData.get("type")).trim() : null;
    const fromDate = String(formData.get("fromDate") || "").trim();
    const toDate = String(formData.get("toDate") || "").trim();
    const eventTime = String(formData.get("eventTime") || "").trim();
    const shortDescription = String(formData.get("shortDescription") || "").trim();
    const description = String(formData.get("description") || "").trim();
    const chapterId = formData.get("chapterId") ? Number(formData.get("chapterId")) : null;
    const associationId = formData.get("associationId") ? Number(formData.get("associationId")) : null;

    // Validation
    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }
    if (title.length > 200) {
      return NextResponse.json({ error: "Title must be 200 characters or less" }, { status: 400 });
    }
    if (!category) {
      return NextResponse.json({ error: "Category is required" }, { status: 400 });
    }
    if (!fromDate || !/^\d{4}-\d{2}-\d{2}$/.test(fromDate)) {
      return NextResponse.json({ error: "Valid from date is required (YYYY-MM-DD)" }, { status: 400 });
    }
    if (!toDate || !/^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
      return NextResponse.json({ error: "Valid to date is required (YYYY-MM-DD)" }, { status: 400 });
    }
    if (!eventTime || !/^\d{2}:\d{2}$/.test(eventTime)) {
      return NextResponse.json({ error: "Valid event time is required (HH:MM)" }, { status: 400 });
    }
    if (!shortDescription) {
      return NextResponse.json({ error: "Short description is required" }, { status: 400 });
    }
    if (shortDescription.length > 500) {
      return NextResponse.json({ error: "Short description must be 500 characters or less" }, { status: 400 });
    }
    if (!description) {
      return NextResponse.json({ error: "Description is required" }, { status: 400 });
    }

    // Validate date range
    const from = new Date(fromDate);
    const to = new Date(toDate);
    if (to < from) {
      return NextResponse.json({ error: "To date must be on or after from date" }, { status: 400 });
    }

    // Validate image1 is required
    const image1File = asImageUploadPart(formData.get("image1"));
    if (!image1File) {
      return NextResponse.json({ error: "Image 1 is required" }, { status: 400 });
    }

    // Generate a unique prefix for image naming using timestamp
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);

    // Save images first (since image1 is required)
    const imageFiles: Record<number, (Blob & { name?: string }) | null> = {
      1: image1File,
      2: asImageUploadPart(formData.get("image2")),
      3: asImageUploadPart(formData.get("image3")),
      4: asImageUploadPart(formData.get("image4")),
      5: asImageUploadPart(formData.get("image5")),
    };

    const savedImages: Record<number, string> = {};

    try {
      // Save all images first with unique filenames
      for (const [num, file] of Object.entries(imageFiles)) {
        const imageNum = parseInt(num);
        if (file) {
          assertEventImageBlob(file, `image${imageNum}`);
          const extension = extensionForEventImage(file);
          const filename = `event-${timestamp}-${randomSuffix}-${imageNum}.${extension}`;
          
          // Create uploads directory if it doesn't exist
          const uploadsDir = getUploadsImagesDir();
          if (!existsSync(uploadsDir)) {
            await mkdir(uploadsDir, { recursive: true });
          }

          // Save file
          const filePath = join(uploadsDir, filename);
          const bytes = await file.arrayBuffer();
          const buffer = Buffer.from(bytes);
          await writeFile(filePath, buffer);

          savedImages[imageNum] = filename;
        }
      }

      // Ensure image1 was saved successfully
      if (!savedImages[1]) {
        // Clean up any saved images
        const { unlink } = await import("fs/promises");
        for (const filename of Object.values(savedImages)) {
          try {
            await unlink(join(getUploadsImagesDir(), filename));
          } catch {
            // Ignore cleanup errors
          }
        }
        return NextResponse.json({ error: "Failed to save image 1" }, { status: 500 });
      }

      // Insert event record with image filenames
      const result = await sql/* sql */`
        INSERT INTO public.tbl_events (category, type, title, shortdescription, longdescription, fromdate, todate, eventtime, image1, image2, image3, image4, image5, chapter_id, association_id)
        VALUES (${category}, ${type}, ${title}, ${shortDescription.slice(0, 500)}, ${description || null}, ${fromDate}, ${toDate}, ${eventTime}, ${savedImages[1]}, ${savedImages[2] || null}, ${savedImages[3] || null}, ${savedImages[4] || null}, ${savedImages[5] || null}, ${chapterId}, ${associationId})
        RETURNING id
      ` as Array<{ id: number }>;

      const eventId = result[0]?.id;
      if (!eventId) {
        // Clean up saved images
        const { unlink } = await import("fs/promises");
        for (const filename of Object.values(savedImages)) {
          try {
            await unlink(join(getUploadsImagesDir(), filename));
          } catch {
            // Ignore cleanup errors
          }
        }
        return NextResponse.json({ error: "Failed to create event" }, { status: 500 });
      }

      return NextResponse.json({ id: eventId, message: "Event created successfully" }, { status: 201 });
    } catch (imageError) {
      // Clean up saved images on error
      const { unlink } = await import("fs/promises");
      for (const filename of Object.values(savedImages)) {
        try {
          await unlink(join(getUploadsImagesDir(), filename));
        } catch {
          // Ignore cleanup errors
        }
      }
      
      const errorMsg = imageError instanceof Error ? imageError.message : "Failed to save images";
      return NextResponse.json({ error: errorMsg }, { status: 500 });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Invalid request";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
