import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  createPulseCache,
  getWorldPulse,
  getWorldPulseSourceHealthSnapshot,
  responseHeadersForPayload,
} from "../lib/world-pulse.js";
import { isCoordinateInsideCountry, verifyArticleParticlePlacements } from "../lib/world-pulse-geography.js";
import {
  WORLD_PULSE_SIGNAL_CATEGORIES,
  WORLD_PULSE_SIGNAL_LEGEND,
  colorForWorldPulseSignalLabel,
  findWorldPulseSignalCategory,
} from "../lib/world-pulse-signals.js";

const FIXED_NOW = "2026-07-15T12:00:00.000Z";
const FIFTEEN_MINUTES_MINUS_ONE_SECOND = new Date(Date.parse(FIXED_NOW) + 899_000).toISOString();
const FIFTEEN_MINUTES_PLUS_ONE_SECOND = new Date(Date.parse(FIXED_NOW) + 901_000).toISOString();

test("world pulse geography keeps world-atlas visible to the Next/Vercel bundle", async () => {
  const source = await readFile(new URL("../lib/world-pulse-geography.js", import.meta.url), "utf8");

  assert.match(source, /import worldAtlas from "world-atlas\/countries-110m\.json" with \{ type: "json" \}/);
  assert.doesNotMatch(source, /createRequire|require\("world-atlas\/countries-110m\.json"\)/);
});

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

test("world pulse legend exposes the deterministic taxonomy plus explicit unclassified bucket", () => {
  assert.deepEqual(WORLD_PULSE_SIGNAL_CATEGORIES.map((item) => item.label), [
    "Conflit/tension",
    "Politique/élections",
    "Économie/marchés",
    "Climat/environnement",
    "Santé",
    "Science/technologie",
    "Sécurité/défense",
    "Justice/société",
    "Culture/médias",
    "Sport",
    "Catastrophes/météo",
    "Énergie/transport",
  ]);
  assert.deepEqual(WORLD_PULSE_SIGNAL_LEGEND.map((item) => item.label), [
    "Conflit/tension",
    "Politique/élections",
    "Économie/marchés",
    "Climat/environnement",
    "Santé",
    "Science/technologie",
    "Sécurité/défense",
    "Justice/société",
    "Culture/médias",
    "Sport",
    "Catastrophes/météo",
    "Énergie/transport",
    "Non déterminé",
  ]);
  assert.equal(new Set(WORLD_PULSE_SIGNAL_LEGEND.map((item) => item.color)).size, 13);
  assert.ok(!WORLD_PULSE_SIGNAL_LEGEND.some((item) => item.label === "Autre signal"));
  assert.equal(WORLD_PULSE_SIGNAL_LEGEND.at(-1).thematic, false);
  for (const item of WORLD_PULSE_SIGNAL_LEGEND) {
    assert.equal(colorForWorldPulseSignalLabel(item.label), item.color);
  }
});

test("world pulse classifies multilingual article wording by the strongest direct evidence", () => {
  const fixtures = [
    ["Fox eyes first major title after joining 62 club", "Sport"],
    ["Lawyers Action Committee terms judge appointment process horse trading", "Justice/société"],
    ["Atlet eFootball Belanda dukung Spanyol memenangkan final", "Sport"],
    ["Pemerintah prepares pemilu and appoints a new menteri", "Politique/élections"],
    ["Hujan lebat triggers banjir across the region", "Catastrophes/météo"],
  ];

  for (const [title, label] of fixtures) {
    const signal = findWorldPulseSignalCategory(title);
    assert.equal(signal.label, label, title);
    assert.ok(signal.score > 0, title);
    assert.ok(signal.matches.length > 0, title);
  }

  const unclassified = findWorldPulseSignalCategory("Daily community bulletin and neighbourhood notices");
  assert.equal(unclassified.label, "Non déterminé");
  assert.equal(unclassified.score, 0);
});

