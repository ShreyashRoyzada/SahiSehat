"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAccount, deleteAccountData, signOut } from "@/lib/server/auth";
import { addMarkers, deleteMarker, EMPTY_PROFILE, getProfile, hasConsent, saveProfile, setConsent, type ConsentPurpose } from "@/lib/server/person";
import { markUploadConfirmed } from "@/lib/server/extract";
import { appDb, audit, now } from "@/lib/server/db";
import { checkPlausible, MARKERS } from "@/lib/units";
import type { AgeBand, Allergen, Condition, Diet, LabFlag, Marker, MarkerName, Profile, ScreenFlag } from "@/lib/types";
import type { FormState } from "./auth";

const AGE: AgeBand[] = ["under-18", "18-29", "30-44", "45-59", "60-74", "75+"];
const CONDITIONS: Condition[] = ["diabetes", "prediabetes", "high-cholesterol", "high-bp"];
const DIETS: Diet[] = ["none", "vegetarian", "vegan", "jain"];
const ALLERGENS: Allergen[] = ["milk", "gluten", "peanut", "treenut", "soy", "sesame", "mustard", "egg", "fish", "crustacean", "sulphite"];
const SCREEN: ScreenFlag[] = ["pregnancy", "kidney-disease", "eating-disorder"];

const pick = <T extends string>(values: FormDataEntryValue[], allowed: T[]) => values.map(String).filter((v): v is T => allowed.includes(v as T));

export async function saveOnboardingAction(_: FormState, form: FormData): Promise<FormState> {
  const account = await requireAccount();
  if (form.get("consent-health") !== "on") return { error: "To personalise verdicts we need your consent to store health data. You can still browse Quality Scores without it." };
  setConsent(account.id, "store-health-data", true);
  if (form.get("consent-reports") === "on") setConsent(account.id, "process-reports", true);
  const ageBand = String(form.get("ageBand") ?? "");
  const profile: Profile = {
    ageBand: AGE.includes(ageBand as AgeBand) ? (ageBand as AgeBand) : null,
    conditions: pick(form.getAll("conditions"), CONDITIONS),
    goals: form.getAll("goals").map(String).filter(Boolean).slice(0, 5),
    diet: (DIETS.includes(String(form.get("diet")) as Diet) ? String(form.get("diet")) : "none") as Diet,
    allergens: pick(form.getAll("allergens"), ALLERGENS),
    screen: pick(form.getAll("screen"), SCREEN),
  };
  if (!profile.ageBand) return { error: "Choose your age band." };
  saveProfile(account.id, profile);
  redirect("/me/numbers?welcome=1");
}

export async function updateProfileAction(_: FormState, form: FormData): Promise<FormState> {
  const account = await requireAccount();
  if (!hasConsent(account.id, "store-health-data")) return { error: "Turn on consent to store health data first (Privacy)." };
  const current = getProfile(account.id) ?? EMPTY_PROFILE;
  const ageBand = String(form.get("ageBand") ?? current.ageBand ?? "");
  saveProfile(account.id, {
    ageBand: AGE.includes(ageBand as AgeBand) ? (ageBand as AgeBand) : current.ageBand,
    conditions: pick(form.getAll("conditions"), CONDITIONS),
    goals: current.goals,
    diet: (DIETS.includes(String(form.get("diet")) as Diet) ? String(form.get("diet")) : "none") as Diet,
    allergens: pick(form.getAll("allergens"), ALLERGENS),
    screen: pick(form.getAll("screen"), SCREEN),
  });
  revalidatePath("/me");
  return { ok: "Profile saved. Verdicts now use these answers." };
}

function readMarker(name: MarkerName, value: string, unit: string, date: string, flag: string, range: string | null, source: Marker["source"]): { marker?: Marker; error?: string } {
  const v = Number(value);
  const check = checkPlausible(name, v, unit);
  if (!check.ok) return { error: check.error };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: `${MARKERS[name].label}: add the date of the test.` };
  if (date > new Date().toISOString().slice(0, 10)) return { error: `${MARKERS[name].label}: the date can't be in the future.` };
  const labFlag = (["high", "low", "normal", "critical"].includes(flag) ? flag : null) as LabFlag;
  return { marker: { name, value: check.canonical, unit: MARKERS[name].canonical, sampleDate: date, labFlag, labRange: range || null, source } };
}

