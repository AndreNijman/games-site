import { describe, expect, it } from "vitest";
import { cleanDevName, signDevPass, verifyDevPass } from "../../shared/net/netdev.js";

async function keypair() {
  const keys = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]) as CryptoKeyPair;
  const b64 = (bytes: ArrayBuffer) => Buffer.from(bytes).toString("base64url");
  return {
    privateKey: b64(await crypto.subtle.exportKey("pkcs8", keys.privateKey)),
    publicKey: b64(await crypto.subtle.exportKey("raw", keys.publicKey)),
  };
}

describe("dev passes", () => {
  it("names the dev only for the game it was signed for, until it expires", async () => {
    const { privateKey, publicKey } = await keypair();
    const now = 1_800_000_000_000;
    const { pass, exp } = await signDevPass(privateKey, { name: "andre!", host: "fart.andrenijman.com", now });
    expect(exp).toBe(now / 1000 + 15 * 60);
    expect(await verifyDevPass(pass, "fart.andrenijman.com", { publicKey, now })).toEqual({ name: "ANDRE" });
    expect(await verifyDevPass(pass, "bop.andrenijman.com", { publicKey, now })).toBeNull();
    expect(await verifyDevPass(pass, "fart.andrenijman.com", { publicKey, now: exp * 1000 + 1 })).toBeNull();
  });

  it("refuses forged, tampered and malformed passes", async () => {
    const mine = await keypair();
    const theirs = await keypair();
    const { pass } = await signDevPass(theirs.privateKey, { name: "mallory", host: "fart.andrenijman.com" });
    expect(await verifyDevPass(pass, "fart.andrenijman.com", { publicKey: mine.publicKey })).toBeNull();
    const own = (await signDevPass(mine.privateKey, { name: "andre", host: "fart.andrenijman.com" })).pass.split(".");
    const forged = Buffer.from(JSON.stringify({ n: "ANDRE", h: "fart.andrenijman.com", x: 9e9 })).toString("base64url");
    expect(await verifyDevPass(`v1.${forged}.${own[2]}`, "fart.andrenijman.com", { publicKey: mine.publicKey })).toBeNull();
    for (const bad of ["", "v1", "v2.a.b", "v1..", null, undefined, 42]) {
      expect(await verifyDevPass(bad, "fart.andrenijman.com", { publicKey: mine.publicKey })).toBeNull();
    }
  });

  it("cleans display names", () => {
    expect(cleanDevName(" andre  nijman ")).toBe("ANDRE NIJMAN");
    expect(cleanDevName("<b>x</b>")).toBe("BXB");
    expect(cleanDevName("a".repeat(30))).toHaveLength(16);
  });
});
