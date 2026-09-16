"use client";

import * as XLSX from "xlsx";

export type BulkUploadGroup = "Basic" | "Performance" | "Compensation";
export type BulkUploadFieldType = "text" | "number" | "date" | "textarea" | "select";

export type BulkUploadColumnMeta = {
  id: string;
  label: string;
  group: BulkUploadGroup;
  fieldType: BulkUploadFieldType;
  persistable: boolean;
  readonly?: boolean;
  aliases: string[];
  options?: Array<{ value: string; label: string }>;
};

export type BulkUploadStaffRow = {
  sapid: string;
  alumniname: string | null;
  personalemail: string | null;
  officialemail: string | null;
  faculty: string | null;
  department: string | null;
  program: string | null;
  yearofending: number | null;
  designation: string | null;
  nameoforganization: string | null;
  work_city: string | null;
  work_country: string | null;
  campusname: string | null;
  category: string | null;
  verify: string | null;
  contactno: string | null;
  contactno1: string | null;
  occupation_transition_timing: string | null;
  employeed: string | null;
  cnicpassport: string | null;
  lasttimelogin: string | null;
  logincount: number | null;
  [key: string]: string | number | boolean | null;
};

export type BulkUploadExcelRow = {
  rowNumber: number;
  sap: string;
  raw: Record<string, string>;
};

export type BulkUploadParsedWorkbook = {
  sheetName: string;
  headers: string[];
  rows: BulkUploadExcelRow[];
  matchedSap: string[];
  unmatchedSap: string[];
  duplicateSap: string[];
};

export type BulkUploadMapping = Record<string, string | "__skip__">;

export type BulkUploadIssue = {
  rowNumber: number;
  sap: string;
  name: string;
  message: string;
};

export type BulkUploadDraft = {
  sap: string;
  name: string;
  isNew: boolean;
  updates: Record<string, string | number | boolean | null>;
  sourceRowNumber: number;
};

export type BulkUploadPlan = {
  drafts: BulkUploadDraft[];
  issues: BulkUploadIssue[];
  changedCount: number;
  createCount: number;
};

