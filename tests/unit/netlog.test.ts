import { describe, expect, it } from "vitest";
import { judgeNetLog, netPlayers, normalizeNetLog, NET_GAMES } from "../../worker/netlog.js";

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

  it("sums players per game, laggiest first, counting only their own lag", () => {
    const logs = [
      normalizeNetLog("fart", { at: "2026-10-26T10:00:00Z", seats: [seat({ name: "victor", rttP95: 320, rttMax: 900 }), seat({ name: "mo" })] }),
      normalizeNetLog("fart", { at: "2026-10-26T11:00:00Z", seats: [seat({ name: "victor", rttP95: 80 }), seat({ name: "mo" })] }),
      normalizeNetLog("bop", { at: "2026-10-26T12:00:00Z", seats: [seat({ name: "mo", fpsMed: 20 })] }),
    ];
    const players = netPlayers(logs);
    expect(players.map((p) => `${p.game}:${p.name}`)).toEqual(["fart:victor", "bop:mo", "fart:mo"]);
    expect(players[0]).toMatchObject({ games: 2, laggy: 1, rttWorst: 900, last: "2026-10-26T11:00:00.000Z" });
    expect(players[2]).toMatchObject({ games: 2, laggy: 0 });
  });
});
