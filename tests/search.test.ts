// PRD A2: the right product is in the top 3 for 20 test queries,
// including typos and Hinglish spellings.
import { describe, expect, it } from "vitest";
import products from "../data/seed/products.json";
import { SearchIndex, editDistance } from "@/lib/search";
import type { Product } from "@/lib/types";

const index = new SearchIndex(products as Product[]);

const queries: [string, string][] = [
  ["amul gold", "amul-gold-milk"],
  ["amul gld milk", "amul-gold-milk"],
  ["mother dairy doodh", "mother-dairy-cow-milk"],
  ["masti dahi", "amul-masti-dahi-pouch"],
  ["aashirvad atta", "aashirvaad-superior-mp-atta"],
  ["tata namak", "tata-salt"],
  ["haldirams peanuts", "haldirams-salted-peanuts"],
  ["kelogs corn flakes", "kelloggs-corn-flakes"],
  ["saffola oats", "saffola-oats"],
  ["pintola peanut butter", "pintola-pb"],
  ["deggi mirch", "mdh-deggi-mirch"],
  ["everest kashmiri lal", "everest-kashmirilal-mirch"],
  ["sarson tel fortune", "fortune-kachi-ghani-mustard-oil"],
  ["patanjali shahad", "patanjali-honey"],
  ["parle g", "parle-g"],
  ["maggi noodels", "maggi-masala-noodles"],
  ["brooke bond taza chai", "brooke-bond-taaza"],
  ["amul makhan", "amul-butter"],
  ["bournvile 70", "cadbury-bournville-70"],
  ["nescafe clasic", "nescafe-classic"],
  ["farmley makhane", "farmley-makhana"],
  ["india gate basmati chawal", "india-gate-feast-rozzana"],
];

describe("search", () => {
  for (const [q, id] of queries) {
    it(`"${q}" finds ${id} in the top 3`, () => {
      const top = index.search(q, { limit: 3 }).map((r) => r.product.id);
      expect(top).toContain(id);
    });
  }

  it("edit distance handles swaps", () => {
    expect(editDistance("milk", "mlik")).toBe(1);
    expect(editDistance("butter", "buter")).toBe(1);
  });

  it("filters by category", () => {
    const res = index.search("amul", { category: "Ghee" });
    expect(res.every((r) => r.product.category === "Ghee")).toBe(true);
    expect(res.length).toBeGreaterThan(0);
  });
});

import { matchLine } from "@/lib/search";

describe("cart and share matching (D2, D3)", () => {
  const cases: [string, string | null][] = [
    ["Amul Taaza Toned Fresh Milk Pouch 500 ml ₹30", "amul-taaza-toned-milk"],
    ["Amul Gold Full Cream Fresh Milk Pouch · 1 L ₹72", "amul-gold-milk"],
    ["Aashirvaad Superior MP Wheat Atta 0% Maida 10 kg", "aashirvaad-superior-mp-atta"],
    ["Haldiram's Classic Salted Peanuts 200 g", "haldirams-salted-peanuts"],
    ["Kellogg's Original Corn Flakes 475 g ₹166", "kelloggs-corn-flakes"],
    ["Parle-G Gold Biscuits 1 kg", "parle-g"],
    ["Maggi 2-Minute Masala Noodles 70 g x 4", "maggi-masala-noodles"],
    ["Tata Salt Vacuum Evaporated Iodised 1 kg", "tata-salt"],
    ["Fresh Tomatoes 500 g", null],
    ["Onion 1 kg", null],
    ["Bisleri Mineral Water 1 L", null],
    ["Subtotal ₹845", null],
  ];
  for (const [line, id] of cases) {
    it(`"${line}" -> ${id ?? "no match"}`, () => {
      expect(matchLine(index, line)?.product.id ?? null).toBe(id);
    });
  }
});