test("RSS classification does not infer a topic from the media source name", async () => {
  const payload = await getWorldPulse({
    cache: createPulseCache(),
    now: () => new Date(FIXED_NOW),
    rssFeeds: [{ name: "Sport Daily", url: "https://rss.example/source-name-only.xml", language: "English", sourceCountry: "France", region: "Europe" }],
    fetchImpl: async (url) => {
      const href = String(url);
      if (href.includes("source-name-only")) {
        return rssResponse([
          rssItem({ title: "Municipal bulletin in France", link: "https://rss.example/source-name-only", description: "Neighbourhood notices and routine updates." }),
        ]);
      }
      if (href.includes("weblegacy/ngrams")) return ngramsTocResponse();
      throw new Error(`unexpected fetch ${href}`);
    },
  });

  assert.equal(payload.articles[0].label, "Non déterminé");
  assert.match(payload.articles[0].labelBasis, /titre ou le résumé/);
});

test("getWorldPulse uses public RSS as the operational source, dedupes canonical URLs and normalized titles, and reads GDELT Web N-Grams TOC with the audited safe lag", async () => {
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
  assert.equal(payload.counts.rssArticles, 2);
  assert.equal(payload.counts.mediaSources, 1);
  assert.equal(payload.counts.rssMediaSources, 1);
  assert.equal(payload.counts.rssKnownMediaCountries, 1);
  assert.equal(payload.counts.rssCategories, 2);
  assert.equal(payload.counts.rssUnclassifiedArticles, 0);
  assert.equal(payload.counts.rssClassificationCoveragePct, 100);
  assert.equal(payload.counts.gdeltNgramsDocuments, 2);
  assert.equal(payload.counts.gdeltNgramsCategories, 3);
  assert.ok(payload.counts.gdeltNgramsRawTrends >= 4);
  assert.ok(payload.counts.gdeltNgramsEmergingTrends > 0);
  assert.equal(payload.articles[0].sourceType, "Mock RSS");
  assert.equal(payload.articles[0].sourceLocation?.code, "FR");
  assert.deepEqual(payload.articles.map((article) => article.title).sort(), ["Climate update", "Election signal"]);
  assert.deepEqual(payload.dataScopes.rss.source, "RSS_PUBLIC");
  assert.deepEqual(payload.dataScopes.gdeltNgrams.source, "GDELT_WEB_NGRAMS_TOC");
  assert.equal(payload.globalTrends.source, "GDELT_WEB_NGRAMS_TOC");
  assert.equal(payload.globalTrends.cycleMinutes, 15);
  assert.equal(payload.globalTrends.delayMinutes, 105);
  assert.equal(payload.globalTrends.documents, 2);
  assert.ok(payload.globalTrends.rawTrends.some((item) => item.term === "climate" && item.label === "Climat/environnement" && item.classified === true));
  assert.ok(payload.globalTrends.rawTrends.some((item) => item.term === "election" && item.label === "Politique/élections" && item.classified === true));
  assert.ok(payload.globalTrends.emergingTrends.length > 0);
  assert.ok(payload.globalTrends.classification.coveragePct < 100);
  assert.ok(!payload.groupings.gdeltNgramsCategories.some((item) => item.label === "Non déterminé"));
  assert.ok(calls.some((href) => href.includes("rss.example")));
  assert.ok(calls.some((href) => href.includes(".toc.json.gz")));
  assert.ok(calls.some((href) => href.includes("20260715101600.toc.json.gz")), "GDELT Web N-Grams TOC must target the audited slow publication lag on real :01/:16/:31/:46 minutes, not the unavailable current-hour boundary");
  assert.ok(!calls.some((href) => href.includes("api/v2/doc")));

  const rssHealth = payload.sourceHealth.find((entry) => entry.source === "Mock RSS");
  const ngramsHealth = payload.sourceHealth.find((entry) => entry.source === "GDELT Web N-Grams TOC");
  assert.equal(rssHealth.state, "OK");
  assert.equal(ngramsHealth.state, "OK");
});

