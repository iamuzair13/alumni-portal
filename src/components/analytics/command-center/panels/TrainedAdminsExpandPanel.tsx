"use client";

import React, { useMemo } from "react";
import AnalyticsDataTable from "@/components/analytics/management/AnalyticsDataTable";
import type { ManagementDashboardPayload } from "@/lib/analytics/management-dashboard";
import { mapTrainedAdmins } from "../data/mapPayloadToCards";
import { TRAINED_ADMINS_METHODOLOGY } from "../data/systemFieldMethodology";
import { KPI_COLOR_HEX } from "@/components/analytics/v2/charts/chartColors";

function formatTrainedDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function TrainedAdminsExpandPanel({
  data,
  isLoading,
}: {
  data: ManagementDashboardPayload | undefined;
  isLoading: boolean;
}) {
  const admins = mapTrainedAdmins(data);

  const roleTotals = useMemo(
    () =>
      admins.byFaculty.reduce(
        (acc, row) => ({
          admins: acc.admins + row.admins,
          viewers: acc.viewers + row.viewers,
        }),
        { admins: 0, viewers: 0 }
      ),
    [admins.byFaculty]
  );

  const facultyScopedTotal = useMemo(
    () => admins.byFaculty.reduce((s, r) => s + r.count, 0),
    [admins.byFaculty]
  );

  const tableRows = useMemo(() => {
    const body = admins.byFaculty.map((row) => ({
      faculty: row.facultyShort,
      admins: row.admins.toLocaleString(),
      viewers: row.viewers.toLocaleString(),
      total: row.count.toLocaleString(),
      firstTrained: formatTrainedDate(row.firstTrainedAt),
      lastTrained: formatTrainedDate(row.lastTrainedAt),
    }));
    if (!body.length) return body;
    return [
      ...body,
      {
        faculty: "Total (faculty-scoped)",
        admins: roleTotals.admins.toLocaleString(),
        viewers: roleTotals.viewers.toLocaleString(),
        total: facultyScopedTotal.toLocaleString(),
        firstTrained: "—",
        lastTrained: "—",
      },
    ];
  }, [admins.byFaculty, roleTotals, facultyScopedTotal]);

  const kpis = [
    {
      label: "All trained users",
      value: admins.total,
      sub: "Faculty-scoped + superadmins",
      color: KPI_COLOR_HEX.amber,
    },
    {
      label: "Superadmins",
      value: admins.superadminsTotal,
      sub: "Org-wide · not tied to a faculty",
      color: KPI_COLOR_HEX.violet,
    },
    {
      label: "Faculty admins",
      value: roleTotals.admins,
      sub: "Across faculty rows",
      color: KPI_COLOR_HEX.indigo,
    },
    {
      label: "Faculty viewers",
      value: roleTotals.viewers,
      sub: "Includes legacy user type",
      color: KPI_COLOR_HEX.sky,
    },
  ];

  return (
    <div className="space-y-5">
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Superadmins are counted once at the org level and are not listed under any faculty.
        Admin and viewer counts are per faculty assignment; the same user may appear in multiple rows.
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="rounded-xl border border-gray-200/80 bg-gradient-to-br from-white to-gray-50/80 px-3 py-2.5 dark:border-gray-800 dark:from-gray-900/80 dark:to-gray-900/40"
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              {k.label}
            </p>
            <p className="mt-1 text-xl font-bold tabular-nums" style={{ color: k.color }}>
              {k.value.toLocaleString()}
            </p>
            <p className="mt-0.5 text-[10px] text-gray-500 dark:text-gray-400">{k.sub}</p>
          </div>
        ))}
      </div>

      <section>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
          By faculty (admins &amp; viewers)
        </h3>
        <AnalyticsDataTable
          isLoading={isLoading}
          columns={[
            { key: "faculty", label: "Faculty" },
            { key: "admins", label: "Admin", align: "right" },
            { key: "viewers", label: "Viewer", align: "right" },
            { key: "total", label: "Total", align: "right" },
            { key: "firstTrained", label: "First trained" },
            { key: "lastTrained", label: "Last trained" },
          ]}
          rows={tableRows}
        />
      </section>

     
    </div>
  );
}
