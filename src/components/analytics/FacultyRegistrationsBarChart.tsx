"use client";

import React from "react";
import { TrendingUp } from "lucide-react";
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, XAxis } from "recharts";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

type FacultyPoint = {
  faculty: string;
  registrations: number;
};

const facultyAbbreviationMap: Array<{ match: RegExp; short: string }> = [
  { match: /allied\s*health/i, short: "FAHS" },
  { match: /information\s*technology/i, short: "FIT" },
  { match: /management\s*science|management\s*sciences/i, short: "MS" },
  { match: /social\s*sciences/i, short: "FSS" },
  { match: /science/i, short: "Sci" },
  { match: /architecture/i, short: "A&R" },
  { match: /law/i, short: "FL" },
  { match: /ucmd|medical|dent/i, short: "UCMD" },
];

const shortFacultyName = (name: string): string => {
  const raw = String(name || "").trim();
  if (!raw) return "N/A";
  const mapped = facultyAbbreviationMap.find((m) => m.match.test(raw));
  if (mapped) return mapped.short;
  const words = raw
    .replace(/^faculty\s+of\s+/i, "")
    .split(/[\s/&,-]+/)
    .filter(Boolean);
  const abbr = words.map((w) => w[0]?.toUpperCase() ?? "").join("");
  return abbr || raw.slice(0, 8);
};

const chartConfig = {
  registrations: {
    label: "Registrations",
    color: "hsl(221 83% 53%)",
  },
} satisfies ChartConfig;

export default function FacultyRegistrationsBarChart({
  data,
  subtitle,
}: {
  data: FacultyPoint[];
  subtitle: string;
}) {
  const safeData = data.length > 0 ? data : [{ faculty: "N/A", registrations: 0 }];
  const chartData = safeData.map((d) => ({
    ...d,
    shortFaculty: shortFacultyName(d.faculty),
  }));
  const sorted = [...safeData].sort((a, b) => b.registrations - a.registrations);
  const top = sorted[0];
  const total = safeData.reduce((sum, p) => sum + p.registrations, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Faculty-wise Registrations</CardTitle>
        <CardDescription>{subtitle}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              accessibilityLayer
              data={chartData}
              margin={{ top: 20, left: 8, right: 8, bottom: 4 }}
            >
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="shortFaculty"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
                interval={0}
              />
              <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
              <Bar dataKey="registrations" fill="var(--color-registrations)" radius={8}>
                <LabelList position="top" offset={8} className="fill-foreground" fontSize={11} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium text-gray-800 dark:text-gray-200">
          Top faculty: {top?.faculty || "Under Processing"} ({Number(top?.registrations || 0).toLocaleString()}) <TrendingUp className="h-4 w-4" />
        </div>
        <div className="leading-none text-gray-500 dark:text-gray-400">Total registrations: {total.toLocaleString()}</div>
      </CardFooter>
    </Card>
  );
}

