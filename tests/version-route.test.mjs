import test from "node:test";
import assert from "node:assert/strict";

import { buildVersionPayload } from "../lib/version-proof.js";

test("buildVersionPayload exposes only non-secret Vercel release metadata", () => {
  const payload = buildVersionPayload({
    VERCEL_GIT_COMMIT_SHA: "abc123",
    VERCEL_DEPLOYMENT_ID: "dpl_123",
    VERCEL_URL: "palm-example.vercel.app",
    VERCEL_TOKEN: "must-not-leak",
    SUPABASE_SERVICE_ROLE_KEY: "must-not-leak",
  });

  assert.deepEqual(Object.keys(payload).sort(), [
    "VERCEL_DEPLOYMENT_ID",
    "VERCEL_DEPLOYMENT_URL",
    "VERCEL_GIT_COMMIT_SHA",
  ]);
  assert.deepEqual(payload, {
    VERCEL_GIT_COMMIT_SHA: "abc123",
    VERCEL_DEPLOYMENT_ID: "dpl_123",
    VERCEL_DEPLOYMENT_URL: "palm-example.vercel.app",
  });
  assert.ok(!JSON.stringify(payload).includes("must-not-leak"));
});

test("buildVersionPayload falls back to the production URL when no deployment id is set", () => {
  assert.deepEqual(buildVersionPayload({
    VERCEL_GIT_COMMIT_SHA: "def456",
    VERCEL_PROJECT_PRODUCTION_URL: "palm-production.vercel.app",
  }), {
    VERCEL_GIT_COMMIT_SHA: "def456",
    VERCEL_DEPLOYMENT_ID: null,
    VERCEL_DEPLOYMENT_URL: "palm-production.vercel.app",
  });
});
