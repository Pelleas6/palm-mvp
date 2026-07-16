import test from "node:test";
import assert from "node:assert/strict";

import {
  createPulseCache,
  getWorldPulse,
  getWorldPulseSourceHealthSnapshot,
  responseHeadersForPayload,
} from "../lib/world-pulse.js";
import { WORLD_PULSE_SIGNAL_LEGEND, colorForWorldPulseSignalLabel } from "../lib/world-pulse-signals.js";

const FIXED_NOW = "2026-07-15T12:00:00.000Z";
const FIFTEEN_MINUTES_MINUS_ONE_SECOND = new Date(Date.parse(FIXED_NOW) + 899_000).toISOString();
const FIFTEEN_MINUTES_PLUS_ONE_SECOND = new Date(Date.parse(FIXED_NOW) + 901_000).toISOString();

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function textResponse(body, status = 200, contentType = "application/rss+xml") {
  return new Response(body, {
    status,
    headers: { "content-type": contentType },
  });
}

function rssResponse(items, status = 200) {
  return textResponse(`<?xml version="1.0"?><rss><channel>${items.join("\n")}</channel></rss>`, status);
}

function rssItem({ title, link, pubDate = "Wed, 15 Jul 2026 11:55:00 GMT", description = "Public report." }) {
  return `<item><title>${title}</title><link>${link}</link><pubDate>${pubDate}</pubDate><description>${description}</description></item>`;
}

function ngramsTocResponse(entries = [
  { ID: 1, date: "2026-07-15T11:45:00.000Z", lang: "en", title: "Technology and climate signal", url: "https://toc.example/technology" },
  { ID: 2, date: "2026-07-15T11:45:00.000Z", lang: "fr", title: "Election mondiale", url: "https://toc.example/election" },
]) {
  return textResponse(entries.map((entry) => JSON.stringify(entry)).join("\n"), 200, "application/x-ndjson");
}

test("world pulse legend exposes the six approved signal categories", () => {
  assert.deepEqual(WORLD_PULSE_SIGNAL_LEGEND.map((item) => item.label), [
    "Conflit/tension",
    "Technologie",
    "Élections",
    "Climat",
    "Santé",
    "Autre signal",
  ]);
  assert.equal(new Set(WORLD_PULSE_SIGNAL_LEGEND.map((item) => item.color)).size, 6);
  for (const item of WORLD_PULSE_SIGNAL_LEGEND) {
    assert.equal(colorForWorldPulseSignalLabel(item.label), item.color);
  }
});

