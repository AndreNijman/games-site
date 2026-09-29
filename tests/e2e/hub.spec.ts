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

test("every game has its card, in order, and every picture loads", async ({ page }) => {
  await asTheWorker(page, null);
  await page.goto("/");
  const cards = page.locator("#games .game");
  await expect(cards).toHaveCount(GAMES.length);
  for (const [i, g] of GAMES.entries()) {
    await expect(cards.nth(i)).toHaveAttribute("href", `https://${g.host}/`);
    await expect(cards.nth(i).locator("h3")).toHaveText(g.name);
  }
  // every file exists and decodes: load the lazy ones now rather than scroll for them
  await page.evaluate(() => document.querySelectorAll<HTMLImageElement>("img[loading=lazy]").forEach((i) => { i.loading = "eager"; }));
  await expect.poll(() => page.evaluate(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0))).toBe(true);
  await expect(page.locator(".strip b").first()).toHaveText(String(GAMES.length));
});
