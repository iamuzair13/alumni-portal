"use client";

import React from "react";
import dynamic from "next/dynamic";
import type { ApexOptions } from "apexcharts";

const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

export default function PieChartComponent(props: {
  title: string;
  subtitle?: string;
  labels: string[];
  data: number[];
  height?: number;
  compact?: boolean;
}) {
  const chartHeight = props.height ?? (props.compact ? 160 : 320);

  const options: ApexOptions = {
    chart: {
      fontFamily: "Outfit, sans-serif",
      type: "pie",
      height: chartHeight,
    },
    labels: props.labels,
    legend: { position: "bottom", fontSize: props.compact ? "10px" : "12px" },
    dataLabels: { enabled: true, style: { fontSize: props.compact ? "10px" : "12px" } },
    stroke: { width: 1 },
    tooltip: {
      y: {
        formatter: (val: number) => `${val}`,
      },
    },
  };

  return (
    <div
      className={`rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] ${
        props.compact ? "px-3 pb-3 pt-3" : "px-5 pb-5 pt-5 sm:px-6 sm:pt-6"
      }`}
    >
      <div className={props.compact ? "mb-2" : "mb-4"}>
        <h3 className={`font-semibold text-gray-800 dark:text-white/90 ${props.compact ? "text-sm" : "text-lg"}`}>{props.title}</h3>
        {props.subtitle ? <p className={`text-gray-500 dark:text-gray-400 ${props.compact ? "mt-0.5 text-[11px]" : "mt-1 text-sm"}`}>{props.subtitle}</p> : null}
      </div>
      <div className="max-w-full">
        <ReactApexChart options={options} series={props.data} type="pie" height={chartHeight} />
      </div>
    </div>
  );
}
