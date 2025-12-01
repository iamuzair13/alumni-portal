import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

type EventListItem = {
  id: string;
  title: string;
  venue: string;
  shortDescription: string;
  imageUrl?: string;
  category?: string;
  startTimeUTC?: string;
  endTimeUTC?: string;
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
};

export async function GET() {
  try {
    const rows = await sql/* sql */`
      SELECT id, category, title, shortdescription, longdescription, fromdate, todate, eventtime, image1, image2, image3, image4, image5
      FROM public.tbl_events
      ORDER BY fromdate DESC
      LIMIT 200` as EventRow[];
    const items = rows.map((r): EventListItem => {
      const id = String(r.id ?? "");
      const title = String(r.title ?? "");
      const venue = ""; // not present in schema
      const shortDescription = String(r.shortdescription ?? "");
      const imageUrl = String(r.image1 ?? "");
      const category = String(r.category ?? "");
      const startTimeUTC = toUtcIso(r.fromdate, r.eventtime);
      const endTimeUTC = toUtcIso(r.todate, r.eventtime) ?? startTimeUTC;
      return { id, title, venue, shortDescription, imageUrl, category, startTimeUTC, endTimeUTC };
    });
    return NextResponse.json({ items }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch events";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    // Parse FormData
    const formData = await req.formData();

    // Extract text fields
    const category = String(formData.get("category") || "").trim();
    const fromDate = String(formData.get("fromDate") || "").trim();
    const toDate = String(formData.get("toDate") || "").trim();
    const eventTime = String(formData.get("eventTime") || "").trim();
    const shortDescription = String(formData.get("shortDescription") || "").trim();
    const description = String(formData.get("description") || "").trim();

    // Validation
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
    const image1File = formData.get("image1") as File | null;
    if (!image1File || !(image1File instanceof File)) {
      return NextResponse.json({ error: "Image 1 is required" }, { status: 400 });
    }

    // Generate a unique prefix for image naming using timestamp
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);

    // Save images first (since image1 is required)
    const imageFiles: Record<number, File | null> = {
      1: image1File,
      2: (formData.get("image2") as File | null) || null,
      3: (formData.get("image3") as File | null) || null,
      4: (formData.get("image4") as File | null) || null,
      5: (formData.get("image5") as File | null) || null,
    };

    const savedImages: Record<number, string> = {};

    try {
      // Save all images first with unique filenames
      for (const [num, file] of Object.entries(imageFiles)) {
        const imageNum = parseInt(num);
        if (file && file instanceof File) {
          // Generate unique filename
          const extension = file.name.split(".").pop() || "jpg";
          const filename = `event-${timestamp}-${randomSuffix}-${imageNum}.${extension}`;
          
          // Validate and save file
          const allowedTypes = ["image/jpeg", "image/jpg", "image/png"];
          if (!allowedTypes.includes(file.type)) {
            throw new Error(`Invalid file type for image${imageNum}. Only JPEG and PNG are allowed.`);
          }

          const maxSize = 5 * 1024 * 1024; // 5MB
          if (file.size > maxSize) {
            throw new Error(`Image${imageNum} exceeds 5MB size limit.`);
          }

          // Create uploads directory if it doesn't exist
          const uploadsDir = join(process.cwd(), "public", "images", "alumni-images", "thumbnail");
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
            await unlink(join(process.cwd(), "public", "images", "alumni-images", "thumbnail", filename));
          } catch {
            // Ignore cleanup errors
          }
        }
        return NextResponse.json({ error: "Failed to save image 1" }, { status: 500 });
      }

      // Insert event record with image filenames
      const result = await sql/* sql */`
        INSERT INTO public.tbl_events (category, title, shortdescription, longdescription, fromdate, todate, eventtime, image1, image2, image3, image4, image5)
        VALUES (${category}, ${""}, ${shortDescription.slice(0, 500)}, ${description || null}, ${fromDate}, ${toDate}, ${eventTime}, ${savedImages[1]}, ${savedImages[2] || null}, ${savedImages[3] || null}, ${savedImages[4] || null}, ${savedImages[5] || null})
        RETURNING id
      ` as Array<{ id: number }>;

      const eventId = result[0]?.id;
      if (!eventId) {
        // Clean up saved images
        const { unlink } = await import("fs/promises");
        for (const filename of Object.values(savedImages)) {
          try {
            await unlink(join(process.cwd(), "public", "images", "alumni-images", "thumbnail", filename));
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
          await unlink(join(process.cwd(), "public", "images", "alumni-images", "thumbnail", filename));
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
