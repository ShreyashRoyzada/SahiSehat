import { describe, expect, it } from "vitest";
import { checkPlausible, fromCanonical, hba1cMmolMolToPercent, hba1cPercentToMmolMol, matchMarkerName, toCanonical } from "@/lib/units";

describe("unit conversions (PRD B2)", () => {
  it("glucose mmol/L -> mg/dL", () => expect(toCanonical("fasting-glucose", 5.6, "mmol/L")).toBeCloseTo(100.8, 1));
  it("glucose mg/dL -> mmol/L", () => expect(fromCanonical("fasting-glucose", 126, "mmol/L")).toBeCloseTo(7.0, 1));
  it("LDL mmol/L -> mg/dL", () => expect(toCanonical("ldl", 3.4, "mmol/L")).toBeCloseTo(131.5, 0));
  it("triglycerides mmol/L -> mg/dL", () => expect(toCanonical("triglycerides", 1.7, "mmol/L")).toBeCloseTo(150.6, 0));
  it("HbA1c 48 mmol/mol = 6.5%", () => expect(hba1cMmolMolToPercent(48)).toBeCloseTo(6.5, 1));
  it("HbA1c 5.7% = 39 mmol/mol", () => expect(hba1cPercentToMmolMol(5.7)).toBeCloseTo(39, 0));
  it("HbA1c round trip", () => expect(hba1cMmolMolToPercent(hba1cPercentToMmolMol(7.2))).toBeCloseTo(7.2, 5));
});

describe("plausible ranges", () => {
  it("accepts a normal HbA1c", () => expect(checkPlausible("hba1c", 6.1, "%").ok).toBe(true));
  it("rejects HbA1c typed as mmol/mol under %", () => expect(checkPlausible("hba1c", 48, "%").ok).toBe(false));
  it("accepts HbA1c in mmol/mol", () => {
    const r = checkPlausible("hba1c", 48, "mmol/mol");
    expect(r.ok && r.canonical).toBeCloseTo(6.54, 1);
  });
  it("rejects impossible blood pressure", () => expect(checkPlausible("systolic-bp", 400, "mmHg").ok).toBe(false));
  it("rejects glucose in the wrong unit", () => expect(checkPlausible("fasting-glucose", 5.6, "mg/dL").ok).toBe(false));
  it("rejects non-numbers", () => expect(checkPlausible("ldl", Number.NaN, "mg/dL").ok).toBe(false));
});

describe("marker name matching", () => {
  const cases: [string, string | null][] = [
    ["HbA1c (Glycosylated Haemoglobin)", "hba1c"],
    ["Glucose Fasting (FBS)", "fasting-glucose"],
    ["Fasting Blood Sugar", "fasting-glucose"],
    ["LDL Cholesterol - Direct", "ldl"],
    ["HDL Cholesterol", "hdl"],
    ["VLDL Cholesterol", null],
    ["Triglycerides", "triglycerides"],
    ["Cholesterol Total", "total-cholesterol"],
    ["Total Cholesterol/HDL Ratio", null],
    ["LDL/HDL Ratio", null],
    ["Haemoglobin", null],
  ];
  for (const [raw, want] of cases) it(raw, () => expect(matchMarkerName(raw)).toBe(want));
});