test("getWorldPulse uses public RSS as the operational source, dedupes canonical URLs and normalized titles, and reads GDELT Web N-Grams TOC for trends", async () => {
  const cache = createPulseCache();
  const calls = [];
  const fetchImpl = async (url) => {
    const href = String(url);
    calls.push(href);
    if (href.includes("rss.example")) {
      return rssResponse([
        rssItem({ title: "Climate update", link: "https://rss.example/world-1?utm_source=test", description: "Climate public report" }),
        rssItem({ title: "Duplicate canonical URL", link: "https://rss.example/world-1", description: "Duplicate by URL" }),
        rssItem({ title: "  Climate   update  ", link: "https://mirror.example/climate-copy", description: "Duplicate by normalized title" }),
        rssItem({ title: "Election signal", link: "https://rss.example/world-2", description: "Election report" }),
      ]);
    }
    if (href.includes("weblegacy/ngrams")) return ngramsTocResponse();
    if (href.includes("gdeltproject")) throw new Error("GDELT DOC must not be queried for operational articles");
    throw new Error(`unexpected fetch ${href}`);
  };

  const payload = await getWorldPulse({
    cache,
    fetchImpl,
    now: () => new Date(FIXED_NOW),
    rssFeeds: [{ name: "Mock RSS", url: "https://rss.example/feed.xml", language: "French", sourceCountry: "France", region: "Europe" }],
  });

  assert.equal(payload.state, "ok");
  assert.equal(payload.stateLabel, "OK — RSS public");
  assert.equal(payload.source.active, "RSS_PUBLIC");
  assert.equal(payload.source.cached, false);
  assert.equal(payload.cache.ttlSeconds, 900);
  assert.equal(payload.counts.articles, 2);
  assert.equal(payload.counts.mediaSources, 1);
  assert.equal(payload.articles[0].sourceType, "Mock RSS");
  assert.equal(payload.articles[0].sourceLocation?.code, "FR");
  assert.deepEqual(payload.articles.map((article) => article.title).sort(), ["Climate update", "Election signal"]);
  assert.equal(payload.globalTrends.source, "GDELT_WEB_NGRAMS_TOC");
  assert.equal(payload.globalTrends.cycleMinutes, 15);
  assert.equal(payload.globalTrends.delayMinutes, 5);
  assert.equal(payload.globalTrends.documents, 2);
  assert.ok(payload.globalTrends.labels.some((item) => item.label === "Technologie"));
  assert.ok(calls.some((href) => href.includes("rss.example")));
  assert.ok(calls.some((href) => href.includes(".toc.json.gz")));
  assert.ok(!calls.some((href) => href.includes("api/v2/doc")));

  const rssHealth = payload.sourceHealth.find((entry) => entry.source === "Mock RSS");
  const ngramsHealth = payload.sourceHealth.find((entry) => entry.source === "GDELT Web N-Grams TOC");
  assert.equal(rssHealth.state, "OK");
  assert.equal(ngramsHealth.state, "OK");
});

test("getWorldPulse serves a shared server cache for at least 15 minutes and suppresses repeated external calls across 20 close loads", async () => {
  const cache = createPulseCache();
  const calls = [];
  const fetchImpl = async (url) => {
    const href = String(url);
    calls.push(href);
    if (href.includes("rss.example")) {
      return rssResponse([rssItem({ title: "Technology signal from cache", link: "https://rss.example/cache" })]);
    }
    if (href.includes("weblegacy/ngrams")) return ngramsTocResponse();
    throw new Error(`unexpected fetch ${href}`);
  };

  const payloads = [];
  for (let index = 0; index < 20; index += 1) {
    payloads.push(await getWorldPulse({
      cache,
      fetchImpl,
      now: () => new Date(Date.parse(FIXED_NOW) + index * 1000),
      rssFeeds: [{ name: "Cache RSS", url: "https://rss.example/feed.xml", language: "French", sourceCountry: "France" }],
    }));
  }
  const nearlyExpired = await getWorldPulse({
    cache,
    fetchImpl,
    now: () => new Date(FIFTEEN_MINUTES_MINUS_ONE_SECOND),
    rssFeeds: [{ name: "Cache RSS", url: "https://rss.example/feed.xml", language: "French", sourceCountry: "France" }],
  });
  const expired = await getWorldPulse({
    cache,
    fetchImpl,
    now: () => new Date(FIFTEEN_MINUTES_PLUS_ONE_SECOND),
    rssFeeds: [{ name: "Cache RSS", url: "https://rss.example/feed.xml", language: "French", sourceCountry: "France" }],
  });

  assert.equal(payloads[0].cache.status, "miss");
  assert.ok(payloads.slice(1).every((payload) => payload.cache.status === "hit"));
  assert.equal(nearlyExpired.cache.status, "hit");
  assert.equal(expired.cache.status, "miss");
  assert.equal(calls.filter((href) => href.includes("rss.example")).length, 2);
  assert.equal(calls.filter((href) => href.includes("weblegacy/ngrams")).length, 2);
  assert.equal(calls.filter((href) => href.includes("api/v2/doc")).length, 0);
});

