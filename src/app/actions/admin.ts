"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { adminSignIn, adminSignOut, requireAdmin } from "@/lib/server/admin";
import { appDb, audit, now } from "@/lib/server/db";
import { invalidateCatalogue } from "@/lib/server/catalogue";
import { canGoLive, validateRuleTable, type RuleTable } from "@/lib/fit/rules";
import { runGolden } from "@/lib/fit/golden";
import { publishBlockers } from "@/lib/publish";
import { gateComplete } from "@/lib/trust";
import type { GateRecord, Product, SourceLicence } from "@/lib/types";
import type { FormState } from "./auth";

export async function adminSignInAction(_: FormState, form: FormData): Promise<FormState> {
  const err = await adminSignIn(String(form.get("actor") ?? ""), String(form.get("password") ?? ""), String(form.get("code") ?? ""));
  if (err) return { error: err };
  redirect("/admin");
}

export async function adminSignOutAction() {
  await adminSignOut();
  redirect("/admin/login");
}

function loadProduct(id: string): Product {
  const row = appDb().prepare("SELECT data FROM products WHERE id = ?").get(id) as { data: string } | undefined;
  if (!row) throw new Error("No such product");
  return JSON.parse(row.data) as Product;
}

/** Saving a change creates a new product version (PRD data rules: a reformulation creates a new version). */
function writeProduct(actor: string, p: Product, action: string) {
  const db = appDb();
  const next = { ...p, version: p.version + 1, updatedAt: now().slice(0, 10) };
  db.transaction(() => {
    db.prepare("UPDATE products SET data = ?, version = ?, status = ?, updated_at = ? WHERE id = ?").run(JSON.stringify(next), next.version, next.status, next.updatedAt, p.id);
    db.prepare("INSERT INTO product_versions (id, version, data, created_at, created_by) VALUES (?, ?, ?, ?, ?)").run(p.id, next.version, JSON.stringify(next), now(), actor);
  })();
  audit(actor, action, p.id, { version: next.version, status: next.status });
  invalidateCatalogue();
  revalidatePath("/", "layout");
}

const num = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  return s === "" ? null : Number(s);
};
const list = (v: FormDataEntryValue | null, sep: RegExp) => String(v ?? "").split(sep).map((s) => s.trim()).filter(Boolean);

export async function saveProductAction(_: FormState, form: FormData): Promise<FormState> {
  const actor = await requireAdmin();
  const p = loadProduct(String(form.get("id")));
  const n = p.nutritionPer100;
  const keys = Object.keys(n) as (keyof typeof n)[];
  const nutrition = Object.fromEntries(keys.map((k) => [k, num(form.get(`n.${k}`))])) as typeof n;
  if (Object.values(nutrition).some((v) => v !== null && (!Number.isFinite(v) || v < 0))) return { error: "Nutrition values must be non-negative numbers." };
  const updated: Product = {
    ...p,
    gtin: String(form.get("gtin") ?? "").trim() || null,
    fssaiLicence: String(form.get("fssai") ?? "").trim() || null,
    servingSize: num(form.get("servingSize")),
    nutritionPer100: nutrition,
    ingredients: list(form.get("ingredients"), /\n|;/),
    allergens: { contains: list(form.get("contains"), /,/), mayContain: list(form.get("mayContain"), /,/) },
    claims: list(form.get("claims"), /\n|;/),
    nova: num(form.get("nova")),
    vegMark: (["veg", "non-veg"].includes(String(form.get("vegMark"))) ? String(form.get("vegMark")) : null) as Product["vegMark"],
    sourceLinks: list(form.get("sourceLinks"), /\n/),
    labelSource:
      form.get("verified") === "on"
        ? { kind: "pack-photo", verified: true, note: "Checked against the pack photo.", verifiedBy: actor, verifiedAt: now() }
        : { ...p.labelSource, verified: false },
  };
  writeProduct(actor, updated, "product.saved");
  return { ok: `Saved as version ${p.version + 1}.` };
}

export async function setProductStatusAction(form: FormData) {
  const actor = await requireAdmin();
  const p = loadProduct(String(form.get("id")));
  const status = form.get("status") === "published" ? "published" : "draft";
  if (status === "published") {
    const blockers = publishBlockers(p);
    if (blockers.length) redirect(`/admin/products/${p.id}?blocked=${encodeURIComponent(blockers.join(", "))}`);
  }
  writeProduct(actor, { ...p, status }, status === "published" ? "product.published" : "product.unpublished");
  redirect(`/admin/products/${p.id}`);
}

