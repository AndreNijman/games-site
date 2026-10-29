// The latest updates as an RSS feed, for readers and for anyone who wants to
// know when a game changes. Deploys players would not notice are left out.
import type { APIRoute } from "astro";
import { ALL, updateLabel, updatesPath } from "../data/changelog";

const ORIGIN = "https://games.andrenijman.com";
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const GET: APIRoute = () => {
  const items = ALL.filter((u) => u.playerFacing !== false && u.summary).slice(0, 60).map((u) => {
    const link = `${ORIGIN}${updatesPath(u.log.slug)}#u-${u.id}`;
    return `    <item>
      <title>${esc(`${u.log.game.name}: ${updateLabel(u)}`)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${new Date(u.at).toUTCString()}</pubDate>
      <description>${esc(u.summary!)}</description>
    </item>`;
  });
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Game updates · Games by Andre Nijman</title>
    <link>${ORIGIN}/updates</link>
    <atom:link href="${ORIGIN}/updates.xml" rel="self" type="application/rss+xml" />
    <description>Every update to every game on games.andrenijman.com, and what changed.</description>
    <language>en</language>
${items.join("\n")}
  </channel>
</rss>
`;
  return new Response(body, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
};
