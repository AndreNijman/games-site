import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "../../worker/index.js";

// The Krillion mirror proxies krillion.io, whose Puffer Party join now needs a
// Turnstile check that can only pass on krillion.io itself.
const upstreamJson = (status: number, data: unknown) =>
  vi.fn(async () => new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  }));

const tokenRequest = (method = "GET") => worker.fetch(
  new Request("https://krillion.andrenijman.com/api/party/token", { method, headers: { Accept: "*/*" } }),
  {},
  { waitUntil() {} },
);

afterEach(() => vi.unstubAllGlobals());

describe("Krillion mirror", () => {
  it("answers Puffer Party's Turnstile check with a plain refusal", async () => {
    vi.stubGlobal("fetch", upstreamJson(403, {
      code: "party-verification",
      siteKey: "0x4AAAAAAF2eix0RNjibbMu0",
      guestId: "abc",
      error: "Complete the verification to join Puffer Party.",
    }));
    const response = await tokenRequest();
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.code).toBe("party-unavailable");
    expect(body.error).toMatch(/Puffer Party is broken/);
    expect(body).not.toHaveProperty("siteKey");
  });

  it("passes a granted party token through untouched", async () => {
    vi.stubGlobal("fetch", upstreamJson(200, { token: "t", exp: 123 }));
    const response = await tokenRequest();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ token: "t", exp: 123 });
  });

  it("leaves other 403s from the token endpoint alone", async () => {
    vi.stubGlobal("fetch", upstreamJson(403, { code: "banned", error: "No." }));
    const response = await tokenRequest();
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe("banned");
  });
});
