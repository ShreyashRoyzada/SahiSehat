import "server-only";
import type { GateRecord, LabReport, Listing, Product, SourceLicence } from "../types";
import { appDb } from "./db";
import { asOfDate } from "../dates";
import { Catalogue } from "../catalogue-core";
import type { RuleTable } from "../fit/rules";

export type { ProductView } from "../catalogue-core";

const g = globalThis as unknown as { __sahiCatalogue?: Catalogue };

/** Catalogue mode: "preview" shows draft records with a badge; "beta" shows only published ones. */
export function catalogueMode(): "preview" | "beta" {
  return process.env.CATALOGUE_MODE === "beta" ? "beta" : "preview";
}

export function invalidateCatalogue() {
  g.__sahiCatalogue = undefined;
}

function build(): Catalogue {
  const db = appDb();
  const products = (db.prepare("SELECT data FROM products").all() as { data: string }[]).map((r) => JSON.parse(r.data) as Product);
  const ruleRow = db.prepare("SELECT data FROM rule_tables WHERE active = 1 LIMIT 1").get() as { data: string };
  return new Catalogue({
    products: catalogueMode() === "beta" ? products.filter((p) => p.status === "published") : products,
    reports: (db.prepare("SELECT data FROM lab_reports WHERE product_id IS NOT NULL").all() as { data: string }[]).map((r) => JSON.parse(r.data) as LabReport),
    gates: new Map((db.prepare("SELECT report_id, data FROM gates").all() as { report_id: string; data: string }[]).map((r) => [r.report_id, JSON.parse(r.data) as GateRecord])),
    licences: Object.fromEntries((db.prepare("SELECT name, licence FROM sources").all() as { name: string; licence: SourceLicence }[]).map((r) => [r.name, r.licence])),
    listings: (db.prepare("SELECT data FROM listings").all() as { data: string }[]).map((r) => JSON.parse(r.data) as Listing),
    rules: JSON.parse(ruleRow.data) as RuleTable,
    asOf: asOfDate(),
  });
}

export function catalogue(): Catalogue {
  if (!g.__sahiCatalogue) g.__sahiCatalogue = build();
  return g.__sahiCatalogue;
}

export const getView = (id: string) => catalogue().getView(id);
export const activeRules = () => catalogue().rules;
export const categories = () => catalogue().categories();
export const searchViews = (q: string, opts: { category?: string; limit?: number } = {}) => catalogue().search(q, opts);
export const matchByUrl = (url: string) => catalogue().matchByUrl(url);
export const matchText = (line: string) => catalogue().matchText(line);
