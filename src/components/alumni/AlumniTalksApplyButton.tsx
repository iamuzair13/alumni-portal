"use client";

import React, { useState } from "react";
import { Modal } from "@/components/ui/modal";
import MentorshipForm from "@/components/forms/MentorshipForm";

export default function AlumniTalksApplyButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center rounded-lg bg-accent-500 px-4 py-2 text-xs font-semibold text-white hover:bg-accent-800"
      >
        Apply for Session
      </button>

      <Modal isOpen={open} onClose={() => setOpen(false)} className="w-[95vw] max-w-[820px]">
        <div className="p-4 sm:p-6">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-gray-900">Apply for Session</h2>
            <p className="text-xs text-gray-600 mt-1">Provide your availability and talk details.</p>
          </div>

          <div className="max-h-[80vh] overflow-auto pr-1">
            <MentorshipForm redirectOnSuccess={false} onSubmitted={() => setOpen(false)} />
          </div>
        </div>
      </Modal>
    </>
  );
}
