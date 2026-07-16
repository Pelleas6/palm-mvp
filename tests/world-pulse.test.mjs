import test from "node:test";
import assert from "node:assert/strict";

import { createPulseCache, getWorldPulse } from "../lib/world-pulse.js";
import { WORLD_PULSE_SIGNAL_LEGEND } from "../lib/world-pulse-signals.js";

const FIXED_NOW = "2026-07-15T12:00:00.000Z";
const FIVE_MINUTES_AND_ONE_SECOND = new Date(Date.parse(FIXED_NOW) + 301_000).toISOString();

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
});

test("getWorldPulse returns GDELT as the primary source and deduplicates article links", async () => {
  const cache = createPulseCache();
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(String(url));
    return jsonResponse({
      articles: [
        {
          url: "https://example.com/world/economy",
          title: "Global technology and health systems react",
          domain: "example.com",
          sourcecountry: "United States",
          language: "English",
          seendate: "20260715115900",
          socialimage: "https://example.com/img.jpg",
        },
        {
          url: "https://example.com/world/economy",
          title: "Duplicate economy article",
          domain: "example.com",
          sourcecountry: "United States",
          language: "English",
          seendate: "20260715115800",
        },
      ],
    });
  };

  const payload = await getWorldPulse({ cache, fetchImpl, now: () => new Date(FIXED_NOW) });

  assert.equal(payload.state, "ok");
  assert.equal(payload.stateLabel, "OK — GDELT");
  assert.equal(payload.source.active, "GDELT");
  assert.equal(payload.source.cached, false);
  assert.equal(payload.counts.articles, 1);
  assert.equal(payload.counts.domains, 1);
  assert.equal(payload.counts.labels, 1);
  assert.equal(payload.counts.localized, 1);
  assert.equal(payload.counts.unlocalized, 0);
  assert.equal(payload.articles[0].label, "Technologie");
  assert.equal(payload.articles[0].labelType, "classification estimative");
  assert.deepEqual(payload.articles[0].sourceLocation, {
    label: "États-Unis",
    code: "US",
    x: 22,
    y: 42,
    basis: "sourceCountry",
  });
  assert.equal(calls.length, 1);
});

test("getWorldPulse serves a fresh server cache for at least five minutes", async () => {
  const cache = createPulseCache();
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return jsonResponse({
      articles: [
        {
          url: "https://cache.example/article",
          title: "Technology signal from cache",
          domain: "cache.example",
          sourcecountry: "France",
          language: "French",
          seendate: "20260715115800",
        },
      ],
    });
  };

  const first = await getWorldPulse({ cache, fetchImpl, now: () => new Date(FIXED_NOW) });
  const second = await getWorldPulse({ cache, fetchImpl, now: () => new Date(Date.parse(FIXED_NOW) + 299_000) });
  const third = await getWorldPulse({ cache, fetchImpl, now: () => new Date(FIVE_MINUTES_AND_ONE_SECOND) });

  assert.equal(first.source.cached, false);
  assert.equal(second.source.cached, true);
  assert.equal(second.cache.status, "hit");
  assert.equal(second.freshnessSeconds, 299);
  assert.equal(third.source.cached, false);
  assert.equal(calls, 2);
});

test("getWorldPulse falls back to public RSS when GDELT fails and deduplicates RSS links", async () => {
  const cache = createPulseCache();
  const calls = [];
  const rss = `<?xml version="1.0"?><rss><channel>
    <item><title>Climate update</title><link>https://rss.example/world-1</link><pubDate>Wed, 15 Jul 2026 11:55:00 GMT</pubDate><description>Public report.</description></item>
    <item><title>Duplicate link</title><link>https://rss.example/world-1</link><pubDate>Wed, 15 Jul 2026 11:54:00 GMT</pubDate></item>
  </channel></rss>`;
  const fetchImpl = async (url) => {
    calls.push(String(url));
    if (String(url).includes("gdeltproject")) {
      const error = new Error("The operation was aborted");
      error.name = "AbortError";
      throw error;
    }
    return textResponse(rss);
  };

  const payload = await getWorldPulse({
    cache,
    fetchImpl,
    now: () => new Date(FIXED_NOW),
    rssFeeds: [{ name: "Mock RSS", url: "https://rss.example/feed.xml", language: "French", sourceCountry: "France" }],
  });

  assert.equal(payload.state, "partial");
  assert.equal(payload.stateLabel, "Partiel — RSS_FALLBACK");
  assert.equal(payload.source.active, "RSS_FALLBACK");
  assert.equal(payload.source.cached, false);
  assert.equal(payload.source.primaryError.reason, "Timeout GDELT");
  assert.equal(payload.counts.articles, 1);
  assert.equal(payload.articles[0].domain, "rss.example");
  assert.equal(payload.articles[0].sourceCountry, "France");
  assert.equal(payload.articles[0].sourceLocation?.code, "FR");
  assert.equal(payload.articles[0].label, "Climat");
  assert.equal(calls.length, 2);
});

