/**
 * Centralized Alumni Card Status Configuration
 * 
 * This file defines the complete and only allowed statuses for alumni cards.
 * All status-related logic should reference this configuration.
 */

// Database status values (as stored in the database)
export type DbCardStatus = "UnderReview" | "UnderPrinting" | "Active" | "Onhold" | "Delivered";

// UI status values (used in frontend)
export type CardStatus = "all" | "under-review" | "underprinting" | "active" | "onhold" | "delivered";

// Status configuration with labels
export const CARD_STATUS_CONFIG = {
  "all": {
    dbValue: null, // "all" is a filter, not a database value
    label: "ALL",
    order: 0,
  },
  "under-review": {
    dbValue: "UnderReview" as DbCardStatus,
    label: "Under-Review",
    order: 1,
  },
  "underprinting": {
    dbValue: "UnderPrinting" as DbCardStatus,
    label: "Under-printing",
    order: 2,
  },
  "active": {
    dbValue: "Active" as DbCardStatus,
    label: "Ready for Delivery",
    order: 3,
  },
  "onhold": {
    dbValue: "Onhold" as DbCardStatus,
    label: "On Hold",
    order: 4,
  },
  "delivered": {
    dbValue: "Delivered" as DbCardStatus,
    label: "Delivered",
    order: 5,
  },
} as const;

// Default status for new card applications
export const DEFAULT_CARD_STATUS: DbCardStatus = "UnderReview";

// Status migration map (for migrating legacy statuses)
export const STATUS_MIGRATION_MAP: Record<string, DbCardStatus> = {
  "Pending": "UnderReview",
  "pending": "UnderReview",
  "PENDING": "UnderReview",
  "Process": "UnderPrinting",
  "process": "UnderPrinting",
  "PROCESS": "UnderPrinting",
  "InProcess": "UnderPrinting",
  "in-process": "UnderPrinting",
  "IN-PROCESS": "UnderPrinting",
};

/**
 * Map database status to UI status
 */
export function mapDbStatusToUI(dbStatus: string | null | undefined): CardStatus {
  if (!dbStatus) return "under-review";
  
  const normalized = String(dbStatus).trim();
  const upper = normalized.toUpperCase();
  
  // Handle legacy statuses via migration map
  if (STATUS_MIGRATION_MAP[upper] || STATUS_MIGRATION_MAP[normalized]) {
    const migratedStatus = STATUS_MIGRATION_MAP[upper] || STATUS_MIGRATION_MAP[normalized];
    return Object.entries(CARD_STATUS_CONFIG).find(
      ([_, config]) => config.dbValue === migratedStatus
    )?.[0] as CardStatus || "under-review";
  }
  
  // Map current statuses (handle both with and without hyphens)
  // Normalize by removing hyphens for comparison
  const normalizedUpper = upper.replace(/-/g, '');
  if (normalizedUpper === "UNDERREVIEW") return "under-review";
  if (normalizedUpper === "UNDERPRINTING") return "underprinting";
  if (upper === "ACTIVE") return "active";
  if (normalizedUpper === "ONHOLD") return "onhold";
  if (upper === "DELIVERED") return "delivered";
  
  // Default to under-review for unknown statuses
  return "under-review";
}

/**
 * Map UI status to database status
 */
export function mapUIStatusToDb(uiStatus: CardStatus): DbCardStatus | null {
  if (uiStatus === "all") return null;
  return CARD_STATUS_CONFIG[uiStatus]?.dbValue || null;
}

/**
 * Get status label for UI display
 */
export function getStatusLabel(status: CardStatus): string {
  return CARD_STATUS_CONFIG[status]?.label || status;
}

/**
 * Get all valid database status values
 */
export function getValidDbStatuses(): DbCardStatus[] {
  return Object.values(CARD_STATUS_CONFIG)
    .filter(config => config.dbValue !== null)
    .map(config => config.dbValue as DbCardStatus);
}

/**
 * Validate if a database status is valid
 */
export function isValidDbStatus(status: string | null | undefined): status is DbCardStatus {
  if (!status) return false;
  return getValidDbStatuses().includes(status as DbCardStatus);
}

/**
 * Normalize and migrate a database status
 */
export function normalizeDbStatus(status: string | null | undefined): DbCardStatus {
  if (!status) return DEFAULT_CARD_STATUS;
  
  const normalized = String(status).trim();
  const upper = normalized.toUpperCase();
  
  // Check migration map first
  if (STATUS_MIGRATION_MAP[upper] || STATUS_MIGRATION_MAP[normalized]) {
    return STATUS_MIGRATION_MAP[upper] || STATUS_MIGRATION_MAP[normalized];
  }
  
  // Check if it's already a valid status
  if (isValidDbStatus(normalized)) {
    return normalized;
  }
  
  // Try to match case-insensitively (handle both with and without hyphens)
  const validStatuses = getValidDbStatuses();
  const normalizedUpper = upper.replace(/-/g, '');
  const matched = validStatuses.find(s => {
    const sUpper = s.toUpperCase().replace(/-/g, '');
    return sUpper === normalizedUpper;
  });
  if (matched) return matched;
  
  // Default to UnderReview for unknown statuses
  return DEFAULT_CARD_STATUS;
}
