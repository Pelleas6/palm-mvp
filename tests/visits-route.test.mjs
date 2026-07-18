import test from "node:test";
import assert from "node:assert/strict";

import { getVisitCount } from "../lib/visit-counter.js";

test("visit counter increments the public fallback once when asked", async () => {
  let calledUrl = null;
  const fetchImpl = async (url) => {
    calledUrl = String(url);
    return new Response(JSON.stringify({ count: 42 }), { status: 200 });
  };

  const result = await getVisitCount({ increment: true, env: {}, fetchImpl });
  assert.equal(calledUrl, "https://api.counterapi.dev/v1/le-pouls-du-monde-pelleas6/explorations/up");
  assert.deepEqual(result, { ok: true, count: 42 });
});

test("visit counter fails closed when its provider cannot answer", async () => {
  const result = await getVisitCount({
    env: {},
    fetchImpl: async () => { throw new Error("offline"); },
  });
  assert.deepEqual(result, { ok: false, count: null });
});

test("visit counter uses the authenticated provider when its environment is configured", async () => {
  let calledUrl = null;
  let authorization = null;
  const result = await getVisitCount({
    increment: false,
    env: {
      COUNTER_API_WORKSPACE: "pouls-prive",
      COUNTER_API_KEY: "test-secret",
      COUNTER_API_COUNTER: "visites",
    },
    fetchImpl: async (url, options) => {
      calledUrl = String(url);
      authorization = options.headers.Authorization;
      return new Response(JSON.stringify({ count: 97 }), { status: 200 });
    },
  });

  assert.equal(calledUrl, "https://api.counterapi.dev/v2/pouls-prive/visites");
  assert.equal(authorization, "Bearer test-secret");
  assert.deepEqual(result, { ok: true, count: 97 });
});
