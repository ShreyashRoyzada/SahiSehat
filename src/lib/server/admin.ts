import "server-only";
import { cookies } from "next/headers";
import { createHmac } from "node:crypto";
import { appDb, audit, now } from "./db";
import { newToken, safeEqual, sha256 } from "./crypto";

// Admin console sign-in: a shared password plus a TOTP code (PRD: two-factor
// on admin). Every write records the named person who made it.

const COOKIE = "ss_admin";
const HOURS = 8;

function base32Decode(s: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = s.replace(/=+$/, "").replace(/\s+/g, "").toUpperCase();
  let bits = "";
  for (const ch of clean) {
    const v = alphabet.indexOf(ch);
    if (v < 0) throw new Error("Invalid base32");
    bits += v.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

export function totp(secret: string, at = Date.now(), step = 30): string {
  const counter = Math.floor(at / 1000 / step);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const h = createHmac("sha1", base32Decode(secret)).update(buf).digest();
  const offset = h[h.length - 1] & 0xf;
  const code = ((h.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).toString().padStart(6, "0");
  return code;
}

export function verifyTotp(secret: string, code: string): boolean {
  const c = code.replace(/\s+/g, "");
  return [-1, 0, 1].some((w) => safeEqual(totp(secret, Date.now() + w * 30_000), c));
}

export function adminConfig(): { enabled: boolean; twoFactor: boolean; devDefault: boolean } {
  const pw = process.env.ADMIN_PASSWORD;
  const prod = process.env.NODE_ENV === "production";
  if (!pw && prod) return { enabled: false, twoFactor: false, devDefault: false };
  return { enabled: true, twoFactor: Boolean(process.env.ADMIN_TOTP_SECRET) || prod, devDefault: !pw };
}

export async function adminSignIn(actor: string, password: string, code: string): Promise<string | null> {
  const cfg = adminConfig();
  if (!cfg.enabled) return "Admin is disabled: set ADMIN_PASSWORD and ADMIN_TOTP_SECRET.";
  const name = actor.trim().slice(0, 80);
  if (!name) return "Enter your name or email so actions are attributed to you.";
  const expected = process.env.ADMIN_PASSWORD ?? "sahisehat-admin";
  if (!safeEqual(sha256(password), sha256(expected))) {
    audit(name, "admin.signin.failed", null);
    return "Wrong password or code.";
  }
  if (cfg.twoFactor) {
    const secret = process.env.ADMIN_TOTP_SECRET;
    if (!secret || !verifyTotp(secret, code)) {
      audit(name, "admin.signin.failed", null);
      return "Wrong password or code.";
    }
  }
  const token = newToken();
  appDb().prepare("INSERT INTO admin_sessions (token_hash, actor, created_at, expires_at) VALUES (?, ?, ?, ?)").run(sha256(token), name, now(), new Date(Date.now() + HOURS * 3600_000).toISOString());
  (await cookies()).set(COOKIE, token, { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", maxAge: HOURS * 3600 });
  audit(name, "admin.signin", null);
  return null;
}

export async function currentAdmin(): Promise<string | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const row = appDb().prepare("SELECT actor FROM admin_sessions WHERE token_hash = ? AND expires_at > ?").get(sha256(token), now()) as { actor: string } | undefined;
  return row?.actor ?? null;
}

export async function requireAdmin(): Promise<string> {
  const a = await currentAdmin();
  if (!a) throw new Error("Admin sign-in required");
  return a;
}

export async function adminSignOut() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) appDb().prepare("DELETE FROM admin_sessions WHERE token_hash = ?").run(sha256(token));
  jar.delete(COOKIE);
}

// ---- Metrics (PRD success metrics; no health data involved) --------------------

export function metrics(days = 7) {
  const db = appDb();
  const since = new Date(Date.now() - days * 86400_000).toISOString();
  const count = (kind: string) => (db.prepare("SELECT COUNT(*) n FROM events WHERE kind = ? AND at >= ?").get(kind, since) as { n: number }).n;
  // North star: signed-in people who viewed a Fit verdict and then opened a swap, saved one or tapped to buy.
  const wpd = (db
    .prepare(
      `SELECT COUNT(DISTINCT v.actor) n FROM events v WHERE v.kind = 'verdict_view' AND v.at >= ? AND v.actor != 'anon'
       AND EXISTS (SELECT 1 FROM events a WHERE a.actor = v.actor AND a.kind IN ('swap_open','swap_save','buy_click') AND a.at >= v.at)`,
    )
    .get(since) as { n: number }).n;
  const verdicts = count("verdict_view");
  return {
    weeklyPersonalisedDecisions: wpd,
    verdictViews: verdicts,
    swapOpens: count("swap_open"),
    swapSaves: count("swap_save"),
    buyClicks: count("buy_click"),
    outboundClickRate: verdicts ? count("buy_click") / verdicts : 0,
    searches: count("search"),
    cartChecks: count("cart_check"),
    assistantQuestions: count("assistant"),
    accounts: (db.prepare("SELECT COUNT(*) n FROM accounts WHERE is_demo = 0").get() as { n: number }).n,
  };
}
