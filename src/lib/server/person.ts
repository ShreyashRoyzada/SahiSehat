import "server-only";
import { randomUUID } from "node:crypto";
import type { FitResult, Marker, Profile } from "../types";
import { appDb, now, vaultDb } from "./db";
import { decryptJson, encryptJson, sha256 } from "./crypto";
import { computeFit, activateRuleSets } from "../fit/engine";
import { activeRules, catalogue, type ProductView } from "./catalogue";
import { asOfDate } from "../dates";
import { findSwaps, type SwapResult } from "../swaps";

// ---- Consent (PRD B6) ------------------------------------------------------

export const NOTICE_VERSION = "notice-0.1-draft";
export type ConsentPurpose = "store-health-data" | "process-reports";

export const CONSENT_TEXT: Record<ConsentPurpose, { title: string; body: string }> = {
  "store-health-data": {
    title: "Store my health numbers to personalise verdicts",
    body: "We keep the conditions you tell us about and the numbers you type or confirm (such as HbA1c, LDL and blood pressure), encrypted in a separate health store, and use them only to work out your daily limits and Fit verdicts. We never sell or share them, never use them for ads, and you can withdraw, export or delete them at any time.",
  },
  "process-reports": {
    title: "Process an uploaded blood report",
    body: "When you upload a report, the file is read on your device. Only the text is sent to us; we remove your name, phone, address and patient or lab IDs before any processing by a service provider. You check every value before we save it. Unconfirmed values are discarded and nothing from the file is kept.",
  },
};

export type ConsentState = Record<ConsentPurpose, { granted: boolean; at: string | null }>;

export function consentState(accountId: string): ConsentState {
  const rows = vaultDb().prepare("SELECT purpose, granted_at, withdrawn_at FROM consents WHERE account_id = ? ORDER BY id").all(accountId) as { purpose: ConsentPurpose; granted_at: string; withdrawn_at: string | null }[];
  const state: ConsentState = { "store-health-data": { granted: false, at: null }, "process-reports": { granted: false, at: null } };
  for (const r of rows) state[r.purpose] = r.withdrawn_at ? { granted: false, at: r.withdrawn_at } : { granted: true, at: r.granted_at };
  return state;
}

export function setConsent(accountId: string, purpose: ConsentPurpose, granted: boolean) {
  const v = vaultDb();
  const current = consentState(accountId)[purpose];
  if (granted && !current.granted) {
    v.prepare("INSERT INTO consents (account_id, purpose, notice_version, granted_at) VALUES (?, ?, ?, ?)").run(accountId, purpose, NOTICE_VERSION, now());
  } else if (!granted && current.granted) {
    v.prepare("UPDATE consents SET withdrawn_at = ? WHERE account_id = ? AND purpose = ? AND withdrawn_at IS NULL").run(now(), accountId, purpose);
    if (purpose === "store-health-data") {
      // Withdrawal stops the processing: stored health data is removed.
      v.prepare("DELETE FROM persons WHERE account_id = ?").run(accountId);
      v.prepare("DELETE FROM markers WHERE account_id = ?").run(accountId);
      v.prepare("DELETE FROM fit_results WHERE account_id = ?").run(accountId);
    }
  }
}

export function hasConsent(accountId: string, purpose: ConsentPurpose) {
  return consentState(accountId)[purpose].granted;
}

// ---- Profile and markers -----------------------------------------------------

export const EMPTY_PROFILE: Profile = { ageBand: null, conditions: [], goals: [], diet: "none", allergens: [], screen: [] };

export function getProfile(accountId: string): Profile | null {
  const row = vaultDb().prepare("SELECT profile_enc FROM persons WHERE account_id = ?").get(accountId) as { profile_enc: string } | undefined;
  return row ? { ...EMPTY_PROFILE, ...decryptJson<Profile>(row.profile_enc) } : null;
}

export function saveProfile(accountId: string, profile: Profile) {
  if (!hasConsent(accountId, "store-health-data")) throw new Error("Consent to store health data is required");
  vaultDb()
    .prepare("INSERT INTO persons (account_id, profile_enc, updated_at) VALUES (?, ?, ?) ON CONFLICT(account_id) DO UPDATE SET profile_enc = excluded.profile_enc, updated_at = excluded.updated_at")
    .run(accountId, encryptJson(profile), now());
}

