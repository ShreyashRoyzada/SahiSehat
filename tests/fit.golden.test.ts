// Golden Fit cases (PRD C8): the cases live in src/lib/fit/golden.ts.
import { describe, expect, it } from "vitest";
import { computeFit } from "@/lib/fit/engine";
import { DEFAULT_RULE_TABLE } from "@/lib/fit/rules";
import { GOLDEN_CASES, runGolden } from "@/lib/fit/golden";
import { AS_OF, crunchyOatsCookies, marker, profile, riya } from "./fixtures";

const salty = GOLDEN_CASES.find((c) => c.product.id === "salty-noodles")!.product;

describe("golden Fit cases", () => {
  it("has at least 30 cases", () => expect(GOLDEN_CASES.length).toBeGreaterThanOrEqual(30));
  for (const c of GOLDEN_CASES) {
    it(c.name, () => {
      const r = computeFit({ profile: c.profile, markers: c.markers, product: c.product, rules: DEFAULT_RULE_TABLE, asOf: AS_OF });
      expect(r.verdict).toBe(c.expect);
      const text = [...r.reasons.map((x) => `${x.text} ${x.trigger ?? ""}`), r.note ?? ""].join(" | ");
      for (const s of c.reasonIncludes ?? []) expect(text).toContain(s);
    });
  }
  it("runGolden agrees", () => expect(runGolden(DEFAULT_RULE_TABLE).failed).toEqual([]));
  it("runGolden catches a broken rule table", () => {
    const broken = { ...DEFAULT_RULE_TABLE, bands: { good: 0.6, small: 0.8 } };
    expect(runGolden(broken).failed.length).toBeGreaterThan(0);
  });
});
describe("Fit engine properties", () => {
  it("is deterministic: same inputs, same verdict and hash", () => {
    const a = computeFit({ ...riya, product: crunchyOatsCookies, rules: DEFAULT_RULE_TABLE, asOf: AS_OF });
    const b = computeFit({ ...riya, product: crunchyOatsCookies, rules: DEFAULT_RULE_TABLE, asOf: AS_OF });
    expect(a).toEqual(b);
    expect(a.inputsHash).toHaveLength(32);
  });

  it("never puts raw marker values into the inputs hash payload", () => {
    const a = computeFit({ ...riya, product: crunchyOatsCookies, rules: DEFAULT_RULE_TABLE, asOf: AS_OF });
    const other = { profile: riya.profile, markers: [marker("hba1c", 6.4, "2026-08-14", "high"), marker("ldl", 150, "2026-08-14", "high")] };
    const b = computeFit({ ...other, product: crunchyOatsCookies, rules: DEFAULT_RULE_TABLE, asOf: AS_OF });
    expect(a.inputsHash).toBe(b.inputsHash); // same rule sets and triggers -> same hash
  });

  it("shows at most three reasons and records the rule version", () => {
    const r = computeFit({ profile: profile({ conditions: ["diabetes", "high-cholesterol", "high-bp"] }), markers: [], product: crunchyOatsCookies, rules: DEFAULT_RULE_TABLE, asOf: AS_OF });
    expect(r.reasons.length).toBeLessThanOrEqual(3);
    expect(r.ruleVersion).toBe(DEFAULT_RULE_TABLE.version);
    expect(r.ruleSets.sort()).toEqual(["BP", "BS", "CH"]);
  });

  it("verdict text never names a disease", () => {
    const r = computeFit({ profile: profile({ conditions: ["diabetes", "high-bp", "high-cholesterol"] }), markers: [], product: salty, rules: DEFAULT_RULE_TABLE, asOf: AS_OF });
    const text = JSON.stringify(r).toLowerCase();
    expect(text).not.toMatch(/diabet|hypertension|cure|reverse/);
  });
});
