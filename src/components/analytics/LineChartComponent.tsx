"use client";

import React from "react";
import dynamic from "next/dynamic";
import type { ApexOptions } from "apexcharts";

const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

export default function LineChartComponent(props: {
  title: string;
  subtitle?: string;
  labels: string[];
  data: number[];
  loading?: boolean;
}) {
  const options: ApexOptions = {
    legend: { show: false },
    colors: ["#465FFF"],
    chart: {
      fontFamily: "Outfit, sans-serif",
      type: "area",
      height: 320,
      toolbar: { show: false },
    },
    stroke: { curve: "straight", width: 2 },
    dataLabels: { enabled: false },
    xaxis: {
      type: "category",
      categories: props.labels,
      axisBorder: { show: false },
      axisTicks: { show: false },
      tooltip: { enabled: false },
      labels: { rotate: -45 },
    },
    yaxis: {
      labels: {
        style: { fontSize: "12px", colors: ["#6B7280"] },
      },
    },
    grid: { yaxis: { lines: { show: true } }, xaxis: { lines: { show: false } } },
    tooltip: { enabled: true },
    fill: { type: "gradient", gradient: { opacityFrom: 0.45, opacityTo: 0 } },
  };

  const series = [{ name: "Count", data: props.data }];

  return (
    <div className="rounded-2xl border border-gray-200 bg-white px-5 pb-5 pt-5 dark:border-gray-800 dark:bg-white/[0.03] sm:px-6 sm:pt-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">{props.title}</h3>
        {props.subtitle ? <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{props.subtitle}</p> : null}
      </div>
      <div className="max-w-full overflow-x-auto custom-scrollbar">
        <div className="min-w-[900px] xl:min-w-full">
          <ReactApexChart options={options} series={series} type="area" height={320} />
        </div>
      </div>
    </div>
  );
}

