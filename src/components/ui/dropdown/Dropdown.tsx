"use client";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface DropdownProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  anchorRef?: React.RefObject<HTMLElement | null>;
  openUpwards?: boolean;
}

export const Dropdown: React.FC<DropdownProps> = ({
  isOpen,
  onClose,
  children,
  className = "",
  anchorRef,
  openUpwards = false,
}) => {
  const dropdownRef = useRef<HTMLDivElement>(null);

  const computePosition = () => {
    if (!anchorRef?.current) return null;
    const rect = anchorRef.current.getBoundingClientRect();
    return {
      top: openUpwards ? rect.top - 8 : rect.bottom + 8,
      left: rect.right,
    };
  };

  const [position, setPosition] = useState<{ top: number; left: number } | null>(() =>
    isOpen ? computePosition() : null
  );

  useEffect(() => {
    if (!isOpen || !anchorRef?.current) {
      setPosition(null);
      return;
    }

    const updatePosition = () => {
      setPosition(computePosition());
    };

    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [isOpen, anchorRef, openUpwards]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !(event.target as HTMLElement).closest(".dropdown-toggle")
      ) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose, isOpen]);

  if (!isOpen) return null;

  const usePortal = Boolean(anchorRef);
  const livePosition = usePortal ? position ?? computePosition() : null;
  const portalReady = usePortal && livePosition !== null;

  const menu = (
    <div
      ref={dropdownRef}
      style={
        portalReady
          ? {
              position: "fixed",
              top: livePosition!.top,
              left: livePosition!.left,
              transform: openUpwards ? "translate(-100%, -100%)" : "translateX(-100%)",
              zIndex: 9999,
            }
          : undefined
      }
      className={`${portalReady ? "" : "absolute right-0 z-[9999] mt-2"} rounded-xl border border-gray-200 bg-white shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark ${className}`}
    >
      {children}
    </div>
  );

  if (portalReady && typeof document !== "undefined") {
    return createPortal(menu, document.body);
  }

  if (usePortal) return null;

  return menu;
};