test("getWorldPulse returns a 24h stale-if-error cache when fresh RSS and Web N-Grams refresh fail", async () => {
  const cache = createPulseCache();
  let failRefresh = false;
  const fetchImpl = async (url) => {
    const href = String(url);
    if (failRefresh) throw new Error(`network down for ${href}`);
    if (href.includes("rss.example")) {
      return rssResponse([rssItem({ title: "Health signal before outage", link: "https://rss.example/stale" })]);
    }
    if (href.includes("weblegacy/ngrams")) return ngramsTocResponse();
    throw new Error(`unexpected fetch ${href}`);
  };

  const first = await getWorldPulse({
    cache,
    fetchImpl,
    now: () => new Date(FIXED_NOW),
    rssFeeds: [{ name: "Stale RSS", url: "https://rss.example/feed.xml", language: "French", sourceCountry: "France" }],
  });
  failRefresh = true;
  const stale = await getWorldPulse({
    cache,
    fetchImpl,
    now: () => new Date(FIFTEEN_MINUTES_PLUS_ONE_SECOND),
    rssFeeds: [{ name: "Stale RSS", url: "https://rss.example/feed.xml", language: "French", sourceCountry: "France" }],
  });

  assert.equal(first.cache.status, "miss");
  assert.equal(stale.cache.status, "stale-if-error");
  assert.equal(stale.source.cached, true);
  assert.equal(stale.counts.articles, 1);
  assert.ok(stale.freshnessSeconds >= 901);
  assert.ok(stale.sourceHealth.some((entry) => entry.state === "CACHE_STALE"));
  const headers = responseHeadersForPayload(first);
  assert.match(headers["Cache-Control"], /s-maxage=900/);
  assert.match(headers["Cache-Control"], /stale-if-error=86400/);
});

test("GDELT DOC canary detects rate limiting even on HTTP 200 and respects the one-hour gate", async () => {
  const cache = createPulseCache();
  let gdeltDocCalls = 0;
  const fetchImpl = async (url) => {
    const href = String(url);
    if (href.includes("rss.example")) {
      return rssResponse([rssItem({ title: "Conflict signal", link: `https://rss.example/conflict-${gdeltDocCalls}` })]);
    }
    if (href.includes("weblegacy/ngrams")) return ngramsTocResponse();
    if (href.includes("api/v2/doc")) {
      gdeltDocCalls += 1;
      return textResponse("Your query has been rate limited by GDELT", 200, "text/plain");
    }
    throw new Error(`unexpected fetch ${href}`);
  };

  const first = await getWorldPulse({
    cache,
    fetchImpl,
    now: () => new Date(FIXED_NOW),
    gdeltCanaryDelayMs: 0,
    awaitGdeltCanary: true,
    rssFeeds: [{ name: "Canary RSS", url: "https://rss.example/feed.xml", language: "French", sourceCountry: "France" }],
  });
  const second = await getWorldPulse({
    cache,
    fetchImpl,
    now: () => new Date(FIFTEEN_MINUTES_PLUS_ONE_SECOND),
    gdeltCanaryDelayMs: 0,
    awaitGdeltCanary: true,
    rssFeeds: [{ name: "Canary RSS", url: "https://rss.example/feed.xml", language: "French", sourceCountry: "France" }],
  });

  const firstCanary = first.sourceHealth.find((entry) => entry.source === "GDELT 2.0 DOC API canary");
  const secondCanary = second.sourceHealth.find((entry) => entry.source === "GDELT 2.0 DOC API canary");
  assert.equal(gdeltDocCalls, 1);
  assert.equal(firstCanary.state, "RATE_LIMITED");
  assert.equal(firstCanary.http, 200);
  assert.equal(secondCanary.state, "RATE_LIMITED");
});

