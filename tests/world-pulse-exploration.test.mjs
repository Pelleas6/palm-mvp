import test from "node:test";
import assert from "node:assert/strict";

import { buildWorldPulseMapHubs, deriveWorldPulseExploration } from "../lib/world-pulse-exploration.js";
import { WORLD_PULSE_SIGNAL_LEGEND, WORLD_PULSE_UNCLASSIFIED_LABEL } from "../lib/world-pulse-signals.js";

const BASE_PAYLOAD = {
  state: "ok",
  generatedAt: "2026-07-15T12:00:00.000Z",
  counts: { rssArticles: 4 },
  articles: [
    {
      id: "fr-climate",
      title: "Climate transition plan",
      url: "https://fr.example/climate",
      mediaName: "France 24 Monde",
      sourceType: "France 24 Monde",
      domain: "fr.example",
      sourceCountry: "France",
      sourceRegion: "Europe",
      sourceLocation: { code: "FR", label: "France", verified: true, isoAlpha2: "FR" },
      eventCountry: "France",
      eventCountryIso: "FR",
      confidence: 0.95,
      matchType: "country_name",
      evidence: { field: "title", matchedText: "France" },
      language: "French",
      label: "Climat/environnement",
      classified: true,
      seenAt: "2026-07-15T11:40:00.000Z",
    },
    {
      id: "fr-health",
      title: "Hospital pressure update",
      url: "https://fr.example/health",
      mediaName: "France 24 Monde",
      sourceType: "France 24 Monde",
      domain: "fr.example",
      sourceCountry: "France",
      sourceRegion: "Europe",
      sourceLocation: { code: "FR", label: "France", verified: true, isoAlpha2: "FR" },
      eventCountry: "France",
      eventCountryIso: "FR",
      confidence: 0.95,
      matchType: "country_name",
      evidence: { field: "title", matchedText: "France" },
      language: "French",
      label: "Santé",
      classified: true,
      seenAt: "2026-07-15T08:15:00.000Z",
    },
    {
      id: "us-politics",
      title: "Election debate latest",
      url: "https://us.example/election",
      mediaName: "NPR World",
      sourceType: "NPR World",
      domain: "us.example",
      sourceCountry: "United States",
      sourceRegion: "North America",
      sourceLocation: { code: "US", label: "États-Unis", verified: true, isoAlpha2: "US" },
      eventCountry: "États-Unis",
      eventCountryIso: "US",
      confidence: 0.95,
      matchType: "country_name",
      evidence: { field: "title", matchedText: "United States" },
      language: "English",
      label: "Politique/élections",
      classified: true,
      seenAt: "2026-07-14T13:00:00.000Z",
    },
    {
      id: "us-unknown",
      title: "Daily community brief",
      url: "https://us.example/brief",
      mediaName: "NPR World",
      sourceType: "NPR World",
      domain: "us.example",
      sourceCountry: "United States",
      sourceRegion: "North America",
      sourceLocation: { code: "US", label: "États-Unis", verified: true, isoAlpha2: "US" },
      eventCountry: "États-Unis",
      eventCountryIso: "US",
      confidence: 0.95,
      matchType: "country_name",
      evidence: { field: "title", matchedText: "United States" },
      language: "English",
      label: "Non déterminé",
      classified: false,
      seenAt: null,
    },
  ],
  mediaMarkers: [
    {
      id: "marker-fr",
      kind: "media",
      mediaName: "France 24 Monde",
      sourceCountry: "France",
      sourceRegion: "Europe",
      location: { code: "FR", label: "France", verified: true, isoAlpha2: "FR" },
      x: 49,
      y: 39,
      articleCount: 2,
      label: "Climat/environnement",
      sampleTitles: ["Climate transition plan", "Hospital pressure update"],
    },
    {
      id: "marker-us",
      kind: "media",
      mediaName: "NPR World",
      sourceCountry: "United States",
      sourceRegion: "North America",
      location: { code: "US", label: "États-Unis", verified: true, isoAlpha2: "US" },
      x: 24,
      y: 37,
      articleCount: 2,
      label: "Politique/élections",
      sampleTitles: ["Election debate latest", "Daily community brief"],
    },
  ],
  articleParticles: [
    { id: "fr-climate:particle", articleId: "fr-climate", kind: "article", title: "Climate transition plan", mediaName: "France 24 Monde", sourceCountry: "France", sourceRegion: "Europe", location: { code: "FR", label: "France" }, x: 49, y: 39, label: "Climat/environnement" },
    { id: "fr-health:particle", articleId: "fr-health", kind: "article", title: "Hospital pressure update", mediaName: "France 24 Monde", sourceCountry: "France", sourceRegion: "Europe", location: { code: "FR", label: "France" }, x: 50, y: 40, label: "Santé" },
    { id: "us-politics:particle", articleId: "us-politics", kind: "article", title: "Election debate latest", mediaName: "NPR World", sourceCountry: "United States", sourceRegion: "North America", location: { code: "US", label: "États-Unis" }, x: 24, y: 37, label: "Politique/élections" },
    { id: "us-unknown:particle", articleId: "us-unknown", kind: "article", title: "Daily community brief", mediaName: "NPR World", sourceCountry: "United States", sourceRegion: "North America", location: { code: "US", label: "États-Unis" }, x: 25, y: 38, label: "Non déterminé" },
  ],
  articleClusters: [
    {
      id: "cluster-us",
      kind: "article-cluster",
      label: "Politique/élections",
      location: { code: "US", label: "États-Unis" },
      sourceCountry: "United States",
      sourceRegion: "North America",
      x: 24.5,
      y: 37.5,
      count: 2,
      mediaNames: ["NPR World"],
      sampleTitles: ["Election debate latest", "Daily community brief"],
      articles: [
        { id: "us-politics:particle", articleId: "us-politics", title: "Election debate latest", url: "https://us.example/election", mediaName: "NPR World" },
        { id: "us-unknown:particle", articleId: "us-unknown", title: "Daily community brief", url: "https://us.example/brief", mediaName: "NPR World" },
      ],
    },
  ],
  offMapArticles: [],
};