test("default RSS coverage keeps 37 verified public feeds while widening regional coverage", async () => {
  const cache = createPulseCache();
  const expectedFeeds = [
    ["BBC News World", "https://feeds.bbci.co.uk/news/world/rss.xml", "United Kingdom"],
    ["BBC News Africa", "https://feeds.bbci.co.uk/news/world/africa/rss.xml", "United Kingdom"],
    ["BBC News Asia", "https://feeds.bbci.co.uk/news/world/asia/rss.xml", "United Kingdom"],
    ["BBC News India", "https://feeds.bbci.co.uk/news/world/asia/india/rss.xml", "United Kingdom"],
    ["BBC News Latin America", "https://feeds.bbci.co.uk/news/world/latin_america/rss.xml", "United Kingdom"],
    ["BBC News Middle East", "https://feeds.bbci.co.uk/news/world/middle_east/rss.xml", "United Kingdom"],
    ["France 24 Monde", "https://www.france24.com/fr/rss", "France"],
    ["France 24 Middle East", "https://www.france24.com/en/middle-east/rss", "France"],
    ["Deutsche Welle Top Stories", "https://rss.dw.com/rdf/rss-en-all", "Germany"],
    ["Ukrainska Pravda English", "https://www.pravda.com.ua/eng/rss/", "Ukraine"],
    ["Daily Sabah World", "https://www.dailysabah.com/rss/world", "Turkey"],
    ["Africanews", "https://www.africanews.com/feed/rss", "Republic of Congo"],
    ["Premium Times", "https://www.premiumtimesng.com/feed", "Nigeria"],
    ["Al Jazeera", "https://www.aljazeera.com/xml/rss/all.xml", "Qatar"],
    ["Arab News", "https://www.arabnews.com/rss.xml", "Saudi Arabia"],
    ["The Daily Star", "https://www.thedailystar.net/rss.xml", "Bangladesh"],
    ["Kathmandu Post", "https://kathmandupost.com/rss", "Nepal"],
    ["Bangkok Post", "https://www.bangkokpost.com/rss/data/topstories.xml", "Thailand"],
    ["Laotian Times", "https://laotiantimes.com/feed/", "Laos"],
    ["VNExpress", "https://vnexpress.net/rss/tin-moi-nhat.rss", "Vietnam"],
    ["Rappler", "https://www.rappler.com/feed/", "Philippines"],
    ["CNA", "https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml", "Singapore"],
    ["NHK World", "https://www3.nhk.or.jp/rss/news/cat0.xml", "Japan"],
    ["ABC Australia World", "https://www.abc.net.au/news/feed/51120/rss.xml", "Australia"],
    ["NPR World", "https://feeds.npr.org/1004/rss.xml", "United States"],
    ["CBC World", "https://www.cbc.ca/cmlink/rss-world", "Canada"],
    ["Mexico News Daily", "https://mexiconewsdaily.com/feed/", "Mexico"],
    ["Prensa Libre", "https://www.prensalibre.com/feed/", "Guatemala"],
    ["Agência Brasil", "https://agenciabrasil.ebc.com.br/rss.xml", "Brazil"],
    ["El Tiempo Mundo", "https://www.eltiempo.com/rss/mundo.xml", "Colombia"],
    ["Agencia Andina", "https://andina.pe/agencia/rss.aspx", "Peru"],
    ["Cooperativa", "https://www.cooperativa.cl/noticias/site/tax/port/all/rss____1.xml", "Chile"],
    ["Antara", "https://www.antaranews.com/rss/terkini.xml", "Indonesia"],
    ["El País", "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada", "Spain"],
    ["RNZ", "https://www.rnz.co.nz/rss/national.xml", "New Zealand"],
    ["FBC News", "https://www.fbcnews.com.fj/rss/", "Fiji"],
    ["SABC News", "https://www.sabcnews.com/sabcnews/feed/", "South Africa"],
  ];
  const countriesByUrl = new Map(expectedFeeds.map(([, url, country]) => [url, country]));
  const namesByUrl = new Map(expectedFeeds.map(([name, url]) => [url, name]));
  const calls = [];
  const fetchImpl = async (url) => {
    const href = String(url);
    calls.push(href);
    if (href.includes("weblegacy/ngrams")) return ngramsTocResponse();
    const country = countriesByUrl.get(href);
    if (!country) throw new Error(`unexpected fetch ${href}`);
    const origin = new URL(href).origin;
    return rssResponse([
      rssItem({
        title: `Technology climate signal in ${country} from ${namesByUrl.get(href)}`,
        link: `${origin}/palm-${namesByUrl.get(href).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        description: `Verified public RSS feed for ${country}`,
      }),
    ]);
  };

  const payload = await getWorldPulse({ cache, fetchImpl, now: () => new Date(FIXED_NOW) });

  assert.equal(payload.state, "ok");
  assert.equal(calls.filter((href) => countriesByUrl.has(href)).length, 37);
  assert.equal(payload.source.feeds.length, 37);
  assert.equal(payload.counts.rssArticlesFetched, 37);
  assert.equal(payload.counts.rssMediaSources, 37);
  assert.equal(payload.counts.rssActiveSources, 37);
  assert.equal(payload.counts.rssKnownMediaCountries, 31);
  assert.ok(payload.counts.sourceRegions >= 6);
  for (const [name, url, country] of expectedFeeds) {
    assert.ok(payload.source.feeds.some((feed) => feed.name === name && feed.url === url && feed.sourceCountry === country), `${name} missing`);
    assert.ok(payload.sourceHealth.some((entry) => entry.source === name && entry.url === url && entry.state === "OK"), `${name} health missing`);
  }
});

test("RSS collection bounds concurrent requests as coverage grows", async () => {
  const cache = createPulseCache();
  let activeRequests = 0;
  let peakRequests = 0;
  const feeds = Array.from({ length: 20 }, (_, index) => ({
    name: `Bounded RSS ${index + 1}`,
    url: `https://rss.example/bounded-${index + 1}.xml`,
    language: "English",
    sourceCountry: "Canada",
    region: "North America",
  }));
  const fetchImpl = async (url) => {
    const href = String(url);
    if (href.includes("weblegacy/ngrams")) return ngramsTocResponse();
    activeRequests += 1;
    peakRequests = Math.max(peakRequests, activeRequests);
    await new Promise((resolve) => setTimeout(resolve, 3));
    activeRequests -= 1;
    return rssResponse([rssItem({ title: `Climate signal ${href}`, link: href })]);
  };

  const payload = await getWorldPulse({
    cache,
    fetchImpl,
    now: () => new Date(FIXED_NOW),
    rssFeeds: feeds,
  });

  assert.equal(payload.state, "ok");
  assert.equal(payload.counts.rssActiveSources, 20);
  assert.ok(peakRequests > 1);
  assert.ok(peakRequests <= 12, `expected at most 12 concurrent RSS requests, got ${peakRequests}`);
});

test("GDELT Web N-Grams reuses the last real validated TOC when the next slot is missing", async () => {
  const cache = createPulseCache();
  let ngramsCalls = 0;
  const fetchImpl = async (url) => {
    const href = String(url);
    if (href.includes("rss.example")) {
      return rssResponse([rssItem({ title: `Technology signal ${ngramsCalls}`, link: `https://rss.example/stale-ngram-${ngramsCalls}` })]);
    }
    if (href.includes("weblegacy/ngrams")) {
      ngramsCalls += 1;
      return ngramsCalls === 1
        ? ngramsTocResponse([
          { ID: 1, date: "2026-07-15T11:46:00.000Z", lang: "en", title: "Climate validated TOC", url: "https://toc.example/validated-climate" },
          { ID: 2, date: "2026-07-15T11:46:00.000Z", lang: "fr", title: "Election validated TOC", url: "https://toc.example/validated-election" },
        ])
        : textResponse("No such object", 404, "text/plain");
    }
    throw new Error(`unexpected fetch ${href}`);
  };

  const first = await getWorldPulse({
    cache,
    fetchImpl,
    now: () => new Date(FIXED_NOW),
    rssFeeds: [{ name: "RSS", url: "https://rss.example/feed.xml", language: "French", sourceCountry: "France" }],
  });
  const stale = await getWorldPulse({
    cache,
    fetchImpl,
    now: () => new Date(FIFTEEN_MINUTES_PLUS_ONE_SECOND),
    rssFeeds: [{ name: "RSS", url: "https://rss.example/feed.xml", language: "French", sourceCountry: "France" }],
  });

  const ngramsHealth = stale.sourceHealth.find((entry) => entry.source === "GDELT Web N-Grams TOC");
  assert.equal(first.globalTrends.documents, 2);
  assert.equal(stale.counts.articles, 1, "RSS must keep living when the current TOC is missing");
  assert.equal(stale.globalTrends.documents, 2, "missing current TOC must not zero validated trends");
  assert.equal(stale.counts.gdeltNgramsDocuments, 2);
  assert.equal(stale.globalTrends.state, "STALE");
  assert.equal(stale.globalTrends.stale, true);
  assert.equal(stale.globalTrends.toc.validatedDocuments, 2);
  assert.match(stale.globalTrends.error.reason, /HTTP GDELT Web N-Grams 404/);
  assert.equal(ngramsHealth.state, "STALE");
  assert.equal(ngramsHealth.http, 404);
  assert.equal(stale.source.trends, "STALE");
});

test("GDELT Web N-Grams missing-TOC checks are rate gated to one external request per 15 minutes", async () => {
  const cache = createPulseCache();
  let ngramsCalls = 0;
  const fetchImpl = async (url) => {
    const href = String(url);
    if (href.includes("rss.example")) {
      return rssResponse([rssItem({ title: `Technology cadence ${ngramsCalls}`, link: `https://rss.example/cadence-${ngramsCalls}` })]);
    }
    if (href.includes("weblegacy/ngrams")) {
      ngramsCalls += 1;
      return ngramsCalls === 1
        ? ngramsTocResponse([{ ID: 1, date: "2026-07-15T11:46:00.000Z", lang: "en", title: "Climate cadence TOC", url: "https://toc.example/cadence-climate" }])
        : textResponse("No such object", 404, "text/plain");
    }
    throw new Error(`unexpected fetch ${href}`);
  };

  await getWorldPulse({
    cache,
    fetchImpl,
    now: () => new Date(FIXED_NOW),
    rssFeeds: [{ name: "RSS", url: "https://rss.example/feed.xml", language: "French", sourceCountry: "France" }],
  });
  await getWorldPulse({
    cache,
    fetchImpl,
    now: () => new Date(FIFTEEN_MINUTES_PLUS_ONE_SECOND),
    rssFeeds: [{ name: "RSS", url: "https://rss.example/feed.xml", language: "French", sourceCountry: "France" }],
  });
  cache.expiresAt = 0;
  const gated = await getWorldPulse({
    cache,
    fetchImpl,
    now: () => new Date(Date.parse(FIFTEEN_MINUTES_PLUS_ONE_SECOND) + 1000),
    rssFeeds: [{ name: "RSS", url: "https://rss.example/feed.xml", language: "French", sourceCountry: "France" }],
  });

  assert.equal(ngramsCalls, 2, "the third refresh must reuse cached TOC state without a new 404 probe");
  assert.equal(gated.globalTrends.documents, 1);
  assert.equal(gated.globalTrends.state, "STALE");
  assert.equal(gated.sourceHealth.find((entry) => entry.source === "GDELT Web N-Grams TOC").state, "STALE");
});

test("unmatched RSS articles stay explicit while GDELT N-Grams emerging terms stay outside category charts", async () => {
  const cache = createPulseCache();
  const fetchImpl = async (url) => {
    const href = String(url);
    if (href.includes("rss.example")) {
      return rssResponse([rssItem({ title: "Local bulletin", link: "https://rss.example/local-bulletin", description: "Neighbourhood note" })]);
    }
    if (href.includes("weblegacy/ngrams")) {
      return ngramsTocResponse([
        { ID: 1, date: "2026-07-15T11:45:00.000Z", lang: "en", title: "Daily local bulletin", url: "https://toc.example/local" },
      ]);
    }
    throw new Error(`unexpected fetch ${href}`);
  };

  const payload = await getWorldPulse({
    cache,
    fetchImpl,
    now: () => new Date(FIXED_NOW),
    rssFeeds: [{ name: "Local RSS", url: "https://rss.example/feed.xml", language: "English", sourceCountry: "United States" }],
  });

  assert.equal(payload.articles[0].label, "Non déterminé");
  assert.equal(payload.articles[0].classified, false);
  assert.equal(payload.counts.rssCategories, 0);
  assert.equal(payload.counts.rssUnclassifiedArticles, 1);
  assert.equal(payload.counts.rssClassificationCoveragePct, 0);
  assert.ok(payload.globalTrends.classification.unclassified > 0);
  assert.ok(payload.globalTrends.classification.coveragePct < 100);
  assert.ok(payload.globalTrends.rawTrends.every((item) => item.term && Number.isFinite(item.volume) && item.tocTimestamp));
  assert.ok(payload.globalTrends.emergingTrends.some((item) => item.term === "bulletin" && item.classified === false));
  assert.ok(payload.groupings.rssCategories.some((item) => item.label === "Non déterminé"));
  assert.ok(!payload.groupings.gdeltNgramsCategories.some((item) => item.label === "Non déterminé"));
});

test("GDELT Web N-Grams TOC accepts real article titles mentioning rate limits without flagging the source as rate limited", async () => {
  const cache = createPulseCache();
  const fetchImpl = async (url) => {
    const href = String(url);
    if (href.includes("rss.example")) {
      return rssResponse([rssItem({ title: "Technology signal", link: "https://rss.example/rate-limit-context" })]);
    }
    if (href.includes("weblegacy/ngrams")) {
      return ngramsTocResponse([
        { ID: 1, date: "2026-07-15T11:46:00.000Z", lang: "en", title: "Rate limit rules change for technology platforms", url: "https://toc.example/rate-limit-rules" },
      ]);
    }
    throw new Error(`unexpected fetch ${href}`);
  };

  const payload = await getWorldPulse({
    cache,
    fetchImpl,
    now: () => new Date(FIXED_NOW),
    rssFeeds: [{ name: "Mock RSS", url: "https://rss.example/feed.xml", language: "English", sourceCountry: "United States" }],
  });

  const ngramsHealth = payload.sourceHealth.find((entry) => entry.source === "GDELT Web N-Grams TOC");
  assert.equal(ngramsHealth.state, "OK");
  assert.equal(payload.globalTrends.documents, 1);
  assert.equal(payload.globalTrends.topTitles[0].title, "Rate limit rules change for technology platforms");
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

test("GDELT DOC canary honors Retry-After backoff and keeps the canary request minimal", async () => {
  const cache = createPulseCache();
  let gdeltDocCalls = 0;
  const gdeltDocUrls = [];
  const fetchImpl = async (url) => {
    const href = String(url);
    if (href.includes("rss.example")) {
      return rssResponse([rssItem({ title: `Canary backoff ${gdeltDocCalls}`, link: `https://rss.example/backoff-${gdeltDocCalls}` })]);
    }
    if (href.includes("weblegacy/ngrams")) return ngramsTocResponse();
    if (href.includes("api/v2/doc")) {
      gdeltDocCalls += 1;
      gdeltDocUrls.push(href);
      return new Response("Rate limit", {
        status: 429,
        headers: {
          "content-type": "text/plain",
          "retry-after": "7200",
        },
      });
    }
    throw new Error(`unexpected fetch ${href}`);
  };

  const first = await getWorldPulse({
    cache,
    fetchImpl,
    now: () => new Date(FIXED_NOW),
    gdeltCanaryDelayMs: 0,
    awaitGdeltCanary: true,
    rssFeeds: [{ name: "Canary Retry RSS", url: "https://rss.example/feed.xml", language: "French", sourceCountry: "France" }],
  });
  cache.expiresAt = 0;
  const second = await getWorldPulse({
    cache,
    fetchImpl,
    now: () => new Date(Date.parse(FIXED_NOW) + 61 * 60 * 1000),
    gdeltCanaryDelayMs: 0,
    awaitGdeltCanary: true,
    rssFeeds: [{ name: "Canary Retry RSS", url: "https://rss.example/feed.xml", language: "French", sourceCountry: "France" }],
  });

  const firstCanary = first.sourceHealth.find((entry) => entry.source === "GDELT 2.0 DOC API canary");
  const secondCanary = second.sourceHealth.find((entry) => entry.source === "GDELT 2.0 DOC API canary");
  assert.equal(gdeltDocCalls, 1, "Retry-After must prevent a second DOC API request after only 61 minutes");
  assert.equal(new URL(gdeltDocUrls[0]).searchParams.get("maxrecords"), "1");
  assert.equal(new URL(gdeltDocUrls[0]).searchParams.get("timespan"), "15m");
  assert.equal(firstCanary.state, "RATE_LIMITED");
  assert.equal(firstCanary.nextAttemptAt, "2026-07-15T14:00:00.000Z");
  assert.equal(secondCanary.state, "RATE_LIMITED");
  assert.equal(secondCanary.nextAttemptAt, "2026-07-15T14:00:00.000Z");
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

  assert.ok(timeoutCalls.includes(5500), "RSS gets 5.5s before being marked unavailable, which reduces false timeouts without removing the server-side concurrency cap");
  assert.ok(timeoutCalls.includes(2500), "Web N-Grams keeps its lightweight 2.5s fetch timeout");
  assert.equal(timeoutCalls.at(-1), 30_000, "GDELT DOC canary default timeout must be 30s");
});

test("getWorldPulse keeps every usable RSS article and renders all explicitly localized event-country articles as map particles", async () => {
  const cache = createPulseCache();
  const eventCountryNames = ["United Kingdom", "France", "Germany", "Republic of Congo", "Qatar", "India", "Japan", "Australia", "United States", "Canada", "Brazil"];
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
      title: `Technology climate signal in ${eventCountryNames[feedIndex]} ${feedIndex}-${itemIndex}`,
      link: `https://feed-${feedIndex}.example/world-${itemIndex}`,
      pubDate: `Wed, 15 Jul 2026 11:${String(50 + itemIndex).padStart(2, "0")}:00 GMT`,
    }));
    return rssResponse(items);
  };

  const payload = await getWorldPulse({ cache, fetchImpl, now: () => new Date(FIXED_NOW), rssFeeds: feeds });

  assert.equal(payload.counts.rssArticlesFetched, 66);
  assert.equal(payload.counts.articles, 66);
  assert.equal(payload.counts.rssArticles, 66);
  assert.equal(payload.counts.rssArticlesRendered, 66);
  assert.equal(payload.counts.rssArticlesTruncated, 0);
  assert.equal(payload.counts.mediaSources, 11);
  assert.equal(payload.counts.mediaMarkers, 11);
  assert.equal(payload.counts.eventCountries, 11);
  assert.equal(payload.counts.eventLocalizedArticles, 66);
  assert.equal(payload.counts.articleParticles, 66);
  assert.ok(payload.counts.articleClusters > 0, "dense same-category particles should expose visual clusters without dropping articles");
  assert.ok(payload.articleClusters.every((cluster) => (
    cluster.size === Math.max(22, Math.min(50, Math.round(13 + Math.sqrt(cluster.count) * 8)))
  )), "cluster diameter must visibly encode the number of grouped articles");
  assert.equal(payload.mapPoints.length, payload.articleClusters.length + payload.articleParticles.filter((particle) => !particle.clusterId).length);
  assert.equal(payload.mediaMarkers.length, 11);
  assert.equal(payload.articleParticles.length, 66);
  assert.deepEqual(payload.offMapArticles, []);
  assert.ok(payload.mediaMarkers.every((marker) => marker.articleCount === 6));
  assert.ok(payload.mediaMarkers.every((marker) => marker.size >= 6 && marker.size <= 8));
  assert.ok(payload.articleParticles.every((particle) => particle.size >= 3 && particle.size <= 5));
  assert.ok(payload.articleParticles.every((particle) => particle.positioning?.basis === "verified_event_country_geometry"));
  assert.ok(payload.articleParticles.every((particle) => particle.positioning?.insideCountry === true));
  assert.ok(payload.articleParticles.every((particle) => isCoordinateInsideCountry(particle.location.code, particle.coordinates.longitude, particle.coordinates.latitude)));
  assert.equal(verifyArticleParticlePlacements(payload.articleParticles).ok, true);
  assert.ok(!payload.dataScopes.rss.period.includes("50"));
  assert.ok(payload.mediaMarkers.some((marker) => marker.location.code === "AU"));
  assert.ok(payload.mediaMarkers.some((marker) => marker.location.code === "CA"));
});

