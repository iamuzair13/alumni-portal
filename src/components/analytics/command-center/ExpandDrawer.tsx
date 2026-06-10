"use client";

import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { BarChart3, X } from "lucide-react";
import { ccAccent } from "./theme";

const accentHeaderBg = {
  emerald:
    "bg-gradient-to-br from-emerald-500/15 to-teal-500/5 dark:from-emerald-500/20 dark:to-teal-500/10",
  violet:
    "bg-gradient-to-br from-violet-500/15 to-purple-500/5 dark:from-violet-500/20 dark:to-purple-500/10",
  amber:
    "bg-gradient-to-br from-amber-500/15 to-orange-500/5 dark:from-amber-500/20 dark:to-orange-500/10",
} as const;

const accentIconBg = {
  emerald: "bg-emerald-500 text-white shadow-emerald-500/30",
  violet: "bg-violet-500 text-white shadow-violet-500/30",
  amber: "bg-amber-500 text-white shadow-amber-500/30",
} as const;

const accentTopBar = {
  emerald: "from-emerald-500 via-teal-400 to-emerald-600",
  violet: "from-violet-500 via-purple-400 to-violet-600",
  amber: "from-amber-500 via-orange-400 to-amber-600",
} as const;

export function ExpandDrawer({
  open,
  title,
  onClose,
  children,
  accent = "emerald",
  maxWidthClass = "max-w-3xl",
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  accent?: "emerald" | "violet" | "amber";
  maxWidthClass?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div
          className="fixed inset-0 z-[700] flex items-center justify-center p-4 sm:p-6"
          role="presentation"
        >
          <motion.button
            type="button"
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-gray-900/45 backdrop-blur-[6px] dark:bg-gray-950/65"
            onClick={onClose}
            aria-label="Close dialog"
          />

          <motion.div
            key="modal"
            role="dialog"
            aria-modal
            aria-label={title}
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
            className={`relative z-[710] flex max-h-[min(88vh,820px)] w-full ${maxWidthClass} flex-col overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-2xl ring-1 dark:border-gray-700/60 dark:bg-gray-900 ${ccAccent[accent].ring}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`h-1 w-full bg-gradient-to-r ${accentTopBar[accent]}`} aria-hidden />

            <div
              className={`flex shrink-0 items-start justify-between gap-3 border-b border-gray-100 px-5 py-4 dark:border-gray-800 ${accentHeaderBg[accent]}`}
            >
              <div className="flex min-w-0 items-start gap-3">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-md ${accentIconBg[accent]}`}
                >
                  <BarChart3 className="h-5 w-5" aria-hidden />
                </div>
                <div className="min-w-0 pt-0.5">
                  <h2 className="truncate text-lg font-semibold tracking-tight text-gray-900 dark:text-gray-50">
                    {title}
                  </h2>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    Detailed breakdown · click outside or press Esc to close
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-200/80 bg-white/90 text-gray-500 transition-colors hover:border-gray-300 hover:bg-gray-50 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-800/90 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-100"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6 sm:py-5">
              {children}
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
