"use client";

import React, { useMemo } from "react";
import dynamic from "next/dynamic";
import type { ChartSeriesPoint } from "../utils/kpiConfig";
import { chartHeight } from "./ChartWidgets";

const ComposableMap = dynamic(() => import("react-simple-maps").then((m) => m.ComposableMap), { ssr: false });
const Geographies = dynamic(() => import("react-simple-maps").then((m) => m.Geographies), { ssr: false });
const Geography = dynamic(() => import("react-simple-maps").then((m) => m.Geography), { ssr: false });

const GEO_URL = "/geo/pakistan-provinces.json";

const NAME_TO_GEO: Record<string, string> = {
  Punjab: "PK-PB",
  Sindh: "PK-SD",
  KPK: "PK-KP",
  Balochistan: "PK-BA",
  Islamabad: "PK-IS",
  AJK: "PK-JK",
  GB: "PK-GB",
};

function fillForValue(value: number, max: number): string {
  if (max <= 0 || value <= 0) return "#e2e8f0";
  const ratio = value / max;
  const r = Math.round(99 + (255 - 99) * (1 - ratio));
  const g = Math.round(102 + (255 - 102) * (1 - ratio));
  const b = Math.round(241 + (255 - 241) * (1 - ratio));
  return `rgb(${r}, ${g}, ${b})`;
}

export function PakistanProvinceMap({
  data,
  compact,
}: {
  data: ChartSeriesPoint[];
  compact?: boolean;
}) {
  const { valueByGeoId, max, overseas, other } = useMemo(() => {
    const map = new Map<string, number>();
    let maxVal = 0;
    let overseasVal = 0;
    let otherVal = 0;
    for (const point of data) {
      if (point.label === "Overseas") {
        overseasVal = point.value;
        continue;
      }
      if (point.label === "Other") {
        otherVal = point.value;
        continue;
      }
      const geoId = (point.meta?.geoId as string) ?? NAME_TO_GEO[point.label];
      if (geoId) {
        map.set(geoId, point.value);
        if (point.value > maxVal) maxVal = point.value;
      }
    }
    return { valueByGeoId: map, max: maxVal, overseas: overseasVal, other: otherVal };
  }, [data]);

  const h = chartHeight(compact, true);

  return (
    <div>
      <div style={{ height: h }} className="w-full">
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{ center: [69, 30.5], scale: compact ? 680 : 820 }}
          width={400}
          height={h}
          style={{ width: "100%", height: "100%" }}
        >
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const id = geo.properties?.id as string;
                const value = valueByGeoId.get(id) ?? 0;
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={fillForValue(value, max)}
                    stroke="#fff"
                    strokeWidth={0.75}
                    style={{
                      default: { outline: "none" },
                      hover: { fill: "#6366f1", outline: "none", cursor: "pointer" },
                      pressed: { outline: "none" },
                    }}
                  />
                );
              })
            }
          </Geographies>
        </ComposableMap>
      </div>
      {(overseas > 0 || other > 0) && (
        <div className="mt-1.5 flex flex-wrap gap-1.5 px-1">
          {overseas > 0 ? (
            <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
              Overseas: {overseas.toLocaleString()}
            </span>
          ) : null}
          {other > 0 ? (
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              Other: {other.toLocaleString()}
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
}
