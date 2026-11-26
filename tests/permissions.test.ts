import { describe, expect, it } from "vitest";
import { can, parsePermissions, roleFor, ROLE_PRESETS, serializePermissions } from "@/lib/permissions";

describe("responsibilities", () => {
  it("names presets and falls back to Custom", () => {
    expect(roleFor(ROLE_PRESETS.OWNER)).toBe("OWNER");
    expect(roleFor(ROLE_PRESETS.GM)).toBe("GM");
    expect(roleFor([...ROLE_PRESETS.SALES_REP].reverse())).toBe("SALES_REP");
    expect(roleFor([...ROLE_PRESETS.SALES_REP, "viewReports"])).toBe("CUSTOM");
  });

  it("round-trips stored lists and ignores unknown entries", () => {
    const stored = serializePermissions(["viewReports", "sell", "sell"]);
    expect(stored).toBe("sell,viewReports");
    expect(parsePermissions(`${stored},deleteEverything, `)).toEqual(["sell", "viewReports"]);
  });

  it("matches what Trifold asked for", () => {
    const gm = { permissions: ROLE_PRESETS.GM };
    expect(can.viewReports(gm)).toBe(true);
    expect(can.viewAllSales(gm)).toBe(true);
    expect(can.viewFinancials(gm)).toBe(false); // no income statement or balance sheet
    expect(can.giveDiscounts({ permissions: ROLE_PRESETS.SALES_REP })).toBe(false); // management gives discounts
    expect(can.giveDiscounts({ permissions: ROLE_PRESETS.OUTLET_MANAGER })).toBe(true);
    expect(can.viewAllSales({ permissions: ROLE_PRESETS.SALES_REP })).toBe(false);
    expect(can.viewFinancials({ permissions: ROLE_PRESETS.OWNER })).toBe(true);
    expect(can.manageLocations({ permissions: ROLE_PRESETS.GM })).toBe(false);
  });
});
