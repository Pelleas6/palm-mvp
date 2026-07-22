import { geoEquirectangular } from "d3-geo";
import {
  getWorldPulseDashboardPayload,
  responseHeadersForPayload,
} from "../../../lib/world-pulse.js";
import { resolveVerifiedSourceCountry, WORLD_MAP_VIEWBOX } from "../../../lib/world-pulse-geography.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const projection = geoEquirectangular().fitExtent(
  WORLD_MAP_VIEWBOX.extent,
  { type: "Sphere" },
);

function cleanText(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function coordinatesFromParticle(particle) {
  const x = Number(particle?.x);
  const y = Number(particle?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

  const projected = [
    (x / 100) * WORLD_MAP_VIEWBOX.width,
    (y / 100) * WORLD_MAP_VIEWBOX.height,
  ];
  const coordinates = projection.invert(projected);
  if (!coordinates || !coordinates.every(Number.isFinite)) return null;

  return [
    Number(coordinates[0].toFixed(5)),
    Number(coordinates[1].toFixed(5)),
  ];
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((left, right) =>
    left.localeCompare(right, "fr"),
  );
}

function compactHeaders(payload) {
  const headers = new Headers(responseHeadersForPayload(payload));
  headers.set(
    "Cache-Control",
    "public, max-age=15, s-maxage=30, stale-while-revalidate=300",
  );
  headers.set("Vary", "Accept-Encoding");
  return headers;
}

export async function GET() {
  try {
    const payload = await getWorldPulseDashboardPayload();
    const seenArticles = new Set();
    const features = [];

    for (const particle of Array.isArray(payload?.articleParticles)
      ? payload.articleParticles
      : []) {
      const articleId = cleanText(particle?.articleId || particle?.id);
      if (!articleId || seenArticles.has(articleId)) continue;

      const coordinates = coordinatesFromParticle(particle);
      if (!coordinates) continue;

      seenArticles.add(articleId);
      features.push({
        type: "Feature",
        id: articleId,
        properties: {
          i: articleId,
          c: cleanText(particle?.label, "Non classé"),
          s: cleanText(particle?.mediaName, "Source"),
          r: cleanText(particle?.sourceRegion, "Non précisée"),
          k: cleanText(particle?.location?.code),
          n: cleanText(
            particle?.eventCountry || particle?.location?.label,
            "Monde",
          ),
        },
        geometry: {
          type: "Point",
          coordinates,
        },
      });
    }

    const categories = uniqueSorted(features.map((entry) => entry.properties.c));
    const sources = uniqueSorted(features.map((entry) => entry.properties.s));
    const countriesByCode = new Map();
    for (const entry of features) {
      const code = entry.properties.k;
      const label = entry.properties.n;
      if (code && !countriesByCode.has(code)) countriesByCode.set(code, label);
    }

    // A country is marked only when every configured media feed from that
    // country failed during the latest verified server refresh. It prevents a
    // blank area from being mistaken for an absence of news.
    const healthByCountry = new Map();
    for (const entry of Array.isArray(payload?.sourceHealth) ? payload.sourceHealth : []) {
      const country = resolveVerifiedSourceCountry(entry?.sourceCountry || "");
      if (!country) continue;
      const current = healthByCountry.get(country.code) || { code: country.code, label: country.label, total: 0, active: 0 };
      current.total += 1;
      if (entry?.state === "OK") current.active += 1;
      healthByCountry.set(country.code, current);
    }

    const body = {
      state: payload?.state || "ready",
      stateLabel: payload?.stateLabel || "En direct",
      generatedAt: payload?.generatedAt || new Date().toISOString(),
      count: features.length,
      sources: {
        active: Number(payload?.counts?.rssActiveSources || 0),
        audited: Number(payload?.counts?.rssAuditedSources || 0),
      },
      filters: {
        categories,
        sources,
        regions: uniqueSorted(features.map((entry) => entry.properties.r)),
        countries: [...countriesByCode.entries()]
          .map(([code, label]) => ({ code, label }))
          .sort((left, right) => left.label.localeCompare(right.label, "fr")),
      },
      unavailableCountries: [...healthByCountry.values()]
        .filter((entry) => entry.total > 0 && entry.active === 0),
      geojson: {
        type: "FeatureCollection",
        features,
      },
    };

    return Response.json(body, {
      headers: compactHeaders(payload),
    });
  } catch (error) {
    console.error("Map signals route error:", error);
    return Response.json(
      {
        state: "offline",
        stateLabel: "Flux indisponible",
        generatedAt: new Date().toISOString(),
        count: 0,
        filters: { categories: [], sources: [], countries: [] },
        geojson: { type: "FeatureCollection", features: [] },
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "public, max-age=15, s-maxage=30, stale-while-revalidate=120",
        },
      },
    );
  }
}
