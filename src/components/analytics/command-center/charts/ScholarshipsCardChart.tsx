"use client";

import React from "react";
import { ChartEmpty } from "./ChartEmpty";
import { SimpleBarList } from "./SimpleBarList";

export type ScholarshipCardRow = {
  type: string;
  short: string;
  applied: number;
  approved: number;
  color: string;
};

export function ScholarshipsCardChart({
  rows,
  total,
}: {
  rows: ScholarshipCardRow[];
  total: number;
}) {
  const typeBars = rows.map((row) => ({
    label: row.type,
    detail: `${row.applied.toLocaleString()} applied`,
    value: row.approved,
    color: row.color,
  }));

  if (total === 0 && typeBars.every((b) => b.value === 0)) {
    return <ChartEmpty height={96} variant="premium" message="No scholarship data" />;
  }

  return (
    <SimpleBarList items={typeBars} compact />
  );
}
