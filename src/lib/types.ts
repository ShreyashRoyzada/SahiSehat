// Domain types shared by the catalogue, the Fit engine and the UI.

export type Unit = "g" | "ml";

export type Nutrition = {
  energyKcal: number | null;
  protein: number | null;
  carbohydrate: number | null;
  totalSugar: number | null;
  addedSugar: number | null;
  fat: number | null;
  saturatedFat: number | null;
  transFat: number | null;
  sodiumMg: number | null;
  fibre: number | null;
};

export type NutrientKey = keyof Nutrition;

export type Allergen =
  | "milk"
  | "gluten"
  | "peanut"
  | "treenut"
  | "soy"
  | "sesame"
  | "mustard"
  | "egg"
  | "fish"
  | "crustacean"
  | "sulphite";

export type Product = {
  id: string;
  gtin: string | null;
  fssaiLicence: string | null;
  brand: string;
  name: string;
  category: string;
  useGroup: string;
  unit: Unit;
  servingSize: number | null;
  nutritionPer100: Nutrition;
  nova: number | null;
  vegMark: "veg" | "non-veg" | null;
  allergens: { contains: string[]; mayContain: string[] };
  ingredients: string[];
  claims: string[];
  labelSource: { kind: "seed-estimate" | "missing" | "pack-photo" | "brand-site" | "retailer"; verified: boolean; note: string; verifiedBy?: string; verifiedAt?: string };
  reportIds: string[];
  qcKey: string | null;
  qcLine: { rank: number; score: number; demandTier: number; topRatingsCount: number } | null;
  price: { amount: number; packQty: number; packUnit: Unit; platform: string; capturedAt: string } | null;
  sourceLinks: string[];
  version: number;
  status: "draft" | "published";
  updatedAt: string;
};

export type ReportSource = "Trustified Pass/Fail" | "Trustified NMR" | "The Whole Truth hub" | "Unbox Health";

export type LabReport = {
  id: string;
  productId: string | null;
  brand: string;
  product: string;
  category: string;
  verdict: string; // as published by the source
  reportDate: string | null;
  batch: string | null;
  lab: string | null;
  source: ReportSource | string;
  externalRating: string | null;
  url: string;
  publishRoute: string | null;
  notes: string | null;
};

export type GateRecord = {
  reportId: string;
  checklist: {
    reportLinked: boolean;
    batchLabDateShown: boolean;
    templateWording: boolean;
    brandNotified: boolean;
    correctionPath: boolean;
  };
  brandNotifiedAt: string | null;
  brandReply: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
};

export type SourceLicence = "granted" | "pending" | "link-only";

export type Listing = {
  qcKey: string;
  line: string;
  platform: string;
  seen: string;
  ratingsCount: number | null;
  evidence: string;
  capturedAt: string;
  url: string;
  notes: string | null;
};

// ---- Person side -------------------------------------------------------

export type Condition = "diabetes" | "prediabetes" | "high-cholesterol" | "high-bp";
export type Diet = "none" | "vegetarian" | "vegan" | "jain";
export type AgeBand = "under-18" | "18-29" | "30-44" | "45-59" | "60-74" | "75+";
export type ScreenFlag = "pregnancy" | "kidney-disease" | "eating-disorder";

export type MarkerName =
  | "hba1c"
  | "fasting-glucose"
  | "total-cholesterol"
  | "ldl"
  | "hdl"
  | "triglycerides"
  | "systolic-bp"
  | "diastolic-bp"
  | "height"
  | "weight";

export type LabFlag = "high" | "low" | "normal" | "critical" | null;

export type Marker = {
  id?: string;
  name: MarkerName;
  value: number; // stored in canonical unit (see units.ts)
  unit: string; // canonical unit
  sampleDate: string; // ISO date
  labFlag: LabFlag; // printed by the lab, if any
  labRange: string | null; // printed reference range, verbatim
  source: "typed" | "report";
};

export type Profile = {
  ageBand: AgeBand | null;
  conditions: Condition[];
  goals: string[];
  diet: Diet;
  allergens: Allergen[];
  screen: ScreenFlag[];
};

// ---- Fit -----------------------------------------------------------------

export type FitVerdict = "good" | "small" | "not-good" | "cant-tell" | "blocked" | "no-verdict";

export type FitReason = {
  ruleId: string;
  text: string;
  nutrient?: NutrientKey;
  perServing?: number;
  unit?: string;
  dailyLimit?: number;
  share?: number; // 0..1
  band?: FitVerdict;
  trigger?: string; // e.g. "Your report flags HbA1c as high (Aug 2026)"
};

export type FitResult = {
  verdict: FitVerdict;
  reasons: FitReason[];
  missing: string[];
  ruleVersion: string;
  ruleSets: string[];
  inputsHash: string;
  note?: string;
};
