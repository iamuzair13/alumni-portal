"use client";

import { useEffect, useState } from "react";
import { useSpring } from "motion/react";

export function useAnimatedNumber(value: number, duration = 0.6) {
  const spring = useSpring(value, { stiffness: 120, damping: 20, duration });
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    spring.set(value);
  }, [value, spring]);

  useEffect(() => {
    const unsub = spring.on("change", (v) => setDisplay(Math.round(v)));
    return () => unsub();
  }, [spring]);

  return display;
}
