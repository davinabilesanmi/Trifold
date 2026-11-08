import { describe, expect, it } from "vitest";
import { parseMoneyToCents } from "@/lib/format";

describe("parseMoneyToCents", () => {
  it("parses prices without float rounding", () => {
    expect(parseMoneyToCents("12.5")).toBe(1250);
    expect(parseMoneyToCents("0.29")).toBe(29);
    expect(parseMoneyToCents("1000")).toBe(100000);
    expect(parseMoneyToCents("")).toBe(0);
  });
  it("rejects invalid input", () => {
    expect(parseMoneyToCents("abc")).toBeNull();
    expect(parseMoneyToCents("-1")).toBeNull();
    expect(parseMoneyToCents("1.234")).toBeNull();
  });
});