export function getMarkers(accountId: string): Marker[] {
  const rows = vaultDb().prepare("SELECT id, data_enc FROM markers WHERE account_id = ?").all(accountId) as { id: string; data_enc: string }[];
  return rows.map((r) => ({ ...decryptJson<Marker>(r.data_enc), id: r.id })).sort((a, b) => b.sampleDate.localeCompare(a.sampleDate));
}

export function addMarkers(accountId: string, markers: Marker[], uploadId: string | null = null) {
  if (!hasConsent(accountId, "store-health-data")) throw new Error("Consent to store health data is required");
  const ins = vaultDb().prepare("INSERT INTO markers (id, account_id, data_enc, upload_id, confirmed_at) VALUES (?, ?, ?, ?, ?)");
  const tx = vaultDb().transaction(() => {
    for (const m of markers) ins.run(randomUUID(), accountId, encryptJson({ ...m, id: undefined }), uploadId, now());
  });
  tx();
}

export function deleteMarker(accountId: string, id: string) {
  vaultDb().prepare("DELETE FROM markers WHERE account_id = ? AND id = ?").run(accountId, id);
}

// ---- Person context and Fit ----------------------------------------------------

export type PersonContext = { accountId: string; profile: Profile; markers: Marker[]; personalised: boolean };

export function personContext(accountId: string): PersonContext | null {
  if (!hasConsent(accountId, "store-health-data")) return null;
  const profile = getProfile(accountId);
  if (!profile) return null;
  return { accountId, profile, markers: getMarkers(accountId), personalised: true };
}

export function fitFor(ctx: PersonContext, view: ProductView, opts: { record?: boolean } = {}): FitResult {
  const result = computeFit({ profile: ctx.profile, markers: ctx.markers, product: view.product, rules: activeRules(), asOf: asOfDate() });
  if (opts.record) {
    // Audit trail (G3): rule version, product version and inputs hash; reasons kept in the vault.
    vaultDb()
      .prepare("INSERT INTO fit_results (account_id, product_id, product_version, rule_version, inputs_hash, verdict, reasons_enc, computed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .run(ctx.accountId, view.product.id, view.product.version, result.ruleVersion, result.inputsHash, result.verdict, encryptJson(result.reasons), now());
  }
  return result;
}

export function swapsFor(ctx: PersonContext | null, view: ProductView): SwapResult {
  const pool = catalogue().list.filter((v) => v.product.useGroup === view.product.useGroup);
  const toCandidate = (v: ProductView) => ({ product: v.product, quality: v.quality, swapBlock: v.swapBlock, fit: ctx ? fitFor(ctx, v) : null });
  return findSwaps(toCandidate(view), pool.map(toCandidate));
}

export function activationFor(ctx: PersonContext) {
  return activateRuleSets(ctx.profile, ctx.markers, activeRules(), asOfDate());
}

// ---- Events for the north-star metric (no health data) -------------------------

export type EventKind = "verdict_view" | "swap_open" | "swap_save" | "buy_click" | "search" | "cart_check" | "assistant";

export function trackEvent(accountId: string | null, kind: EventKind, productId: string | null = null) {
  const actor = accountId ? sha256(`evt:${accountId}`).slice(0, 16) : "anon";
  appDb().prepare("INSERT INTO events (at, actor, kind, product_id) VALUES (?, ?, ?, ?)").run(now(), actor, kind, productId);
}

// ---- Saved swaps / shopping list -------------------------------------------------

export function savedProducts(accountId: string): string[] {
  return (appDb().prepare("SELECT product_id FROM saved WHERE account_id = ? ORDER BY at DESC").all(accountId) as { product_id: string }[]).map((r) => r.product_id);
}

export function exportPersonData(accountId: string) {
  const v = vaultDb();
  return {
    exportedAt: now(),
    noticeVersion: NOTICE_VERSION,
    profile: getProfile(accountId),
    markers: getMarkers(accountId),
    consents: v.prepare("SELECT purpose, notice_version, granted_at, withdrawn_at FROM consents WHERE account_id = ?").all(accountId),
    reportUploads: v.prepare("SELECT id, status, extraction_version, created_at, confirmed_at, file_deleted_at FROM report_uploads WHERE account_id = ?").all(accountId),
    fitResults: (v.prepare("SELECT product_id, product_version, rule_version, inputs_hash, verdict, reasons_enc, computed_at FROM fit_results WHERE account_id = ? ORDER BY id DESC LIMIT 500").all(accountId) as { reasons_enc: string }[]).map(({ reasons_enc, ...r }) => ({ ...r, reasons: decryptJson(reasons_enc) })),
    savedProducts: savedProducts(accountId),
  };
}
