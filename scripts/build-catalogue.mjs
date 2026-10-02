// Builds data/seed/products.json from the label seed (data/source/label-seed.tsv)
// and the workbook import (lab-reports.json, listings.json, qc-lines.json).
// Run: node scripts/build-catalogue.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(readFileSync(join(root, p), "utf8"));
const reports = read("data/seed/lab-reports.json");
const listings = read("data/seed/listings.json");
const lines = read("data/seed/qc-lines.json");

const [header, ...rows] = readFileSync(join(root, "data/source/label-seed.tsv"), "utf8")
  .split("\n")
  .filter((l) => l.trim())
  .map((l) => l.split("\t"));

const num = (v) => (v === "" || v === undefined ? null : Number(v));
const list = (v, sep = ",") => (v ? v.split(sep).map((s) => s.trim()).filter(Boolean) : []);

// "500 ml ₹30, 1 L ₹59" or "6 x 1 L ₹462" -> first pack with a price
function parsePrice(text) {
  const re = /(?:(\d+)\s*x\s*)?(\d+(?:\.\d+)?)\s*(kg|g|ml|L)\b[^₹,]*?₹\s*([\d,]+(?:\.\d+)?)/i;
  const m = text && text.match(re);
  if (!m) return null;
  const count = m[1] ? Number(m[1]) : 1;
  let qty = Number(m[2]) * count;
  let unit = m[3].toLowerCase();
  if (unit === "kg") { qty *= 1000; unit = "g"; }
  if (unit === "l") { qty *= 1000; unit = "ml"; }
  return { amount: Number(m[4].replace(/,/g, "")), packQty: qty, packUnit: unit };
}

const reportById = Object.fromEntries(reports.map((r) => [r.id, r]));
const lineByKey = Object.fromEntries(lines.map((l) => [l.qcKey, l]));
const used = new Set();

const products = rows.map((cells) => {
  const r = Object.fromEntries(header.map((h, i) => [h, cells[i] ?? ""]));
  const reportIds = list(r.reportIds);
  reportIds.forEach((id) => {
    if (!reportById[id]) throw new Error(`${r.id}: unknown report ${id}`);
    if (used.has(id)) throw new Error(`${r.id}: report ${id} mapped twice`);
    used.add(id);
  });
  const qcListings = r.qcKey ? listings.filter((l) => l.qcKey === r.qcKey) : [];
  if (r.qcKey && !qcListings.length) throw new Error(`${r.id}: no listings for ${r.qcKey}`);
  let price = null;
  for (const l of qcListings) {
    const p = parsePrice(l.seen);
    if (p && p.packUnit === r.unit) { price = { ...p, platform: l.platform, capturedAt: l.capturedAt }; break; }
  }
  const line = r.qcKey ? lineByKey[r.qcKey] : null;
  const hasLabel = r.kcal !== "";
  return {
    id: r.id,
    gtin: null,
    fssaiLicence: null,
    brand: r.brand,
    name: r.name,
    category: r.category,
    useGroup: r.useGroup,
    unit: r.unit,
    servingSize: num(r.serving),
    nutritionPer100: {
      energyKcal: num(r.kcal),
      protein: num(r.protein),
      carbohydrate: num(r.carbs),
      totalSugar: num(r.sugar),
      addedSugar: num(r.addedSugar),
      fat: num(r.fat),
      saturatedFat: num(r.satFat),
      transFat: num(r.transFat),
      sodiumMg: num(r.sodium),
      fibre: num(r.fibre),
    },
    nova: num(r.nova),
    vegMark: r.veg === "N" ? "non-veg" : r.veg === "Y" ? "veg" : null,
    allergens: { contains: list(r.contains), mayContain: list(r.mayContain) },
    ingredients: list(r.ingredients, ";"),
    claims: list(r.claims, ";"),
    labelSource: hasLabel
      ? { kind: "seed-estimate", verified: false, note: "Typical values entered for the MVP seed. Check against the pack photo before publishing." }
      : { kind: "missing", verified: false, note: "Label data not captured yet." },
    reportIds,
    qcKey: r.qcKey || null,
    qcLine: line ? { rank: line.rank, score: line.qcScore, demandTier: line.demandTier, topRatingsCount: line.topRatingsCount } : null,
    price,
    sourceLinks: qcListings.map((l) => l.url).slice(0, 3),
    version: 1,
    status: "draft",
    updatedAt: "2026-10-02",
  };
});

const shortlistMapped = lines.filter((l) => products.some((p) => p.reportIds.includes(l.reportId)));
writeFileSync(join(root, "data/seed/products.json"), JSON.stringify(products, null, 1) + "\n");
console.log(`products: ${products.length}, with label data: ${products.filter((p) => p.labelSource.kind !== "missing").length}`);
console.log(`reports mapped: ${used.size}, shortlist lines covered: ${shortlistMapped.length}/${lines.length}`);
console.log(`with price: ${products.filter((p) => p.price).length}`);
