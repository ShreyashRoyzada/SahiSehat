import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
import { totp } from "@/lib/server/admin";

describe("TOTP (RFC 6238 test vector, SHA-1)", () => {
  // Secret "12345678901234567890" in base32.
  const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
  it("matches the RFC vector at T=59s", () => expect(totp(secret, 59_000)).toBe("287082"));
  it("matches the RFC vector at T=1111111109s", () => expect(totp(secret, 1111111109_000)).toBe("081804"));
});
