import test from "node:test";
import assert from "node:assert/strict";

import { guardRequest, rateLimitHeaders, resetRequestGuardsForTests } from "../lib/request-guard.js";

function request(ip = "203.0.113.7") {
  return new Request("https://ma-ligne-de-vie.fr/api/gdelt", { headers: { "x-forwarded-for": ip } });
}

test("request guard accepts a bounded burst then returns an explicit retry window", () => {
  resetRequestGuardsForTests();
  const now = 1_000_000;
  const first = guardRequest(request(), { scope: "test", limit: 2, windowMs: 10_000, now });
  const second = guardRequest(request(), { scope: "test", limit: 2, windowMs: 10_000, now: now + 1 });
  const blocked = guardRequest(request(), { scope: "test", limit: 2, windowMs: 10_000, now: now + 2 });

  assert.equal(first.allowed, true);
  assert.equal(second.remaining, 0);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfterSeconds, 10);
  assert.deepEqual(rateLimitHeaders(blocked), {
    "RateLimit-Limit": "2",
    "RateLimit-Remaining": "0",
    "RateLimit-Reset": "1010",
  });
});

test("request guard isolates clients and resets at the end of its window", () => {
  resetRequestGuardsForTests();
  const now = 2_000_000;
  guardRequest(request("203.0.113.8"), { scope: "test", limit: 1, windowMs: 1_000, now });
  const otherClient = guardRequest(request("203.0.113.9"), { scope: "test", limit: 1, windowMs: 1_000, now });
  const afterWindow = guardRequest(request("203.0.113.8"), { scope: "test", limit: 1, windowMs: 1_000, now: now + 1_000 });

  assert.equal(otherClient.allowed, true);
  assert.equal(afterWindow.allowed, true);
});
