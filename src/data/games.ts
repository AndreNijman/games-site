// Every game on the hub, in the order the hub shows them. The cards, the
// count in the strip and the CollectionPage structured data are all drawn
// from this list, so they cannot disagree.
//
// The games-guard Worker keeps its own table (GAMES in worker/index.js) for
// the pages it draws on each game's host; tests/unit/games.test.ts holds the
// two to the same names and screenshots.

export type Game = {
  host: string;
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
  /** "all": two columns wherever there are two; "lg": only at three */
  wide?: "all" | "lg";
  author?: { "@type": "Person" | "Organization"; name: string; url: string };
  isBasedOn?: string[];
};

export const GAMES: Game[] = [
  {
    host: "mc.andrenijman.com",
    name: "ONE WORLD",
    genre: ["Sandbox", "Survival", "Multiplayer"],
    description: "A persistent shared anarchy survival world where every signed-in player joins the same map using their games.andrenijman.com username, with a private local-world option and consent-based teleport requests.",
    meta: "Persistent anarchy survival · one shared map · account usernames · private local mode · open source",
    image: "mc.png",
    alt: "ONE WORLD browser survival game menu with shared-world and private local-world choices",
    label: "Play ONE WORLD, a persistent shared anarchy survival world that requires a games.andrenijman.com account",
    wide: "all",
    isBasedOn: ["https://github.com/zardoy/minecraft-web-client", "https://github.com/MultiPaper/MultiPaper"],
  },
  {
    host: "topout.andrenijman.com",
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
    name: "OVERPOP",
    genre: ["Tower defense", "Strategy"],
    description: "A free, original round-based tower defense game: 25 woodland-critter towers with three-branch upgrade trees, 100 rounds, 16 maps, levelling heroes, paragons and eleven game modes. Installable as a PWA and playable offline.",
    meta: "Round-based tower defense · 25 towers · 100 rounds · 16 maps · heroes · works offline",
    image: "overpop.png",
    alt: "OVERPOP in play: critter towers along a winding track, with the tower shop and round HUD",
    label: "Play OVERPOP, a free browser round-based tower defense game",
  },
  {
    host: "scrap.andrenijman.com",
    name: "SCRAP AND STEEL",
    genre: ["Sandbox", "Action", "Physics"],
    description: "A free browser physics robot-building sandbox and 1v1 arena fighter: assemble a robot from a modular parts catalog, wire its power grid, bind its controls, test it with real physics, then fight online. Breakable welds, heat, traction and battery endurance decide fights — no hidden health bars.",
    meta: "Robot builder & arena fighter · wire your own power grid · breakable welds · heat & mass physics · 1v1 online",
    image: "scrap.png",
    alt: "SCRAP AND STEEL in play: two built robots fighting in an arena, one wrecked, with power and heat HUD bars",
    label: "Play SCRAP AND STEEL, a free physics robot-building sandbox and 1v1 arena fighter",
  },
  {
    host: "slingwreck.andrenijman.com",
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
    name: "BOP",
    genre: ["Action", "Fighting", "Multiplayer"],
    description: "A free browser physics brawler: draft one of three wild abilities every round, squish opponents off floating terrain, online multiplayer for eight, couch play and bots.",
    meta: "Online physics brawler · 29 drafted abilities · 15 arenas · 8 players · couch play",
    image: "bop.png",
    alt: "BOP in play: coloured blobs fighting on floating platforms above water with an ability HUD",
    label: "Play BOP, a free online physics brawler with drafted abilities",
  },
  {
    host: "wildbound.andrenijman.com",
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
    name: "Blade Hymn",
    genre: ["Platformer", "Action"],
    description: "A free sword-fighting platformer made by Eason: three hand-crafted stages, three bosses, dash combos and per-stage speedrun leaderboards.",
    meta: "Sword-fighting platformer · 3 stages · 3 bosses · speedrun leaderboards",
    credit: "made by Eason",
    image: "bladehymn.png",
    alt: "Blade Hymn in play: the player mid-swing facing the samurai boss on a snowy ledge between pillars, titled Blade Hymn, a game by Eason",
    label: "Play Blade Hymn, a free sword-fighting platformer made by Eason",
    author: { "@type": "Person", name: "Eason", url: "https://github.com/Eason-F" },
  },
  {
    host: "isaac.andrenijman.com",
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
    name: "Celeste",
    genre: ["Platformer", "Precision", "Action"],
    description: "A free browser platformer homage: 46 curated rooms across 14 chapters, precision physics, dashes, wall climbing, collectibles, achievements, and synthesized WebAudio.",
    meta: "Precision platformer · 46 curated rooms · 14 chapters · 18 achievements",
    credit: "homage to Maddy Makes Games",
    image: "celeste.png",
    alt: "Celeste in play: Madeline mid-dash towards a winged strawberry in a snowy twilight mountain peak",
    label: "Play Celeste, a free browser platformer homage to Maddy Makes Games",
    wide: "lg",
    author: { "@type": "Organization", name: "Maddy Makes Games (homage)", url: "https://www.celestegame.com" },
  },
];

// The picture beside the headline.
export const FEATURED = {
  host: "slingwreck.andrenijman.com",
  image: "slingwreck.png",
  width: 2000,
  height: 1050,
  alt: "SLINGWRECK: a wooden and glass fortress collapsing across green hills",
  label: "Play SLINGWRECK, a slingshot demolition game",
  cap: "SLINGWRECK · a little good destruction",
};

export const gameUrl = (g: { host: string }) => `https://${g.host}/`;
export const artPath = (image: string) => `/art/${image.replace(/\.png$/, ".webp")}`;
