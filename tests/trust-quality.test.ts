// Lab display rules (MVP scope, A3, A5, G2) and the Quality Score (A4, C5).
import { describe, expect, it } from "vitest";
import products from "../data/seed/products.json";
import reports from "../data/seed/lab-reports.json";
import { displayReport, gateComplete, swapBlock } from "@/lib/trust";
import { computeQuality } from "@/lib/quality";
import type { GateRecord, LabReport, Product } from "@/lib/types";
import { AS_OF } from "./fixtures";

const byId = Object.fromEntries((reports as unknown as LabReport[]).map((r) => [r.id, r]));
const amulGold = byId.R001; // Failed, Feb 2026
const taaza = byId.R002; // Passed, Feb 2026
const bread = byId.R043; // Passed, Dec 2024 (stale)

const fullGate = (over: Partial<GateRecord> = {}): GateRecord => ({
  reportId: "R001",
  checklist: { reportLinked: true, batchLabDateShown: true, templateWording: true, brandNotified: true, correctionPath: true },
  brandNotifiedAt: "2026-09-01T00:00:00Z",
  brandReply: null,
  approvedBy: "counsel@example.com",
  approvedAt: "2026-09-20T00:00:00Z",
  ...over,
});

describe("lab display rules", () => {
  it("licence pending: any report shows only 'Lab report on file' and no verdict", () => {
    for (const r of [amulGold, taaza]) {
      const d = displayReport(r, "pending", null, AS_OF);
      expect(d.label).toBe("Lab report on file");
      expect(d.showDetails).toBe(false);
      expect(d.countsTowardScore).toBe(false);
    }
  });

  it("licence granted: Passed shows and counts", () => {
    const d = displayReport(taaza, "granted", null, AS_OF);
    expect(d.label).toBe("Passed");
    expect(d.lValue).toBe(100);
  });

  it("a Failed result never renders without a recorded gate approval", () => {
    expect(displayReport(amulGold, "granted", null, AS_OF).label).toBe("Lab report on file");
    expect(displayReport(amulGold, "granted", fullGate({ approvedBy: null }), AS_OF).label).toBe("Lab report on file");
    expect(displayReport(amulGold, "granted", fullGate(), AS_OF).label).toBe("Failed lab test");
  });

  it("the 7-day brand reply window must have passed", () => {
    const g = fullGate({ brandNotifiedAt: "2026-09-28T00:00:00Z" });
    expect(gateComplete(g, AS_OF).missing).toContain("7-day reply window still open");
  });

  it("results older than 12 months show as Stale and stop counting (A5)", () => {
    const d = displayReport(bread, "granted", null, AS_OF);
    expect(d.stale).toBe(true);
    expect(d.label).toMatch(/Stale/);
    expect(d.countsTowardScore).toBe(false);
  });

  it("competitor ratings are link-out only", () => {
    const d = displayReport(byId.R012, "link-only", null, AS_OF);
    expect(d.label).toMatch(/Unbox/);
    expect(d.showDetails).toBe(false);
  });

  it("C5: a product whose latest report failed is held from swaps even before the gate", () => {
    const pending = displayReport(amulGold, "pending", null, AS_OF);
    expect(swapBlock([pending])).toMatch(/Held back/);
    const approved = displayReport(amulGold, "granted", fullGate(), AS_OF);
    expect(swapBlock([approved])).toMatch(/Failed lab test/);
    expect(swapBlock([displayReport(taaza, "granted", null, AS_OF)])).toBeNull();
  });
});

describe("Quality Score", () => {
  const all = products as Product[];
  const p = (id: string) => all.find((x) => x.id === id)!;

  it("every product with label data gets a score and an evidence level", () => {
    for (const prod of all.filter((x) => x.labelSource.kind !== "missing")) {
      const q = computeQuality(prod, []);
      expect(q.score, prod.id).not.toBeNull();
      expect(q.evidence).toBe("label-analysed");
    }
  });

  it("products without label data read Insufficient data with no score", () => {
    const q = computeQuality(p("epigamia-turbo"), []);
    expect(q.score).toBeNull();
    expect(q.evidence).toBe("insufficient");
  });

  it("a displayable failed critical test caps the score at 40", () => {
    const d = displayReport(amulGold, "granted", fullGate(), AS_OF);
    const q = computeQuality(p("amul-gold-milk"), [d]);
    expect(q.score).toBeLessThanOrEqual(40);
    expect(q.capped).toBe(true);
  });

  it("a fresh Passed report makes the product Lab-verified", () => {
    const q = computeQuality(p("amul-taaza-toned-milk"), [displayReport(taaza, "granted", null, AS_OF)]);
    expect(q.evidence).toBe("lab-verified");
  });

  it("orders obvious pairs sensibly", () => {
    const score = (id: string) => computeQuality(p(id), []).score!;
    expect(score("quaker-rolled-oats")).toBeGreaterThan(score("kelloggs-chocos"));
    expect(score("tropicana-orange-100")).toBeGreaterThan(score("coca-cola"));
    expect(score("fortune-kachi-ghani-mustard-oil")).toBeGreaterThan(score("dalda-vanaspati"));
    expect(score("alpino-natural-pb")).toBeGreaterThan(score("sundrop-pb-creamy"));
  });
});
