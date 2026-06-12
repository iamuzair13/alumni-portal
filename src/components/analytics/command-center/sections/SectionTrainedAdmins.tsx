"use client";

import React from "react";
import { motion } from "motion/react";
import { Maximize2, UserCog } from "lucide-react";
import type { ManagementDashboardPayload } from "@/lib/analytics/management-dashboard";
import { AnimatedNumber } from "../animation/AnimatedNumber";
import { ENTRANCE } from "../animation/config";
import { getMotionProps, useReducedMotion } from "../animation/useReducedMotion";
import { useAnimationReplay } from "../animation/AnimationReplayContext";
import { ExpandDrawer } from "../ExpandDrawer";
import { TrainedAdminsExpandPanel } from "../panels/TrainedAdminsExpandPanel";
import { useExpandable } from "../hooks/useExpandable";
import { mapTrainedAdmins } from "../data/mapPayloadToCards";
import { ccAccent, ccCard, ccCardTitle, ccCardValueMd } from "../theme";

const CARD_ID = "trained-admins";

export function SectionTrainedAdmins({
  data,
  isLoading,
}: {
  data: ManagementDashboardPayload | undefined;
  isLoading: boolean;
}) {
  const { activeId, open, close } = useExpandable();
  const admins = mapTrainedAdmins(data);
  const amber = ccAccent.amber;
  const isOpen = activeId === CARD_ID;
  const reduced = useReducedMotion();
  const { replayKey } = useAnimationReplay();

  const entrance = getMotionProps(reduced, {
    initial: { opacity: 0, y: ENTRANCE.y },
    animate: { opacity: 1, y: 0 },
    transition: {
      delay: ENTRANCE.facultyBarDelay,
      duration: ENTRANCE.duration,
      ease: ENTRANCE.ease,
    },
  });

  return (
    <>
      <motion.button
        key={`trained-admins-${replayKey}`}
        type="button"
        {...entrance}
        onClick={() => open(CARD_ID)}
        className={`group flex w-full flex-col overflow-hidden text-left transition-shadow hover:shadow-md ${ccCard} ${amber.border}`}
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-amber-100/80 px-2.5 py-1.5 dark:border-amber-500/10">
          <UserCog className={`h-3.5 w-3.5 shrink-0 ${amber.icon}`} />
          <span className={ccCardTitle}>Trained Faculty Admins</span>
          <span className={`ml-auto ${ccCardValueMd}`}>
            <AnimatedNumber value={admins.total} />
          </span>
          <Maximize2 className="h-3 w-3 shrink-0 text-gray-400 opacity-0 transition-opacity group-hover:opacity-100 dark:text-gray-500" />
        </div>
        <div className="flex min-h-0 items-center overflow-x-auto scroll-smooth px-2 py-1.5 [scrollbar-width:thin] snap-x snap-mandatory">
          <div className="flex w-max min-w-full items-center gap-1.5">
            {admins.byFaculty.length > 0 ? (
              admins.byFaculty.map((f) => (
                <motion.div
                  key={f.faculty}
                  title={`${f.faculty}: ${f.count} admin${f.count === 1 ? "" : "s"}`}
                  whileHover={
                    reduced
                      ? undefined
                      : { scale: 1.02, transition: { duration: 0.2, ease: "easeOut" } }
                  }
                  className="inline-flex shrink-0 snap-center items-center gap-1 rounded-md border border-gray-200/80 bg-gray-50/90 px-2 py-0.5 transition-colors duration-200 hover:bg-gray-100 dark:border-gray-700/60 dark:bg-gray-800/60 dark:hover:bg-gray-700/60"
                >
                  <span className="max-w-[7.5rem] truncate text-[10px] font-medium text-gray-600 dark:text-gray-300">
                    {f.facultyShort}
                  </span>
                  <span className="text-[11px] font-bold tabular-nums text-gray-900 dark:text-gray-100">
                    {f.count}
                  </span>
                </motion.div>
              ))
            ) : (
              <span className="text-[10px] text-gray-400 dark:text-gray-500">
                {isLoading ? "Loading…" : "No faculty-scoped admins"}
              </span>
            )}
          </div>
        </div>
      </motion.button>

      <ExpandDrawer
        open={isOpen}
        title="Trained Faculty Admins"
        onClose={close}
        accent="amber"
        maxWidthClass="max-w-5xl"
      >
        <TrainedAdminsExpandPanel data={data} isLoading={isLoading} />
      </ExpandDrawer>
    </>
  );
}
