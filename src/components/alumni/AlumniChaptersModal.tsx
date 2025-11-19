"use client";
import Link from "next/link";
import AlumniChaptersForm from "@/components/forms/AlumniChaptersForm";

type Props = {
  alumniId: string;
  name: string;
  sapId: string;
  faculty: string;
  department: string;
  passingYear: number | null;
  contactNumber: string;
};

export default function AlumniChaptersModal({
  alumniId,
  name,
  sapId,
  faculty,
  department,
  passingYear,
  contactNumber,
}: Props) {

  return (
    <dialog open className="fixed inset-0 z-[60] flex items-center justify-center rounded-lg">
      <div className="w-full h-full max-h-[100vh] bg-white shadow-xl overflow-y-auto">
        <div className="sticky top-0 bg-white border-b z-10 flex items-center justify-between p-4">
          <h2 className="text-lg font-semibold text-slate-900">Apply for Alumni Chapters</h2>
          <Link
            aria-label="Close"
            href={sapId ? `/alumni-profile?sapid=${encodeURIComponent(sapId)}` : `/alumni-profile`}
            className="rounded-md px-2 py-1 text-slate-700 hover:bg-slate-100"
          >
            Close
          </Link>
        </div>
        <div className="p-6">
          <AlumniChaptersForm
            name={name}
            faculty={faculty}
            department={department}
            passingYear={passingYear}
            contactNumber={contactNumber}
            alumniId={alumniId}
          />
        </div>
      </div>
    </dialog>
  );
}