test("RSS articles without explicit event-country evidence remain counted off map without media-country fallback", async () => {
  const cache = createPulseCache();
  const fetchImpl = async (url) => {
    const href = String(url);
    if (href.includes("weblegacy/ngrams")) return ngramsTocResponse();
    if (href.includes("unknown.example")) {
      return rssResponse([rssItem({ title: "Climate signal from unknown source", link: "https://unknown.example/story" })]);
    }
    throw new Error(`unexpected fetch ${href}`);
  };

  const payload = await getWorldPulse({
    cache,
    fetchImpl,
    now: () => new Date(FIXED_NOW),
    rssFeeds: [{ name: "Unknown RSS", url: "https://unknown.example/rss.xml", language: "English", sourceCountry: "Atlantis" }],
  });

  assert.equal(payload.counts.rssArticlesFetched, 1);
  assert.equal(payload.counts.rssArticles, 1);
  assert.equal(payload.counts.rssArticlesRendered, 0);
  assert.equal(payload.counts.unlocalized, 1);
  assert.equal(payload.counts.articleParticles, 0);
  assert.equal(payload.counts.offMapArticles, 1);
  assert.deepEqual(payload.articleParticles, []);
  assert.equal(payload.offMapArticles.length, 1);
  assert.equal(payload.offMapArticles[0].reason, "event_country_not_detected");
  assert.match(payload.offMapArticles[0].detail, /titre\/résumé/i);
  assert.match(payload.offMapArticles[0].detail, /Atlantis/);
  assert.ok(payload.groupings.offMapReasons.some((item) => item.label === "Événement non localisé" && item.count === 1));
});

