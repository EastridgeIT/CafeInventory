import { describe, expect, it } from "vitest";
import { PIN_PATTERN, ulid } from "../worker/crypto";

describe("ulid", () => {
  it("is 26 chars, unique, and sorts by time", () => {
    const a = ulid(1_000_000);
    const b = ulid(2_000_000);
    expect(a).toHaveLength(26);
    expect(a < b).toBe(true);
    expect(new Set(Array.from({ length: 200 }, () => ulid())).size).toBe(200);
  });
});

describe("PIN_PATTERN", () => {
  it("accepts 4 to 8 digits only", () => {
    for (const ok of ["1234", "12345678", "0000"]) expect(PIN_PATTERN.test(ok)).toBe(true);
    for (const bad of ["123", "123456789", "12a4", "", " 1234", "1234\n"]) expect(PIN_PATTERN.test(bad)).toBe(false);
  });
});
