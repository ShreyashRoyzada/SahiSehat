// Builds the catalogue in the browser from the same seed JSON the server uses.
import products from "../data/seed/products.json";
import reports from "../data/seed/lab-reports.json";
import listings from "../data/seed/listings.json";
import { Catalogue } from "../src/lib/catalogue-core";
import { DEFAULT_RULE_TABLE } from "../src/lib/fit/rules";
import type { LabReport, Listing, Product } from "../src/lib/types";

const byReport = new Map<string, string>();
for (const p of products as Product[]) for (const r of p.reportIds) byReport.set(r, p.id);

export const AS_OF = new Date();

export const CATALOGUE = new Catalogue({
  products: products as Product[],
  reports: (reports as unknown as LabReport[]).map((r) => ({ ...r, productId: byReport.get(r.id) ?? null })),
  gates: new Map(),
  // Same starting point as the server app: no source licensed yet, so lab results are link-out only.
  licences: { "Trustified Pass/Fail": "pending", "Trustified NMR": "pending", "The Whole Truth hub": "pending", "Unbox Health": "link-only" },
  listings: listings as Listing[],
  rules: DEFAULT_RULE_TABLE,
  asOf: AS_OF,
});
