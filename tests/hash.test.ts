import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { sha256Hex } from "@/lib/hash";

describe("sha256Hex", () => {
  for (const s of ["", "abc", "a".repeat(55), "a".repeat(56), "a".repeat(64), "स्वास्थ्य सही है", JSON.stringify({ x: [1, 2, 3] }).repeat(40)]) {
    it(`matches node:crypto for length ${s.length}`, () => expect(sha256Hex(s)).toBe(createHash("sha256").update(s).digest("hex")));
  }
});
