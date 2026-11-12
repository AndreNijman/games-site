// api.openfront.andrenijman.com: stands in for OpenFront's account API, which
// a self-hosted server has none of. The client polls api.<DOMAIN>/cluster.json
// and treats an API it cannot reach as an outage that disables every
// multiplayer button; any answer below 500, a 404 included, means "reachable,
// no list", and the client then plays on the single server its page names.
// So every path answers 404, with CORS for the game page so the browser lets
// the client read it. Accounts, cosmetics and stats stay unavailable.
const PAGE = "https://openfront.andrenijman.com";

export default {
  async fetch(request) {
    const origin = request.headers.get("Origin");
    const headers = new Headers({ "Cache-Control": "no-store", Vary: "Origin" });
    if (origin === PAGE) {
      headers.set("Access-Control-Allow-Origin", PAGE);
      headers.set("Access-Control-Allow-Credentials", "true");
    }
    if (request.method === "OPTIONS") {
      if (origin === PAGE) {
        headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
        headers.set("Access-Control-Allow-Headers",
          request.headers.get("Access-Control-Request-Headers") ?? "content-type, authorization");
        headers.set("Access-Control-Max-Age", "86400");
      }
      return new Response(null, { status: 204, headers });
    }
    headers.set("Content-Type", "application/json");
    return new Response(JSON.stringify({ error: "not_found" }), { status: 404, headers });
  },
};
