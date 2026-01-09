import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { writeFile, mkdir, unlink } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

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
  chapter_id: number | null;
  association_id: number | null;
};

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const eid = Number(id);
    
    if (Number.isNaN(eid)) {
      return NextResponse.json({ error: "Invalid event ID" }, { status: 400 });
    }

    const rows = await sql/* sql */`
      SELECT 
        id, 
        category, 
        title, 
        shortdescription, 
        longdescription, 
        fromdate, 
        todate, 
        eventtime, 
        image1, 
        image2, 
        image3, 
        image4, 
        image5,
        chapter_id,
        association_id
      FROM public.tbl_events 
      WHERE id = ${eid} 
      LIMIT 1
    ` as EventRow[];
    
    const r = rows[0];
    if (!r) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Collect all images
    const images: string[] = [];
    if (r.image1) images.push(r.image1);
    if (r.image2) images.push(r.image2);
    if (r.image3) images.push(r.image3);
    if (r.image4) images.push(r.image4);
    if (r.image5) images.push(r.image5);

    const result = {
      id: String(r.id ?? ""),
      category: String(r.category ?? ""),
      title: String(r.title ?? ""),
      shortDescription: String(r.shortdescription ?? ""),
      description: String(r.longdescription ?? ""),
      fromDate: r.fromdate,
      toDate: r.todate,
      eventTime: r.eventtime,
      images: images,
      chapterId: r.chapter_id ? String(r.chapter_id) : null,
      associationId: r.association_id ? String(r.association_id) : null,
      startTimeUTC: toUtcIso(r.fromdate, r.eventtime),
      endTimeUTC: toUtcIso(r.todate, r.eventtime) ?? toUtcIso(r.fromdate, r.eventtime),
    };
    
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch event";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    
    // SECURITY: Require authentication
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // SECURITY: Only admins/superadmins can update events
    const { canModify } = await import("@/lib/alumniProfile");
    if (!canModify(session.user)) {
      return NextResponse.json({ error: "Forbidden: Only admins can update events" }, { status: 403 });
    }

    const { id } = await ctx.params;
    const eid = Number(id);
    
    if (Number.isNaN(eid)) {
      return NextResponse.json({ error: "Invalid event ID" }, { status: 400 });
    }

    // Check if event exists and get existing values
    const existingEvent = await sql/* sql */`
      SELECT id, image1, image2, image3, image4, image5, fromdate, todate, eventtime
      FROM public.tbl_events 
      WHERE id = ${eid} 
      LIMIT 1
    ` as Array<{ id: number; image1: string | null; image2: string | null; image3: string | null; image4: string | null; image5: string | null; fromdate: string | null; todate: string | null; eventtime: string | null }>;
    
    if (!existingEvent[0]) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Parse FormData
    const formData = await req.formData();

    // Extract text fields
    const title = String(formData.get("title") || "").trim();
    const category = String(formData.get("category") || "").trim();
    const fromDateInput = formData.get("fromDate") ? String(formData.get("fromDate")).trim() : null;
    const toDateInput = formData.get("toDate") ? String(formData.get("toDate")).trim() : null;
    const eventTimeInput = formData.get("eventTime") ? String(formData.get("eventTime")).trim() : null;
    const shortDescription = String(formData.get("shortDescription") || "").trim();
    const description = String(formData.get("description") || "").trim();
    const chapterId = formData.get("chapterId") ? Number(formData.get("chapterId")) : null;
    const associationId = formData.get("associationId") ? Number(formData.get("associationId")) : null;

    // Use provided values or fall back to existing values
    const fromDate = fromDateInput && fromDateInput !== "" ? fromDateInput : (existingEvent[0].fromdate || "");
    const toDate = toDateInput && toDateInput !== "" ? toDateInput : (existingEvent[0].todate || "");
    const eventTime = eventTimeInput && eventTimeInput !== "" ? eventTimeInput : (existingEvent[0].eventtime || "");

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
    // Validate date/time only if provided (for updates, existing values are preserved)
    if (fromDateInput && fromDateInput !== "" && !/^\d{4}-\d{2}-\d{2}$/.test(fromDateInput)) {
      return NextResponse.json({ error: "Valid from date format required (YYYY-MM-DD)" }, { status: 400 });
    }
    if (toDateInput && toDateInput !== "" && !/^\d{4}-\d{2}-\d{2}$/.test(toDateInput)) {
      return NextResponse.json({ error: "Valid to date format required (YYYY-MM-DD)" }, { status: 400 });
    }
    if (eventTimeInput && eventTimeInput !== "" && !/^\d{2}:\d{2}$/.test(eventTimeInput)) {
      return NextResponse.json({ error: "Valid event time format required (HH:MM)" }, { status: 400 });
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

    // Validate date range only if both dates are provided
    if (fromDate && toDate) {
      const from = new Date(fromDate);
      const to = new Date(toDate);
      if (to < from) {
        return NextResponse.json({ error: "To date must be on or after from date" }, { status: 400 });
      }
    }

    // Handle images - preserve existing if not provided, update if new file is uploaded
    const existingImages = {
      1: existingEvent[0].image1,
      2: existingEvent[0].image2,
      3: existingEvent[0].image3,
      4: existingEvent[0].image4,
      5: existingEvent[0].image5,
    };

    const imageFiles: Record<number, File | null> = {
      1: (formData.get("image1") as File | null) || null,
      2: (formData.get("image2") as File | null) || null,
      3: (formData.get("image3") as File | null) || null,
      4: (formData.get("image4") as File | null) || null,
      5: (formData.get("image5") as File | null) || null,
    };

    const savedImages: Record<number, string> = {};
    const imagesToDelete: string[] = [];
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    
    // Create uploads directory if it doesn't exist (defined outside try for catch block access)
    const uploadsDir = join(process.cwd(), "public", "images");

    try {
      if (!existsSync(uploadsDir)) {
        await mkdir(uploadsDir, { recursive: true });
      }

      // Process each image
      for (const [num, file] of Object.entries(imageFiles)) {
        const imageNum = parseInt(num);
        if (file && file instanceof File) {
          // New image uploaded - save it
          const extension = file.name.split(".").pop() || "jpg";
          const filename = `event-${timestamp}-${randomSuffix}-${imageNum}.${extension}`;
          
          // Validate file
          const allowedTypes = ["image/jpeg", "image/jpg", "image/png"];
          if (!allowedTypes.includes(file.type)) {
            throw new Error(`Invalid file type for image${imageNum}. Only JPEG and PNG are allowed.`);
          }

          const maxSize = 5 * 1024 * 1024; // 5MB
          if (file.size > maxSize) {
            throw new Error(`Image${imageNum} exceeds 5MB size limit.`);
          }

          // Save new file
          const filePath = join(uploadsDir, filename);
          const bytes = await file.arrayBuffer();
          const buffer = Buffer.from(bytes);
          await writeFile(filePath, buffer);

          savedImages[imageNum] = filename;

          // Mark old image for deletion if it exists
          if (existingImages[imageNum as keyof typeof existingImages]) {
            imagesToDelete.push(existingImages[imageNum as keyof typeof existingImages]!);
          }
        } else {
          // No new image - preserve existing
          savedImages[imageNum] = existingImages[imageNum as keyof typeof existingImages] || "";
        }
      }

      // Ensure image1 exists (either new or existing)
      if (!savedImages[1] || savedImages[1].trim() === "") {
        // Clean up any newly saved images
        for (const filename of Object.values(savedImages)) {
          if (filename && filename.trim() !== "") {
            const isNewImage = !Object.values(existingImages).some(existing => existing === filename);
            if (isNewImage) {
              try {
                await unlink(join(uploadsDir, filename));
              } catch {
                // Ignore cleanup errors
              }
            }
          }
        }
        return NextResponse.json({ error: "Image 1 is required" }, { status: 400 });
      }

      // Update event record
      const result = await sql/* sql */`
        UPDATE public.tbl_events 
        SET 
          category = ${category},
          title = ${title},
          shortdescription = ${shortDescription.slice(0, 500)},
          longdescription = ${description || null},
          fromdate = ${fromDate},
          todate = ${toDate},
          eventtime = ${eventTime},
          image1 = ${savedImages[1] || null},
          image2 = ${savedImages[2] || null},
          image3 = ${savedImages[3] || null},
          image4 = ${savedImages[4] || null},
          image5 = ${savedImages[5] || null},
          chapter_id = ${chapterId},
          association_id = ${associationId}
        WHERE id = ${eid}
        RETURNING id
      ` as Array<{ id: number }>;

      if (!result[0]) {
        // Clean up newly saved images
        for (const filename of Object.values(savedImages)) {
          if (filename && filename.trim() !== "") {
            const isNewImage = !Object.values(existingImages).some(existing => existing === filename);
            if (isNewImage) {
              try {
                await unlink(join(uploadsDir, filename));
              } catch {
                // Ignore cleanup errors
              }
            }
          }
        }
        return NextResponse.json({ error: "Failed to update event" }, { status: 500 });
      }

      // Delete old images that were replaced
      for (const oldImage of imagesToDelete) {
        if (oldImage) {
          try {
            await unlink(join(uploadsDir, oldImage));
          } catch {
            // Ignore deletion errors (file might not exist)
          }
        }
      }

      return NextResponse.json({ id: result[0].id, message: "Event updated successfully" }, { status: 200 });
    } catch (imageError) {
      // Clean up newly saved images on error
      for (const filename of Object.values(savedImages)) {
        if (filename && filename.trim() !== "") {
          const isNewImage = !Object.values(existingImages).some(existing => existing === filename);
          if (isNewImage) {
            try {
              await unlink(join(uploadsDir, filename));
            } catch {
              // Ignore cleanup errors
            }
          }
        }
      }
      
      const errorMsg = imageError instanceof Error ? imageError.message : "Failed to update images";
      return NextResponse.json({ error: errorMsg }, { status: 500 });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Invalid request";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const eid = Number(id);
    
    if (Number.isNaN(eid)) {
      return NextResponse.json({ error: "Invalid event ID" }, { status: 400 });
    }

    const res = await sql/* sql */`DELETE FROM public.tbl_events WHERE id = ${eid} RETURNING id`;
    if (!res[0]) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to delete";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