test("world pulse uses Non déterminé as the explicit non-taxonomy bucket", () => {
  assert.equal(WORLD_PULSE_UNCLASSIFIED_LABEL, "Non déterminé");
  assert.equal(WORLD_PULSE_SIGNAL_LEGEND.at(-1).label, "Non déterminé");
  assert.equal(WORLD_PULSE_SIGNAL_LEGEND.at(-1).thematic, false);
  assert.equal(WORLD_PULSE_SIGNAL_LEGEND.filter((item) => item.thematic).length, 12);
  assert.ok(!WORLD_PULSE_SIGNAL_LEGEND.some((item) => /Autre signal|À classifier/i.test(item.label)));
});

test("deriveWorldPulseExploration filters articles, map collections and counters coherently", () => {
  const view = deriveWorldPulseExploration(BASE_PAYLOAD, {
    region: "Europe",
    source: "France 24 Monde",
    category: "Santé",
  });

  assert.deepEqual(view.filteredArticles.map((article) => article.id), ["fr-health"]);
  assert.equal(view.counts.articles, 1);
  assert.equal(view.counts.mediaSources, 1);
  assert.equal(view.counts.countries, 1);
  assert.equal(view.counts.articleParticles, 1);
  assert.equal(view.counts.articleClusters, 0);
  assert.deepEqual(view.articleParticles.map((particle) => particle.articleId), ["fr-health"]);
  assert.deepEqual(view.mediaMarkers.map((marker) => [marker.mediaName, marker.articleCount]), [["France 24 Monde", 1]]);
  assert.ok(view.filterOptions.regions.some((option) => option.value === "Europe" && option.count === 2));
  assert.ok(view.filterOptions.categories.some((option) => option.value === "Non déterminé" && option.count === 1 && option.thematic === false));
});

test("deriveWorldPulseExploration keeps the non-localized queue explicit and filterable", () => {
  const payload = {
    ...BASE_PAYLOAD,
    articles: [
      ...BASE_PAYLOAD.articles,
      {
        id: "needs-location",
        title: "Routine regional bulletin",
        url: "https://us.example/needs-location",
        mediaName: "NPR World",
        sourceType: "NPR World",
        domain: "us.example",
        sourceCountry: "United States",
        sourceRegion: "North America",
        sourceLocation: { code: "US", label: "États-Unis", verified: true, isoAlpha2: "US" },
        eventCountry: null,
        eventCountryIso: null,
        confidence: 0,
        matchType: "none",
        language: "English",
        label: "Non déterminé",
        classified: false,
        seenAt: "2026-07-15T10:00:00.000Z",
      },
    ],
    offMapArticles: [{ id: "needs-location", title: "Routine regional bulletin", reasonLabel: "Événement non localisé" }],
  };

  const queue = deriveWorldPulseExploration(payload, { location: "unlocalized" });
  assert.deepEqual(queue.articles.map((article) => article.id), ["needs-location"]);
  assert.equal(queue.counts.eventLocalizedArticles, 0);
  assert.equal(queue.counts.eventUnlocalizedArticles, 1);
  assert.equal(queue.offMapArticles.length, 1);
  assert.equal(queue.filters.location, "unlocalized");

  const mapped = deriveWorldPulseExploration(payload, { location: "localized" });
  assert.equal(mapped.articles.length, BASE_PAYLOAD.articles.length);
  assert.equal(mapped.counts.eventUnlocalizedArticles, 0);
  assert.ok(mapped.articleParticles.length > 0);
});

