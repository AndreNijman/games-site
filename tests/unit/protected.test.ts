import { describe, expect, it } from "vitest";
import { isProtectedAccount, isProtectedAccountId, isProtectedDevice, isProtectedVisit } from "../../worker/protected.js";

// A D1 stand-in that knows two accounts and three devices.
const accounts: Record<number, string> = { 1: "AndreNijman", 2: "someone" };
const devices: Record<string, number | null> = { mine: 1, theirs: 2, fresh: null };
const db = {
  prepare(sql: string) {
    return {
      bind(id: string | number) {
        return {
          async first() {
            if (sql.includes("FROM devices")) {
              const owner = devices[id as string];
              return owner ? { username: accounts[owner] } : null;
            }
            return accounts[id as number] ? { username: accounts[id as number] } : null;
          },
        };
      },
    };
  },
};

describe("the protected account", () => {
  it("matches andrenijman whatever the case, and nobody else", () => {
    expect(isProtectedAccount("andrenijman")).toBe(true);
    expect(isProtectedAccount(" AndreNijman ")).toBe(true);
    expect(isProtectedAccount("andrenijman2")).toBe(false);
    expect(isProtectedAccount(null)).toBe(false);
  });

  it("finds it by account id and by any device that has signed in to it", async () => {
    expect(await isProtectedAccountId(db, 1)).toBe(true);
    expect(await isProtectedAccountId(db, 2)).toBe(false);
    expect(await isProtectedAccountId(db, null)).toBe(false);
    expect(await isProtectedDevice(db, "mine")).toBe(true);
    expect(await isProtectedDevice(db, "theirs")).toBe(false);
    expect(await isProtectedDevice(db, "fresh")).toBe(false);
  });

  it("covers a visit signed in as the owner, or on the owner's browser while signed out", async () => {
    expect(await isProtectedVisit(db, { username: "andrenijman" }, { account_id: null })).toBe(true);
    expect(await isProtectedVisit(db, null, { account_id: 1 })).toBe(true);
    expect(await isProtectedVisit(db, { username: "someone" }, { account_id: 2 })).toBe(false);
    expect(await isProtectedVisit(db, null, null)).toBe(false);
  });
});
