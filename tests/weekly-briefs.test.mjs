import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { getPublishedBriefBySlug, getPublishedBriefs } from "../lib/weekly-briefs.js";

test("published briefs have a stable public route and traceable reading fields", () => {
  const briefs = getPublishedBriefs();
  assert.ok(briefs.length > 0);
  for (const brief of briefs) {
    assert.match(brief.slug, /^[a-z0-9-]+$/);
    assert.equal(brief.status, "published");
    assert.ok(Array.isArray(brief.metrics) && brief.metrics.length === 3);
    assert.ok(Array.isArray(brief.sections) && brief.sections.length > 0);
    assert.ok(Array.isArray(brief.sources) && brief.sources.length > 0);
    assert.equal(getPublishedBriefBySlug(brief.slug)?.slug, brief.slug);
  }
});

test("brief publishing guide keeps drafts separate from public publication", async () => {
  const guide = await readFile(new URL("../docs/HERMES_BRIEF_MONDE.md", import.meta.url), "utf8");
  assert.match(guide, /status/);
  assert.match(guide, /published/);
  assert.match(guide, /non déterminés/);
});
