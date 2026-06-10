import "server-only";

import { readdir, stat } from "fs/promises";
import { join } from "path";
import { sql } from "@/lib/dbconnect";
import { getUploadsImagesDir } from "@/lib/uploadsDir";

export type SystemHealthStatus = "healthy" | "warning" | "critical";

export type SystemHealthMetric = {
  id: string;
  label: string;
  value: string;
  status: SystemHealthStatus;
  unit?: string;
};

export type SystemLogEntry = {
  time: string;
  level: string;
  message: string;
};

export type SystemHealthPayload = {
  metrics: SystemHealthMetric[];
  logs: SystemLogEntry[];
  collectedAt: string;
};

const DEFAULT_STORAGE_QUOTA_GB = 60;

function storageQuotaBytes(): number {
  const raw = process.env.UPLOADS_STORAGE_QUOTA_GB;
  const gb = raw ? Number.parseFloat(raw) : DEFAULT_STORAGE_QUOTA_GB;
  if (!Number.isFinite(gb) || gb <= 0) return DEFAULT_STORAGE_QUOTA_GB * 1024 ** 3;
  return gb * 1024 ** 3;
}

function latencyStatus(ms: number): SystemHealthStatus {
  if (ms >= 300) return "critical";
  if (ms >= 100) return "warning";
  return "healthy";
}

function storageStatus(percent: number): SystemHealthStatus {
  if (percent >= 85) return "critical";
  if (percent >= 60) return "warning";
  return "healthy";
}

function errorRateStatus(percent: number): SystemHealthStatus {
  if (percent >= 5) return "critical";
  if (percent >= 1) return "warning";
  return "healthy";
}

function formatLogTime(value: unknown): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}

async function getDirectorySizeBytes(dir: string): Promise<number> {
  let total = 0;
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        total += await getDirectorySizeBytes(fullPath);
      } else if (entry.isFile()) {
        const fileStat = await stat(fullPath);
        total += fileStat.size;
      }
    }
  } catch {
    return 0;
  }
  return total;
}

async function probeDatabase(): Promise<{ online: boolean; latencyMs: number }> {
  const started = performance.now();
  try {
    await sql`SELECT 1 AS ok`;
    return { online: true, latencyMs: Math.max(1, Math.round(performance.now() - started)) };
  } catch {
    return { online: false, latencyMs: Math.max(1, Math.round(performance.now() - started)) };
  }
}

async function probeStorage(): Promise<{ percent: number; usedBytes: number; quotaBytes: number }> {
  const usedBytes = await getDirectorySizeBytes(getUploadsImagesDir());
  const quotaBytes = storageQuotaBytes();
  const percent = quotaBytes > 0 ? Math.min(100, Math.round((usedBytes / quotaBytes) * 1000) / 10) : 0;
  return { percent, usedBytes, quotaBytes };
}

async function probeErrorRate(): Promise<number> {
  try {
    const rows = await sql<{ total: number; failed: number }[]>/* sql */`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE LOWER(TRIM(status)) = 'failed')::int AS failed
      FROM public.email_logs
      WHERE created_at >= NOW() - INTERVAL '24 hours'
    `;
    const total = Number(rows[0]?.total ?? 0);
    const failed = Number(rows[0]?.failed ?? 0);
    if (total <= 0) return 0;
    return Math.round((failed / total) * 10000) / 100;
  } catch {
    return 0;
  }
}

async function fetchRecentLogs(limit = 8): Promise<SystemLogEntry[]> {
  try {
    const rows = await sql<
      Array<{
        created_at: Date | string;
        status: string | null;
        subject: string | null;
        error_message: string | null;
        action_type: string | null;
      }>
    >/* sql */`
      SELECT created_at, status, subject, error_message, action_type
      FROM public.email_logs
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;

    if (!rows.length) {
      return [{ time: "—", level: "INFO", message: "No operational log entries in the last period." }];
    }

    return rows.map((row) => {
      const failed = String(row.status ?? "").toLowerCase() === "failed";
      const message =
        (failed && row.error_message ? String(row.error_message) : null) ||
        (row.subject ? String(row.subject) : null) ||
        (row.action_type ? String(row.action_type) : null) ||
        (failed ? "Operation failed" : "Operation completed");

      return {
        time: formatLogTime(row.created_at),
        level: failed ? "ERROR" : "INFO",
        message: message.slice(0, 160),
      };
    });
  } catch {
    return [{ time: "—", level: "WARN", message: "email_logs table unavailable — cannot load recent activity." }];
  }
}

/** Live operational metrics for the command-center system strip. */
export async function collectSystemHealth(): Promise<SystemHealthPayload> {
  const [db, storage, errorRate, logs] = await Promise.all([
    probeDatabase(),
    probeStorage(),
    probeErrorRate(),
    fetchRecentLogs(),
  ]);

  const metrics: SystemHealthMetric[] = [
    {
      id: "api",
      label: "API Latency",
      value: db.online ? String(db.latencyMs) : "—",
      status: db.online ? latencyStatus(db.latencyMs) : "critical",
      unit: "ms",
    },
    {
      id: "db",
      label: "Database",
      value: db.online ? "Online" : "Offline",
      status: db.online ? "healthy" : "critical",
    },
    {
      id: "storage",
      label: "Storage",
      value: String(storage.percent),
      status: storageStatus(storage.percent),
      unit: "%",
    },
    {
      id: "errors",
      label: "Error Rate",
      value: errorRate.toFixed(errorRate >= 1 ? 1 : 2),
      status: errorRateStatus(errorRate),
      unit: "%",
    },
  ];

  return {
    metrics,
    logs,
    collectedAt: new Date().toISOString(),
  };
}
