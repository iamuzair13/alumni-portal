import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { buildMappingSuggestions, normalizeSapValue, parseWorkbook, suggestTargetForHeader } from "./bulk-upload-staff";

describe("bulk-upload-staff helpers", () => {
  it("normalizes sap values", () => {
    expect(normalizeSapValue(" 12345.0 ")).toBe("12345");
    expect(normalizeSapValue("SAP-01")).toBe("sap-01");
  });

  it("suggests common header mappings", () => {
    expect(suggestTargetForHeader("SAP ID")).toBe("sapid");
    expect(suggestTargetForHeader("Employee Name")).toBe("alumniname");
    expect(buildMappingSuggestions(["SAP", "Employee Name"])["SAP"]).toBe("sapid");
  });

  it("parses first sheet, deduplicates sap rows, and rejects missing sap header", () => {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
      ["SAP", "Employee Name", "Email"],
      ["1001", "Alice Smith", "alice@example.com"],
      ["1001.0", "Duplicate Alice", "dup@example.com"],
      ["", "Ignored", "ignored@example.com"],
    ]);
    XLSX.utils.book_append_sheet(workbook, sheet, "Sheet1");
    const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }) as Buffer;
    const arrayBuffer = Uint8Array.from(buffer).buffer;

    const parsed = parseWorkbook(arrayBuffer, new Set(["1001"]));
    expect(parsed.headers).toEqual(["SAP", "Employee Name", "Email"]);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0].sap).toBe("1001");
    expect(parsed.matchedSap).toEqual(["1001"]);
    expect(parsed.duplicateSap).toEqual(["1001"]);
  });

  it("throws when SAP header is missing", () => {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
      ["Name", "Email"],
      ["Alice", "alice@example.com"],
    ]);
    XLSX.utils.book_append_sheet(workbook, sheet, "Sheet1");
    const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }) as Buffer;
    const arrayBuffer = Uint8Array.from(buffer).buffer;

    expect(() => parseWorkbook(arrayBuffer)).toThrow("Missing required SAP column");
  });
});
