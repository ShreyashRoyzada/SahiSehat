import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { dataDir } from "./paths";

// ---- Field-level encryption for the health vault (AES-256-GCM) -------------

let cachedKey: Buffer | null = null;

function vaultKey(): Buffer {
  if (cachedKey) return cachedKey;
  const env = process.env.VAULT_KEY;
  if (env) {
    const key = Buffer.from(env, "base64");
    if (key.length !== 32) throw new Error("VAULT_KEY must be 32 bytes, base64-encoded");
    cachedKey = key;
    return key;
  }
  if (process.env.NODE_ENV === "production" && !process.env.ALLOW_DEV_VAULT_KEY) {
    throw new Error("VAULT_KEY is required in production");
  }
  // Development only: a local key file next to the data.
  const dir = dataDir();
  const file = join(dir, "vault.dev.key");
  if (!existsSync(file)) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(file, randomBytes(32).toString("base64"), { mode: 0o600 });
  }
  cachedKey = Buffer.from(readFileSync(file, "utf8").trim(), "base64");
  return cachedKey;
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", vaultKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

export function decrypt(blob: string): string {
  const [v, iv, tag, enc] = blob.split(":");
  if (v !== "v1") throw new Error("Unknown ciphertext version");
  const decipher = createDecipheriv("aes-256-gcm", vaultKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(enc, "base64")), decipher.final()]).toString("utf8");
}

export const encryptJson = (v: unknown) => encrypt(JSON.stringify(v));
export const decryptJson = <T>(blob: string): T => JSON.parse(decrypt(blob)) as T;

// ---- Passwords and tokens ----------------------------------------------------

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt:${salt.toString("base64")}:${hash.toString("base64")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split(":");
  if (scheme !== "scrypt") return false;
  const expected = Buffer.from(hash, "base64");
  const actual = scryptSync(password, Buffer.from(salt, "base64"), expected.length);
  return timingSafeEqual(expected, actual);
}

export const newToken = () => randomBytes(32).toString("base64url");
export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