test("getWorldPulse gives nearby European events their own verified country positions without using media-country fallback", async () => {
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
    return rssResponse([rssItem({ title: `Technology signal in ${feed.sourceCountry}`, link: `${feed.url.replace("/rss.xml", "")}/article` })]);
  };

  const payload = await getWorldPulse({ cache, fetchImpl, now: () => new Date(FIXED_NOW), rssFeeds: feeds });
  const distance = (left, right) => Math.hypot(left.x - right.x, left.y - right.y);
  const minMediaDistance = Math.min(...payload.mediaMarkers.flatMap((left, leftIndex) => (
    payload.mediaMarkers.slice(leftIndex + 1).map((right) => distance(left, right))
  )));
  const particleCoordinates = new Set(payload.articleParticles.map((particle) => `${particle.location.code}:${particle.coordinates.longitude}:${particle.coordinates.latitude}`));

  assert.equal(payload.mediaMarkers.length, 3);
  assert.equal(payload.articleParticles.length, 3);
  assert.ok(minMediaDistance > 0, `media markers collapsed: ${minMediaDistance}`);
  assert.equal(particleCoordinates.size, 3);
  assert.equal(verifyArticleParticlePlacements(payload.articleParticles).ok, true);
  assert.ok(payload.articleParticles.every((particle) => particle.positioning?.basis === "verified_event_country_geometry"));
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

test("RSS ingestion rejects oversized source bodies without exhausting the dashboard response", async () => {
  const payload = await getWorldPulse({
    cache: createPulseCache(),
    fetchImpl: async (url) => {
      const href = String(url);
      if (href.includes("oversized.example")) {
        return textResponse(`<rss><channel>${"x".repeat(3_100_000)}</channel></rss>`);
      }
      if (href.includes("weblegacy/ngrams")) return ngramsTocResponse();
      throw new Error(`unexpected fetch ${href}`);
    },
    now: () => new Date(FIXED_NOW),
    gdeltCanaryDelayMs: 600_000,
    rssFeeds: [{ name: "Oversized RSS", url: "https://oversized.example/feed.xml", language: "English", sourceCountry: "France" }],
  });

  const health = payload.sourceHealth.find((entry) => entry.source === "Oversized RSS");
  assert.equal(payload.state, "unavailable");
  assert.equal(health?.state, "INVALID_RESPONSE");
  assert.match(health?.detail || "", /trop volumineuse/i);
});
