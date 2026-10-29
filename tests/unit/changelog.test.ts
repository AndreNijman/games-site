import { describe, expect, it } from "vitest";
import {
  BEHIND_THE_SCENES, OTHER_GAMES, classify, countKinds, outcome, prompt, sourceSha, validSummary,
} from "../../scripts/changelog-lib.mjs";
import data from "../../src/data/changelog.json";
import { ALL, LOGS, countLine, slugOf, updateLabel } from "../../src/data/changelog";
import { GAMES } from "../../src/data/games";

describe("classify", () => {
  it("sorts conventional commits players see under their heading", () => {
    expect(classify("feat: hotbar for spells").kind).toBe("new");
    expect(classify("fix(net): reconnect after a drop").kind).toBe("fixed");
    expect(classify("perf: cache terrain chunks").kind).toBe("improved");
  });
  it("tidies the text: capital first letter, no full stop, scope dropped", () => {
    const c = classify("feat(ui): add a pause menu.\n\nLonger body here.");
    expect(c).toMatchObject({ type: "feat", kind: "new", text: "Add a pause menu", body: "Longer body here." });
  });
  it("hides tooling, docs, tests and chores", () => {
    for (const m of ["chore: bump deps", "ci: cache npm", "docs: readme", "test: more cases", "refactor: split", "build: vite 7"]) {
      expect(classify(m).kind, m).toBe("hidden");
    }
  });
  it("hides noise whatever its prefix", () => {
    for (const m of ["Merge pull request #4 from x/y", "Create CNAME", "Initial commit", "Deploy site from abc1234", "Update README.md", "wip", "fix: update cname"]) {
      expect(classify(m).kind, m).toBe("hidden");
    }
  });
  it("hides commits that name the games ours are modelled on", () => {
    expect(classify("feat: Terraria-style hotbar").kind).toBe("hidden");
    expect(classify("BTD6 parity for camo").kind).toBe("hidden");
    expect(classify("fix: match vanilla jump height").kind).toBe("hidden");
  });
  it("shows a plain, non-conventional subject as other", () => {
    expect(classify("Add a second boss").kind).toBe("other");
    expect(classify("").kind).toBe("hidden");
  });
});

describe("outcome", () => {
  it("counts inactive as live: GitHub keeps only that on superseded deploys", () => {
    expect(outcome(["inactive"])).toBe("success");
    expect(outcome(["in_progress", "success"])).toBe("success");
  });
  it("is failed on failure or error, pending otherwise", () => {
    expect(outcome(["failure"])).toBe("failed");
    expect(outcome(["error", "queued"])).toBe("failed");
    expect(outcome(["queued", "in_progress"])).toBe("pending");
    expect(outcome([])).toBe("pending");
  });
});

describe("sourceSha", () => {
  it("is the deployment's own sha off a source branch", () => {
    expect(sourceSha({ ref: "main", sha: "abc1234" }, undefined)).toBe("abc1234");
  });
  it("reads the source out of a gh-pages build commit", () => {
    expect(sourceSha({ ref: "gh-pages", sha: "fff" }, "Deploy site from 0123abc4567def")).toBe("0123abc4567def");
    expect(sourceSha({ ref: "gh-pages", sha: "fff" }, "deploy: 89abcde")).toBe("89abcde");
  });
  it("is null for a build commit that names no source", () => {
    expect(sourceSha({ ref: "gh-pages", sha: "fff" }, "Create CNAME")).toBeNull();
  });
});

describe("countKinds", () => {
  it("counts each kind", () => {
    const counts = countKinds(["feat: a", "feat: b", "fix: c", "chore: d", "Plain"].map(classify));
    expect(counts).toEqual({ new: 2, fixed: 1, improved: 0, other: 1, hidden: 1 });
  });
});

describe("prompt", () => {
  const game = { name: "Test", description: "A test game." };
  it("puts what players see first and keeps hidden commits out of the bodies", () => {
    const p = prompt(game, { at: "2026-10-29T00:00:00Z" }, ["chore: x\n\nsecret body", "feat: y"].map(classify));
    expect(p.indexOf("[feat] Y")).toBeLessThan(p.indexOf("[chore] X"));
    expect(p).not.toContain("secret body");
  });
  it("asks for the launch from the description", () => {
    expect(prompt(game, { launch: true, at: "2026-10-29T00:00:00Z" }, [])).toMatch(/first deploy/);
  });
});