test("GDELT DOC canary uses a thirty-second default timeout", async () => {
  const cache = createPulseCache();
  const timeoutCalls = [];
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  globalThis.setTimeout = (callback, timeoutMs, ...args) => {
    timeoutCalls.push(timeoutMs);
    return originalSetTimeout(callback, timeoutMs, ...args);
  };
  globalThis.clearTimeout = (timer) => originalClearTimeout(timer);

  try {
    await getWorldPulse({
      cache,
      fetchImpl: async (url) => {
        const href = String(url);
        if (href.includes("rss.example")) return rssResponse([rssItem({ title: "Canary timeout signal", link: "https://rss.example/canary-timeout" })]);
        if (href.includes("weblegacy/ngrams")) return ngramsTocResponse();
        if (href.includes("api/v2/doc")) return textResponse("Your query has been rate limited by GDELT", 200, "text/plain");
        throw new Error(`unexpected fetch ${href}`);
      },
      now: () => new Date(FIXED_NOW),
      gdeltCanaryDelayMs: 0,
      awaitGdeltCanary: true,
      rssFeeds: [{ name: "Canary Timeout RSS", url: "https://rss.example/feed.xml", language: "French", sourceCountry: "France" }],
    });
  } finally {
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
  }

  assert.ok(timeoutCalls.filter((timeoutMs) => timeoutMs === 2500).length >= 2, "RSS and Web N-Grams keep lightweight 2.5s fetch timeouts");
  assert.equal(timeoutCalls.at(-1), 30_000, "GDELT DOC canary default timeout must be 30s");
});

test("getWorldPulse caps public RSS to five articles per media and 50 globally while preserving media markers and article particles", async () => {
  const cache = createPulseCache();
  const feeds = Array.from({ length: 11 }, (_, index) => ({
    name: `Feed ${index}`,
    region: "Fixture",
    url: `https://feed-${index}.example/rss.xml`,
    language: "English",
    sourceCountry: ["United Kingdom", "France", "Germany", "Republic of Congo", "Qatar", "India", "Japan", "Australia", "United States", "Canada", "Brazil"][index],
  }));
  const fetchImpl = async (url) => {
    const href = String(url);
    if (href.includes("weblegacy/ngrams")) return ngramsTocResponse();
    const feedIndex = Number(href.match(/feed-(\d+)/)?.[1] || 0);
    const items = Array.from({ length: 6 }, (_, itemIndex) => rssItem({
      title: `Technology climate signal ${feedIndex}-${itemIndex}`,
      link: `https://feed-${feedIndex}.example/world-${itemIndex}`,
      pubDate: `Wed, 15 Jul 2026 11:${String(50 + itemIndex).padStart(2, "0")}:00 GMT`,
    }));
    return rssResponse(items);
  };

  const payload = await getWorldPulse({ cache, fetchImpl, now: () => new Date(FIXED_NOW), rssFeeds: feeds });

  assert.equal(payload.counts.articles, 50);
  assert.equal(payload.counts.mediaSources, 11);
  assert.equal(payload.counts.mediaMarkers, 11);
  assert.equal(payload.counts.articleParticles, 50);
  assert.equal(payload.mapPoints.length, 11);
  assert.equal(payload.mediaMarkers.length, 11);
  assert.equal(payload.articleParticles.length, 50);
  assert.ok(payload.mediaMarkers.every((marker) => marker.articleCount <= 5));
  assert.ok(payload.mediaMarkers.every((marker) => marker.size >= 6 && marker.size <= 8));
  assert.ok(payload.articleParticles.every((particle) => particle.size >= 3 && particle.size <= 5));
  assert.ok(payload.mediaMarkers.some((marker) => marker.location.code === "AU"));
  assert.ok(payload.mediaMarkers.some((marker) => marker.location.code === "CA"));
});

