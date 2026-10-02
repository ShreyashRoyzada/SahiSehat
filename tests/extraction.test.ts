// PRD B3/B5: report reading and redaction. All people here are fictional.
import { describe, expect, it } from "vitest";
import { redact } from "@/lib/extraction/redact";
import { parseDate, parseReportText } from "@/lib/extraction/parse";

const FIRST = ["Riya", "Arjun", "Meera", "Kabir", "Ananya", "Vikram", "Sunita", "Rahul", "Priya", "Imran"];
const LAST = ["Sharma", "Rao", "Iyer", "Khan", "Patel", "Singh", "Menon", "Das", "Gupta", "Reddy"];

function syntheticReport(i: number) {
  const name = `${FIRST[i % 10]} ${LAST[(i * 3) % 10]}`;
  const phone = `9${String(810000000 + i * 1234567).slice(0, 9)}`;
  const uhid = `UH${2026000 + i * 17}`;
  const lab = `LAB-${48213 + i}`;
  const formats = [
    `Patient Name : Mrs. ${name}\nAge/Sex: 34 Y / F\nUHID: ${uhid}\nMobile: +91 ${phone}\nRef. By: Dr. Anil Kumar\nSample Collected: 14/08/2026 08:10\nLab No - ${lab}\n\nHbA1c (Glycosylated Haemoglobin)  6.1  %  4.0 - 5.6  H\nLDL Cholesterol - Direct  138  mg/dL  <100  High\nTriglycerides 142 mg/dL <150\n`,
    `Name- Mr. ${name}\nAddress: 21, Shanti Nagar, Pune 411001\nEmail: ${FIRST[i % 10].toLowerCase()}@example.com\nPatient ID: ${uhid}\nCollection Date: 02-Aug-2026\nGlucose Fasting (FBS)\t108\tmg/dl\t70-100\tH\nCholesterol Total 212 mg/dL 0-200 H\nHDL Cholesterol 41 mg/dL >40\nBlood Pressure: 138/88 mmHg\nBarcode ${lab}X${i}\n`,
    `${name.toUpperCase()}\nPh ${phone}\nReg No: ${uhid}\nDate of collection: 2026-09-01\nHBA1C 48 mmol/mol\nLDL 3.6 mmol/L 0 - 2.6 H\nBranch: Andheri West Collection Centre\n`,
  ];
  return { text: formats[i % 3], identifiers: [name, phone, uhid, lab, FIRST[i % 10].toLowerCase() + "@example.com", "Anil Kumar", "Shanti Nagar", "411001", "Andheri"] };
}

describe("redaction (B5): 20 test reports leak no personal identifier", () => {
  for (let i = 0; i < 20; i++) {
    it(`report ${i + 1}`, () => {
      const { text, identifiers } = syntheticReport(i);
      const out = redact(text).text;
      for (const id of identifiers) {
        if (text.includes(id) || text.toUpperCase().includes(id.toUpperCase())) {
          expect(out.toLowerCase()).not.toContain(id.toLowerCase());
        }
      }
      // Values survive redaction.
      expect(out).toMatch(/138|108|48/);
    });
  }
});

describe("report parsing (B3)", () => {
  it("reads HbA1c, LDL and TG with flags, ranges and the sample date", () => {
    const rows = parseReportText(redact(syntheticReport(0).text).text);
    const by = Object.fromEntries(rows.map((r) => [r.marker, r]));
    expect(by.hba1c).toMatchObject({ value: 6.1, unit: "%", flag: "high", range: "4.0 - 5.6", sampleDate: "2026-08-14" });
    expect(by.ldl).toMatchObject({ value: 138, unit: "mg/dL", flag: "high" });
    expect(by.triglycerides).toMatchObject({ value: 142, flag: null });
    expect(by.hba1c.issues).toEqual([]);
  });

  it("reads tab-separated rows, blood pressure and month-name dates", () => {
    const rows = parseReportText(redact(syntheticReport(1).text).text);
    const by = Object.fromEntries(rows.map((r) => [r.marker, r]));
    expect(by["fasting-glucose"]).toMatchObject({ value: 108, unit: "mg/dL", flag: "high", sampleDate: "2026-08-02" });
    expect(by["total-cholesterol"]).toMatchObject({ value: 212, flag: "high" });
    expect(by.hdl).toMatchObject({ value: 41 });
    expect(by["systolic-bp"]).toMatchObject({ value: 138 });
    expect(by["diastolic-bp"]).toMatchObject({ value: 88 });
  });

  it("keeps SI units for conversion and flags a missing H when value is above range", () => {
    const rows = parseReportText(redact(syntheticReport(2).text).text);
    const by = Object.fromEntries(rows.map((r) => [r.marker, r]));
    expect(by.hba1c).toMatchObject({ value: 48, unit: "mmol/mol", sampleDate: "2026-09-01" });
    expect(by.ldl).toMatchObject({ value: 3.6, unit: "mmol/L", flag: "high" });
  });

  it("marks a flag that disagrees with the range", () => {
    const rows = parseReportText("Sample collected: 01/09/2026\nLDL Cholesterol 90 mg/dL <100 H");
    expect(rows[0].issues.join(" ")).toMatch(/inside the printed range/);
  });

  it("marks implausible values", () => {
    const rows = parseReportText("Sample collected: 01/09/2026\nHbA1c 61 % 4.0-5.6");
    expect(rows[0].issues.join(" ")).toMatch(/plausible/);
  });

  it("parses dates in Indian formats", () => {
    expect(parseDate("14/08/2026")).toBe("2026-08-14");
    expect(parseDate("02-Aug-2026")).toBe("2026-08-02");
    expect(parseDate("5 September 2026")).toBe("2026-09-05");
  });
});
