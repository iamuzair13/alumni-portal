"use client";

import React, { useState } from "react";
import { motion } from "motion/react";
import { ENTRANCE, HOVER_CARD } from "./config";
import { getMotionProps, useReducedMotion } from "./useReducedMotion";
import { useAnimationReplay } from "./AnimationReplayContext";

type AnimatedCardProps = {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  onClick?: () => void;
  type?: "button";
  "aria-label"?: string;
};

export function AnimatedCard({
  children,
  className = "",
  delay = 0,
  onClick,
  type = "button",
  "aria-label": ariaLabel,
}: AnimatedCardProps) {
  const reduced = useReducedMotion();
  const { replayKey } = useAnimationReplay();
  const [willChange, setWillChange] = useState(false);

  const entrance = getMotionProps(reduced, {
    initial: { opacity: 0, y: ENTRANCE.y },
    animate: { opacity: 1, y: 0 },
    transition: { delay, duration: ENTRANCE.duration, ease: ENTRANCE.ease },
  });

  return (
    <motion.button
      key={replayKey}
      type={type}
      {...entrance}
      onAnimationStart={() => setWillChange(true)}
      onAnimationComplete={() => setWillChange(false)}
      whileHover={
        reduced
          ? undefined
          : {
              y: HOVER_CARD.y,
              transition: { duration: HOVER_CARD.duration, ease: HOVER_CARD.ease },
            }
      }
      style={willChange ? { willChange: "transform" } : undefined}
      onClick={onClick}
      aria-label={ariaLabel}
      className={className}
    >
      {children}
    </motion.button>
  );
}
