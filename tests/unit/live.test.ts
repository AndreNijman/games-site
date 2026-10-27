import { describe, expect, it } from "vitest";
import { LIVE_HIDDEN_MS, LIVE_VISIBLE_MS, LiveTabs, cleanBeat, liveDevices } from "../../worker/live.js";

const beat = (over: Record<string, unknown> = {}) => ({
  device: "d1", host: "topout.andrenijman.com", tab: "abcd1234", path: "/", idle: 0, state: "on",
  country: "AU", city: "Perth", colo: "PER", ...over,
});

describe("live now", () => {
  it("accepts only well-formed reports", () => {
    expect(cleanBeat({ tab: "abcd1234", path: "/play", idle: 12.4, state: "hidden" }))
      .toEqual({ tab: "abcd1234", path: "/play", idle: 12, state: "hidden" });
    expect(cleanBeat({ tab: "x", state: "on" })).toBeNull();
    expect(cleanBeat({ tab: "abcd1234", state: "deleted" })).toBeNull();
    expect(cleanBeat(null)).toBeNull();
    expect(cleanBeat({ tab: "abcd1234", idle: -5 })?.idle).toBe(0);
  });

  it("tells playing, idle and background apart and keeps when a tab opened", () => {
    const live = new LiveTabs();
    live.beat(beat(), 0);
    live.beat(beat(), 20_000);
    expect(live.list(20_000)[0]).toMatchObject({ status: "playing", forS: 20, idleS: 0 });
    live.beat(beat({ idle: 90 }), 40_000);
    expect(live.list(40_000)[0]).toMatchObject({ status: "idle", forS: 40, idleS: 90 });
    live.beat(beat({ state: "hidden", idle: 95 }), 45_000);
    expect(live.list(45_000)[0].status).toBe("background");
  });

  it("drops closed tabs at once and silent ones after their timeout", () => {
    const live = new LiveTabs();
    live.beat(beat(), 0);
    live.beat(beat({ tab: "hidden01", state: "hidden" }), 0);
    live.beat(beat({ tab: "closed01" }), 0);
    live.beat(beat({ tab: "closed01", state: "gone" }), 1000);
    expect(live.list(1000).map((t) => t.tab).sort()).toEqual(["abcd1234", "hidden01"]);
    expect(live.list(LIVE_VISIBLE_MS + 1).map((t) => t.tab)).toEqual(["hidden01"]);
    expect(live.list(LIVE_HIDDEN_MS + 1)).toEqual([]);
  });

  it("groups tabs by device, best status first", () => {
    const live = new LiveTabs();
    live.beat(beat({ device: "a", state: "hidden" }), 0);
    live.beat(beat({ device: "b", host: "fart.andrenijman.com" }), 1000);
    live.beat(beat({ device: "a", tab: "second01", host: "bop.andrenijman.com" }), 5000);
    const devices = liveDevices(live.list(6000));
    expect(devices.map((d) => [d.device, d.status, d.tabs.length])).toEqual([["a", "playing", 2], ["b", "playing", 1]]);
  });
});