test("getWorldPulse disperses media markers and article particles when source coordinates are close", async () => {
  const cache = createPulseCache();
  const feeds = [
    { name: "Near UK", region: "Europe", url: "https://near-uk.example/rss.xml", language: "English", sourceCountry: "United Kingdom" },
    { name: "Near France", region: "Europe", url: "https://near-fr.example/rss.xml", language: "French", sourceCountry: "France" },
    { name: "Near Germany", region: "Europe", url: "https://near-de.example/rss.xml", language: "German", sourceCountry: "Germany" },
  ];
  const fetchImpl = async (url) => {
    const href = String(url);
    if (href.includes("weblegacy/ngrams")) return ngramsTocResponse();
    const feed = feeds.find((item) => href === item.url);
    if (!feed) throw new Error(`unexpected fetch ${href}`);
    return rssResponse([rssItem({ title: `Technology signal from ${feed.name}`, link: `${feed.url.replace("/rss.xml", "")}/article` })]);
  };

  const payload = await getWorldPulse({ cache, fetchImpl, now: () => new Date(FIXED_NOW), rssFeeds: feeds });
  const distance = (left, right) => Math.hypot(left.x - right.x, left.y - right.y);
  const minMediaDistance = Math.min(...payload.mediaMarkers.flatMap((left, leftIndex) => (
    payload.mediaMarkers.slice(leftIndex + 1).map((right) => distance(left, right))
  )));
  const minParticleDistance = Math.min(...payload.articleParticles.flatMap((left, leftIndex) => (
    payload.articleParticles.slice(leftIndex + 1).map((right) => distance(left, right))
  )));

  assert.equal(payload.mediaMarkers.length, 3);
  assert.equal(payload.articleParticles.length, 3);
  assert.ok(minMediaDistance >= 4.5, `media markers too close: ${minMediaDistance}`);
  assert.ok(minParticleDistance >= 4.5, `article particles too close: ${minParticleDistance}`);
});

test("source health snapshot reads in-memory cache only and performs zero external fetch", async () => {
  const cache = createPulseCache();
  let calls = 0;
  const fetchImpl = async (url) => {
    calls += 1;
    const href = String(url);
    if (href.includes("rss.example")) return rssResponse([rssItem({ title: "Climate snapshot", link: "https://rss.example/snapshot" })]);
    if (href.includes("weblegacy/ngrams")) return ngramsTocResponse();
    throw new Error(`unexpected fetch ${href}`);
  };

  await getWorldPulse({
    cache,
    fetchImpl,
    now: () => new Date(FIXED_NOW),
    rssFeeds: [{ name: "Snapshot RSS", url: "https://rss.example/feed.xml", language: "French", sourceCountry: "France" }],
  });
  const callsBeforeSnapshot = calls;
  const snapshot = getWorldPulseSourceHealthSnapshot({ cache, now: () => new Date(Date.parse(FIXED_NOW) + 1000) });

  assert.equal(calls, callsBeforeSnapshot);
  assert.equal(snapshot.cache.status, "memory");
  assert.ok(snapshot.items.some((entry) => entry.source === "Snapshot RSS" && entry.state === "OK"));
  assert.ok(snapshot.items.some((entry) => entry.source === "GDELT Web N-Grams TOC" && entry.state === "OK"));
});

test("getWorldPulse returns unavailable with documented source states when RSS has no usable article and no stale cache exists", async () => {
  const cache = createPulseCache();
  const fetchImpl = async (url) => {
    const href = String(url);
    if (href.includes("rss.example")) return textResponse("service down", 503, "text/plain");
    if (href.includes("weblegacy/ngrams")) return textResponse("not-json-lines", 200, "text/plain");
    return jsonResponse({ articles: [] });
  };

  const payload = await getWorldPulse({
    cache,
    fetchImpl,
    now: () => new Date(FIXED_NOW),
    rssFeeds: [{ name: "Mock RSS", url: "https://rss.example/feed.xml", language: "French" }],
  });

  assert.equal(payload.state, "unavailable");
  assert.equal(payload.stateLabel, "Indisponible");
  assert.equal(payload.source.active, "none");
  assert.equal(payload.counts.articles, 0);
  assert.deepEqual(payload.articles, []);
  assert.ok(payload.sourceHealth.some((entry) => entry.source === "Mock RSS" && entry.state === "HTTP_ERROR"));
  assert.ok(payload.sourceHealth.some((entry) => entry.source === "GDELT Web N-Grams TOC" && entry.state === "INVALID_RESPONSE"));
  assert.match(payload.notice, /Aucune donnée de démonstration/i);
});
