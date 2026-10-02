export const CONDITION_LABELS = [
  { value: "diabetes", label: "Diabetes" },
  { value: "prediabetes", label: "Prediabetes or borderline sugar" },
  { value: "high-cholesterol", label: "High cholesterol or triglycerides" },
  { value: "high-bp", label: "High blood pressure" },
] as const;

export const ALLERGEN_OPTIONS = [
  ["milk", "Milk"], ["gluten", "Gluten"], ["peanut", "Peanut"], ["treenut", "Tree nuts"], ["soy", "Soy"], ["sesame", "Sesame"], ["mustard", "Mustard"], ["egg", "Egg"], ["fish", "Fish"], ["crustacean", "Crustaceans"], ["sulphite", "Sulphite"],
] as const;

export const AGE_OPTIONS = ["under-18", "18-29", "30-44", "45-59", "60-74", "75+"] as const;