test("deriveWorldPulseExploration builds reading summaries for countries, markers and clusters", () => {
  const country = deriveWorldPulseExploration(BASE_PAYLOAD, {}, { type: "country", code: "FR" }).selection;
  assert.equal(country.kind, "country");
  assert.equal(country.articleCount, 2);
  assert.deepEqual(country.mediaNames, ["France 24 Monde"]);
  assert.deepEqual(country.sourceCountries, [{ code: "FR", label: "France" }]);
  assert.deepEqual(country.categories.map((item) => [item.label, item.count]), [["Climat/environnement", 1], ["Santé", 1]]);
  assert.equal(country.latestSeenAt, "2026-07-15T11:40:00.000Z");
  assert.deepEqual(country.latestTitles.map((item) => item.title), ["Climate transition plan", "Hospital pressure update"]);

  const marker = deriveWorldPulseExploration(BASE_PAYLOAD, {}, { type: "marker", id: "marker-us" }).selection;
  assert.equal(marker.kind, "marker");
  assert.equal(marker.articleCount, 2);
  assert.deepEqual(marker.mediaNames, ["NPR World"]);

  const cluster = deriveWorldPulseExploration(BASE_PAYLOAD, {}, { type: "cluster", id: "cluster-us" }).selection;
  assert.equal(cluster.kind, "cluster");
  assert.equal(cluster.articleCount, 2);
  assert.deepEqual(cluster.sourceCountries, [{ code: "US", label: "États-Unis" }]);
  assert.ok(cluster.categories.some((item) => item.label === "Non déterminé" && item.count === 1));

  const hub = deriveWorldPulseExploration(BASE_PAYLOAD, {}, {
    type: "hub",
    id: "hub:FR-US",
    countryCodes: ["FR", "US"],
    label: "Zone dense · 2 pays",
  }).selection;
  assert.equal(hub.kind, "hub");
  assert.equal(hub.articleCount, 4);
  assert.match(hub.basis, /Zone dense de lecture/);
});

test("country map signals aggregate RSS articles by country and replace overlapping targets with explicit zones", () => {
  const view = deriveWorldPulseExploration(BASE_PAYLOAD);
  assert.deepEqual(
    view.countrySignals.map((signal) => [signal.code, signal.articleCount]).sort((left, right) => left[0].localeCompare(right[0])),
    [["FR", 2], ["US", 2]]
  );
  assert.equal(view.countryHubs.length, 2);
  assert.equal(view.brief.localizedArticles, 4);
  assert.equal(view.brief.localizationPct, 100);
  assert.match(view.brief.methodNote, /articles RSS réellement reçus/);

  const hubs = buildWorldPulseMapHubs([
    { code: "BE", label: "Belgique", articleCount: 2, x: 50, y: 36, categories: [{ label: "Politique/élections", count: 2 }], mediaNames: ["A"], latestSeenAt: "2026-07-15T10:00:00.000Z" },
    { code: "NL", label: "Pays-Bas", articleCount: 3, x: 51.5, y: 33, categories: [{ label: "Politique/élections", count: 3 }], mediaNames: ["B"], latestSeenAt: "2026-07-15T11:00:00.000Z" },
  ]);
  assert.equal(hubs.length, 1);
  assert.equal(hubs[0].countryCount, 2);
  assert.deepEqual(hubs[0].countryCodes, ["NL", "BE"]);
  assert.equal(hubs[0].articleCount, 5);
});

test("deriveWorldPulseExploration reports 6h/24h windows only from received RSS dates and flags incomplete coverage", () => {
  const view = deriveWorldPulseExploration(BASE_PAYLOAD);

  assert.equal(view.timeWindows.validDateCount, 3);
  assert.equal(view.timeWindows.missingDateCount, 1);
  assert.equal(view.timeWindows.referenceSeenAt, "2026-07-15T11:40:00.000Z");
  assert.equal(view.timeWindows.last6h.count, 2);
  assert.equal(view.timeWindows.last6h.complete, true);
  assert.equal(view.timeWindows.last24h.count, 3);
  assert.equal(view.timeWindows.last24h.complete, false);
  assert.match(view.timeWindows.last24h.message, /Fenêtre 24 h incomplète/);
  assert.match(view.timeWindows.notice, /dates RSS reçues/);
});
