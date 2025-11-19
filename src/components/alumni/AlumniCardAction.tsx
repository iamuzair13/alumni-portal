"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import AlumniCardForm from "@/components/forms/alumni-card";

type Props = {
  alumniId: string;
  name: string;
  sapId: string;
  faculty: string;
  department: string;
  program: string;
  initialStatus?: "pending" | "rejected" | "delivered" | null;
  isAdmin?: boolean;
};

type CardRow = {
  cardid: number;
  alumniid: number;
  cnicno: string | null;
  cardaddress: string | null;
  status: string | null;
  cardpicture: string | null;
  createdat: string | null;
};

export function computeButtonMode(card: CardRow | null, initialStatus?: "pending" | "rejected" | "delivered" | null): "apply" | "view" {
  const st = (initialStatus ?? card?.status ?? "").toLowerCase();
  if (st === "rejected") return "apply";
  if (card) return "view";
  return "apply";
}

 

export default function AlumniCardAction({ alumniId, name, sapId, faculty, department, program, initialStatus, isAdmin = false }: Props) {
  const [openForm, setOpenForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [card, setCard] = useState<CardRow | null>(null);
  const closeFormBtnRef = useRef<HTMLButtonElement | null>(null);

  const mode = useMemo(() => computeButtonMode(card, initialStatus), [card, initialStatus]);
  const statusLabel = useMemo(() => {
    const st = (initialStatus ?? card?.status ?? "").toLowerCase();
    return st === "delivered" || st === "active" ? "card is active" : "Under Review";
  }, [card, initialStatus]);

  const fetchStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      // Validation uses sapid-based lookup to determine existing card registration
      const res = await fetch(`/api/alumni-cards/by-sap/${encodeURIComponent(sapId)}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setCard(data?.card || null);
      } else if (res.status === 404) {
        setCard(null);
      } else {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || `Failed (${res.status})`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to check status";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) {
      fetchStatus();
    } else {
      setCard(null);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alumniId, isAdmin]);

  // Refresh status when form closes (after navigation back)
  useEffect(() => {
    if (!openForm && !isAdmin) {
      fetchStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openForm, isAdmin]);

  useEffect(() => {
    if (openForm && closeFormBtnRef.current) {
      closeFormBtnRef.current.focus();
    }
  }, [openForm]);

  useEffect(() => {
    // no-op for view dialog
  }, []);

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

  return (
    <div>
      {mode === "apply" ? (
        <button
          type="button"
          aria-label="Apply for Alumni Card"
          role="button"
          className="mt-4 px-4 py-2.5 w-full rounded-lg text-white text-sm font-medium bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-60"
          onClick={() => setOpenForm(true)}
          disabled={loading}
        >
          {loading ? "Loading..." : "Apply"}
        </button>
      ) : (
        <button
          type="button"
          aria-label={statusLabel}
          role="button"
          className="mt-4 px-4 py-2.5 w-full rounded-lg text-white text-sm font-medium bg-gray-300 cursor-not-allowed"
          disabled
          aria-disabled="true"
        >
          {statusLabel}
        </button>
      )}

      {error && (
        <div className="mt-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-red-700">{error}</div>
      )}

      {openForm && (
        <dialog open aria-modal="true"  role="dialog" className="fixed inset-0 mt-20 flex items-start justify-center p-0 bg-black/40">
          <div className="w-full h-full max-w-none bg-white shadow-xl transition-all duration-300 ease-out">
            <div className="flex items-center justify-between border-b p-4">
              <h2 className="text-lg font-semibold text-slate-900">Apply for Alumni Card</h2>
              <button ref={closeFormBtnRef} aria-label="Close" className="rounded-md px-2 py-1 text-slate-700 hover:bg-slate-100" onClick={() => setOpenForm(false)}>Close</button>
            </div>
            <div className="p-4 m overflow-y-auto h-[calc(100vh-56px)]">
              <AlumniCardForm alumniId={alumniId} name={name} sapId={sapId} faculty={faculty} department={department} program={program} />
            </div>
          </div>
        </dialog>
      )}

      
    </div>
  );
}