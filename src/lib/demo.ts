// Riya, 34: a fictional persona from the PRD. No real person's data is used anywhere.
import type { Marker, Profile } from "./types";

export const RIYA: { profile: Profile; markers: Marker[] } = {
  profile: { ageBand: "30-44", conditions: [], goals: ["Eat less sugar", "Lower LDL"], diet: "vegetarian", allergens: [], screen: [] },
  markers: [
    { name: "hba1c", value: 6.1, unit: "%", sampleDate: "2026-08-14", labFlag: "high", labRange: "4.0 - 5.6", source: "report" },
    { name: "fasting-glucose", value: 104, unit: "mg/dL", sampleDate: "2026-08-14", labFlag: "high", labRange: "70 - 100", source: "report" },
    { name: "ldl", value: 138, unit: "mg/dL", sampleDate: "2026-08-14", labFlag: "high", labRange: "< 100", source: "report" },
    { name: "hdl", value: 46, unit: "mg/dL", sampleDate: "2026-08-14", labFlag: "normal", labRange: "> 40", source: "report" },
    { name: "triglycerides", value: 141, unit: "mg/dL", sampleDate: "2026-08-14", labFlag: "normal", labRange: "< 150", source: "report" },
    { name: "systolic-bp", value: 118, unit: "mmHg", sampleDate: "2026-09-20", labFlag: null, labRange: null, source: "typed" },
    { name: "diastolic-bp", value: 76, unit: "mmHg", sampleDate: "2026-09-20", labFlag: null, labRange: null, source: "typed" },
  ],
};
