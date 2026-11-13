"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

export type HubTabDef = { key: string; label: string };

type HubProps = {
  tabs: HubTabDef[];
  panels: Record<string, ReactNode>;
};

export default function Hub({ tabs, panels }: HubProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const listRef = useRef<HTMLDivElement>(null);

  const active = searchParams.get("tab") ?? "overview";

  const [overflowing, setOverflowing] = useState(false);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    setOverflowing(el.scrollWidth > el.clientWidth + 2);
    setCanLeft(el.scrollLeft > 2);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    updateScrollState();
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    el.addEventListener("scroll", updateScrollState, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", updateScrollState);
    };
  }, [updateScrollState]);

  const scrollTabs = useCallback((dir: 1 | -1) => {
    const el = listRef.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({
      left: dir * Math.max(140, el.clientWidth * 0.6),
      behavior: reduce ? "auto" : "smooth",
    });
  }, []);

  const setTab = useCallback(
    (key: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (key === "overview") params.delete("tab");
      else params.set("tab", key);
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const idx = tabs.findIndex((t) => t.key === active);
    const next =
      e.key === "ArrowRight" ? (idx + 1) % tabs.length : (idx - 1 + tabs.length) % tabs.length;
    const btn = listRef.current?.querySelector<HTMLElement>(`[data-tab="${tabs[next].key}"]`);
    btn?.focus();
    setTab(tabs[next].key);
  };

  return (
    <div>
      <div className="sticky top-16 z-30 -mx-1 bg-gray-50/90 px-1 pt-1 pb-2 backdrop-blur supports-[backdrop-filter]:bg-gray-50/70 dark:bg-gray-950/90 dark:supports-[backdrop-filter]:bg-gray-950/70">
        <div className="flex items-center gap-1 rounded-2xl border border-border-subtle bg-surface p-1.5 shadow-sm">
          {overflowing && (
            <button
              type="button"
              aria-label="Scroll tabs left"
              disabled={!canLeft}
              onClick={() => scrollTabs(-1)}
              className="inline-flex h-10 w-9 shrink-0 items-center justify-center rounded-xl text-content-secondary transition-colors hover:bg-surface-raised hover:text-content focus-visible:outline-2 focus-visible:outline-brand-500 disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </button>
          )}
          <div
            ref={listRef}
            role="tablist"
            aria-label="Profile sections"
            onKeyDown={onKeyDown}
            className="flex flex-1 items-center gap-1.5 overflow-x-auto scrollbar-none [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
          {tabs.map((t) => {
            const selected = t.key === active;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                id={`hub-tab-${t.key}`}
                aria-selected={selected}
                aria-controls={`hub-panel-${t.key}`}
                data-tab={t.key}
                tabIndex={selected ? 0 : -1}
                onClick={() => setTab(t.key)}
                className={`shrink-0 rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500 ${
                  selected
                    ? "bg-brand-600 text-white shadow-sm dark:bg-brand-500 dark:text-accent-950"
                    : "text-content-secondary hover:bg-surface-raised hover:text-content"
                }`}
              >
                {t.label}
              </button>
            );
          })}
          </div>
          {overflowing && (
            <button
              type="button"
              aria-label="Scroll tabs right"
              disabled={!canRight}
              onClick={() => scrollTabs(1)}
              className="inline-flex h-10 w-9 shrink-0 items-center justify-center rounded-xl text-content-secondary transition-colors hover:bg-surface-raised hover:text-content focus-visible:outline-2 focus-visible:outline-brand-500 disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          )}
        </div>
      </div>

      {tabs.map((t) => {
        const selected = t.key === active;
        return (
          <div
            key={t.key}
            role="tabpanel"
            id={`hub-panel-${t.key}`}
            aria-labelledby={`hub-tab-${t.key}`}
            hidden={!selected}
            className={selected ? "mt-5" : undefined}
          >
            {selected ? panels[t.key] : null}
          </div>
        );
      })}
    </div>
  );
}
