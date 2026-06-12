"use client";

import React, { useRef } from "react";
import { motion, useInView } from "motion/react";
import { useCountUp } from "./useCountUp";
import { useValueFlash } from "./useValueFlash";
import { useAnimationReplay } from "./AnimationReplayContext";
import { useDemoMetricDrift } from "./useDemoMetricDrift";
import { useReducedMotion } from "./useReducedMotion";
import { FLASH } from "./config";

type AnimatedNumberProps = {
  value: number;
  className?: string;
  enableDrift?: boolean;
};

export function AnimatedNumber({ value, className = "", enableDrift = true }: AnimatedNumberProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });
  const reduced = useReducedMotion();
  const { replayKey, demoMode } = useAnimationReplay();

  const drifted = useDemoMetricDrift(value, enableDrift && demoMode);
  const displayTarget = enableDrift && demoMode ? drifted : value;
  const display = useCountUp(displayTarget, {
    trigger: reduced ? true : inView,
    replayKey,
    duration: reduced ? 0 : undefined,
  });
  const isFlashing = useValueFlash(displayTarget, !demoMode);

  return (
    <motion.span
      ref={ref}
      className={`inline-block rounded px-0.5 tabular-nums ${className}`}
      animate={
        isFlashing && !reduced
          ? {
              backgroundColor: ["rgba(16, 185, 129, 0.2)", "rgba(16, 185, 129, 0)"],
            }
          : { backgroundColor: "transparent" }
      }
      transition={{ duration: FLASH.durationMs / 1000, ease: "easeOut" }}
    >
      {display.toLocaleString()}
    </motion.span>
  );
}
