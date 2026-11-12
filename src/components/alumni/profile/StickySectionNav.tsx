"use client";
import { useEffect, useRef, useState } from "react";

type Section = { id: string; label: string };

/**
 * Sticky in-page chip navigation with scroll-spy.
 * Clicking a chip smooth-scrolls to the section; the active chip follows
 * scroll position via IntersectionObserver.
 */
export default function StickySectionNav({ sections }: { sections: Section[] }) {
  const [active, setActive] = useState<string>(sections[0]?.id ?? "");
  const navRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const targets = sections
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => !!el);
    if (targets.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]?.target.id) setActive(visible[0].target.id);
      },
      { rootMargin: "-30% 0px -60% 0px", threshold: 0 }
    );
    targets.forEach((t) => observer.observe(t));
    return () => observer.disconnect();
  }, [sections]);

  const goTo = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    setActive(id);
  };

  return (
    <nav
      ref={navRef}
      aria-label="Page sections"
      className="sticky top-2 z-30 -mx-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <div className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white/90 p-1.5 shadow-sm backdrop-blur dark:bg-gray-900/90 dark:border-gray-700">
        {sections.map((s) => {
          const isActive = s.id === active;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => goTo(s.id)}
              aria-current={isActive ? "location" : undefined}
              className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs sm:text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 ${
                isActive
                  ? "bg-accent-800 text-white shadow-sm dark:bg-brand-600"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
              }`}
            >
              {s.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
