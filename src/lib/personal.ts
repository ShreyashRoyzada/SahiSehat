// Pure helpers that apply one person's profile to catalogue views.
import type { FitResult, Marker, Profile } from "./types";
import type { Catalogue, ProductView } from "./catalogue-core";
import { computeFit } from "./fit/engine";
import { findSwaps, type SwapResult } from "./swaps";

export type Person = { profile: Profile; markers: Marker[] };

export function fitOf(cat: Catalogue, person: Person | null, v: ProductView, asOf: Date): FitResult | null {
  return person ? computeFit({ profile: person.profile, markers: person.markers, product: v.product, rules: cat.rules, asOf }) : null;
}

export function swapsOf(cat: Catalogue, person: Person | null, v: ProductView, asOf: Date): SwapResult {
  const toCandidate = (x: ProductView) => ({ product: x.product, quality: x.quality, swapBlock: x.swapBlock, fit: fitOf(cat, person, x, asOf) });
  const pool = cat.list.filter((x) => x.product.useGroup === v.product.useGroup);
  return findSwaps(toCandidate(v), pool.map(toCandidate));
}

/** What a page needs to evaluate products for one person. */
export type Evaluator = {
  cat: Catalogue;
  personalised: boolean;
  fit: (v: ProductView) => FitResult | null;
  swaps: (v: ProductView) => SwapResult;
};

export function evaluator(cat: Catalogue, person: Person | null, asOf: Date): Evaluator {
  return { cat, personalised: Boolean(person), fit: (v) => fitOf(cat, person, v, asOf), swaps: (v) => swapsOf(cat, person, v, asOf) };
}
