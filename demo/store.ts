// Per-viewer profile kept only in this browser. Nothing is sent anywhere.
import type { Marker, Profile } from "../src/lib/types";

export type Saved = { kind: "demo" | "own" | "none"; profile: Profile | null; markers: Marker[]; consentAt: string | null; saved: string[] };
const KEY = "sahisehat.demo.v1";

export function load(): Saved | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}

export function save(s: Saved) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage blocked: the page keeps working for this visit */
  }
}

export function clear() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
