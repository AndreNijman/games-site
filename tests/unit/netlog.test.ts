import { describe, expect, it } from "vitest";
// @ts-expect-error plain JS module shared with the Worker
import { judgeNetLog, normalizeNetLog, NET_GAMES } from "../../worker/netlog.js";

const seat = (o = {}) => ({ name: "A", rttMed: 40, rttP95: 60, rttMax: 90, fpsMed: 60, fpsMin: 55, frameMax: 30, reconnects: 0, ...o });

describe("multiplayer lag logs", () => {
  it("keeps a clean match clean", () => {
    const log = normalizeNetLog("bop", { code: "ABCD", runTime: 120, seats: [seat(), seat({ name: "B" })] });
    expect(log.lag).toEqual([]);
    expect(log.seats).toHaveLength(2);
    expect(log.game).toBe("bop");
  });

  it("flags high ping, low frame rate, reconnects and a stalling server", () => {
    const log = normalizeNetLog("tung", {
      runTime: 60,
      server: { simSpeed: 0.9, tickGapMax: 400 },
      seats: [seat({ name: "far", rttP95: 450 }), seat({ name: "slow", fpsMed: 22 }), seat({ name: "flaky", reconnects: 2 })],
    });
    expect(log.lag).toEqual([
      "far: ping p95 450 ms", "slow: 22 fps", "flaky: 2 reconnect(s)",
      "server: sim at 90% speed", "server: tick loop stalled 400 ms",
    ]);
  });

  it("judges by its own limits, not the relay's say-so, but keeps extra notes", () => {
    const log = normalizeNetLog("scrap", { seats: [seat()], lag: ["relay: room rebuilt"] });
    expect(log.lag).toEqual(["relay: room rebuilt"]);
    expect(judgeNetLog({ seats: [seat({ rttP95: 201 })], server: null, runTime: 0 })).toEqual(["A: ping p95 201 ms"]);
  });

  it("clamps what a relay sends and refuses unknown games", () => {
    const log = normalizeNetLog("fart", { at: "nonsense", code: "x".repeat(99), seats: Array.from({ length: 40 }, () => seat({ name: "<b>" + "n".repeat(80), rttMed: -5, rttP95: "oops" })) });
    expect(log.seats).toHaveLength(16);
    expect(log.seats[0].name.length).toBe(32);
    expect(log.seats[0].rttMed).toBe(0);
    expect(log.code.length).toBe(16);
    expect(Number.isFinite(Date.parse(log.at))).toBe(true);
    expect(() => normalizeNetLog("evil", {})).toThrow();
    expect(NET_GAMES.has("topout")).toBe(true);
  });
});
