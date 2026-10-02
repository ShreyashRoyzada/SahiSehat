// Medical-boundary guard for the assistant (PRD D4, G4). Runs before any
// model call, so diagnosis, medicine and dose questions are always declined
// the same way, whichever engine answers.

const MEDICINE = /\b(metformin|insulin|glimepiride|gliclazide|sitagliptin|vildagliptin|dapagliflozin|empagliflozin|semaglutide|ozempic|wegovy|mounjaro|tirzepatide|statins?|atorvastatin|rosuvastatin|ecosprin|aspirin|telmisartan|losartan|amlodipine|metoprolol|ramipril|hydrochlorothiazide|thyronorm|levothyroxine|eltroxin)\b/i;
const DOSE = /\b(dose|dosage|doses|how many (tablets?|pills?|units?|mg)|\d+\s*(mg|units?)\b.*\b(take|tablet|pill)|tablets?|pills?|medicines?|medications?|prescriptions?|drugs?|supplement dose)\b/i;
const DIAGNOSIS = /\b(do i have|am i (diabetic|pre-?diabetic|hypertensive)|have i got|diagnos\w*|is it (diabetes|cancer)|what disease|which disease|should i (stop|start|skip|reduce|increase) (taking|my)|instead of (my )?(medicine|tablets?|insulin)|cure|reverse (my )?(diabetes|cholesterol|bp|blood pressure)|treat(ment)? (for|of))\b/i;

export const DECLINE_TEXT =
  "I can't help with diagnosis, medicines or doses. That needs your doctor, who knows your full history. I can help you choose packaged foods: ask which products in a category suit your numbers, why a product got its verdict, or what to buy instead.";

export function medicalBoundary(question: string): { declined: true; text: string } | null {
  if (MEDICINE.test(question) || DOSE.test(question) || DIAGNOSIS.test(question)) {
    return { declined: true, text: DECLINE_TEXT };
  }
  return null;
}
