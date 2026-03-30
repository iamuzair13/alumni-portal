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
}) {
  const options: ApexOptions = {
    colors: ["#465FFF"],
    chart: {
      fontFamily: "Outfit, sans-serif",
      type: "bar",
      height: 260,
      toolbar: { show: false },
    },
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: "45%",
        borderRadius: 6,
        borderRadiusApplication: "end",
      },
    },
    dataLabels: { enabled: false },
    xaxis: {
      categories: props.labels,
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: { rotate: -45 },
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
    <div className="rounded-2xl border border-gray-200 bg-white px-5 pb-5 pt-5 dark:border-gray-800 dark:bg-white/[0.03] sm:px-6 sm:pt-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">{props.title}</h3>
        {props.subtitle ? <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{props.subtitle}</p> : null}
      </div>
      <div className="max-w-full overflow-x-auto custom-scrollbar">
        <div className="min-w-[900px] xl:min-w-full">
          <ReactApexChart options={options} series={series} type="bar" height={260} />
        </div>
      </div>
    </div>
  );
}

