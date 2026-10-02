// The catalogue as an in-memory object: product views (lab display, Quality
// Score, swap gate, listings), search and matching. Pure, so the same code
// backs the server app and the browser-only demo build.

import type { GateRecord, LabReport, Listing, Product, SourceLicence } from "./types";
import { displayReport, sortReports, swapBlock, type ReportDisplay } from "./trust";
import { computeQuality, type QualityResult } from "./quality";
import { SearchIndex, matchLine } from "./search";
import type { RuleTable } from "./fit/rules";

export type ProductView = {
  product: Product;
  reports: ReportDisplay[];
  quality: QualityResult;
  swapBlock: string | null;
  listings: Listing[];
};

export type CatalogueInput = {
  products: Product[];
  reports: LabReport[];
  gates: Map<string, GateRecord>;
  licences: Record<string, SourceLicence>;
  listings: Listing[];
  rules: RuleTable;
  asOf: Date;
};

export class Catalogue {
  readonly views = new Map<string, ProductView>();
  readonly list: ProductView[];
  readonly index: SearchIndex;
  readonly rules: RuleTable;
  readonly licences: Record<string, SourceLicence>;

  constructor(input: CatalogueInput) {
    this.rules = input.rules;
    this.licences = input.licences;
    const byProduct = new Map<string, LabReport[]>();
    for (const r of input.reports) {
      if (!r.productId) continue;
      byProduct.set(r.productId, [...(byProduct.get(r.productId) ?? []), r]);
    }
    for (const p of input.products) {
      const displays = sortReports(byProduct.get(p.id) ?? []).map((r) => displayReport(r, input.licences[r.source] ?? "pending", input.gates.get(r.id), input.asOf));
      const quality = computeQuality(p, displays);
      this.views.set(p.id, {
        product: p,
        reports: displays,
        quality,
        swapBlock: quality.score === null ? "Insufficient data, so it isn't suggested as a swap." : swapBlock(displays),
        listings: p.qcKey ? input.listings.filter((l) => l.qcKey === p.qcKey) : [],
      });
    }
    this.list = [...this.views.values()];
    this.index = new SearchIndex(this.list.map((v) => v.product));
  }

  getView(id: string): ProductView | null {
    return this.views.get(id) ?? null;
  }

  categories(): { name: string; count: number }[] {
    const counts = new Map<string, number>();
    for (const v of this.list) counts.set(v.product.category, (counts.get(v.product.category) ?? 0) + 1);
    return [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name));
  }

  search(q: string, opts: { category?: string; limit?: number } = {}): ProductView[] {
    if (!q.trim()) {
      const pool = opts.category ? this.list.filter((v) => v.product.category === opts.category) : this.list;
      return [...pool].sort((a, b) => (a.product.qcLine?.rank ?? 999) - (b.product.qcLine?.rank ?? 999) || a.product.brand.localeCompare(b.product.brand)).slice(0, opts.limit ?? 200);
    }
    return this.index.search(q, opts).map((r) => this.views.get(r.product.id)!).filter(Boolean);
  }

  /** Match a shared link from a quick-commerce app to a product (PRD D2). */
  matchByUrl(url: string): ProductView | null {
    const norm = (u: string) => u.replace(/^https?:\/\/(www\.)?/, "").replace(/[?#].*$/, "").replace(/\/$/, "").toLowerCase();
    const target = norm(url);
    if (!target) return null;
    return this.list.find((v) => v.listings.some((l) => norm(l.url) === target)) ?? null;
  }

  matchText(line: string): ProductView | null {
    const hit = matchLine(this.index, line);
    return hit ? this.views.get(hit.product.id) ?? null : null;
  }
}
