"use client";

import { ENTRANCE } from "./config";

export function useStaggeredEntrance(index: number, sectionOffset = 0) {
  return {
    delay: sectionOffset + index * (ENTRANCE.staggerMs / 1000),
    duration: ENTRANCE.duration,
    ease: ENTRANCE.ease,
    y: ENTRANCE.y,
  };
}

export function staggerDelay(index: number, sectionOffset = 0): number {
  return sectionOffset + index * (ENTRANCE.staggerMs / 1000);
}
