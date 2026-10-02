import "server-only";
import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { appDb, audit, now, vaultDb } from "./db";
import { hashPassword, newToken, sha256, verifyPassword } from "./crypto";

const COOKIE = "ss_session";
const DAY = 24 * 60 * 60 * 1000;

export type Account = { id: string; email: string | null; isDemo: boolean };

export async function currentAccount(): Promise<Account | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const row = appDb()
    .prepare("SELECT a.id, a.email, a.is_demo FROM sessions s JOIN accounts a ON a.id = s.account_id WHERE s.token_hash = ? AND s.expires_at > ?")
    .get(sha256(token), now()) as { id: string; email: string | null; is_demo: number } | undefined;
  return row ? { id: row.id, email: row.email, isDemo: row.is_demo === 1 } : null;
}

export async function requireAccount(): Promise<Account> {
  const a = await currentAccount();
  if (!a) throw new Error("Not signed in");
  return a;
}

async function startSession(accountId: string, days: number) {
  const token = newToken();
  appDb().prepare("INSERT INTO sessions (token_hash, account_id, created_at, expires_at) VALUES (?, ?, ?, ?)").run(sha256(token), accountId, now(), new Date(Date.now() + days * DAY).toISOString());
  (await cookies()).set(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: days * 86400 });
}

export async function signUp(email: string, password: string, invite: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = appDb();
  const cleanEmail = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail)) return { ok: false, error: "Enter a valid email address." };
  if (password.length < 10) return { ok: false, error: "Use a password of at least 10 characters." };
  const code = db.prepare("SELECT code FROM invites WHERE code = ?").get(invite.trim().toUpperCase());
  if (!code) return { ok: false, error: "That invite code isn't valid. SahiSehat is invite-only during the beta." };
  if (db.prepare("SELECT 1 FROM accounts WHERE email = ?").get(cleanEmail)) return { ok: false, error: "An account with that email already exists. Sign in instead." };
  const id = randomUUID();
  db.prepare("INSERT INTO accounts (id, email, password_hash, is_demo, created_at) VALUES (?, ?, ?, 0, ?)").run(id, cleanEmail, hashPassword(password), now());
  db.prepare("UPDATE invites SET used_by = COALESCE(used_by, ?), used_at = COALESCE(used_at, ?) WHERE code = ?").run(id, now(), invite.trim().toUpperCase());
  audit("system", "account.created", null, { invite: true });
  await startSession(id, 30);
  return { ok: true };
}

export async function signIn(email: string, password: string): Promise<boolean> {
  const row = appDb().prepare("SELECT id, password_hash FROM accounts WHERE email = ? AND is_demo = 0").get(email.trim().toLowerCase()) as { id: string; password_hash: string } | undefined;
  if (!row || !verifyPassword(password, row.password_hash)) return false;
  await startSession(row.id, 30);
  return true;
}

export async function signOut() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) appDb().prepare("DELETE FROM sessions WHERE token_hash = ?").run(sha256(token));
  jar.delete(COOKIE);
}

/** A throwaway account for the fictional-persona demo (GTM "beta hook"). */
export async function startDemoAccount(): Promise<string> {
  purgeExpiredDemos();
  const id = `demo-${randomUUID()}`;
  appDb().prepare("INSERT INTO accounts (id, email, password_hash, is_demo, created_at) VALUES (?, NULL, NULL, 1, ?)").run(id, now());
  await startSession(id, 1);
  return id;
}

/** Delete everything for an account: profile, numbers, consents, uploads, derived results (PRD B7). */
export function deleteAccountData(accountId: string, opts: { keepAccount?: boolean } = {}) {
  const v = vaultDb();
  const a = appDb();
  v.transaction(() => {
    v.prepare("DELETE FROM persons WHERE account_id = ?").run(accountId);
    v.prepare("DELETE FROM markers WHERE account_id = ?").run(accountId);
    v.prepare("DELETE FROM consents WHERE account_id = ?").run(accountId);
    v.prepare("DELETE FROM report_uploads WHERE account_id = ?").run(accountId);
    v.prepare("DELETE FROM fit_results WHERE account_id = ?").run(accountId);
  })();
  a.prepare("DELETE FROM saved WHERE account_id = ?").run(accountId);
  if (!opts.keepAccount) {
    a.prepare("DELETE FROM sessions WHERE account_id = ?").run(accountId);
    a.prepare("DELETE FROM accounts WHERE id = ?").run(accountId);
  }
  // Logged without personal data.
  audit("system", "person.deleted", null, { demo: accountId.startsWith("demo-") });
}

export function purgeExpiredDemos() {
  const old = appDb().prepare("SELECT id FROM accounts WHERE is_demo = 1 AND created_at < ?").all(new Date(Date.now() - DAY).toISOString()) as { id: string }[];
  for (const { id } of old) deleteAccountData(id);
}
