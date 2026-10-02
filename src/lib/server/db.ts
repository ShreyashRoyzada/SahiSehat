import "server-only";
import Database from "better-sqlite3";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { dataDir } from "./paths";

// Two databases, as the PRD asks: the catalogue/app store, and a separate
// health vault (people, markers, consents, uploads, Fit results) whose
// values are encrypted field by field with their own key.

type DBs = { app: Database.Database; vault: Database.Database };

const globalForDb = globalThis as unknown as { __sahiDbs?: DBs };

const APP_SCHEMA = `
CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, data TEXT NOT NULL, version INTEGER NOT NULL, status TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS product_versions (id TEXT NOT NULL, version INTEGER NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL, created_by TEXT, PRIMARY KEY (id, version));
CREATE TABLE IF NOT EXISTS lab_reports (id TEXT PRIMARY KEY, product_id TEXT, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS gates (report_id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS listings (id INTEGER PRIMARY KEY AUTOINCREMENT, qc_key TEXT NOT NULL, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sources (name TEXT PRIMARY KEY, licence TEXT NOT NULL, note TEXT, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS rule_tables (version TEXT PRIMARY KEY, data TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, created_by TEXT);
CREATE TABLE IF NOT EXISTS audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, actor TEXT NOT NULL, action TEXT NOT NULL, target TEXT, detail TEXT);
CREATE TABLE IF NOT EXISTS flags (id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, product_id TEXT, kind TEXT NOT NULL, message TEXT, status TEXT NOT NULL DEFAULT 'open');
CREATE TABLE IF NOT EXISTS product_requests (id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, text TEXT NOT NULL, url TEXT, votes INTEGER NOT NULL DEFAULT 1, status TEXT NOT NULL DEFAULT 'open');
CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, email TEXT UNIQUE, password_hash TEXT, is_demo INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, account_id TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS admin_sessions (token_hash TEXT PRIMARY KEY, actor TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS invites (code TEXT PRIMARY KEY, used_by TEXT, used_at TEXT);
CREATE TABLE IF NOT EXISTS saved (account_id TEXT NOT NULL, product_id TEXT NOT NULL, from_product_id TEXT, at TEXT NOT NULL, PRIMARY KEY (account_id, product_id));
CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, actor TEXT NOT NULL, kind TEXT NOT NULL, product_id TEXT);
CREATE INDEX IF NOT EXISTS idx_reports_product ON lab_reports(product_id);
CREATE INDEX IF NOT EXISTS idx_events_kind ON events(kind, at);
`;

const VAULT_SCHEMA = `
CREATE TABLE IF NOT EXISTS persons (account_id TEXT PRIMARY KEY, profile_enc TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS markers (id TEXT PRIMARY KEY, account_id TEXT NOT NULL, data_enc TEXT NOT NULL, upload_id TEXT, confirmed_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS consents (id INTEGER PRIMARY KEY AUTOINCREMENT, account_id TEXT NOT NULL, purpose TEXT NOT NULL, notice_version TEXT NOT NULL, granted_at TEXT NOT NULL, withdrawn_at TEXT);
CREATE TABLE IF NOT EXISTS report_uploads (id TEXT PRIMARY KEY, account_id TEXT NOT NULL, status TEXT NOT NULL, extraction_version TEXT NOT NULL, created_at TEXT NOT NULL, confirmed_at TEXT, file_deleted_at TEXT);
CREATE TABLE IF NOT EXISTS fit_results (id INTEGER PRIMARY KEY AUTOINCREMENT, account_id TEXT NOT NULL, product_id TEXT NOT NULL, product_version INTEGER NOT NULL, rule_version TEXT NOT NULL, inputs_hash TEXT NOT NULL, verdict TEXT NOT NULL, reasons_enc TEXT NOT NULL, computed_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_markers_account ON markers(account_id);
CREATE INDEX IF NOT EXISTS idx_consents_account ON consents(account_id);
CREATE INDEX IF NOT EXISTS idx_fit_account ON fit_results(account_id, product_id);
`;

function open(file: string, schema: string): Database.Database {
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(schema);
  return db;
}

