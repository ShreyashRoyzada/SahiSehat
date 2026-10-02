import "server-only";
import type { GateRecord, LabReport, Listing, Product, SourceLicence } from "../types";
import { appDb } from "./db";
import { asOfDate } from "../dates";
import { displayReport, sortReports, swapBlock, type ReportDisplay } from "../trust";
import { computeQuality, type QualityResult } from "../quality";
import { SearchIndex, matchLine } from "../search";
import type { RuleTable } from "../fit/rules";

export type ProductView = {
  product: Product;
  reports: ReportDisplay[];
  quality: QualityResult;
  swapBlock: string | null;
  listings: Listing[];
};

type Cache = {
  views: Map<string, ProductView>;
  list: ProductView[];
  index: SearchIndex;
  rules: RuleTable;
  licences: Record<string, SourceLicence>;
  builtAt: number;
};

const g = globalThis as unknown as { __sahiCatalogue?: Cache };

/** Catalogue mode: "preview" shows draft records with a badge; "beta" shows only published ones. */
export function catalogueMode(): "preview" | "beta" {
  return process.env.CATALOGUE_MODE === "beta" ? "beta" : "preview";
}

export function invalidateCatalogue() {
  g.__sahiCatalogue = undefined;
}

function build(): Cache {
  const db = appDb();
  const products = (db.prepare("SELECT data FROM products").all() as { data: string }[]).map((r) => JSON.parse(r.data) as Product);
  const reports = (db.prepare("SELECT data FROM lab_reports WHERE product_id IS NOT NULL").all() as { data: string }[]).map((r) => JSON.parse(r.data) as LabReport);
  const gates = new Map((db.prepare("SELECT report_id, data FROM gates").all() as { report_id: string; data: string }[]).map((r) => [r.report_id, JSON.parse(r.data) as GateRecord]));
  const licences = Object.fromEntries((db.prepare("SELECT name, licence FROM sources").all() as { name: string; licence: SourceLicence }[]).map((r) => [r.name, r.licence]));
  const listings = (db.prepare("SELECT data FROM listings").all() as { data: string }[]).map((r) => JSON.parse(r.data) as Listing);
  const ruleRow = db.prepare("SELECT data FROM rule_tables WHERE active = 1 LIMIT 1").get() as { data: string } | undefined;
  const rules = JSON.parse(ruleRow!.data) as RuleTable;
  const asOf = asOfDate();

  const reportsByProduct = new Map<string, LabReport[]>();
  for (const r of reports) {
    if (!r.productId) continue;
    reportsByProduct.set(r.productId, [...(reportsByProduct.get(r.productId) ?? []), r]);
  }

  const visible = catalogueMode() === "beta" ? products.filter((p) => p.status === "published") : products;
  const views = new Map<string, ProductView>();
  for (const p of visible) {
    const displays = sortReports(reportsByProduct.get(p.id) ?? []).map((r) => displayReport(r, licences[r.source] ?? "pending", gates.get(r.id), asOf));
    const quality = computeQuality(p, displays);
    views.set(p.id, {
      product: p,
      reports: displays,
      quality,
      swapBlock: quality.score === null ? "Insufficient data, so it isn't suggested as a swap." : swapBlock(displays),
      listings: p.qcKey ? listings.filter((l) => l.qcKey === p.qcKey) : [],
    });
  }
  const list = [...views.values()];
  return { views, list, index: new SearchIndex(list.map((v) => v.product)), rules, licences, builtAt: Date.now() };
}

export function catalogue(): Cache {
  if (!g.__sahiCatalogue) g.__sahiCatalogue = build();
  return g.__sahiCatalogue;
}

export const getView = (id: string) => catalogue().views.get(id) ?? null;
export const activeRules = () => catalogue().rules;

export function categories(): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const v of catalogue().list) counts.set(v.product.category, (counts.get(v.product.category) ?? 0) + 1);
  return [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name));
}

export function searchViews(q: string, opts: { category?: string; limit?: number } = {}): ProductView[] {
  const c = catalogue();
  if (!q.trim()) {
    const pool = opts.category ? c.list.filter((v) => v.product.category === opts.category) : c.list;
    return [...pool].sort((a, b) => (a.product.qcLine?.rank ?? 999) - (b.product.qcLine?.rank ?? 999) || a.product.brand.localeCompare(b.product.brand)).slice(0, opts.limit ?? 200);
  }
  return c.index.search(q, opts).map((r) => c.views.get(r.product.id)!).filter(Boolean);
}

/** Match a shared link from a quick-commerce app to a product (PRD D2). */
export function matchByUrl(url: string): ProductView | null {
  const norm = (u: string) => u.replace(/^https?:\/\/(www\.)?/, "").replace(/[?#].*$/, "").replace(/\/$/, "").toLowerCase();
  const target = norm(url);
  if (!target) return null;
  for (const v of catalogue().list) {
    if (v.listings.some((l) => norm(l.url) === target)) return v;
  }
  return null;
}

export function matchText(line: string): ProductView | null {
  const hit = matchLine(catalogue().index, line);
  return hit ? catalogue().views.get(hit.product.id) ?? null : null;
}
