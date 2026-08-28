(function () {
  // ---------------- base lists (original vibe, lightly edited for duplicates and straight quotes) ----------------
  const gameplayTips = [
    "Use D to go right. Unless you are facing left.",
    "Jumping is faster. Probably.",
    "Red things are not friends.",
    "You cannot win if you lose.",
    "Try not dying. It helps a lot.",
    "Gravity is on. Always.",
    "Reloading is faster than dying.",
    "The save button saves. Unless it does not.",
    "Boss fights are just fights with louder music.",
    "Collect everything. Even if you do not need it.",
    "You can't win if you lose. Think about it.",
    "Enemies can't kill you if you quit first.",
    "Pressing random keys sometimes makes cool sounds. (try it!)",
    "'Lag' is just the universe taking a break.",
    "Sprinting drains stamina. Sitting still doesn't.",
    "Fire hurts. It's been tested.",
    "Collecting coins doesn't improve your real finances.",
    "The walls exist for a reason.",
    "If you can't find the exit... maybe you are the exit.",
    "Taking fall damage? Just don't fall.",
    "The secret door isn't that secret.",
    "'Are you sure you want to quit?' No one ever is.",
    "Pressing W moves you forward - in game and in life.",
    "If it glows, click it. If it explodes, remember that.",
    "Saving prevents tragedy. Usually.",
    "Crouching in real life doesn't increase stealth.",
    "Boss music means something's wrong.",
    "Don't jump off the map. It's not a shortcut.",
    "Gravity is undefeated since forever.",
    "Friendly fire is only funny once.",
    "If it's glowing green, that's not food."
  ];

  const obviousFacts = [
    "If you punch a wall hard enough, the wall wins.",
    "Did you know most houses have a floor? Incredible technology.",
    "Standing in rain makes you wet.",
    "Falling hurts more the higher you go.",
    "The sun is really bright. Do not stare at it.",
    "Eating food stops hunger for a bit.",
    "Water is often found in wet places.",
    "If you walk long enough, you'll be somewhere else.",
    "Hitting your head hurts, no matter how confident you are.",
    "If something's hot, it's not cold.",
    "Running into trees is rarely productive.",
    "If your phone battery dies, it turns off.",
    "Jumping off cliffs isn't a reusable strategy.",
    "Keys open locks. Unless they don't.",
    "Clouds are not solid. Do not test.",
    "Breathing underwater only works once.",
    "Fire is not a toy. Unless you're chaos itself.",
    "Standing up increases your height slightly.",
    "You can't drown in sand, but you can regret it.",
    "Sleeping at night is the default setting."
  ];

  const gamerLogic = [
    "Pressing W makes you advance your destiny and your character.",
    "If it glows, click it. If it explodes, remember that.",
    "Loot everything. Even if you don't need it. Especially if you don't need it.",
    "The tutorial is optional until it's not.",
    "Friendly fire is only funny once.",
    "Don't jump off the map. You won't win faster.",
    "Saving the game prevents tragedy. Usually.",
    "Boss fights are just normal fights with louder music.",
    "Collectibles don't fill the void, but they try.",
    "The harder the level, the louder the keyboard.",
    "Pressing jump twice doesn't always mean double jump. Sometimes it means goodbye.",
    "Explosions solve problems. Sometimes they create them too.",
    "Crouching in real life doesn't increase stealth.",
    "The final boss doesn't care about your feelings.",
    "The game isn't cheating. You're just losing correctly."
  ];

  const lifeTips = [
    "Most doors can be opened. Try it sometime.",
    "The fridge light turns off. Probably.",
    "You can't lose an argument if you stop responding.",
    "Yelling at the microwave won't make it faster.",
    "Traffic lights don't care about your schedule.",
    "Gravity is still undefeated since the beginning of time.",
    "Socks come in pairs until they don't.",
    "Toothpaste tastes worse than it looks.",
    "Sleep debt cannot be paid with exposure.",
    "Money can be exchanged for goods and services.",
    "The faster you run, the sooner you're tired.",
    "Most mirrors reflect you. The scary ones don't.",
    "Coffee is basically legal energy theft.",
    "You can't delete real life by pressing escape.",
    "Stairs are just vertical regrets.",
    "The universe doesn't have patch notes.",
    "Birds don't pay rent.",
    "Music makes silence jealous.",
    "Friends are just NPCs with better dialogue.",
    "If you touch grass, the grass touches back.",
    "Air is free, but only while supplies last.",
    "Time flies but it refuses to land.",
    "Gravity pulls us together mostly toward the floor.",
    "No one has ever won an argument with Wi-Fi.",
    "Life is the longest unskippable cutscene."
  ];

  const realLifeTips = [
    "Bathrooms often have sinks. Use them.",
    "Don't lick doorknobs on other planets. Or this one.",
    "You can't lose a fight if you don't show up.",
    "If it's on fire, it's probably hot.",
    "If it's glowing green, that's not food.",
    "Breathing is a good daily habit.",
    "Standing up is faster than lying down, usually.",
    "The floor is reliable. It's always there for you.",
    "If you drop something, gravity wins. Every time.",
    "Time only moves forward - plan accordingly.",
    "Chairs are like sitting upgrades.",
    "'Hot water' is just aggressive water.",
    "You can't spell 'snack' without 'ack'.",
    "Most doors open when you pull the right way.",
    "Running upstairs is fun until it's not.",
    "Sleep is the human loading screen.",
    "Forgetting something means you'll remember it later.",
    "Socks improve walking DLC.",
    "Birds don't know what Wi-Fi is.",
    "The fridge light goes out when you close the door. Or does it?"
  ];

  // ---------------- big generated set to triple the pool ----------------
  function buildGeneratedTips() {
    const roomFacts = [
      ["bedrooms", "beds"],
      ["kitchens", "sinks"],
      ["bathrooms", "toilets"],
      ["living rooms", "sofas"],
      ["garages", "cars that do not start"],
      ["closets", "secrets"],
      ["attics", "mysterious boxes"],
      ["basements", "unfinished projects"],
      ["pantries", "snacks you forgot"],
      ["offices", "stacks of paper you will not read"]
    ];

    const template1 = roomFacts.map(([room, thing]) =>
      `Did you know most ${room} have ${thing}?`
    );

    const notFood = [
      "batteries", "glow sticks", "lava", "mystery blue liquid",
      "glitter", "cat toys", "USB drives", "dry ice",
      "dish soap", "paint", "tree sap", "shampoo"
    ].map(x => `${x} is not a snack.`);

    const scienceJokes = [
      "Gravity works even when you do not believe in it.",
      "Friction is just the floor giving you a hug you did not ask for.",
      "Light travels fast. Your Wi-Fi travels slower.",
      "Absolute zero is a temperature, not a vibe.",
      "Vacuum is great at cleaning. Space kind of is one.",
      "Magnets stick to your plans sometimes."
    ];

    const proTips = [
      ["red barrels", "stand back"],
      ["levers", "pull once, look twice"],
      ["mysterious buttons", "press after saving"],
      ["locked doors", "try the other door"],
      ["suspicious chests", "check for teeth"],
      ["ledge jumps", "do not look down"],
      ["spikes", "avoid every time"],
      ["checkpoint flags", "wave back"]
    ].map(([thing, action]) => `Pro tip: ${thing} - ${action}.`);

    const collectibles = ["coins", "keys", "tickets", "stickers", "bananas", "shells", "stars", "gems", "orbs", "notes"];
    const template2 = collectibles.map(c => `Collect ${c}. You probably will need them later.`);

    const lifeLoops = [
      "Drink water. Future you will send a thank you email.",
      "Blink sometimes. Your eyes like that.",
      "Stretch once in a while. Your spine is not DLC.",
      "Charge your device before 1 percent. Be bold.",
      "Writing things down increases the chance you remember the paper exists.",
      "Snacks taste better after saving your progress."
    ];

    const bossThings = [
      "louder music", "dramatic lighting", "more health", "suspicious arena walls", "dialogue that feels personal"
    ].map(x => `Boss fights are just fights with ${x}.`);

    const schoolJokes = [
      "Homework does not drop legendary loot.",
      "Group projects are stealth games.",
      "Study breaks cannot fail if they never end.",
      "Pop quizzes are jump scares with pencils.",
      "Lunch is the only speedrun schools allow."
    ];

    const rngStuff = [
      "Randomness means the game is fair in a chaotic way.",
      "If the drop rate is 1 percent, expect 0 percent today.",
      "Crit chance goes up when someone is watching. Probably.",
      "If you flip a coin 10 times and lose, the 11th is still a coin."
    ];

    const microwave = [
      "One more minute means three more checks.",
      "Staring does not change the timer",
      "The beep is a boss fight for your ears"
    ].map(x => `Microwave lore: ${x}.`);

    const chores = [
      "Laundry is a stealth mission. Socks vanish.",
      "Dishes are a tower defense game. The sink always wins.",
      "Vacuuming gives +5 calm to carpets."
    ];

    const meta = [
      "This tip knows you are reading it.",
      "If this tip repeats, the cycle restarted. Nice.",
      "Tip RNG is seeded by vibes."
    ];

    const verbs = ["touch", "kick", "stare at", "collect", "yell at", "befriend"];
    const objects = ["bees", "clouds", "traffic cones", "loading bars", "NPCs named Greg", "tutorial popups", "lava lamps", "puddles"];
    const outcomes = ["it will not help", "results may vary", "science will be disappointed", "someone will notice", "achievement not unlocked", "you may level up in patience"];

    const template3 = [];
    for (let i = 0; i < verbs.length; i++) {
      for (let j = 0; j < objects.length; j++) {
        const o = outcomes[(i + j) % outcomes.length];
        template3.push(`If you ${verbs[i]} ${objects[j]}, ${o}.`);
      }
    }

    const keyboardKeys = ["W", "A", "S", "D", "Space", "Shift", "Ctrl"];
    const keyTips = keyboardKeys.map(k => `Pressing ${k} does something. Probably.`);

    const sleeping = [
      "Napping is fast travel in real life.",
      "Pillows are head armor tier 1.",
      "Blankets grant +10 comfort and -5 motivation."
    ];

    const foodTruths = [
      "Cereal is soup you commit to.",
      "Ice cream is frozen happiness with a cooldown.",
      "Fruit snacks are not fruit. They are snacks."
    ];

    const moreRooms = [
      "Hallways are just very long rooms.",
      "Windows are TV for outside.",
      "Ceilings are floors for spiders."
    ];

    return [
      ...template1,
      ...notFood,
      ...scienceJokes,
      ...proTips,
      ...template2,
      ...lifeLoops,
      ...bossThings,
      ...schoolJokes,
      ...rngStuff,
      ...microwave,
      ...chores,
      ...meta,
      ...template3,
      ...keyTips,
      ...sleeping,
      ...foodTruths,
      ...moreRooms
    ];
  }

  // ---------------- combine, generate, dedupe ----------------
  const RAW_TIPS = [
    ...gameplayTips,
    ...obviousFacts,
    ...gamerLogic,
    ...lifeTips,
    ...realLifeTips,
    ...buildGeneratedTips()
  ];

  const seen = new Set();
  const ALL_TIPS = RAW_TIPS.filter(t => {
    const key = t.replace(/\s+/g, " ").trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const MIN_TARGET = Math.ceil((gameplayTips.length + obviousFacts.length + gamerLogic.length + lifeTips.length + realLifeTips.length) * 3);
  if (ALL_TIPS.length < MIN_TARGET) {
    const base = "Fun fact: most bedrooms have beds.";
    const need = MIN_TARGET - ALL_TIPS.length;
    for (let k = 1; k <= need; k++) {
      ALL_TIPS.push(`${base} Variant ${k}.`);
    }
  }

  function shuffleInPlace(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  const LS_KEY = "SQTips_state_v2";
  const LS_COUNTER = "SQTips_counter_v2";

  function loadState(total) {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) throw 0;
      const s = JSON.parse(raw);
      if (!s || !Array.isArray(s.order) || typeof s.cursor !== "number" || s.total !== total) throw 0;
      return s;
    } catch {
      const order = Array.from({ length: total }, (_, i) => i);
      shuffleInPlace(order);
      const s = { order, cursor: 0, cycle: 1, total };
      localStorage.setItem(LS_KEY, JSON.stringify(s));
      return s;
    }
  }

  function saveState(s) { localStorage.setItem(LS_KEY, JSON.stringify(s)); }

  function nextId() {
    const current = parseInt(localStorage.getItem(LS_COUNTER) || "0", 10);
    const next = isNaN(current) ? 1 : current + 1;
    localStorage.setItem(LS_COUNTER, String(next));
    return next;
  }

  const state = loadState(ALL_TIPS.length);

  function nextTipCore(renderToEl) {
    if (state.cursor >= state.order.length) {
      state.cursor = 0;
      state.cycle += 1;
      shuffleInPlace(state.order);
    }
    const idx = state.order[state.cursor++];
    const tip = ALL_TIPS[idx];
    const id = nextId();
    saveState(state);
    if (renderToEl) { try { renderToEl.textContent = tip; } catch {} }
    return { id, tip, index: idx, total: ALL_TIPS.length, cycle: state.cycle, ts: Date.now() };
  }

  function getElement(elOrSelector) {
    if (!elOrSelector) return null;
    if (typeof elOrSelector === "string") return document.querySelector(elOrSelector);
    if (elOrSelector && elOrSelector.nodeType === 1) return elOrSelector;
    return null;
  }

  function apiNext() { return nextTipCore(null); }
  function apiRenderTo(elOrSelector) { const el = getElement(elOrSelector); return nextTipCore(el); }
  function apiGetMany(n = 10) { const out=[]; for (let i=0;i<Math.max(0, Math.min(n, ALL_TIPS.length)); i++) out.push(nextTipCore(null)); return out; }
  function apiResetCycle(shuffle = true) { state.cursor=0; state.cycle+=1; if (shuffle) shuffleInPlace(state.order); saveState(state); }
  function apiState() {
    return {
      cursor: state.cursor,
      cycle: state.cycle,
      total: state.total,
      nextIndex: state.order[state.cursor % state.order.length],
      nextPreview: ALL_TIPS[state.order[state.cursor % state.order.length]]
    };
  }

  if (typeof window !== "undefined") {
    window.SQTips = window.SQTips || {};
    if (!Array.isArray(window.SQTips.list) || window.SQTips.list.length < ALL_TIPS.length) {
      window.SQTips.list = Object.freeze([...ALL_TIPS]);
    }
    window.SQTips.next = apiNext;
    window.SQTips.renderTo = apiRenderTo;
    window.SQTips.getMany = apiGetMany;
    window.SQTips.resetCycle = apiResetCycle;
    window.SQTips.state = apiState;

    console.log(
      "%c[StaticQuasar931 Tips Loaded]%c " +
        window.SQTips.list.length +
        " total tips across " +
        state.order.length +
        " slots. Cycle " +
        state.cycle +
        ".",
      "color:#5ee1ff;font-weight:700",
      "color:#fff;font-weight:400"
    );
  }
})();
