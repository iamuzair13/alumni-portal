import { describe, expect, it } from "vitest";
import { buildDiscountTablePdf } from "./scholarshipDiscount";

const adm = [
  { id: 1, category_id: 1, cgpa_min: 3.0, cgpa_max: 3.25, discount_percent: 20, sort_order: 0 },
  { id: 2, category_id: 1, cgpa_min: 3.26, cgpa_max: 3.5, discount_percent: 35, sort_order: 1 },
  { id: 3, category_id: 1, cgpa_min: 3.51, cgpa_max: 3.75, discount_percent: 50, sort_order: 2 },
  { id: 4, category_id: 1, cgpa_min: 3.76, cgpa_max: 4, discount_percent: 75, sort_order: 3 },
];

describe("buildDiscountTablePdf", () => {
  it("merges two columns aligned by CGPA range", () => {
    const tui = adm.map((t) => ({ ...t, discount_percent: t.discount_percent - 5 }));
    const t = buildDiscountTablePdf({
      title: "Masters",
      columns: [
        { header: "Admission Fee Discount", tiers: adm },
        { header: "Tuition Fee Discount (CGPA Based)", tiers: tui },
      ],
    });
    expect(t.discountColHeaders).toEqual([
      "Admission Fee Discount",
      "Tuition Fee Discount (CGPA Based)",
    ]);
    expect(t.rows).toHaveLength(4);
    expect(t.rows[0]).toEqual({
      cgpaMin: 3.0,
      cgpaMax: 3.25,
      cgpa: "3.00 – 3.25",
      discounts: ["20%", "15%"],
    });
  });

  it("renders a single-column table for one category", () => {
    const t = buildDiscountTablePdf({
      title: "Kinship Masters",
      columns: [
        {
          header: "Kinship Discount\n(Tuition Fee)",
          tiers: [
            { id: 1, category_id: 2, cgpa_min: 0, cgpa_max: 4, discount_percent: 15, sort_order: 0 },
          ],
        },
      ],
    });
    expect(t.discountColHeaders).toHaveLength(1);
    expect(t.rows).toEqual([
      { cgpaMin: 0, cgpaMax: 4, cgpa: "0.00 – 4.00", discounts: ["15%"] },
    ]);
  });

  it("marks missing ranges with — when columns differ", () => {
    const t = buildDiscountTablePdf({
      title: "Masters",
      columns: [
        {
          header: "A",
          tiers: [
            { id: 1, category_id: 1, cgpa_min: 3, cgpa_max: 3.25, discount_percent: 20, sort_order: 0 },
          ],
        },
        {
          header: "B",
          tiers: [
            { id: 2, category_id: 2, cgpa_min: 3.26, cgpa_max: 3.5, discount_percent: 15, sort_order: 0 },
          ],
        },
      ],
    });
    expect(t.rows).toEqual([
      { cgpaMin: 3, cgpaMax: 3.25, cgpa: "3.00 – 3.25", discounts: ["20%", "—"] },
      { cgpaMin: 3.26, cgpaMax: 3.5, cgpa: "3.26 – 3.50", discounts: ["—", "15%"] },
    ]);
  });

  it("returns header-only model when no tiers exist", () => {
    const t = buildDiscountTablePdf({ title: "X", columns: [{ header: "H", tiers: [] }] });
    expect(t.discountColHeaders).toEqual(["H"]);
    expect(t.rows).toEqual([]);
  });
});
