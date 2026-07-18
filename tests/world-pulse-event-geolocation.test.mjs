import test from "node:test";
import assert from "node:assert/strict";

import { resolveEventCountryFromArticle } from "../lib/world-pulse-event-geolocation.js";
import { createPulseCache, getWorldPulse } from "../lib/world-pulse.js";
import { isCoordinateInsideCountry } from "../lib/world-pulse-geography.js";

const FIXED_NOW = "2026-07-15T12:00:00.000Z";

function textResponse(body, status = 200, contentType = "application/rss+xml") {
  return new Response(body, {
    status,
    headers: { "content-type": contentType },
  });
}

function rssItem({ title, link, pubDate = "Wed, 15 Jul 2026 11:55:00 GMT", description = "Public report.", content = "" }) {
  return `<item><title>${title}</title><link>${link}</link><pubDate>${pubDate}</pubDate><description>${description}</description>${content ? `<content:encoded><![CDATA[${content}]]></content:encoded>` : ""}</item>`;
}

function rssResponse(items, status = 200) {
  return textResponse(`<?xml version="1.0"?><rss><channel>${items.join("\n")}</channel></rss>`, status);
}

function ngramsTocResponse() {
  return textResponse(JSON.stringify({ ID: 1, date: "2026-07-15T11:45:00.000Z", lang: "en", title: "Climate signal", url: "https://toc.example/climate" }), 200, "application/x-ndjson");
}

test("event geolocation detects only explicit countries or documented unambiguous capitals from RSS title and summary", () => {
  const fixtures = [
    { title: "Iran faces new climate pressure", summary: "", iso: "IR", country: "Iran", type: "country_name" },
    { title: "Trade talks", summary: "Canada announces a new package.", iso: "CA", country: "Canada", type: "country_name" },
    { title: "Energy investment in Algeria", summary: "", iso: "DZ", country: "Algérie", type: "country_name" },
    { title: "Argentina votes on reform", summary: "", iso: "AR", country: "Argentine", type: "country_name" },
    { title: "United Kingdom prepares emergency response", summary: "", iso: "GB", country: "Royaume-Uni", type: "country_name" },
    { title: "Market update", summary: "United States regulators opened an inquiry.", iso: "US", country: "États-Unis", type: "country_name" },
    { title: "Pakistan prepares a new energy plan", summary: "", iso: "PK", country: "Pakistan", type: "country_name" },
    { title: "Bangkok transport network closes after flooding", summary: "", iso: "TH", country: "Thaïlande", type: "capital_city" },
    { title: "Vietnam considers a climate transition", summary: "", iso: "VN", country: "Viêt Nam", type: "country_name" },
    { title: "Authorities meet in Dhaka", summary: "", iso: "BD", country: "Bangladesh", type: "capital_city" },
    { title: "Kathmandu hosts regional talks", summary: "", iso: "NP", country: "Népal", type: "capital_city" },
    { title: "Philippines launches a new public-health campaign", summary: "", iso: "PH", country: "Philippines", type: "country_name" },
    { title: "Diplomats meet in Tehran", summary: "", iso: "IR", country: "Iran", type: "capital_city" },
    { title: "Warsaw prepares an emergency response", summary: "", iso: "PL", country: "Pologne", type: "capital_city" },
    { title: "Ghana launches a new education programme", summary: "", iso: "GH", country: "Ghana", type: "country_name" },
    { title: "Baghdad hosts regional talks", summary: "", iso: "IQ", country: "Irak", type: "capital_city" },
    { title: "Malaysia considers a climate transition", summary: "", iso: "MY", country: "Malaisie", type: "country_name" },
    { title: "Peru votes on reform", summary: "", iso: "PE", country: "Pérou", type: "country_name" },
  ];

  for (const fixture of fixtures) {
    const result = resolveEventCountryFromArticle({ title: fixture.title, summary: fixture.summary });
    assert.equal(result.eventCountryIso, fixture.iso, fixture.title);
    assert.equal(result.eventCountry, fixture.country, fixture.title);
    assert.equal(result.matchType, fixture.type, fixture.title);
    assert.ok(result.confidence > 0.7, fixture.title);
    assert.ok(result.evidence?.field === "title" || result.evidence?.field === "summary", fixture.title);
  }
});

test("event geolocation recognizes explicit country names used by the enabled RSS languages", () => {
  const fixtures = [
    { title: "Estados Unidos anuncia nuevas medidas", iso: "US" },
    { title: "A Alemanha aprova um novo orçamento", iso: "DE" },
    { title: "Pemerintah Tiongkok mengumumkan kebijakan baru", iso: "CN" },
    { title: "Korea Selatan prépare une réponse", iso: "KR" },
    { title: "Los Emiratos Árabes Unidos publican un comunicado", iso: "AE" },
  ];

  for (const fixture of fixtures) {
    const result = resolveEventCountryFromArticle({ title: fixture.title, summary: "" });
    assert.equal(result.eventCountryIso, fixture.iso, fixture.title);
    assert.equal(result.matchType, "country_name", fixture.title);
    assert.equal(result.evidence?.field, "title", fixture.title);
  }
});

