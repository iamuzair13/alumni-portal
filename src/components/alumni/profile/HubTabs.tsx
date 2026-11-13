"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useRef } from "react";
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
        <div
          ref={listRef}
          role="tablist"
          aria-label="Profile sections"
          onKeyDown={onKeyDown}
          className="flex items-center gap-1.5 overflow-x-auto rounded-2xl border border-border-subtle bg-surface p-1.5 shadow-sm scrollbar-none [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
