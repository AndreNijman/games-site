// Every game on the hub. The cards, the count in the strip and the
// CollectionPage structured data are all drawn from this list, so they cannot
// disagree. The hub shows them in the order order.ts gives (the most visited
// first); this order is the fallback and places games with no visit data.
//
// The games-guard Worker keeps its own table (GAMES in worker/index.js) for
// the pages it draws on each game's host; tests/unit/games.test.ts holds the
// two to the same names and screenshots.

export type Game = {
  host: string;
  /** the day it joined the hub, YYYY-MM-DD: the newest is advertised in the hero */
  added: string;
  name: string;
  genre: string[];
  /** the structured-data description */
  description: string;
  /** the line on the card */
  meta: string;
  /** a visible credit, when the game is not only Andre's */
  credit?: string;
  /** the screenshot at the root of public/; art/<name>.webp is made from it */
  image: string;
  alt: string;
  /** the link's accessible name */
  label: string;
  author?: { "@type": "Person" | "Organization"; name: string; url: string };
  isBasedOn?: string[];
  /** the GitHub repository Pages publishes the game from: the changelog reads
   * its deployments (scripts/changelog.mjs). None for a game hosted elsewhere. */
  repo?: string;
};

export const GAMES: Game[] = [
  {
    host: "stink.andrenijman.com",
    repo: "AndreNijman/stinkwater",
    added: "2026-10-26",
    name: "Stinkwater",
    genre: ["Roguelike", "RPG", "Life sim"],
    description: "A free pixel-art story roguelike in the browser: a year in a fen town as Rax Pu, seven backgrounds, about 250 branching stories played out where they happen, trades and magic to learn, a real-time dungeon under the old well, and a kingdom that falls and changes around you.",
    meta: "Story roguelike · a year in a fen town · 250 branching stories · dungeon fights · trades and magic · four save slots",
    image: "stink.png",
    alt: "Stinkwater in play: Rax, purple-haired, in the cobbled town square by the well, townsfolk at a fruit stall, a statue and a timber cottage",
    label: "Play Stinkwater, a free story roguelike set in a pixel-art fen town",
  },
  {
    host: "rasists.andrenijman.com",
    repo: "AndreNijman/rasists",
    added: "2026-10-26",
    name: "Rasists",
    genre: ["Racing", "Multiplayer"],
    description: "A free 3D browser racing game: a new procedurally generated track every race, online rooms with friends, solo events with AI rivals, time trials with ghosts, replays, and a garage of cars to unlock, paint and upgrade.",
    meta: "3D racing · a new track every race · online rooms · AI rivals · ghosts and replays · car garage",
    image: "rasists.png",
    alt: "Rasists in play: a red car on a winding forest road below red rock hills and pine trees",
    label: "Play Rasists, a free 3D browser racing game with online races",
  },
  {
    host: "mc.andrenijman.com",
    repo: "AndreNijman/one-world",
    added: "2026-08-28",
    name: "ONE WORLD",
    genre: ["Sandbox", "Survival", "Multiplayer"],
    description: "A persistent shared anarchy survival world where every signed-in player joins the same map using their games.andrenijman.com username, with a private local-world option and consent-based teleport requests.",
    meta: "Persistent anarchy survival · one shared map · account usernames · private local mode · open source",
    image: "mc.png",
    alt: "ONE WORLD browser survival game menu with shared-world and private local-world choices",
    label: "Play ONE WORLD, a persistent shared anarchy survival world that requires a games.andrenijman.com account",
    isBasedOn: ["https://github.com/zardoy/minecraft-web-client", "https://github.com/MultiPaper/MultiPaper"],
  },
  {
    host: "topout.andrenijman.com",
    repo: "AndreNijman/topout",
    added: "2026-08-18",
    name: "TOPOUT",
    genre: ["Puzzle", "Action"],
    description: "A free competitive block-stacking game with modern mechanics, online versus multiplayer, CPU battles, replays and a global leaderboard.",
    meta: "Competitive block stacker · online VS · CPU battles · replays · global leaderboard",
    image: "topout.png",
    alt: "TOPOUT title screen with solo, multiplayer, leaderboard and replays menu",
    label: "Play TOPOUT, a free online block-stacking game",
  },
  {
    host: "defenders.andrenijman.com",
    repo: "AndreNijman/pvz",
    added: "2026-08-18",
    name: "Garden Defenders 2",
    genre: ["Tower defense", "Strategy"],
    description: "A free, original fan-made lane-defense tower defense game: five worlds, 40 levels, boss fights, endless mode, installable as a PWA.",
    meta: "Lane-defense tower game · 5 worlds · 40 levels · endless mode · works offline",
    image: "defenders.png",
    alt: "Garden Defenders 2 title screen with the classic campaign and GD 2.5 Remixed modes",
    label: "Play Garden Defenders 2, a free browser tower defense game",
  },
  {
    host: "overpop.andrenijman.com",
    repo: "AndreNijman/overpop",
    added: "2026-08-18",
    name: "OVERPOP",
    genre: ["Tower defense", "Strategy"],
    description: "A free, original round-based tower defense game: 25 woodland-critter towers with three-branch upgrade trees, 100 rounds, 16 maps, levelling heroes, paragons and eleven game modes. Installable as a PWA and playable offline.",
    meta: "Round-based tower defense · 25 towers · 100 rounds · 16 maps · heroes · works offline",
    image: "overpop.png",
    alt: "OVERPOP in play: critter towers along a winding track, with the tower shop and round HUD",
    label: "Play OVERPOP, a free browser round-based tower defense game",
  },
  {
    host: "slingwreck.andrenijman.com",
    repo: "AndreNijman/slingwreck",
    added: "2026-08-23",
    name: "SLINGWRECK",
    genre: ["Action", "Puzzle", "Physics"],
    description: "A free browser slingshot demolition game: fling nine kinds of critter at pig fortresses across a 52-level campaign, build your own fortress in the workshop, then defend it in a 1v1 online siege. Hand-written rigid-body physics, no engine.",
    meta: "Slingshot demolition · 52 levels · 9 critters · fortress workshop · 1v1 online siege",
    image: "slingwreck.png",
    alt: "SLINGWRECK in play: a wooden and glass pig fortress coming apart mid-shot, debris in the air",
    label: "Play SLINGWRECK, a free slingshot demolition game with a 52-level campaign and 1v1 online siege",
  },
  {
    host: "bop.andrenijman.com",
    repo: "AndreNijman/bop",
    added: "2026-08-20",
    name: "BOP",
    genre: ["Action", "Fighting", "Multiplayer"],
    description: "A free browser physics brawler: choose up to three of 29 wild abilities, cling to every side of floating terrain and squish your friends off it. Online multiplayer for four, couch play and practice bots.",
    meta: "Online physics brawler · 29 abilities · 15 arenas · 4 players · couch play",
    image: "bop.png",
    alt: "BOP in play: pixel-art slimes fighting on grassy floating islands above water, each with its three abilities shown overhead",
    label: "Play BOP, a free online physics brawler with 29 abilities",
  },
  {
    host: "memoryburn.andrenijman.com",
    repo: "AndreNijman/memoryburn",
    added: "2026-10-22",
    name: "Memory Burn",
    genre: ["Action", "Shooter", "Co-op"],
    description: "A free browser wave-survival shooter, solo or in online co-op for up to four: somebody burned out your memory and is selling it as shards, so you fight 15 contracts across seven cyberpunk districts, spend your eddies in a back-alley market between waves, and face three named bosses before an endless Afterburn mode.",
    meta: "Wave-survival shooter · 1–4 players, online co-op · 15-contract story · 8 characters · 42 items · 3 bosses",
    image: "memoryburn.png",
    alt: "Memory Burn in play: a potato gunslinger surrounded by blob robots on a neon grid floor, with a wave timer and side-job HUD",
    label: "Play Memory Burn, a free cyberpunk wave-survival shooter with online co-op and a 15-contract story",
  },
  {
    host: "wildbound.andrenijman.com",
    repo: "AndreNijman/taming",
    added: "2026-08-20",
    name: "Wildbound.io",
    genre: ["Survival", "Action", "Multiplayer"],
    description: "A free multiplayer survival game with gathering, age upgrades, base building, rotating seasons, bosses, CPU rivals and 60 tameable companion species.",
    meta: "Online survival · 60 tameable species · 6 seasons · bosses · base building · CPU rivals",
    image: "wildbound.png",
    alt: "Wildbound.io in play: a tamer exploring a forest among wild creatures, resources, rivals and a survival HUD",
    label: "Play Wildbound.io, a free online survival and creature-taming game",
  },
  {
    host: "tree.andrenijman.com",
    repo: "AndreNijman/tree",
    added: "2026-08-20",
    name: "tree",
    genre: ["Sandbox", "Adventure", "Action"],
    description: "A full-progression procedural browser sandbox with mining, crafting, building, towns, fishing, invasions, events, and bosses through the Moon Lord.",
    meta: "Procedural sandbox · mining and crafting · towns · events · full boss progression",
    image: "tree.png",
    alt: "tree gameplay at night in the Hallow during a fight against the Twins",
    label: "Play tree, a free full-progression browser sandbox game",
  },
  {
    host: "tung.andrenijman.com",
    repo: "AndreNijman/tung-tung-tung-sahur",
    added: "2026-08-18",
    name: "Tung Tung Tung Sahorror",
    genre: ["Horror", "Survival"],
    description: "A free first-person raycaster horror game in a single HTML file. Gather six offerings in the dark and carry them home before the call to Subuh, while a drumming creature hunts by sight, sound and your own panic. Originally by tim.",
    meta: "First-person horror · gather six offerings and get home before dawn",
    credit: "originally by tim",
    image: "tung.png",
    alt: "Tung Tung Tung Sahorror in play: the drumming creature waiting in a torchlit corridor, with the offerings, torch, stamina and nerve HUD",
    label: "Play Tung Tung Tung Sahorror, a free browser first-person horror game",
  },
  {
    host: "bladehymn.andrenijman.com",
    repo: "AndreNijman/blade-hymn",
    added: "2026-09-04",
    name: "Blade Hymn",
    genre: ["Platformer", "Action"],
    description: "Eason's sword-fighting platformer, ported to the browser: three hand-crafted stages, three bosses, dash combos and per-stage speedrun leaderboards.",
    meta: "Sword-fighting platformer · 3 stages · 3 bosses · speedrun leaderboards",
    credit: "made by Eason, ported to the browser",
    image: "bladehymn.png",
    alt: "Blade Hymn in play: the player mid-swing facing the samurai boss on a snowy ledge between pillars, titled Blade Hymn, a game by Eason",
    label: "Play Blade Hymn, a free sword-fighting platformer made by Eason",
    author: { "@type": "Person", name: "Eason", url: "https://github.com/Eason-F" },
  },
  {
    host: "isaac.andrenijman.com",
    repo: "AndreNijman/isuck",
    added: "2026-08-18",
    name: "ISUCK",
    genre: ["Roguelike", "Action", "Shooter"],
    description: "A free, from-scratch browser roguelike with seeded floors, 732 collectibles, 34 playable characters, alternate paths, 208 enemies and 80 bosses.",
    meta: "Browser roguelike · 732 collectibles · 34 characters · alternate paths · 80 bosses",
    image: "isuck.png",
    alt: "ISUCK in play: Isaac fighting enemies in a procedurally generated Basement room",
    label: "Play ISUCK, a free browser roguelike",
  },
  {
    host: "celeste.andrenijman.com",
    repo: "AndreNijman/celeste",
    added: "2026-09-08",
    name: "Celeste",
    genre: ["Platformer", "Precision", "Action"],
    description: "A free browser platformer homage: 46 curated rooms across 14 chapters, precision physics, dashes, wall climbing, collectibles, achievements, and synthesized WebAudio.",
    meta: "Precision platformer · 46 curated rooms · 14 chapters · 18 achievements",
    credit: "homage to Maddy Makes Games",
    image: "celeste.png",
    alt: "Celeste in play: Madeline mid-dash towards a winged strawberry in a snowy twilight mountain peak",
    label: "Play Celeste, a free browser platformer homage to Maddy Makes Games",
    author: { "@type": "Organization", name: "Maddy Makes Games (homage)", url: "https://www.celestegame.com" },
  },
  {
    host: "fart.andrenijman.com",
    repo: "AndreNijman/fart-together",
    added: "2026-10-26",
    name: "FART TOGETHER",
    genre: ["Co-op", "Party", "Multiplayer"],
    description: "A free co-op pixel-art raft game for 1 to 4 players: hippos ride a round raft down procedurally generated water flumes in the sky and steer by farting, each from their own share of the rim, past spike walls, hammers and open drops.",
    meta: "Co-op raft game · 1–4 players · steer by farting · online rooms · a new seeded course every run",
    image: "fart.png",
    alt: "FART TOGETHER in play: four hippos on a round wooden raft rounding a bend in a sky-high water flume, a green gas cloud behind them",
    label: "Play FART TOGETHER, a free co-op raft game where hippos steer by farting",
  },
  {
    host: "scoops.andrenijman.com",
    repo: "AndreNijman/scoop-trouble",
    added: "2026-10-27",
    name: "SCOOP TROUBLE",
    genre: ["Co-op", "Arcade", "Multiplayer"],
    description: "A free co-op pixel-art arcade puzzle game for 1 to 4 players: ice-cream scoops build and break ice walls to trap enemies and collect every fruit across 120 levels in 12 worlds, on one keyboard or in online rooms.",
    meta: "Co-op arcade puzzle · 1–4 players · build and break ice · online rooms · 120 levels",
    image: "scoops.png",
    alt: "SCOOP TROUBLE in play: vanilla, blueberry and strawberry scoops beside freshly built ice blocks in a snowy maze, bugs and lemons around them",
    label: "Play SCOOP TROUBLE, a free co-op arcade game where ice-cream scoops build ice to trap enemies",
  },
  {
    host: "krillion.andrenijman.com",
    added: "2026-10-29",
    name: "Krillion",
    genre: ["Word", "Trivia", "Daily"],
    description: "A free daily word and trivia game: seven prompts a day, 25 seconds each, and the rarer your answer the deeper you dive. Endless mode, themed packs and party rooms with friends.",
    meta: "Daily word dive · 7 prompts · rarer answers sink deeper · endless mode · party rooms",
    credit: "by krillion.io",
    image: "krillion.png",
    alt: "Krillion's title screen: a pixel-art sky over dark water, The Daily Dive, a Puffer Party room and a Begin Descent button",
    label: "Play Krillion, a free daily word dive by krillion.io",
    author: { "@type": "Organization", name: "Krillion", url: "https://krillion.io" },
  },
  {
    host: "snackarang.andrenijman.com",
    repo: "AndreNijman/snackarang",
    added: "2026-10-29",
    name: "SNACKARANG",
    genre: ["Party", "Action", "Multiplayer"],
    description: "A free 3D party brawler for 1 to 6 players, on one screen or in online rooms: snacks throw, curve, recall and slash with boomerangs, one hit and you're sliced, across 12 arenas with power-up books, bushes to hide in and edges to fall off. Keyboards, gamepads and bots.",
    meta: "Party brawler · 1–6 players · local and online · boomerangs · one-hit knockouts · 14 power-ups · 12 arenas · bots",
    image: "snackarang.png",
    alt: "SNACKARANG in play: snacks with boomerangs on sandy islands joined by wooden bridges over the sea, a lemon sliced in half beside a pickle mid-throw",
    label: "Play SNACKARANG, a free party brawler where snacks fight with boomerangs, on one screen or online",
  },
  {
    host: "chess.andrenijman.com",
    repo: "AndreNijman/rook-and-roll",
    added: "2026-10-29",
    name: "ROOK & ROLL",
    genre: ["Board", "Strategy"],
    description: "A free pixel-art chess game: play nine computer opponents from beginner to full-strength Stockfish with hints and takebacks, explore any position with the engine, and review your games move by move with accuracy scores.",
    meta: "Chess · 1 player · 9 bots up to full-strength Stockfish · hints and takebacks · analysis board · game review with accuracy",
    image: "chess.png",
    alt: "ROOK & ROLL in play: pixel-art chess pieces on a wooden board against the bot Nyx, a bishop selected with its moves dotted and the move list beside",
    label: "Play ROOK & ROLL, a free pixel-art chess game against nine bots, with analysis and game review",
  },
];

/** The game that joined the hub last; on a tie, the later one in the list. */
export const newestGame = (games: Game[]) => games.reduce((a, b) => (b.added >= a.added ? b : a));

export const gameUrl = (g: { host: string }) => `https://${g.host}/`;
export const artPath = (image: string) => `/art/${image.replace(/\.png$/, ".webp")}`;
