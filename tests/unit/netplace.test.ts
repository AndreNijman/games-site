import { describe, expect, it } from "vitest";
import { chooseRegion, newShard, playerWhere, regionOfColo, roomStub, shardRegion, whereOf, withWhere } from "../../shared/net/netplace.js";
import { NetStats } from "../../shared/net/netstats.js";
import { normalizeNetLog } from "../../worker/netlog.js";

const europe = { weur: 30, eeur: 50, enam: 100, apac: 190, oc: 290 };
const asia = { weur: 420, eeur: 330, enam: 250, apac: 60, oc: 140 };

describe("room placement", () => {
  const at = (probes: Record<string, number> | null, rtt: number | null) => ({ probes, rtt });

  it("moves a mixed group only when the worst ping clearly improves", () => {
    // three in Europe at 30 ms, one in Asia at 420 ms in a London room
    const group = [at(europe, 30), at(europe, 30), at(europe, 30), at(asia, 420)];
    expect(chooseRegion(group)).toEqual({ region: "apac", worst: 190, from: 420 });
    expect(chooseRegion([at(europe, 30), at(europe, 35)])).toBeNull();
    expect(chooseRegion([at(europe, 30), at(europe, 90)])).toBeNull();
    // never makes someone else laggy to help one player
    expect(chooseRegion([at({ ...europe, apac: 260 }, 30), at(asia, 420)])?.region).toBe("enam");
  });

  it("stays put without everyone's probes and ping", () => {
    expect(chooseRegion([at(europe, 30), at(null, 420)])).toBeNull();
    expect(chooseRegion([at(europe, 30), at(asia, null)])).toBeNull();
    expect(chooseRegion([at(asia, 420)])).toBeNull();
  });

  it("weighs the path through the relay when the host runs the game", () => {
    expect(chooseRegion([at(asia, 420)], { via: at(europe, 30) })).toEqual({ region: "apac", worst: 250, from: 450 });
  });

  it("names shards by region and places their objects there", () => {
    const shard = newShard("apac");
    expect(shard).toMatch(/^apac-[a-z0-9]{6}$/);
    expect(shardRegion(shard)).toBe("apac");
    expect(shardRegion("nowhere-abcdef")).toBe("");
    const calls: unknown[] = [];
    const ns = { idFromName: (n: string) => n, get: (id: string, opts?: unknown) => (calls.push([id, opts]), id) };
    roomStub(ns, "ABCD");
    roomStub(ns, "ABCD", shard);
    expect(calls).toEqual([["ABCD", undefined], [`ABCD~${shard}`, { locationHint: "apac" }]]);
  });

  it("knows colos' regions", () => {
    expect(regionOfColo("lhr")).toBe("weur");
    expect(regionOfColo("SIN")).toBe("apac");
    expect(regionOfColo("PER")).toBe("oc");
    expect(regionOfColo("XXX")).toBe("");
  });

  it("carries where a player is from the Worker to the room", () => {
    const req = new Request("https://relay/ws", { headers: { "X-Games-Country": "ZZ" } });
    Object.defineProperty(req, "cf", { value: { country: "br", colo: "GRU" } });
    const where = playerWhere(req);
    expect(where).toEqual({ country: "BR", edge: "GRU" });
    expect(playerWhere(req, { trustHeaders: true }).country).toBe("ZZ");
    expect(whereOf(withWhere(req, where))).toEqual(where);
  });

  it("puts where each player is in the lag record, and the collector keeps it", () => {
    const net = new NetStats();
    net.seat("a", "victor", { country: "BR", edge: "GRU" });
    net.ping("a", 420, 60, 20);
    const log = normalizeNetLog("fart", net.record({ code: "X", region: "eeur", moved: { from: "LHR", to: "eeur" } }));
    expect(log.seats[0]).toMatchObject({ name: "victor", country: "BR", edge: "GRU" });
    expect(log.region).toBe("eeur");
    expect(log.moved).toEqual({ from: "LHR", to: "eeur" });
  });
});
