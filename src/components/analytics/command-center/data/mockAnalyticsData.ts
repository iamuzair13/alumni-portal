// TODO: Replace with actual API data for system health metrics

export type SystemHealthMetric = {
  id: string;
  label: string;
  value: string;
  status: "healthy" | "warning" | "critical";
  unit?: string;
};

export const MOCK_SYSTEM_HEALTH: SystemHealthMetric[] = [
  { id: "api", label: "API Latency", value: "42", status: "healthy", unit: "ms" },
  { id: "db", label: "Database", value: "Online", status: "healthy" },
  { id: "storage", label: "Storage", value: "68", status: "warning", unit: "%" },
  { id: "errors", label: "Error Rate", value: "0.02", status: "healthy", unit: "%" },
];

export const MOCK_SYSTEM_LOGS = [
  { time: "14:32:01", level: "INFO", message: "Dashboard cache refreshed" },
  { time: "14:31:45", level: "INFO", message: "Alumni trends sync complete" },
  { time: "14:30:12", level: "WARN", message: "Storage threshold at 68%" },
  { time: "14:28:00", level: "INFO", message: "Scheduled backup verified" },
];
