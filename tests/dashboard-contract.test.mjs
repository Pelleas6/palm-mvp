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

test("dashboard payload contract keeps the deferred dashboard and map entry points coherent", async () => {
  const pageSource = await readFile(new URL("../app/page.jsx", import.meta.url), "utf8");
  const deferredDashboardSource = await readFile(new URL("../components/DeferredWorldPulseDashboard.js", import.meta.url), "utf8");
  const mapGuardSource = await readFile(new URL("../components/WorldMapGuard.js", import.meta.url), "utf8");
  const componentSource = await readFile(new URL("../components/WorldPulseDashboard.js", import.meta.url), "utf8");
  const layoutSource = await readFile(new URL("../app/layout.js", import.meta.url), "utf8");
  const globalsSource = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const headerSource = await readFile(new URL("../components/Header.jsx", import.meta.url), "utf8");
  const nextConfigSource = await readFile(new URL("../next.config.mjs", import.meta.url), "utf8");
  const loadingSource = await readFile(new URL("../app/loading.jsx", import.meta.url), "utf8");
  const sourceHealthPage = await readFile(new URL("../app/sante-sources/page.jsx", import.meta.url), "utf8");
  const apiRouteSource = await readFile(new URL("../app/api/gdelt/route.js", import.meta.url), "utf8");

  assert.match(pageSource, /<WorldMapGuard \/>/);
  assert.match(pageSource, /<DeferredWorldPulseDashboard \/>/);
  assert.match(deferredDashboardSource, /dynamic\(\(\) => import\("\.\/WorldPulseDashboard"\)/);
  assert.match(deferredDashboardSource, /IntersectionObserver/);
  assert.match(deferredDashboardSource, /Charger les analyses détaillées/);
  assert.match(mapGuardSource, /import\("maplibre-gl"\)/);
  assert.match(componentSource, /function useGdeltPulse\(initialPayload\)/);
  assert.match(componentSource, /function hasUsableInitialPayload\(initialPayload\)/);
  assert.match(componentSource, /useState\(\(\) => initialPayload \|\| \{ state: "loading" \}\)/);
  assert.match(componentSource, /if \(!hasUsableInitialPayload\(initialPayload\)\) refreshIfChanged\(\{ showLoading: true \}\);/);
  assert.match(layoutSource, /import "\.\/globals\.css"/);
  assert.match(layoutSource, /criticalShellCss/);
  assert.match(layoutSource, /\.route-loading/);
  assert.match(globalsSource, /\.pulse-shell/);
  assert.match(globalsSource, /\.route-loading/);
  assert.match(loadingSource, /Préparation de la carte/);
  assert.match(componentSource, /Atlas vivant de l'actualité mondiale/);
  assert.match(componentSource, /Voyez les événements cités dans l'actualité prendre forme sur une carte/);
  assert.match(componentSource, /const REFRESH_MS = 30 \* 1000/);
  assert.match(componentSource, /method: "HEAD"/);
  assert.match(componentSource, /If-None-Match/);
  assert.match(componentSource, /x-world-pulse-version/);
  assert.match(componentSource, /particle-layer > \.article-particle:nth-child\(-n \+ 64\)/);
  assert.match(apiRouteSource, /export async function HEAD/);
  assert.match(apiRouteSource, /X-World-Pulse-Version/);
  assert.match(apiRouteSource, /ETag/);
  assert.match(componentSource, /Survolez un repère sur ordinateur ou touchez-le sur mobile/);
  assert.match(componentSource, /<section className="map-experience" id="carte">/);
  assert.ok(
    componentSource.indexOf('<section className="map-experience" id="carte">')
      < componentSource.indexOf('<section className="metric-grid metric-grid-primary"'),
    "the map must be placed before the metric cards on arrival"
  );
  assert.match(componentSource, /className="map-viewport"/);
  assert.match(componentSource, /aspect-ratio: 2 \/ 1/);
  assert.match(componentSource, /<section className="stream-section" aria-label="Articles reçus">/);
  assert.match(componentSource, /<SituationBrief/);
  assert.match(componentSource, /Exporter les données CSV/);
  assert.match(componentSource, /Points vérifiés/);
  assert.match(componentSource, /Les articles à qualifier sont exclus de ce classement/);
  assert.match(componentSource, /className="particle-layer"/);
  assert.match(componentSource, /className=\{`particle \$\{className\}/);
  assert.match(componentSource, /--particle-mobile-scale/);
  assert.match(componentSource, /\.metric-grid \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); \}/);
  assert.match(componentSource, /\.brief-grid \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); \}/);
  assert.match(componentSource, /Point = un article · bulle = plusieurs articles proches du même thème/);
  assert.match(componentSource, /\.world-map \{[\s\S]+inset: 0;[\s\S]+width: 100%;[\s\S]+height: 100%;/);
  assert.match(componentSource, /WORLD_PULSE_LOCALIZATION_FILTERS/);
  assert.match(componentSource, /À localiser/);
  assert.match(componentSource, /\.top-strip \{[\s\S]+align-items: start/);
  assert.match(componentSource, /grid-template-columns: minmax\(0, 1\.45fr\) minmax\(280px, 0\.55fr\)/);
  assert.match(componentSource, /<Metric label="Signaux cartographiés"/);
  assert.match(componentSource, /<Metric label="Sources en ligne"/);
  assert.doesNotMatch(componentSource, /pouls-du-monde-logo-master\.webp/);
  assert.doesNotMatch(headerSource, /pouls-du-monde-logo-master\.webp/);
  assert.doesNotMatch(headerSource, /site-brand-mark/);
  assert.match(nextConfigSource, /Content-Security-Policy/);
  assert.match(nextConfigSource, /poweredByHeader: false/);
  assert.doesNotMatch(componentSource, /Lecture contextuelle/);
  assert.doesNotMatch(componentSource, /Tendances du moment/);
  assert.doesNotMatch(componentSource, /MomentTrendsPanel/);
  assert.doesNotMatch(componentSource, /Tendances brutes GDELT/);
  assert.doesNotMatch(componentSource, /Tendances émergentes/);
  assert.doesNotMatch(componentSource, /générique\(s\) en trace/);
  assert.doesNotMatch(componentSource, /RawGdeltTrends/);
  assert.doesNotMatch(componentSource, /BANNED_WORDS/);
  assert.doesNotMatch(componentSource, /<CountList title="Catégories GDELT N-Grams"/);
  assert.match(componentSource, /--count-row-color/);
  assert.match(componentSource, /\.details-panel \{/);
  assert.match(sourceHealthPage, /getWorldPulseDashboardPayload/);
  assert.match(sourceHealthPage, /export default async function SourceHealthPage/);
  assert.match(sourceHealthPage, /Contrôle réel au chargement/);
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
  assert.equal(payload.counts.rssActiveSources, 1);
  assert.equal(payload.counts.articleParticles, payload.articleParticles.length);
  assert.equal(payload.counts.mediaMarkers, payload.mediaMarkers.length);
  assert.ok(Array.isArray(payload.globalTrends.rawTrends));
  assert.ok(Array.isArray(payload.globalTrends.emergingTrends));
  assert.ok(payload.counts.articles > 0);
  assert.equal(Object.hasOwn(payload.articles[0], "summary"), false);
  assert.equal(Object.hasOwn(payload.articles[0], "image"), false);
  assert.equal(Object.hasOwn(payload, "mapPoints"), false);
  assert.equal(Object.hasOwn(payload.articleParticles[0] || {}, "positioning"), false);
  assert.equal(Object.hasOwn(payload.articleParticles[0] || {}, "coordinates"), false);
  assert.ok(payload.dataScopes.rss);
  assert.ok(payload.dataScopes.gdeltNgrams);
});
