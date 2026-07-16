import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { getWorldPulseDashboardPayload, createPulseCache } from "../lib/world-pulse.js";

function textResponse(body, status = 200, contentType = "application/rss+xml") {
  return new Response(body, {
    status,
    headers: { "content-type": contentType },
  });
}

function rssItem({ title, link, pubDate = "Wed, 15 Jul 2026 11:55:00 GMT", description = "Public report." }) {
  return `<item><title>${title}</title><link>${link}</link><pubDate>${pubDate}</pubDate><description>${description}</description></item>`;
}

function rssResponse(items, status = 200) {
  return textResponse(`<?xml version="1.0"?><rss><channel>${items.join("\n")}</channel></rss>`, status);
}

function ngramsTocResponse(entries = [
  { ID: 1, date: "2026-07-15T11:46:00.000Z", lang: "en", title: "Technology and climate signal", url: "https://toc.example/technology" },
]) {
  return textResponse(entries.map((entry) => JSON.stringify(entry)).join("\n"), 200, "application/x-ndjson");
}

test("dashboard payload contract keeps API, server page and component on the same validated object", async () => {
  const pageSource = await readFile(new URL("../app/page.jsx", import.meta.url), "utf8");
  const componentSource = await readFile(new URL("../components/WorldPulseDashboard.js", import.meta.url), "utf8");

  assert.match(pageSource, /getWorldPulseDashboardPayload/);
  assert.match(pageSource, /export const dynamic = "force-dynamic"/);
  assert.match(pageSource, /<WorldPulseDashboard initialPayload=\{initialPayload\}/);
  assert.match(componentSource, /function useGdeltPulse\(initialPayload\)/);
  assert.match(componentSource, /useState\(\(\) => initialPayload \|\| \{ state: "loading" \}\)/);
});

test("validated dashboard payload exposes matching RSS counts and rendered collections", async () => {
  const payload = await getWorldPulseDashboardPayload({
    cache: createPulseCache(),
    fetchImpl: async (url) => {
      const href = String(url);
      if (href.includes("rss.example")) {
        return rssResponse([
          rssItem({ title: "Climate dashboard contract", link: "https://rss.example/contract-climate" }),
          rssItem({ title: "Election dashboard contract", link: "https://rss.example/contract-election" }),
        ]);
      }
      if (href.includes("weblegacy/ngrams")) return ngramsTocResponse();
      throw new Error(`unexpected fetch ${href}`);
    },
    now: () => new Date("2026-07-15T12:00:00.000Z"),
    rssFeeds: [{ name: "Contract RSS", url: "https://rss.example/feed.xml", language: "French", sourceCountry: "France" }],
  });

  assert.equal(payload.state, "ok");
  assert.equal(payload.counts.articles, payload.articles.length);
  assert.equal(payload.counts.rssArticles, payload.articles.length);
  assert.equal(payload.counts.rssMediaSources, 1);
  assert.equal(payload.counts.rssKnownMediaCountries, 1);
  assert.equal(payload.counts.articleParticles, payload.articleParticles.length);
  assert.equal(payload.counts.mediaMarkers, payload.mediaMarkers.length);
  assert.ok(payload.counts.articles > 0);
  assert.ok(payload.dataScopes.rss);
  assert.ok(payload.dataScopes.gdeltNgrams);
});