test("event geolocation can use an explicit country from the RSS content lede", () => {
  const result = resolveEventCountryFromArticle({
    title: "Budget update",
    summary: "Short bulletin.",
    content: "Officials in Bogotá announced the new measures.",
  });

  assert.equal(result.eventCountryIso, "CO");
  assert.equal(result.matchType, "capital_city");
  assert.equal(result.evidence?.field, "content");
  assert.ok(result.confidence >= 0.8);
});

test("RSS parsing keeps an explicit country found in namespaced content as auditable evidence", async () => {
  const payload = await getWorldPulse({
    cache: createPulseCache(),
    fetchImpl: async (url) => {
      const href = String(url);
      if (href.includes("rss.example")) {
        return rssResponse([rssItem({
          title: "Budget update",
          link: "https://rss.example/content-lede",
          description: "Short bulletin without a location.",
          content: "<p>Officials in Bogotá announced the new measures.</p>",
        })]);
      }
      if (href.includes("weblegacy/ngrams")) return ngramsTocResponse();
      throw new Error(`unexpected fetch ${href}`);
    },
    now: () => new Date(FIXED_NOW),
    rssFeeds: [{ name: "Content Test RSS", url: "https://rss.example/feed.xml", language: "English", sourceCountry: "Canada", region: "North America" }],
  });

  assert.equal(payload.counts.eventLocalizedArticles, 1);
  assert.equal(payload.articles[0].eventCountryIso, "CO");
  assert.equal(payload.articles[0].evidence?.field, "content");
});

test("event geolocation leaves articles non localized without strong evidence and never falls back to media country or short aliases", () => {
  const noPlace = resolveEventCountryFromArticle({
    title: "Rates rise after central bank meeting",
    summary: "The report cites analysts but no country or unambiguous capital.",
    sourceCountry: "Canada",
  });
  const shortUs = resolveEventCountryFromArticle({ title: "US stocks move after tech earnings", summary: "" });
  const shortUk = resolveEventCountryFromArticle({ title: "UK minister says talks continue", summary: "" });

  for (const result of [noPlace, shortUs, shortUk]) {
    assert.equal(result.eventCountry, null);
    assert.equal(result.eventCountryIso, null);
    assert.equal(result.confidence, 0);
    assert.equal(result.matchType, "none");
    assert.equal(result.evidence, null);
  }
});

test("getWorldPulse renders event-country particles inside the detected country and keeps source provenance separate", async () => {
  const cache = createPulseCache();
  const fetchImpl = async (url) => {
    const href = String(url);
    if (href.includes("rss.example")) {
      return rssResponse([
        rssItem({
          title: "Diplomats meet in Tehran over energy security",
          link: "https://rss.example/tehran-energy",
          description: "The article summary mentions talks in Tehran but the media source is Canadian.",
        }),
        rssItem({
          title: "Central bank update",
          link: "https://rss.example/no-place",
          description: "This article has no explicit country or documented unambiguous capital.",
        }),
      ]);
    }
    if (href.includes("weblegacy/ngrams")) return ngramsTocResponse();
    throw new Error(`unexpected fetch ${href}`);
  };

  const payload = await getWorldPulse({
    cache,
    fetchImpl,
    now: () => new Date(FIXED_NOW),
    rssFeeds: [{ name: "Canadian Test RSS", url: "https://rss.example/feed.xml", language: "English", sourceCountry: "Canada", region: "North America" }],
  });

  assert.equal(payload.counts.rssArticles, 2);
  assert.equal(payload.counts.eventLocalizedArticles, 1);
  assert.equal(payload.counts.eventUnlocalizedArticles, 1);
  assert.equal(payload.counts.eventCountries, 1);
  assert.equal(payload.articleParticles.length, 1);
  assert.equal(payload.offMapArticles.length, 1);
  assert.equal(payload.mediaMarkers.length, 1);
  assert.equal(payload.mediaMarkers[0].location.code, "CA");

  const eventArticle = payload.articles.find((article) => article.url.endsWith("/tehran-energy"));
  assert.equal(eventArticle.eventCountry, "Iran");
  assert.equal(eventArticle.eventCountryIso, "IR");
  assert.equal(eventArticle.matchType, "capital_city");
  assert.equal(eventArticle.sourceLocation.code, "CA");

  const particle = payload.articleParticles[0];
  assert.equal(particle.location.code, "IR");
  assert.equal(particle.eventCountryIso, "IR");
  assert.equal(particle.sourceCountry, "Canada");
  assert.equal(particle.positioning.basis, "verified_event_country_geometry");
  assert.equal(isCoordinateInsideCountry("IR", particle.coordinates.longitude, particle.coordinates.latitude), true);

  assert.equal(payload.offMapArticles[0].reason, "event_country_not_detected");
  assert.match(payload.offMapArticles[0].detail, /titre\/résumé/i);
});
