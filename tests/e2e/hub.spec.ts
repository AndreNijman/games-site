import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { GAMES } from "../../src/data/games";

// Stand in for the games-guard Worker and Google: the Worker's routes answer,
// the AdSense loader is empty, and a hub page gets the status meta prepended
// to <head> the way the Worker's HTMLRewriter does it.
async function asTheWorker(page: Page, status: object | null) {
  await page.route("https://pagead2.googlesyndication.com/**", (r) => r.fulfill({ contentType: "text/javascript", body: "" }));
  await page.route("**/_guard/**", (r) => r.fulfill(r.request().url().endsWith("/client.js")
    ? { contentType: "text/javascript", body: "" }
    : { contentType: "application/json", body: JSON.stringify(status ?? { allowed: true, signedIn: false }) }));
  if (!status) return;
  await page.route(/\/(index\.html)?$/, async (r) => {
    const res = await r.fetch();
    const meta = `<meta name="games-guard-status" content="${JSON.stringify(status).replace(/"/g, "&quot;")}">`;
    await r.fulfill({ response: res, body: (await res.text()).replace("<head>", `<head>${meta}`) });
  });
}

test("the hub loads clean, fits a phone and passes axe", async ({ page }) => {
  const problems: string[] = [];
  page.on("pageerror", (e) => problems.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") problems.push(m.text()); });
  await asTheWorker(page, { allowed: true, signedIn: false, username: null, needsProfile: false });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
  const axe = await new AxeBuilder({ page }).exclude(".ad-sticky").exclude(".ad-rail").analyze();
  const serious = axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  expect(problems).toEqual([]);
});

test("a visitor who is not signed in is offered sign in", async ({ page }) => {
  await asTheWorker(page, { allowed: true, signedIn: false, username: null, needsProfile: false });
  await page.goto("/");
  await expect(page.locator("#nav-signin")).toBeVisible();
  await expect(page.locator("#account")).toBeHidden();
});

test("a signed-in player sees their name and can log out", async ({ page }) => {
  await asTheWorker(page, { allowed: true, signedIn: true, username: "tester_01", needsProfile: false });
  await page.goto("/");
  await expect(page.locator("#account-name")).toHaveText("tester_01");
  await expect(page.locator("#account")).toBeVisible();
  await expect(page.locator("#nav-signin")).toBeHidden();
  await expect(page.locator('form[action="/_guard/logout"] button')).toBeVisible();
});

test("every game has its card and every picture loads", async ({ page }) => {
  await asTheWorker(page, null);
  await page.goto("/");
  const cards = page.locator("#games .game");
  await expect(cards).toHaveCount(GAMES.length);
  // the order follows the visit ranking the build fetched, so only the set is fixed
  const hrefs = await cards.evaluateAll((els) => els.map((e) => e.getAttribute("href")));
  expect([...hrefs].sort()).toEqual(GAMES.map((g) => `https://${g.host}/`).sort());
  for (const g of GAMES) await expect(page.locator(`#games .game[href="https://${g.host}/"] h3`)).toHaveText(g.name);
  // no row left open at three columns or at two
  for (const width of [1280, 800]) {
    await page.setViewportSize({ width, height: 900 });
    const open = await page.locator("#games .games").evaluate((grid) => {
      const cols = getComputedStyle(grid).gridTemplateColumns.split(" ").length;
      const rows = new Map<number, number>();
      for (const card of grid.children) {
        const r = card.getBoundingClientRect();
        rows.set(Math.round(r.top), (rows.get(Math.round(r.top)) ?? 0) + r.width);
      }
      const full = grid.getBoundingClientRect().width;
      return [...rows.values()].filter((w) => w < full * 0.9).length + (cols > 0 ? 0 : 1);
    });
    expect(open, `open rows at ${width}`).toBe(0);
  }
  // every file exists and decodes: load the lazy ones now rather than scroll for them
  await page.evaluate(() => document.querySelectorAll<HTMLImageElement>("img[loading=lazy]").forEach((i) => { i.loading = "eager"; }));
  await expect.poll(() => page.evaluate(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0))).toBe(true);
});