export async function addNumbersAction(_: FormState, form: FormData): Promise<FormState> {
  const account = await requireAccount();
  if (!hasConsent(account.id, "store-health-data")) return { error: "Consent to store health data is needed before saving numbers." };
  const date = String(form.get("date") ?? "");
  const markers: Marker[] = [];
  const errors: string[] = [];
  for (const name of Object.keys(MARKERS) as MarkerName[]) {
    const value = String(form.get(`${name}.value`) ?? "").trim();
    if (!value) continue;
    const r = readMarker(name, value, String(form.get(`${name}.unit`) ?? MARKERS[name].canonical), date, String(form.get(`${name}.flag`) ?? ""), null, "typed");
    if (r.error) errors.push(r.error);
    else markers.push(r.marker!);
  }
  if (errors.length) return { error: errors.join(" ") };
  if (!markers.length) return { error: "Type at least one number." };
  addMarkers(account.id, markers);
  revalidatePath("/me");
  return { ok: `Saved ${markers.length} number${markers.length > 1 ? "s" : ""}.` };
}

export async function deleteMarkerAction(form: FormData) {
  const account = await requireAccount();
  deleteMarker(account.id, String(form.get("id")));
  revalidatePath("/me");
  revalidatePath("/me/numbers");
}

export type ConfirmRow = { include: boolean; marker: MarkerName; value: string; unit: string; date: string; flag: string; range: string | null };

/** Save only the rows the person confirmed (PRD B3). */
export async function confirmReportAction(uploadId: string, rows: ConfirmRow[]): Promise<{ error?: string; saved?: number }> {
  const account = await requireAccount();
  if (!hasConsent(account.id, "store-health-data") || !hasConsent(account.id, "process-reports")) return { error: "Both consents are needed to save values from a report." };
  const markers: Marker[] = [];
  for (const row of rows.filter((r) => r.include)) {
    if (!(row.marker in MARKERS)) continue;
    const r = readMarker(row.marker, row.value, row.unit, row.date, row.flag, row.range, "report");
    if (r.error) return { error: r.error };
    markers.push(r.marker!);
  }
  if (!markers.length) return { error: "Tick at least one row to save, or cancel." };
  addMarkers(account.id, markers, uploadId);
  markUploadConfirmed(account.id, uploadId);
  revalidatePath("/me");
  return { saved: markers.length };
}

export async function setConsentAction(form: FormData) {
  const account = await requireAccount();
  const purpose = String(form.get("purpose")) as ConsentPurpose;
  if (purpose !== "store-health-data" && purpose !== "process-reports") return;
  setConsent(account.id, purpose, form.get("granted") === "1");
  revalidatePath("/me/privacy");
  revalidatePath("/me");
}

/** Delete everything in two taps (PRD B7): this is the second tap. */
export async function deleteEverythingAction(form: FormData) {
  const account = await requireAccount();
  if (form.get("confirm") !== "DELETE") redirect("/me/privacy?confirm=1");
  deleteAccountData(account.id);
  await signOut();
  redirect("/?deleted=1");
}

export async function saveSwapAction(form: FormData) {
  const account = await requireAccount();
  const productId = String(form.get("productId"));
  appDb().prepare("INSERT OR IGNORE INTO saved (account_id, product_id, from_product_id, at) VALUES (?, ?, ?, ?)").run(account.id, productId, String(form.get("from") || "") || null, now());
  const { trackEvent } = await import("@/lib/server/person");
  trackEvent(account.id, "swap_save", productId);
  revalidatePath("/me/list");
  revalidatePath(`/p/${String(form.get("from") || productId)}`);
}

export async function removeSavedAction(form: FormData) {
  const account = await requireAccount();
  appDb().prepare("DELETE FROM saved WHERE account_id = ? AND product_id = ?").run(account.id, String(form.get("productId")));
  revalidatePath("/me/list");
}

export async function flagProductAction(_: FormState, form: FormData): Promise<FormState> {
  const productId = String(form.get("productId") ?? "");
  const message = String(form.get("message") ?? "").slice(0, 1000).trim();
  const kind = String(form.get("kind") ?? "looks-wrong");
  if (!message) return { error: "Tell us briefly what looks wrong." };
  appDb().prepare("INSERT INTO flags (at, product_id, kind, message) VALUES (?, ?, ?, ?)").run(now(), productId, kind, message);
  audit("public", "flag.created", productId, { kind });
  return { ok: "Thanks. It's in our review queue." };
}

export async function requestProductAction(_: FormState, form: FormData): Promise<FormState> {
  const text = String(form.get("text") ?? "").slice(0, 300).trim();
  const url = String(form.get("url") ?? "").slice(0, 500).trim() || null;
  if (!text && !url) return { error: "Tell us the product name or paste its link." };
  const db = appDb();
  const existing = db.prepare("SELECT id FROM product_requests WHERE lower(text) = lower(?) AND status = 'open'").get(text) as { id: number } | undefined;
  if (existing) db.prepare("UPDATE product_requests SET votes = votes + 1 WHERE id = ?").run(existing.id);
  else db.prepare("INSERT INTO product_requests (at, text, url) VALUES (?, ?, ?)").run(now(), text || url, url);
  return { ok: "Requested. We add the most-requested products first." };
}
