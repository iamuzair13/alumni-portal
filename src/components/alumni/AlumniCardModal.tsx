"use client";

import Link from "next/link";
import AlumniCardForm from "@/components/forms/alumni-card";

type Props = {
  alumniId: string;
  name: string;
  sapId: string;
  faculty: string;
  department: string;
  program: string;
};

export default function AlumniCardModal({ alumniId, name, sapId, faculty, department, program }: Props) {

  return (
    <dialog open className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40" aria-modal="true" role="dialog">
      <div className="w-full h-full max-h-[100vh] rounded-lg bg-white shadow-xl transition-all duration-300 ease-out flex flex-col">
        <div className="flex items-center justify-between border-b p-4 flex-shrink-0">
          <h2 className="text-lg font-semibold text-slate-900">Apply for Alumni Card</h2>
          <Link
            aria-label="Close"
            href={sapId ? `/alumni-profile?sapid=${encodeURIComponent(sapId)}` : `/alumni-profile`}
            className="rounded-md px-2 py-1 text-slate-700 hover:bg-slate-100"
          >
            Close
          </Link>
        </div>
        <div className="p-4 overflow-y-auto flex-1">
          <AlumniCardForm
            alumniId={alumniId}
            name={name}
            sapId={sapId}
            faculty={faculty}
            department={department}
            program={program}
          />
        </div>
      </div>
    </dialog>
  );
}

