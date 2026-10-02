// The pure cores behind both the server app and the browser demo build.
import { describe, expect, it } from "vitest";
import products from "../data/seed/products.json";
import reports from "../data/seed/lab-reports.json";
import listings from "../data/seed/listings.json";
import { Catalogue } from "@/lib/catalogue-core";
import { DEFAULT_RULE_TABLE } from "@/lib/fit/rules";
import { evaluator } from "@/lib/personal";
import { checkCart } from "@/lib/cart-core";
import { rulesAnswer } from "@/lib/assistant/rules";
import { RIYA } from "@/lib/demo";
import type { LabReport, Listing, Product } from "@/lib/types";
import { AS_OF } from "./fixtures";

const byReport = new Map<string, string>();
for (const p of products as Product[]) for (const r of p.reportIds) byReport.set(r, p.id);
const cat = new Catalogue({
  products: products as Product[],
  reports: (reports as unknown as LabReport[]).map((r) => ({ ...r, productId: byReport.get(r.id) ?? null })),
  gates: new Map(),
  licences: { "Trustified Pass/Fail": "pending", "Trustified NMR": "pending", "The Whole Truth hub": "pending", "Unbox Health": "link-only" },
  listings: listings as Listing[],
  rules: DEFAULT_RULE_TABLE,
  asOf: AS_OF,
});
const riya = evaluator(cat, RIYA, AS_OF);

describe("catalogue core", () => {
  it("builds all products", () => expect(cat.list.length).toBe(157));
  it("Amul Gold is not a good fit for Riya and swaps to double toned milk", () => {
    const v = cat.getView("amul-gold-milk")!;
    expect(riya.fit(v)!.verdict).toBe("not-good");
    expect(riya.swaps(v).swaps[0].product.id).toBe("mother-dairy-double-toned-milk");
  });
  it("failed-report products are never offered as swaps", () => {
    for (const v of cat.list) for (const s of riya.swaps(v).swaps) expect(cat.getView(s.product.id)!.swapBlock).toBeNull();
  });
});

describe("cart core", () => {
  it("matches items, lists unmatched and finds swaps", () => {
    const r = checkCart("Amul Gold Full Cream Fresh Milk Pouch 500 ml ₹36\nParle-G Gold Biscuits 1 kg\nFresh Tomatoes 500 g", riya);
    expect(r.matched.map((m) => m.productId)).toEqual(["amul-gold-milk", "parle-g"]);
    expect(r.unmatched).toEqual(["Fresh Tomatoes 500 g"]);
    expect(r.swaps.length).toBeGreaterThan(0);
  });
});

describe("assistant rules engine", () => {
  it("ranks a category for the person with sources", () => {
    const a = rulesAnswer("Which biscuits suit me?", riya);
    expect(a.items.length).toBeGreaterThan(0);
    expect(a.sources.length).toBeGreaterThan(0);
  });
  it("explains a verdict", () => {
    const a = rulesAnswer("Why is Amul Gold milk not sahi for me?", riya);
    expect(a.text).toMatch(/Not sahi for you/);
  });
});
