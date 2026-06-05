"use client";

import React from "react";
import dynamic from "next/dynamic";
import type { ApexOptions } from "apexcharts";

const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

export default function BarChartComponent(props: {
  title: string;
  subtitle?: string;
  labels: string[];
  data: number[];
  height?: number;
  compact?: boolean;
}) {
  const chartHeight = props.height ?? (props.compact ? 150 : 260);

  const options: ApexOptions = {
    colors: ["#465FFF"],
    chart: {
      fontFamily: "Outfit, sans-serif",
      type: "bar",
      height: chartHeight,
      toolbar: { show: false },
    },
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: "45%",
        borderRadius: 4,
        borderRadiusApplication: "end",
      },
    },
    dataLabels: { enabled: false },
    xaxis: {
      categories: props.labels,
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: { rotate: -45, style: { fontSize: props.compact ? "10px" : "12px" } },
    },
    grid: { yaxis: { lines: { show: true } } },
    tooltip: {
      y: {
        formatter: (val: number) => `${val}`,
      },
    },
  };

  const series = [{ name: "Count", data: props.data }];

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
      <div className="max-w-full overflow-x-auto custom-scrollbar">
        <div className={props.compact ? "min-w-0" : "min-w-[900px] xl:min-w-full"}>
          <ReactApexChart options={options} series={series} type="bar" height={chartHeight} />
        </div>
      </div>
    </div>
  );
}
