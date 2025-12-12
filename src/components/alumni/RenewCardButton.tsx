"use client";
import React, { useState, useRef, useEffect } from "react";
import AlumniCardForm from "@/components/forms/alumni-card";

type Props = {
  alumniId: string;
  name: string;
  sapId: string;
  faculty: string;
  department: string;
};

export default function RenewCardButton({ alumniId, name, sapId, faculty, department }: Props) {
  const [openForm, setOpenForm] = useState(false);
  const closeFormBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (openForm && closeFormBtnRef.current) {
      closeFormBtnRef.current.focus();
    }
  }, [openForm]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && openForm) {
        setOpenForm(false);
      }
    }
    if (openForm) {
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }
    return;
  }, [openForm]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (openForm) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [openForm]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpenForm(true)}
        className="mt-2 sm:mt-3 inline-flex items-center justify-center px-3 sm:px-4 py-2 sm:py-2.5 w-full rounded-lg text-white text-xs sm:text-sm font-medium bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
      >
        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-4 h-4 mr-2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M23 4v6h-6"></path>
          <path d="M1 20v-6h6"></path>
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
        </svg>
        Renew Card
      </button>

      {openForm && (
        <div 
          className="fixed inset-0 z-[9999] flex items-start justify-center bg-black/40"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setOpenForm(false);
            }
          }}
        >
          <div className="w-full h-full bg-white shadow-xl transition-all duration-300 ease-out flex flex-col">
            <div className="flex items-center justify-between border-b p-4 flex-shrink-0">
              <h2 className="text-lg font-semibold text-slate-900">Renew Alumni Card</h2>
              <button 
                ref={closeFormBtnRef} 
                aria-label="Close" 
                className="rounded-md px-2 py-1 text-slate-700 hover:bg-slate-100" 
                onClick={() => setOpenForm(false)}
              >
                Close
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="max-w-4xl mx-auto">
                <AlumniCardForm alumniId={alumniId} name={name} sapId={sapId} faculty={faculty} department={department} />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

