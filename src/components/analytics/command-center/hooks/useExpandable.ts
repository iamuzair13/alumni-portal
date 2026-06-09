"use client";

import { useCallback, useState } from "react";

export function useExpandable() {
  const [activeId, setActiveId] = useState<string | null>(null);

  const open = useCallback((id: string) => setActiveId(id), []);
  const close = useCallback(() => setActiveId(null), []);
  const isOpen = useCallback((id: string) => activeId === id, [activeId]);

  return { activeId, open, close, isOpen };
}
