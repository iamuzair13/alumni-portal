"use client";

import { useEffect, useState } from "react";
import type { TargetAndTransition, Transition } from "motion/react";

const QUERY = "(prefers-reduced-motion: reduce)";

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return reduced;
}

export type MotionEntranceProps = {
  initial: TargetAndTransition | false;
  animate: TargetAndTransition;
  transition?: Transition;
};

export function getMotionProps(
  reduced: boolean,
  props: MotionEntranceProps,
  instantAnimate?: TargetAndTransition
): MotionEntranceProps {
  if (!reduced) return props;
  return {
    initial: false,
    animate: instantAnimate ?? props.animate,
    transition: { duration: 0 },
  };
}

export function instantIfReduced<T>(reduced: boolean, value: T, instant: T): T {
  return reduced ? instant : value;
}
