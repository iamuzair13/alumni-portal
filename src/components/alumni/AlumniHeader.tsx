"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { ChevronDown } from "lucide-react";
import { Dropdown } from "@/components/ui/dropdown/Dropdown";
import { DropdownItem } from "@/components/ui/dropdown/DropdownItem";
import { ThemeToggleButton } from "@/components/common/ThemeToggleButton";
import { useCurrentUserImage } from "@/app/queries/alumni-profile";
import { uploadsImageUrl } from "@/lib/uploadsImageUrl";

const PLACEHOLDER_AVATAR = "/images/person.jpg";
const failedAvatarUrls = new Set<string>();

const ROLE_LABELS: Record<string, string> = {
  alumni: "Alumni",
  admin: "Admin",
  superadmin: "Super Admin",
  viewer: "Viewer",
  staff: "Admin",
};

function normalizeUserImage(raw: string): string {
  let imagePath = raw.trim().replace(/\/tumbnail\//g, "/");
  imagePath = imagePath.replace(/\/alumni-images\/thumbnail\//g, "/");
  imagePath = imagePath.replace(/\/alumni-images\/card\//g, "/");
  if (!imagePath.startsWith("http://") && !imagePath.startsWith("https://")) {
    if (!imagePath.startsWith("/") && !imagePath.includes("/")) {
      imagePath = uploadsImageUrl(imagePath);
    } else if (/^\/images\/[^/]+$/u.test(imagePath)) {
      imagePath = uploadsImageUrl(imagePath);
    } else if (!imagePath.startsWith("/")) {
      imagePath = `/${imagePath}`;
    }
  }
  return imagePath;
}

function AlumniUserMenu() {
  const { data: session, status } = useSession();
  const { data: userImageData } = useCurrentUserImage(status === "authenticated");
  const [isOpen, setIsOpen] = useState(false);
  const [, setImgError] = useState(0);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const role = String(((session?.user ?? {}) as { type?: string }).type || "").toLowerCase();
  const roleLabel = ROLE_LABELS[role] ?? null;
  const displayName = session?.user?.name || "User";
  const displayEmail = String(session?.user?.email || "").includes("@") ? session?.user?.email : null;

  const rawImage = String(userImageData?.image ?? "").trim();
  const resolvedImage = rawImage && !failedAvatarUrls.has(rawImage) ? normalizeUserImage(rawImage) : PLACEHOLDER_AVATAR;

  const closeMenu = useCallback(() => setIsOpen(false), []);

  // Esc closes + focus returns to trigger
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen]);

  if (status === "loading") {
    return (
      <div className="flex items-center gap-2" aria-busy="true">
        <span className="h-9 w-9 animate-pulse rounded-full bg-surface-raised" />
        <span className="hidden h-4 w-20 animate-pulse rounded bg-surface-raised lg:block" />
      </div>
    );
  }

  if (status !== "authenticated") {
    return (
      <Link
        href="/signin"
        className="inline-flex items-center rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:bg-brand-500 dark:text-accent-950 dark:hover:bg-brand-400"
      >
        Sign in
      </Link>
    );
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className="dropdown-toggle flex items-center gap-2 rounded-xl px-1.5 py-1.5 transition-colors hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
      >
        <span className="h-9 w-9 shrink-0 overflow-hidden rounded-full border border-border-subtle bg-surface-sunken">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={resolvedImage}
            alt=""
            width={36}
            height={36}
            className="h-full w-full object-cover"
            onError={() => {
              if (rawImage) failedAvatarUrls.add(rawImage);
              setImgError((t) => t + 1);
            }}
          />
        </span>
        <span className="hidden min-w-0 flex-col items-start sm:flex">
          <span className="max-w-32 truncate text-sm font-semibold text-content leading-tight">
            {displayName}
          </span>
          {roleLabel && (
            <span className="rounded-full border border-brand-200 bg-brand-50 px-1.5 py-px text-[10px] font-bold leading-snug text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300">
              {roleLabel}
            </span>
          )}
        </span>
        <ChevronDown
          className={`h-4 w-4 text-content-muted transition-transform duration-150 motion-reduce:transition-none ${isOpen ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      <Dropdown
        isOpen={isOpen}
        onClose={closeMenu}
        anchorRef={buttonRef}
        className="w-[240px] p-2 shadow-lg"
      >
        <div className="px-2 pb-2 pt-1" role="presentation">
          <span className="block truncate text-sm font-semibold text-content">{displayName}</span>
          {displayEmail ? (
            <span className="mt-0.5 block truncate text-xs text-content-muted">{displayEmail}</span>
          ) : null}
          {roleLabel && (
            <span className="mt-1.5 inline-block rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300">
              {roleLabel}
            </span>
          )}
        </div>
        <ul className="flex flex-col gap-0.5 border-t border-border-subtle pt-2" role="menu">
          <li role="none">
            <DropdownItem
              tag="a"
              href="/alumni-profile"
              onItemClick={closeMenu}
              baseClassName="block w-full rounded-lg px-3 py-2 text-sm font-medium text-content-secondary hover:bg-surface-raised hover:text-content"
            >
              Overview
            </DropdownItem>
          </li>
          <li role="none">
            <DropdownItem
              tag="a"
              href="/alumni-profile?tab=profile"
              onItemClick={closeMenu}
              baseClassName="block w-full rounded-lg px-3 py-2 text-sm font-medium text-content-secondary hover:bg-surface-raised hover:text-content"
            >
              Edit Profile
            </DropdownItem>
          </li>
          <li role="none">
            <DropdownItem
              tag="a"
              href="/alumni-profile/view-applications"
              onItemClick={closeMenu}
              baseClassName="block w-full rounded-lg px-3 py-2 text-sm font-medium text-content-secondary hover:bg-surface-raised hover:text-content"
            >
              My Applications
            </DropdownItem>
          </li>
        </ul>
        <button
          type="button"
          onClick={async () => {
            setIsOpen(false);
            await signOut({ redirect: false });
            window.location.href = "/signin";
          }}
          className="mt-2 flex w-full items-center gap-2 rounded-lg border-t border-border-subtle px-3 py-2.5 pt-3 text-left text-sm font-semibold text-error-600 transition-colors hover:bg-error-50 dark:text-error-400 dark:hover:bg-error-500/10"
        >
          <svg className="fill-current" width="16" height="16" viewBox="0 0 24 24" aria-hidden>
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M15.1007 19.247C14.6865 19.247 14.3507 18.9112 14.3507 18.497L14.3507 14.245H12.8507V18.497C12.8507 19.7396 13.8581 20.747 15.1007 20.747H18.5007C19.7434 20.747 20.7507 19.7396 20.7507 18.497L20.7507 5.49609C20.7507 4.25345 19.7433 3.24609 18.5007 3.24609H15.1007C13.8581 3.24609 12.8507 4.25345 12.8507 5.49609V9.74501L14.3507 9.74501V5.49609C14.3507 5.08188 14.6865 4.74609 15.1007 4.74609L18.5007 4.74609C18.9149 4.74609 19.2507 5.08188 19.2507 5.49609L19.2507 18.497C19.2507 18.9112 19.2507 19.247 18.5007 19.247H15.1007ZM3.25073 11.9984C3.25073 12.2144 3.34204 12.4091 3.48817 12.546L8.09483 17.1556C8.38763 17.4485 8.86251 17.4487 9.15549 17.1559C9.44848 16.8631 9.44863 16.3882 9.15583 16.0952L5.81116 12.7484L16.0007 12.7484C16.4149 12.7484 16.7507 12.4127 16.7507 11.9984C16.7507 11.5842 16.4149 11.2484 16.0007 11.2484L5.81528 11.2484L9.15585 7.90554C9.44864 7.61255 9.44847 7.13767 9.15547 6.84488C8.86248 6.55209 8.3876 6.55226 8.09481 6.84525L3.52309 11.4202C3.35673 11.5577 3.25073 11.7657 3.25073 11.9984Z"
            />
          </svg>
          Sign out
        </button>
      </Dropdown>
    </div>
  );
}

export default function AlumniHeader() {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 w-full border-b bg-surface/95 backdrop-blur transition-shadow duration-200 motion-reduce:transition-none print:hidden ${
        isScrolled ? "border-border-subtle shadow-sm" : "border-transparent"
      }`}
    >
      <a
        href="#main-content"
        className="sr-only rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[100]"
      >
        Skip to content
      </a>
      <nav
        aria-label="Alumni"
        className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between gap-3 px-3 sm:h-16 sm:px-4 md:px-6 lg:px-8"
      >
        <Link
          href="/alumni-profile"
          aria-label="UOL Alumni Portal home"
          className="flex shrink-0 items-center gap-2.5 rounded-lg transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        >
          <Image
            width={254}
            height={80}
            src="/images/logo/UOL-Rebrand-ID_Final-01.png"
            alt=""
            priority
            className="h-9 w-auto dark:hidden sm:h-10"
          />
          <Image
            width={254}
            height={80}
            src="/images/logo/logo-white.png"
            alt=""
            priority
            className="hidden h-9 w-auto dark:block sm:h-10"
          />
          <span className="hidden text-sm font-bold tracking-tight text-content md:block">
            Alumni Portal
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <ThemeToggleButton />
          <span aria-hidden className="mx-0.5 hidden h-6 w-px bg-border-subtle sm:block" />
          <AlumniUserMenu />
        </div>
      </nav>
    </header>
  );
}