test("getWorldPulse limits each media to five articles and exposes one deterministic map point per media", async () => {
  const cache = createPulseCache();
  const repeatedMedia = Array.from({ length: 7 }, (_, index) => ({
    url: `https://example.com/world-${index}`,
    title: `Climate and economy signal ${index}`,
    domain: "example.com",
    sourcecountry: "France",
    language: "French",
    seendate: `20260715115${index}00`,
  }));
  const secondMedia = Array.from({ length: 2 }, (_, index) => ({
    url: `https://another.example/world-${index}`,
    title: `Conflict signal ${index}`,
    domain: "another.example",
    sourcecountry: "France",
    language: "French",
    seendate: `20260715114${index}00`,
  }));
  const fetchImpl = async () => jsonResponse({ articles: [...repeatedMedia, ...secondMedia] });

  const payload = await getWorldPulse({ cache, fetchImpl, now: () => new Date(FIXED_NOW) });

  assert.equal(payload.counts.articles, 7);
  assert.equal(payload.counts.mediaSources, 2);
  assert.equal(payload.counts.mapPoints, 2);
  assert.equal(payload.counts.localized, 7);
  assert.equal(payload.counts.unlocalized, 0);

  const examplePoint = payload.mapPoints.find((point) => point.mediaName === "example.com");
  const anotherPoint = payload.mapPoints.find((point) => point.mediaName === "another.example");
  assert.equal(examplePoint.articleCount, 5);
  assert.equal(anotherPoint.articleCount, 2);
  assert.equal(examplePoint.location.code, "FR");
  assert.equal(examplePoint.sourceCountry, "France");
  assert.equal(examplePoint.label, "Climat");
  assert.equal(examplePoint.positioning, "media_source_location");
  assert.notEqual(`${examplePoint.x},${examplePoint.y}`, `${anotherPoint.x},${anotherPoint.y}`);
});

test("getWorldPulse records RSS source health and caps fallback articles per feed", async () => {
  const cache = createPulseCache();
  const rss = `<?xml version="1.0"?><rss><channel>${Array.from({ length: 6 }, (_, index) => `
    <item><title>World health update ${index}</title><link>https://rss-ok.example/world-${index}</link><pubDate>Wed, 15 Jul 2026 11:5${index}:00 GMT</pubDate><description>Public report.</description></item>`).join("")}
  </channel></rss>`;
  const fetchImpl = async (url) => {
    if (String(url).includes("gdeltproject")) {
      const error = new Error("The operation was aborted");
      error.name = "AbortError";
      throw error;
    }
    if (String(url).includes("rss-fail.example")) return textResponse("service down", 503, "text/plain");
    return textResponse(rss);
  };

  const payload = await getWorldPulse({
    cache,
    fetchImpl,
    now: () => new Date(FIXED_NOW),
    rssFeeds: [
      { name: "RSS OK", region: "Europe", url: "https://rss-ok.example/feed.xml", language: "French", sourceCountry: "France" },
      { name: "RSS KO", region: "Africa", url: "https://rss-fail.example/feed.xml", language: "French", sourceCountry: "Kenya" },
    ],
  });

  assert.equal(payload.state, "partial");
  assert.equal(payload.counts.articles, 5);
  assert.equal(payload.counts.mapPoints, 1);
  assert.equal(payload.mapPoints[0].mediaName, "RSS OK");
  assert.equal(payload.mapPoints[0].articleCount, 5);

  const gdeltHealth = payload.sourceHealth.find((entry) => entry.source === "GDELT 2.0 DOC API");
  const okHealth = payload.sourceHealth.find((entry) => entry.source === "RSS OK");
  const failHealth = payload.sourceHealth.find((entry) => entry.source === "RSS KO");
  assert.equal(gdeltHealth.state, "timeout");
  assert.equal(okHealth.region, "Europe");
  assert.equal(okHealth.http, 200);
  assert.equal(okHealth.xml, true);
  assert.equal(okHealth.articles, 6);
  assert.equal(okHealth.recent, true);
  assert.equal(okHealth.state, "ok");
  assert.equal(failHealth.http, 503);
  assert.equal(failHealth.state, "http_error");
});

test("getWorldPulse counts real articles without reliable source location outside the map", async () => {
  const cache = createPulseCache();
  const fetchImpl = async () => jsonResponse({
    articles: [
      {
        url: "https://unknown.example/article",
        title: "Health signal from an unknown source region",
        domain: "unknown.example",
        sourcecountry: "Atlantis",
        language: "English",
        seendate: "20260715115900",
      },
    ],
  });

  const payload = await getWorldPulse({ cache, fetchImpl, now: () => new Date(FIXED_NOW) });

  assert.equal(payload.state, "ok");
  assert.equal(payload.counts.articles, 1);
  assert.equal(payload.counts.localized, 0);
  assert.equal(payload.counts.unlocalized, 1);
  assert.equal(payload.articles[0].sourceCountry, "Atlantis");
  assert.equal(payload.articles[0].sourceLocation, null);
});

test("getWorldPulse returns unavailable with documented causes when both GDELT and RSS fail", async () => {
  const cache = createPulseCache();
  const fetchImpl = async (url) => {
    if (String(url).includes("gdeltproject")) return textResponse("not-json", 502, "text/plain");
    return textResponse("", 503);
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
  assert.ok(payload.error.causes.some((cause) => cause.source === "GDELT"));
  assert.ok(payload.error.causes.some((cause) => cause.source === "RSS_FALLBACK"));
  assert.match(payload.notice, /Aucune donnée de démonstration/i);
});
