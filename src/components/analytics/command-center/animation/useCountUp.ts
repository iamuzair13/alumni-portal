"use client";

import { useEffect, useRef, useState } from "react";
import { animate } from "motion/react";
import { COUNT_UP } from "./config";

type UseCountUpOptions = {
  duration?: number;
  trigger?: boolean;
  replayKey?: number;
};

export function useCountUp(
  target: number,
  { duration = COUNT_UP.duration, trigger = true, replayKey = 0 }: UseCountUpOptions = {}
) {
  const skipAnimation = duration === 0;
  const [display, setDisplay] = useState(skipAnimation || !trigger ? target : 0);
  const prevTarget = useRef(target);
  const prevReplay = useRef(replayKey);

  useEffect(() => {
    if (!trigger || skipAnimation) {
      setDisplay(target);
      prevTarget.current = target;
      return;
    }

    const replayChanged = prevReplay.current !== replayKey;
    prevReplay.current = replayKey;

    const from = replayChanged ? 0 : prevTarget.current;
    prevTarget.current = target;

    if (from === target && !replayChanged) return;

    const controls = animate(from, target, {
      duration,
      ease: COUNT_UP.ease,
      onUpdate: (v) => setDisplay(Math.round(v)),
    });

    return () => controls.stop();
  }, [target, duration, trigger, replayKey, skipAnimation]);

  return display;
}