describe("validSummary", () => {
  it("keeps plain sentences", () => {
    expect(validSummary("A hotbar for spells, tools and food.")).toBe(true);
  });
  it("rejects markdown, lists, empties, essays and banned words", () => {
    expect(validSummary("**New** hotbar")).toBe(false);
    expect(validSummary("Changes:\n- a\n- b")).toBe(false);
    expect(validSummary("Ok")).toBe(false);
    expect(validSummary("x".repeat(601))).toBe(false);
    expect(validSummary("A Terraria-style hotbar.")).toBe(false);
    expect(validSummary("Rooms now follow Isaac-style rules.")).toBe(false);
    expect(validSummary("The commit message says little.")).toBe(false);
    expect(validSummary(null)).toBe(false);
  });
});

// The stored changelog, as the hub will publish it.
type Stored = { repo: string; public: boolean; seen: number[]; updates: any[] };
const games = (data as unknown as { games: Record<string, Stored> }).games;

describe("changelog.json", () => {
  it("has a log for every game with a repository, and only those", () => {
    const withRepo = GAMES.filter((g) => g.repo).map(slugOf).sort();
    expect(Object.keys(games).sort()).toEqual(withRepo);
    for (const g of GAMES.filter((g) => g.repo)) expect(games[slugOf(g)].repo).toBe(g.repo);
  });
  it("publishes no commit of a private repository", () => {
    for (const [slug, e] of Object.entries(games)) {
      if (e.public) continue;
      for (const u of e.updates) expect(u.commits, `${slug} ${u.id}`).toEqual([]);
    }
  });
  it("shows no commit that names another game", () => {
    for (const e of Object.values(games)) {
      for (const u of e.updates) for (const c of u.commits) expect(c.text).not.toMatch(OTHER_GAMES);
    }
  });
  // null is a summary Haiku has yet to write (the next run retries it); the
  // page says "Notes on the way" until then, so it must not block a deploy
  it("has a valid summary on every update that has one", () => {
    for (const [slug, e] of Object.entries(games)) {
      for (const u of e.updates) {
        if (u.summary === null) continue;
        expect(validSummary(u.summary), `${slug} ${u.id}: ${u.summary}`).toBe(true);
        if (u.playerFacing === false) expect(u.summary).toBe(BEHIND_THE_SCENES);
      }
    }
  });
  it("starts each game with exactly one launch, oldest first, never the same deploy twice", () => {
    for (const [slug, e] of Object.entries(games)) {
      expect(e.updates[0]?.launch, slug).toBe(true);
      expect(e.updates.filter((u) => u.launch).length, slug).toBe(1);
      const ids = e.updates.map((u) => u.id);
      expect(new Set(ids).size, slug).toBe(ids.length);
      for (let i = 1; i < e.updates.length; i++) expect(e.updates[i].at >= e.updates[i - 1].at, `${slug} ${i}`).toBe(true);
    }
  });
});

describe("changelog.ts", () => {
  it("lists every update newest first", () => {
    expect(ALL.length).toBe(Object.values(games).reduce((n, e) => n + e.updates.length, 0));
    for (let i = 1; i < ALL.length; i++) expect(ALL[i - 1].at >= ALL[i].at).toBe(true);
  });
  it("names the launch and numbers what came after", () => {
    for (const log of LOGS) {
      expect(updateLabel(log.updates.at(-1)!)).toBe("Launch");
      if (log.updates.length > 1) expect(updateLabel(log.updates[0])).toBe(`Update ${log.updates.length - 1}`);
    }
  });
  it("says what a private update held", () => {
    const counts = { new: 2, fixed: 1, improved: 0, other: 0, hidden: 3 };
    expect(countLine({ counts } as any)).toBe("2 new, 1 fixed, 3 behind the scenes");
  });
});