export const bulkUploadColumns: BulkUploadColumnMeta[] = [
  {
    id: "sapid",
    label: "SAP",
    group: "Basic",
    fieldType: "text",
    persistable: false,
    readonly: true,
    aliases: ["sap", "sap id", "sap code", "employee id", "employee id.", "employeeid", "sapid"],
  },
  {
    id: "alumniname",
    label: "Employee Name",
    group: "Basic",
    fieldType: "text",
    persistable: true,
    aliases: ["name", "employee name", "full name", "alumniname", "alumni name"],
  },
  {
    id: "personalemail",
    label: "Personal Email",
    group: "Basic",
    fieldType: "text",
    persistable: true,
    aliases: ["personal email", "email", "email address", "personalemail"],
  },
  {
    id: "officialemail",
    label: "Official Email",
    group: "Basic",
    fieldType: "text",
    persistable: true,
    aliases: ["official email", "work email", "officialemail"],
  },
  {
    id: "faculty",
    label: "Org Level 1",
    group: "Basic",
    fieldType: "select",
    persistable: true,
    aliases: ["org level 1", "org1", "faculty", "faculty name", "facultyname", "org1 name"],
  },
  {
    id: "department",
    label: "Org Level 2",
    group: "Basic",
    fieldType: "select",
    persistable: true,
    aliases: ["org level 2", "org2", "department", "department name", "departmentname", "org2 name"],
  },
  {
    id: "campusname",
    label: "Campus",
    group: "Basic",
    fieldType: "select",
    persistable: true,
    aliases: ["campus", "campus name"],
  },
  {
    id: "category",
    label: "Employee Category",
    group: "Basic",
    fieldType: "select",
    persistable: true,
    aliases: ["category", "employee category"],
  },
  {
    id: "subcategory",
    label: "Employee Sub-Category",
    group: "Basic",
    fieldType: "select",
    persistable: true,
    aliases: ["sub category", "sub-category", "subcategory"],
  },
  {
    id: "formTemplateId",
    label: "Form Template",
    group: "Basic",
    fieldType: "select",
    persistable: true,
    aliases: ["form", "form template", "template", "template id"],
  },
  {
    id: "managerSap",
    label: "Manager 1",
    group: "Basic",
    fieldType: "select",
    persistable: false,
    aliases: ["manager", "manager 1", "reporting manager"],
  },
  {
    id: "manager2Sap",
    label: "Manager 2",
    group: "Basic",
    fieldType: "select",
    persistable: false,
    aliases: ["manager 2", "second manager"],
  },
  {
    id: "verify",
    label: "Verification Status",
    group: "Basic",
    fieldType: "select",
    persistable: true,
    aliases: ["verify", "status", "verification"],
  },
  {
    id: "designation",
    label: "Designation",
    group: "Performance",
    fieldType: "text",
    persistable: true,
    aliases: ["designation", "job title", "role"],
  },
  {
    id: "nameoforganization",
    label: "Organization",
    group: "Performance",
    fieldType: "text",
    persistable: true,
    aliases: ["organization", "company", "nameoforganization", "employer"],
  },
  {
    id: "work_country",
    label: "Work Country",
    group: "Performance",
    fieldType: "select",
    persistable: true,
    aliases: ["work country", "country"],
  },
  {
    id: "work_city",
    label: "Work City",
    group: "Performance",
    fieldType: "select",
    persistable: true,
    aliases: ["work city", "city"],
  },
  {
    id: "occupation_transition_timing",
    label: "Transition Timing",
    group: "Performance",
    fieldType: "text",
    persistable: true,
    aliases: ["transition timing", "occupation transition timing"],
  },
  {
    id: "employeed",
    label: "Employment Status",
    group: "Performance",
    fieldType: "select",
    persistable: true,
    aliases: ["employment status", "employed", "employeed"],
  },
  {
    id: "program",
    label: "Degree",
    group: "Compensation",
    fieldType: "text",
    persistable: true,
    aliases: ["degree", "degree title", "degreetitle", "program"],
  },
  {
    id: "salary",
    label: "Salary",
    group: "Compensation",
    fieldType: "number",
    persistable: false,
    aliases: ["salary", "compensation"],
  },
  {
    id: "adjustment",
    label: "Adjustment",
    group: "Compensation",
    fieldType: "number",
    persistable: false,
    aliases: ["adjustment", "increment", "allowance"],
  },
  {
    id: "calibrationFactor",
    label: "Calibration Factor",
    group: "Compensation",
    fieldType: "number",
    persistable: false,
    aliases: ["calibration", "calibration factor", "factor"],
  },
  {
    id: "yearofending",
    label: "Year of Ending",
    group: "Compensation",
    fieldType: "number",
    persistable: true,
    aliases: ["year of ending", "passing year", "year"],
  },
  {
    id: "contactno",
    label: "Contact No",
    group: "Compensation",
    fieldType: "text",
    persistable: true,
    aliases: ["contact no", "mobile", "phone"],
  },
  {
    id: "contactno1",
    label: "Contact No 2",
    group: "Compensation",
    fieldType: "text",
    persistable: true,
    aliases: ["contact no 2", "alternate contact", "phone 2"],
  },
  {
    id: "cnicpassport",
    label: "CNIC / Passport",
    group: "Compensation",
    fieldType: "text",
    persistable: true,
    aliases: ["cnic", "passport", "cnic/passport"],
  },
  {
    id: "lasttimelogin",
    label: "Date of Joining",
    group: "Compensation",
    fieldType: "date",
    persistable: true,
    aliases: ["date of joining", "joining date", "last login", "date"],
  },
  {
    id: "logincount",
    label: "Login Count",
    group: "Performance",
    fieldType: "number",
    persistable: true,
    aliases: ["login count", "count"],
  },
  {
    id: "remarks",
    label: "Remarks",
    group: "Compensation",
    fieldType: "textarea",
    persistable: true,
    aliases: ["remarks", "notes", "comment"],
  },
];

const SAP_ALIASES = bulkUploadColumns.find((c) => c.id === "sapid")?.aliases ?? [];

export function normalizeSapValue(input: unknown): string {
  const raw = String(input ?? "").trim();
  if (!raw) return "";
  const compact = raw.replace(/\s+/g, "");
  if (/^\d+\.0+$/.test(compact)) {
    return compact.replace(/\.0+$/, "");
  }
  return compact.toLowerCase();
}

