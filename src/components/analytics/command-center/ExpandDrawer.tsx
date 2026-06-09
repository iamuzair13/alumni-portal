"use client";

import React, { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { ccAccent, ccDrawerBackdrop, ccDrawerHeader, ccDrawerPanel, ccDrawerTitle } from "./theme";

export function ExpandDrawer({
  open,
  title,
  onClose,
  children,
  accent = "emerald",
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  accent?: "emerald" | "violet" | "amber";
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const accentRing = ccAccent[accent].ring;

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={`fixed inset-0 z-[700] backdrop-blur-md ${ccDrawerBackdrop}`}
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            key="drawer"
            role="dialog"
            aria-modal
            aria-label={title}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className={`fixed right-0 top-0 z-[710] flex h-full w-full max-w-xl flex-col border-l shadow-2xl ring-1 ${ccDrawerPanel} ${accentRing}`}
          >
            <div className={`flex shrink-0 items-center justify-between px-4 py-3 ${ccDrawerHeader} border-b`}>
              <h2 className={ccDrawerTitle}>{title}</h2>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="flex-1 overflow-y-auto p-4"
            >
              {children}
            </motion.div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