export async function saveGateAction(form: FormData) {
  const actor = await requireAdmin();
  const reportId = String(form.get("reportId"));
  const db = appDb();
  const prev = db.prepare("SELECT data FROM gates WHERE report_id = ?").get(reportId) as { data: string } | undefined;
  const old = prev ? (JSON.parse(prev.data) as GateRecord) : null;
  const notified = String(form.get("brandNotifiedAt") ?? "").trim();
  const approve = form.get("approve") === "1";
  const gate: GateRecord = {
    reportId,
    checklist: {
      reportLinked: form.get("reportLinked") === "on",
      batchLabDateShown: form.get("batchLabDateShown") === "on",
      templateWording: form.get("templateWording") === "on",
      brandNotified: form.get("brandNotified") === "on",
      correctionPath: form.get("correctionPath") === "on",
    },
    brandNotifiedAt: notified ? new Date(notified).toISOString() : null,
    brandReply: String(form.get("brandReply") ?? "").trim() || null,
    approvedBy: approve ? actor : form.get("revoke") === "1" ? null : (old?.approvedBy ?? null),
    approvedAt: approve ? now() : form.get("revoke") === "1" ? null : (old?.approvedAt ?? null),
  };
  if (approve) {
    const missing = gateComplete({ ...gate, approvedBy: actor, approvedAt: now() }, new Date()).missing;
    if (missing.length) redirect(`/admin/reports?error=${encodeURIComponent(`${reportId}: can't approve yet. Missing: ${missing.join(", ")}`)}#${reportId}`);
  }
  db.prepare("INSERT INTO gates (report_id, data, updated_at) VALUES (?, ?, ?) ON CONFLICT(report_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at").run(reportId, JSON.stringify(gate), now());
  audit(actor, approve ? "gate.approved" : form.get("revoke") === "1" ? "gate.revoked" : "gate.updated", reportId, gate.checklist);
  invalidateCatalogue();
  revalidatePath("/", "layout");
  redirect(`/admin/reports?saved=${reportId}#${reportId}`);
}

export async function setLicenceAction(form: FormData) {
  const actor = await requireAdmin();
  const name = String(form.get("name"));
  const licence = String(form.get("licence")) as SourceLicence;
  if (!["granted", "pending", "link-only"].includes(licence)) return;
  const note = String(form.get("note") ?? "").slice(0, 500);
  appDb().prepare("UPDATE sources SET licence = ?, note = ?, updated_at = ? WHERE name = ?").run(licence, note, now(), name);
  audit(actor, "source.licence", name, { licence });
  invalidateCatalogue();
  revalidatePath("/", "layout");
}

export async function createRuleVersionAction(_: FormState, form: FormData): Promise<FormState> {
  const actor = await requireAdmin();
  let table: RuleTable;
  try {
    table = JSON.parse(String(form.get("json") ?? ""));
  } catch {
    return { error: "That isn't valid JSON." };
  }
  const errors = validateRuleTable(table);
  if (errors.length) return { error: errors.join("; ") };
  const db = appDb();
  if (db.prepare("SELECT 1 FROM rule_tables WHERE version = ?").get(table.version)) return { error: `Version ${table.version} already exists. Bump the version.` };
  table = { ...table, status: "draft", approval: { approver: null, approvedAt: null, note: String(form.get("note") ?? "") } };
  db.prepare("INSERT INTO rule_tables (version, data, active, created_at, created_by) VALUES (?, ?, 0, ?, ?)").run(table.version, JSON.stringify(table), now(), actor);
  audit(actor, "rules.created", table.version);
  revalidatePath("/admin/rules");
  return { ok: `Draft ${table.version} saved. Record the advisor's approval, then activate.` };
}

export async function approveRuleVersionAction(form: FormData) {
  const actor = await requireAdmin();
  const version = String(form.get("version"));
  const advisor = String(form.get("advisor") ?? "").trim();
  if (!advisor) redirect(`/admin/rules?error=${encodeURIComponent("Name the advisor who signed this version.")}`);
  const db = appDb();
  const row = db.prepare("SELECT data FROM rule_tables WHERE version = ?").get(version) as { data: string } | undefined;
  if (!row) return;
  const table = JSON.parse(row.data) as RuleTable;
  const signed: RuleTable = { ...table, status: "approved", approval: { approver: advisor, approvedAt: now(), note: `${table.approval.note} Recorded by ${actor}.`.trim() } };
  db.prepare("UPDATE rule_tables SET data = ? WHERE version = ?").run(JSON.stringify(signed), version);
  audit(actor, "rules.approved", version, { advisor });
  invalidateCatalogue();
  revalidatePath("/", "layout");
  redirect("/admin/rules");
}

/** C1 + C8: a version goes live only with an approval record and a passing golden run. */
export async function activateRuleVersionAction(form: FormData) {
  const actor = await requireAdmin();
  const version = String(form.get("version"));
  const db = appDb();
  const row = db.prepare("SELECT data FROM rule_tables WHERE version = ?").get(version) as { data: string } | undefined;
  if (!row) return;
  const table = JSON.parse(row.data) as RuleTable;
  const live = canGoLive(table);
  const allowPlaceholder = form.get("preview") === "1" && process.env.CATALOGUE_MODE !== "beta";
  if (!live.ok && !allowPlaceholder) redirect(`/admin/rules?error=${encodeURIComponent(live.reason!)}`);
  const golden = runGolden(table);
  if (golden.failed.length) redirect(`/admin/rules?error=${encodeURIComponent(`${golden.failed.length} golden case(s) fail: ${golden.failed.map((f) => f.name).slice(0, 3).join("; ")}`)}`);
  db.transaction(() => {
    db.prepare("UPDATE rule_tables SET active = 0").run();
    db.prepare("UPDATE rule_tables SET active = 1 WHERE version = ?").run(version);
  })();
  audit(actor, "rules.activated", version, { golden: golden.passed, placeholder: !live.ok });
  invalidateCatalogue();
  revalidatePath("/", "layout");
  redirect("/admin/rules");
}

export async function resolveQueueAction(form: FormData) {
  const actor = await requireAdmin();
  const table = form.get("table") === "requests" ? "product_requests" : "flags";
  const id = Number(form.get("id"));
  appDb().prepare(`UPDATE ${table} SET status = 'closed' WHERE id = ?`).run(id);
  audit(actor, `${table}.closed`, String(id));
  revalidatePath("/admin/queue");
}