export function normalizeHeader(input: unknown): string {
  return String(input ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\u0000-\u001f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isSapHeader(input: unknown): boolean {
  const header = normalizeHeader(input);
  return SAP_ALIASES.some((alias) => normalizeHeader(alias) === header);
}

export function getColumnById(columnId: string) {
  return bulkUploadColumns.find((column) => column.id === columnId) ?? null;
}

export function suggestTargetForHeader(header: string): string | "__skip__" {
  const normalized = normalizeHeader(header);
  if (!normalized) return "__skip__";
  const column = bulkUploadColumns.find((meta) => meta.aliases.some((alias) => normalizeHeader(alias) === normalized));
  return column?.id ?? "__skip__";
}

export function parseWorkbook(file: ArrayBuffer, matchedSapLookup?: Set<string>): BulkUploadParsedWorkbook {
  const workbook = XLSX.read(file, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("No worksheet found in Excel file");
  }

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, { header: 1, defval: "" });
  const headers = (rows[0] ?? []).map((v) => String(v ?? "").trim());
  const sapIndex = headers.findIndex((header) => isSapHeader(header));
  if (sapIndex < 0) {
    throw new Error("Missing required SAP column");
  }

  const seen = new Set<string>();
  const parsed: BulkUploadExcelRow[] = [];
  const duplicateSap: string[] = [];
  const matched = new Set<string>();
  const unmatched = new Set<string>();

  rows.slice(1).forEach((row, index) => {
    const rowNumber = index + 2;
    const raw: Record<string, string> = {};
    headers.forEach((header, headerIndex) => {
      raw[header] = String(row?.[headerIndex] ?? "").trim();
    });

    const sap = normalizeSapValue(row?.[sapIndex]);
    if (!sap) return;
    if (seen.has(sap)) {
      duplicateSap.push(sap);
      return;
    }
    seen.add(sap);
    parsed.push({ rowNumber, sap, raw });
    if (matchedSapLookup?.has(sap)) matched.add(sap);
    else unmatched.add(sap);
  });

  return {
    sheetName,
    headers,
    rows: parsed,
    matchedSap: Array.from(matched),
    unmatchedSap: Array.from(unmatched),
    duplicateSap,
  };
}

export function buildMappingSuggestions(headers: string[]): BulkUploadMapping {
  const mapping: BulkUploadMapping = {};
  headers.forEach((header) => {
    mapping[header] = suggestTargetForHeader(header);
  });
  return mapping;
}

export function normalizeCellValue(value: unknown, fieldType: BulkUploadFieldType): string | number | boolean | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;

  if (fieldType === "number") {
    const compact = text.replace(/,/g, "");
    const parsed = Number(compact);
    return Number.isFinite(parsed) ? parsed : text;
  }

  if (fieldType === "date") {
    const d = new Date(text);
    if (!Number.isNaN(d.getTime())) {
      return d.toISOString().slice(0, 10);
    }
    return text;
  }

  return text;
}

export function buildDraftsFromParsedRows(
  rows: BulkUploadExcelRow[],
  mapping: BulkUploadMapping,
  staffBySap: Map<string, BulkUploadStaffRow>
): BulkUploadPlan {
  const issues: BulkUploadIssue[] = [];
  const drafts: BulkUploadDraft[] = [];
  let changedCount = 0;
  let createCount = 0;

  rows.forEach((row) => {
    const targetSap = normalizeSapValue(row.sap);
    const current = staffBySap.get(targetSap) ?? null;
    const isNew = !current;
    const updates: Record<string, string | number | boolean | null> = {};

    Object.entries(mapping).forEach(([header, fieldId]) => {
      if (fieldId === "__skip__") return;
      const column = getColumnById(fieldId);
      if (!column || fieldId === "sapid") return;
      const rawValue = row.raw[header];
      const nextValue = normalizeCellValue(rawValue, column.fieldType);
      if (nextValue === null) return;
      updates[fieldId] = nextValue;
    });

    if (isNew) {
      createCount += 1;
      drafts.push({
        sap: targetSap,
        name: String(updates.alumniname ?? "").trim(),
        isNew: true,
        updates: { sapid: targetSap, ...updates },
        sourceRowNumber: row.rowNumber,
      });
      return;
    }

    const diff: Record<string, string | number | boolean | null> = {};
    Object.entries(updates).forEach(([key, value]) => {
      const currentValue = current?.[key];
      if (String(currentValue ?? "") !== String(value ?? "")) {
        diff[key] = value;
      }
    });

    if (Object.keys(diff).length > 0) {
      changedCount += 1;
      drafts.push({
        sap: targetSap,
        name: String(current?.alumniname ?? updates.alumniname ?? "").trim(),
        isNew: false,
        updates: diff,
        sourceRowNumber: row.rowNumber,
      });
    }
  });

  if (drafts.length === 0) {
    issues.push({
      rowNumber: 0,
      sap: "",
      name: "",
      message: "No changes",
    });
  }

  return { drafts, issues, changedCount, createCount };
}

export function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}
