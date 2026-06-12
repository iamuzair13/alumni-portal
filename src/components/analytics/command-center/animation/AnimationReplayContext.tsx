"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

type AnimationReplayContextValue = {
  replayKey: number;
  replay: () => void;
  demoMode: boolean;
  toggleDemo: () => void;
};

const AnimationReplayContext = createContext<AnimationReplayContextValue | null>(null);

export function AnimationReplayProvider({ children }: { children: React.ReactNode }) {
  const [replayKey, setReplayKey] = useState(0);
  const [demoMode, setDemoMode] = useState(false);

  const replay = useCallback(() => setReplayKey((k) => k + 1), []);
  const toggleDemo = useCallback(() => setDemoMode((d) => !d), []);

  const value = useMemo(
    () => ({ replayKey, replay, demoMode, toggleDemo }),
    [replayKey, replay, demoMode, toggleDemo]
  );

  return (
    <AnimationReplayContext.Provider value={value}>{children}</AnimationReplayContext.Provider>
  );
}

export function useAnimationReplay(): AnimationReplayContextValue {
  const ctx = useContext(AnimationReplayContext);
  if (!ctx) {
    return {
      replayKey: 0,
      replay: () => {},
      demoMode: false,
      toggleDemo: () => {},
    };
  }
  return ctx;
}
