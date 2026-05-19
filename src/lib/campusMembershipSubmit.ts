import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import {
  insertCampusMembershipApplication,
  type CampusMembershipSubmitBody,
} from "@/lib/campusMembershipServer";
import { saveMembershipDocument } from "@/lib/campusMembershipUpload";
import { formatMembershipMonthFromDate, type CampusFacilityType } from "@/lib/campusMembership";
import { verifyAlumniForMembership } from "@/lib/campusMembershipAuth";
import { sendCricketMembershipEmail, sendGymMembershipEmail, sendSwimmingPoolMembershipEmail } from "@/lib/email";

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

export async function handleCampusMembershipPost(
  req: Request,
  facilityType: CampusFacilityType,
  session: Session,
) {
  const contentType = req.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json(
      { error: "Expected multipart form data with document uploads." },
      { status: 400 },
    );
  }

  const form = await req.formData();
  const alumniId = str(form, "alumniId");
  const membershipType = str(form, "membershipType");
  const membershipStartDate = str(form, "membershipStartDate");
  const preferredTiming = str(form, "preferredTiming");

  if (!alumniId) return NextResponse.json({ error: "Alumni ID is required" }, { status: 400 });
  if (!membershipType) return NextResponse.json({ error: "Membership type is required" }, { status: 400 });
  if (!membershipStartDate) {
    return NextResponse.json({ error: "Membership start date is required" }, { status: 400 });
  }
  if (!preferredTiming) {
    return NextResponse.json({ error: "Preferred timing is required" }, { status: 400 });
  }
  if (!str(form, "emergencyContactName")) {
    return NextResponse.json({ error: "Emergency contact name is required" }, { status: 400 });
  }
  if (!str(form, "emergencyContactRelationship")) {
    return NextResponse.json({ error: "Emergency contact relationship is required" }, { status: 400 });
  }
  if (!str(form, "emergencyContactNumber")) {
    return NextResponse.json({ error: "Emergency contact number is required" }, { status: 400 });
  }

  const alumniCardFile = form.get("alumniCardFile");
  const cnicFile = form.get("cnicFile");
  if (!(alumniCardFile instanceof File) || alumniCardFile.size === 0) {
    return NextResponse.json({ error: "Alumni Card document is required" }, { status: 400 });
  }
  if (!(cnicFile instanceof File) || cnicFile.size === 0) {
    return NextResponse.json({ error: "CNIC document is required" }, { status: 400 });
  }

  const alum = await verifyAlumniForMembership(session, alumniId);
  if (!alum) {
    return NextResponse.json({ error: "Alumni not found or access denied" }, { status: 404 });
  }

  const prefix = `membership-${facilityType}-${alum.alumniid}`;
  let alumniCardDoc;
  let cnicDoc;
  try {
    alumniCardDoc = await saveMembershipDocument({
      file: alumniCardFile,
      prefix,
      slot: "alumni-card",
      label: "Alumni Card",
    });
    cnicDoc = await saveMembershipDocument({
      file: cnicFile,
      prefix,
      slot: "cnic",
      label: "CNIC",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to upload documents";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const body: CampusMembershipSubmitBody = {
    alumniId,
    membershipType,
    membershipStartDate,
    preferredTiming,
    medicalConditions: str(form, "medicalConditions"),
    allergies: str(form, "allergies"),
    physicalDisability: str(form, "physicalDisability"),
    emergencyContactName: str(form, "emergencyContactName"),
    emergencyContactRelationship: str(form, "emergencyContactRelationship"),
    emergencyContactNumber: str(form, "emergencyContactNumber"),
    documents: {
      alumniCard: alumniCardDoc,
      cnic: cnicDoc,
    },
  };

  const { applicationRef } = await insertCampusMembershipApplication(facilityType, alum.alumniid, body);

  try {
    const alumniEmail = alum.personalemail || alum.officialemail || alum.universityemail;
    const alumniName = alum.alumniname || "Alumni";
    if (alumniEmail) {
      if (facilityType === "gym") {
        sendGymMembershipEmail(
          alumniEmail,
          alumniName,
          formatMembershipMonthFromDate(membershipStartDate),
        ).catch(() => {});
      } else if (facilityType === "pool") {
        sendSwimmingPoolMembershipEmail(
          alumniEmail,
          alumniName,
          formatMembershipMonthFromDate(membershipStartDate),
        ).catch(() => {});
      } else {
        sendCricketMembershipEmail(alumniEmail, alumniName).catch(() => {});
      }
    }
  } catch {
    // email failure should not block submission
  }

  const facilityLabel =
    facilityType === "gym"
      ? "Gym"
      : facilityType === "pool"
      ? "Swimming pool"
      : "Cricket club";

  return NextResponse.json({
    success: true,
    message: `${facilityLabel} membership application submitted successfully`,
    applicationRef,
  });
}
