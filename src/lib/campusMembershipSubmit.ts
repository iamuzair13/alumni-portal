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

function bool(form: FormData, key: string): boolean {
  const value = String(form.get(key) ?? "").trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes" || value === "on";
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
  const validTill = str(form, "validTill");

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
  if ((facilityType === "pool" || facilityType === "cricket") && !validTill) {
    return NextResponse.json({ error: "Valid till date is required" }, { status: 400 });
  }
  if (facilityType === "pool") {
    if (!str(form, "poolLocation")) {
      return NextResponse.json({ error: "Pool location is required" }, { status: 400 });
    }
    if (!str(form, "swimmingLevel")) {
      return NextResponse.json({ error: "Swimming level is required" }, { status: 400 });
    }
    if (!str(form, "hasMedicalCondition")) {
      return NextResponse.json({ error: "Medical condition selection is required" }, { status: 400 });
    }
    if (!bool(form, "declarationAccepted")) {
      return NextResponse.json({ error: "You must agree to the pool declaration" }, { status: 400 });
    }
  }
  if (facilityType === "cricket") {
    if (!str(form, "membershipCategory")) {
      return NextResponse.json({ error: "Membership category is required" }, { status: 400 });
    }
    if (!str(form, "playingCategory")) {
      return NextResponse.json({ error: "Playing category is required" }, { status: 400 });
    }
    if (!str(form, "playingRole")) {
      return NextResponse.json({ error: "Playing role is required" }, { status: 400 });
    }
    if (!str(form, "highestPlayingLevel")) {
      return NextResponse.json({ error: "Highest playing level is required" }, { status: 400 });
    }
  }

  const alumniCardFile = form.get("alumniCardFile");
  const cnicFile = form.get("cnicFile");
  const medicalFitnessCertificateFile = form.get("medicalFitnessCertificateFile");
  const previousClubLetterFile = form.get("previousClubLetterFile");
  if (!(alumniCardFile instanceof File) || alumniCardFile.size === 0) {
    return NextResponse.json({ error: "Alumni Card document is required" }, { status: 400 });
  }
  if (!(cnicFile instanceof File) || cnicFile.size === 0) {
    return NextResponse.json({ error: "CNIC document is required" }, { status: 400 });
  }
  if (
    facilityType === "cricket" &&
    (!(medicalFitnessCertificateFile instanceof File) || medicalFitnessCertificateFile.size === 0)
  ) {
    return NextResponse.json(
      { error: "Medical fitness certificate is required" },
      { status: 400 },
    );
  }

  const alum = await verifyAlumniForMembership(session, alumniId);
  if (!alum) {
    return NextResponse.json({ error: "Alumni not found or access denied" }, { status: 404 });
  }

  const prefix = `membership-${facilityType}-${alum.alumniid}`;
  let alumniCardDoc;
  let cnicDoc;
  let medicalFitnessCertificateDoc = null;
  let previousClubLetterDoc = null;
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
    if (facilityType === "cricket" && medicalFitnessCertificateFile instanceof File && medicalFitnessCertificateFile.size > 0) {
      medicalFitnessCertificateDoc = await saveMembershipDocument({
        file: medicalFitnessCertificateFile,
        prefix,
        slot: "medical-fitness-certificate",
        label: "Medical Fitness Certificate",
      });
    }
    if (facilityType === "cricket" && previousClubLetterFile instanceof File && previousClubLetterFile.size > 0) {
      previousClubLetterDoc = await saveMembershipDocument({
        file: previousClubLetterFile,
        prefix,
        slot: "previous-club-letter",
        label: "Previous Club Letter",
      });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to upload documents";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const body: CampusMembershipSubmitBody = {
    alumniId,
    membershipType,
    membershipStartDate,
    validTill,
    preferredTiming,
    medicalConditions: str(form, "medicalConditions"),
    allergies: str(form, "allergies"),
    physicalDisability: str(form, "physicalDisability"),
    physicalDisabilityDetails: str(form, "physicalDisabilityDetails"),
    emergencyContactName: str(form, "emergencyContactName"),
    emergencyContactRelationship: str(form, "emergencyContactRelationship"),
    emergencyContactNumber: str(form, "emergencyContactNumber"),
    declarationAccepted: bool(form, "declarationAccepted"),
    poolDetails:
      facilityType === "pool"
        ? {
            poolLocation: str(form, "poolLocation"),
            swimmingLevel: str(form, "swimmingLevel") as "Beginner" | "Intermediate" | "Advanced" | "",
            hasMedicalCondition: str(form, "hasMedicalCondition") as "Yes" | "No" | "",
          }
        : undefined,
    cricketDetails:
      facilityType === "cricket"
        ? {
            membershipCategory: str(form, "membershipCategory") as "Alumni" | "",
            playingCategory: str(form, "playingCategory") as "Junior" | "Senior" | "",
            playingRole: str(form, "playingRole") as
              | "Batsman"
              | "Bowler"
              | "All-Rounder"
              | "Wicket Keeper"
              | "",
            previousClub: str(form, "previousClub"),
            highestPlayingLevel: str(form, "highestPlayingLevel") as
              | "School"
              | "College"
              | "University"
              | "Club"
              | "District"
              | "National"
              | "",
            injuryHistory: str(form, "injuryHistory"),
          }
        : undefined,
    documents: {
      alumniCard: alumniCardDoc,
      cnic: cnicDoc,
      medicalFitnessCertificate: medicalFitnessCertificateDoc,
      previousClubLetter: previousClubLetterDoc,
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