export function dbs(): DBs {
  if (globalForDb.__sahiDbs) return globalForDb.__sahiDbs;
  const dir = dataDir();
  mkdirSync(dir, { recursive: true });
  const app = open(join(dir, "app.db"), APP_SCHEMA);
  const vault = open(join(dir, "vault.db"), VAULT_SCHEMA);
  seedIfEmpty(app);
  globalForDb.__sahiDbs = { app, vault };
  return globalForDb.__sahiDbs;
}

export const appDb = () => dbs().app;
export const vaultDb = () => dbs().vault;

export const now = () => new Date().toISOString();

function readSeed<T>(name: string): T {
  return JSON.parse(readFileSync(join(process.cwd(), "data", "seed", name), "utf8")) as T;
}

function seedIfEmpty(app: Database.Database) {
  const count = (app.prepare("SELECT COUNT(*) AS n FROM products").get() as { n: number }).n;
  if (count > 0) return;
  const products = readSeed<{ id: string; version: number; status: string; updatedAt: string; reportIds: string[] }[]>("products.json");
  const reports = readSeed<{ id: string; [k: string]: unknown }[]>("lab-reports.json");
  const listings = readSeed<{ qcKey: string }[]>("listings.json");
  const rules = JSON.parse(readFileSync(join(process.cwd(), "data", "rules", "rule-table-v1.json"), "utf8"));
  const productByReport = new Map<string, string>();
  for (const p of products) for (const r of p.reportIds) productByReport.set(r, p.id);
  const at = now();

  const tx = app.transaction(() => {
    const insP = app.prepare("INSERT INTO products (id, data, version, status, updated_at) VALUES (?, ?, ?, ?, ?)");
    const insV = app.prepare("INSERT INTO product_versions (id, version, data, created_at, created_by) VALUES (?, ?, ?, ?, 'seed')");
    for (const p of products) {
      insP.run(p.id, JSON.stringify(p), p.version, p.status, p.updatedAt);
      insV.run(p.id, p.version, JSON.stringify(p), at);
    }
    const insR = app.prepare("INSERT INTO lab_reports (id, product_id, data) VALUES (?, ?, ?)");
    for (const r of reports) {
      const productId = productByReport.get(r.id) ?? null;
      insR.run(r.id, productId, JSON.stringify({ ...r, productId }));
    }
    const insL = app.prepare("INSERT INTO listings (qc_key, data) VALUES (?, ?)");
    for (const l of listings) insL.run(l.qcKey, JSON.stringify(l));
    const insS = app.prepare("INSERT INTO sources (name, licence, note, updated_at) VALUES (?, ?, ?, ?)");
    insS.run("Trustified Pass/Fail", "pending", "No API or reuse terms found. Written licence requested; link out until then.", at);
    insS.run("Trustified NMR", "pending", "Same terms as Trustified Pass/Fail.", at);
    insS.run("The Whole Truth hub", "pending", "The brand's own publication. Ask before reusing content.", at);
    insS.run("Unbox Health", "link-only", "Direct competitor. Link out only; grades are not copied.", at);
    app.prepare("INSERT INTO rule_tables (version, data, active, created_at, created_by) VALUES (?, ?, 1, ?, 'seed')").run(rules.version, JSON.stringify(rules), at);
    const codes = (process.env.INVITE_CODES || "SAHI-BETA-2026").split(",").map((c) => c.trim()).filter(Boolean);
    const insI = app.prepare("INSERT OR IGNORE INTO invites (code) VALUES (?)");
    for (const c of codes) insI.run(c);
    app.prepare("INSERT INTO audit_log (at, actor, action, target, detail) VALUES (?, 'system', 'seed', 'catalogue', ?)").run(
      at,
      JSON.stringify({ products: products.length, reports: reports.length, listings: listings.length, source: "QC_lab_report_products_2026-10-02.xlsx + label-seed.tsv" }),
    );
  });
  tx();
}

export function audit(actor: string, action: string, target: string | null, detail?: unknown) {
  appDb().prepare("INSERT INTO audit_log (at, actor, action, target, detail) VALUES (?, ?, ?, ?, ?)").run(now(), actor, action, target, detail === undefined ? null : JSON.stringify(detail));
}