test("games.json lists the cards in the hub's order, for andrenijman.com", async ({ page, request }) => {
  await asTheWorker(page, null);
  await page.goto("/");
  const hrefs = await page.locator("#games .game").evaluateAll((els) => els.map((e) => e.getAttribute("href")));
  const feed = await (await request.get("/games.json")).json() as { source: string; games: { href: string; art: string; name: string }[] };
  expect(["visits", "static"]).toContain(feed.source);
  expect(feed.games.map((g) => g.href)).toEqual(hrefs);
  for (const g of feed.games) expect((await request.get(g.art)).ok(), g.art).toBe(true);
});

// Rows left open in the grid at the current width: visible cards only.
const openRows = (page: Page) => page.locator("#games .games").evaluate((grid) => {
  const rows = new Map<number, number>();
  for (const card of grid.children) {
    if ((card as HTMLElement).hidden) continue;
    const r = card.getBoundingClientRect();
    rows.set(Math.round(r.top), (rows.get(Math.round(r.top)) ?? 0) + r.width);
  }
  const full = grid.getBoundingClientRect().width;
  return [...rows.values()].filter((w) => w < full * 0.9).length;
});

test("the games can be sorted and searched, and Popular puts them back", async ({ page }) => {
  await asTheWorker(page, null);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  const cards = page.locator("#games .game");
  const visible = page.locator("#games .game:not([hidden])");
  const hrefs = () => cards.evaluateAll((els) => els.map((e) => e.getAttribute("href")));
  const built = await hrefs();
  const classes = () => cards.evaluateAll((els) => els.map((e) => [...e.classList].sort().join(" ")));
  const builtClasses = await classes();

  await page.getByRole("button", { name: "A–Z" }).click();
  await expect(page.getByRole("button", { name: "A–Z" })).toHaveAttribute("aria-pressed", "true");
  const names = await visible.locator("h3").allTextContents();
  expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base", numeric: true })));
  expect(names.length).toBe(GAMES.length);
  expect(await openRows(page)).toBe(0);

  await page.getByRole("button", { name: "Genre" }).click();
  const genres = await visible.evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.genre!));
  expect(genres).toEqual([...genres].sort((a, b) => a.localeCompare(b, "en")));

  const search = page.getByRole("searchbox", { name: "Search the games" });
  await search.fill("racing");
  const hits = GAMES.filter((g) => [g.name, ...g.genre, g.meta, g.credit ?? ""].join(" ").match(/\bracing/i));
  await expect(visible).toHaveCount(hits.length);
  await expect(cards).toHaveCount(GAMES.length);
  await expect(page.locator("#games-count")).toHaveText(`${hits.length} of ${GAMES.length} games`);

  // a term matches the start of a word, not the middle: "rac" is not in "characters"
  await search.fill("rac");
  await expect(visible).toHaveCount(hits.length);

  await search.fill("zzzz no such game");
  await expect(visible).toHaveCount(0);
  await expect(page.locator("#games-none")).toBeVisible();
  await page.getByRole("button", { name: "Clear the search" }).click();
  await expect(search).toHaveValue("");
  await expect(visible).toHaveCount(GAMES.length);

  await page.getByRole("button", { name: "Popular" }).click();
  expect(await hrefs()).toEqual(built);
  expect(await classes()).toEqual(builtClasses);
});

test("the updates pages load clean, fit a phone and pass axe", async ({ page }) => {
  // axe over /updates, every update of every game on one page, takes a while
  test.setTimeout(120_000);
  const problems: string[] = [];
  page.on("pageerror", (e) => problems.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") problems.push(m.text()); });
  await asTheWorker(page, null);
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ["/updates", "/updates/tree", "/updates/stink"]) {
    await page.goto(path);
    await expect(page.locator(".upd").first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), path).toBeLessThanOrEqual(0);
    const axe = await new AxeBuilder({ page }).exclude(".ad-sticky").exclude(".ad-rail").analyze();
    const serious = axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious.map((v) => `${path} ${v.id}: ${v.nodes.length}`)).toEqual([]);
  }
  expect(problems).toEqual([]);
});

test("the hub's latest updates lead to every update", async ({ page }) => {
  await asTheWorker(page, null);
  await page.goto("/");
  await expect(page.locator("#updates .upd")).toHaveCount(4);
  // the splash above the hero's heading is the newest of those four
  const first = await page.locator("#updates .upd").first().getAttribute("id");
  await expect(page.locator(".splash")).toHaveAttribute("href", `/updates#${first}`);
  await page.locator('#updates a[href="/updates"]').click();
  await expect(page).toHaveURL(/\/updates$/);
  await expect(page.locator("h1")).toContainText("Every update");
});
