// The pure half of the changelog: what counts as an update, how a commit is
// sorted, and what Haiku is asked. scripts/changelog.mjs does the fetching
// and writing; tests/unit/changelog.test.ts holds these to the rules.

/** Conventional-commit types players see, and the heading each goes under. */
export const SHOWN = { feat: "new", fix: "fixed", perf: "improved" };

/** Commits that say nothing about the game, whatever their prefix. */
const NOISE = /^(merge\b|merged\b|(create|delete|update|add) cname\b|initial commit\b|deploy(ed)? (site )?from\b|update readme(\.md)?$|wip\b|force (a )?(fresh )?pages\b|add nojekyll\b|update (the )?handoff\b)/i;

const CONVENTIONAL = /^(\w+)(?:\(([^)]*)\))?(!)?:\s*(.+)$/;

/**
 * One commit message, sorted. `kind` is new, fixed, improved or other (shown),
 * or hidden: tooling, tests, docs, merges and the like.
 */
export function classify(message) {
  const [subject = "", ...rest] = String(message).split("\n");
  const body = rest.join("\n").trim();
  const line = subject.trim();
  const m = CONVENTIONAL.exec(line);
  if (m) {
    const type = m[1].toLowerCase();
    const text = tidy(m[4]);
    if (type === "merge" || NOISE.test(m[4]) || OTHER_GAMES.test(m[4])) return { type, kind: "hidden", text, body };
    return { type, kind: SHOWN[type] ?? "hidden", text, body };
  }
  if (!line || NOISE.test(line) || OTHER_GAMES.test(line)) return { type: "", kind: "hidden", text: tidy(line), body };
  return { type: "", kind: "other", text: tidy(line), body };
}

/** Capital first letter, no trailing full stop. */
function tidy(s) {
  const t = s.trim().replace(/\.$/, "");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/**
 * A deployment's outcome from its statuses (any order): "success" once it has
 * gone live. "inactive" counts too: it means a newer deploy replaced this one,
 * and GitHub drops the older statuses of old Pages deploys, so it is often
 * all that is left. "failed" when the build errored, otherwise "pending".
 */
export function outcome(states) {
  if (states.includes("success") || states.includes("inactive")) return "success";
  if (states.includes("failure") || states.includes("error")) return "failed";
  return "pending";
}

/**
 * The source commit a deployment was built from. Most games publish their
 * default branch, so it is the deployment's own sha. A game published from a
 * build branch (gh-pages) names its source in the build commit's message
 * ("Deploy site from <sha>"); a build commit that names none ("Create CNAME")
 * changed nothing, and gives null.
 */
export function sourceSha(deployment, buildMessage) {
  if (!isBuildBranch(deployment.ref)) return deployment.sha;
  const m = /\b(?:from|deploy:)\s+([0-9a-f]{7,40})\b/i.exec(buildMessage ?? "");
  return m ? m[1] : null;
}

export const isBuildBranch = (ref) => ref === "gh-pages";

/** Counts by kind, for an update whose commits are not published. */
export function countKinds(classified) {
  const counts = { new: 0, fixed: 0, improved: 0, other: 0, hidden: 0 };
  for (const c of classified) counts[c.kind] += 1;
  return counts;
}

export const MODEL = "claude-haiku-5-5";

export const SYSTEM = `You write the update notes players read for a free browser game on games.andrenijman.com. You are given the game and the commits that went into one deploy of it.

Write one to three short sentences saying what changed for someone playing the game.

- Only say what the commits support. Do not invent features, numbers or reasons.
- Leave out what players never see: tests, CI, tooling, refactors, docs, build and deploy changes, cache busting, logging, lag or analytics recording, and anything only developers, admins or moderators can use (dev join, admin tools, joining full or locked rooms, skipping passwords or seat limits). If that is all the deploy contains, set player_facing to false.
- Talk about the game, never about the commits: do not say what a commit message does or does not say.
- A security fix is "A security fix." and nothing more: never say what it protected or how.
- Never name other games, their expansions, studios or brands, even when a commit compares the game to one ("Terraria-style", "BTD6 parity", "Repentance content"). Describe the feature itself.
- Never mention secrets, tokens, credentials, accounts of named people, internal hosts, or the details of a security hole. "A security fix" is enough.
- Plain, direct English. No hype words (exciting, epic, awesome, enhanced, seamless), no exclamation marks, no emoji, no markdown, no lists.
- Lead with what matters most to a player. Start each sentence with the thing that changed, for example "A hotbar for spells, tools and food." or "Online rooms reconnect after a dropped connection." Do not start with "This update" or the game's name.`;

/** The user turn for one update: the game, then its commits, most telling first. */
export function prompt(game, update, classified, { launchNote } = {}) {
  const head = [
    `Game: ${game.name}`,
    `About the game: ${game.description}`,
    update.launch
      ? `This is the game's first deploy to the site: its launch. ${launchNote ?? ""}`.trim()
      : `Deployed: ${update.at.slice(0, 10)}`,
  ];
  if (update.launch) head.push("Summarise what the game offers at launch in one or two sentences, drawing on the description above first; the commits are only background. Do not list its history.");
  const rank = { new: 0, fixed: 1, improved: 2, other: 3, hidden: 4 };
  const lines = [...classified]
    .sort((a, b) => rank[a.kind] - rank[b.kind])
    .slice(0, 250)
    .map((c) => {
      const tag = c.type || "other";
      const body = c.kind !== "hidden" && c.body ? ` (${c.body.replace(/\s+/g, " ").slice(0, 300)})` : "";
      return `- [${tag}] ${c.text}${body}`;
    });
  if (classified.length > lines.length) lines.push(`- ...and ${classified.length - lines.length} more`);
  return `${head.join("\n")}\n\nCommits (${classified.length}):\n${lines.join("\n") || "- (none listed)"}`;
}

export const SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    player_facing: { type: "boolean" },
  },
  required: ["summary", "player_facing"],
  additionalProperties: false,
};

/** What a player reads for a deploy with nothing they would notice. */
export const BEHIND_THE_SCENES = "Behind-the-scenes fixes and tidying.";

/**
 * The games ours are modelled on, and the words that point at them. Neither a
 * summary nor a commit subject the hub shows may carry one.
 */
export const OTHER_GAMES = /\b(terraria|bloons|btd\d*|chimps|minecraft|repentance|binding of isaac|plants vs\.? zombies|tetris|vanilla)\b/i;

const BANNED = new RegExp(`${OTHER_GAMES.source}|\\b(commit messages?|the commits?)\\b`, "i");

/** A summary is kept only if it reads like one: some words, no markdown, not an essay, nothing banned. */
export function validSummary(s) {
  if (typeof s !== "string") return false;
  const t = s.trim();
  return t.length >= 8 && t.length <= 600 && !/^#|\n\s*[-*] |\*\*/.test(t) && !BANNED.test(t);
}
