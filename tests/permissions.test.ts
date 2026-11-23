import { describe, expect, it } from "vitest";
import { can, parsePermissions, roleFor, ROLE_PRESETS, serializePermissions } from "@/lib/permissions";

describe("responsibilities", () => {
  it("names presets and falls back to Custom", () => {
    expect(roleFor(ROLE_PRESETS.ADMIN)).toBe("ADMIN");
    expect(roleFor(ROLE_PRESETS.MANAGER)).toBe("MANAGER");
    expect(roleFor([...ROLE_PRESETS.STAFF].reverse())).toBe("STAFF");
    expect(roleFor([...ROLE_PRESETS.STAFF, "viewReports"])).toBe("CUSTOM");
  });

  it("round-trips stored lists and ignores unknown entries", () => {
    const stored = serializePermissions(["viewReports", "sell", "sell"]);
    expect(stored).toBe("sell,viewReports");
    expect(parsePermissions(`${stored},deleteEverything, `)).toEqual(["sell", "viewReports"]);
  });

  it("checks individual responsibilities", () => {
    const storekeeper = { permissions: parsePermissions("receivePurchases,recordMovements") };
    expect(can.receivePurchases(storekeeper)).toBe(true);
    expect(can.sell(storekeeper)).toBe(false);
    expect(can.manageLocations({ permissions: ROLE_PRESETS.MANAGER })).toBe(false);
    expect(can.manageLocations({ permissions: ROLE_PRESETS.ADMIN })).toBe(true);
  });
});
