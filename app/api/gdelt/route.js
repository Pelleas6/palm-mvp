export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

const GDELT_ENDPOINT = "https://api.gdeltproject.org/api/v2/doc/doc";
const QUERY_TERMS = [
  "climate",
  "conflict",
  "economy",
  "health",
  "energy",
  "migration",
  "election",
  "technology",
];
const QUERY = `(${QUERY_TERMS.join(" OR ")})`;
const MAX_RECORDS = 60;
const TIME_SPAN = "24h";
const REQUEST_TIMEOUT_MS = 8000;
const CACHE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
};

function json(payload, status = 200) {
  return NextResponse.json(payload, { status, headers: CACHE_HEADERS });
}

function buildGdeltUrl() {
  const url = new URL(GDELT_ENDPOINT);
  url.searchParams.set("query", QUERY);
  url.searchParams.set("mode", "artlist");
  url.searchParams.set("format", "json");
  url.searchParams.set("maxrecords", String(MAX_RECORDS));
  url.searchParams.set("sort", "datedesc");
  url.searchParams.set("timespan", TIME_SPAN);
  return url;
}

function trimText(value, max = 500) {
  if (typeof value !== "string") return "";
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function safeUrl(value) {
  if (typeof value !== "string") return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function hostnameFromUrl(value) {
  const url = safeUrl(value);
  if (!url) return "Source non précisée";
  return new URL(url).hostname.replace(/^www\./, "");
}

function parseGdeltDate(value) {
  if (typeof value !== "string") return null;
  const compact = value.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/);
  if (compact) {
    const [, year, month, day, hour, minute, second] = compact;
    return `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function stableHash(value) {
  const input = String(value || "gdelt");
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function normalizeArticle(article, index) {
  const url = safeUrl(article?.url);
  const title = trimText(article?.title, 220);
  if (!url || !title) return null;

  const domain = trimText(article?.domain, 80) || hostnameFromUrl(url);
  const seenAt = parseGdeltDate(article?.seendate);
  const sourceCountry = trimText(article?.sourcecountry, 80) || "Non précisé";
  const language = trimText(article?.language, 80) || "Non précisé";
  const image = safeUrl(article?.socialimage);
  const idSeed = `${url}|${article?.seendate || index}`;

  return {
    id: stableHash(idSeed).toString(36),
    title,
    url,
    domain,
    sourceCountry,
    language,
    seenAt,
    image,
  };
}

function countBy(articles, field) {
  const counts = new Map();
  for (const article of articles) {
    const value = trimText(article?.[field], 100) || "Non précisé";
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "fr"))
    .slice(0, 8)
    .map(([label, count]) => ({ label, count }));
}

function distinctCount(articles, field) {
  const values = new Set();
  for (const article of articles) {
    values.add(trimText(article?.[field], 100) || "Non précisé");
  }
  return values.size;
}

function unavailablePayload({ generatedAt, url, status = null, reason, detail = "" }) {
  return {
    state: "unavailable",
    generatedAt,
    source: {
      name: "GDELT 2.0 DOC API",
      url: url.toString(),
      status,
      timespan: TIME_SPAN,
      maxRecords: MAX_RECORDS,
    },
    query: QUERY,
    counts: {
      articles: 0,
      domains: 0,
      countries: 0,
      languages: 0,
    },
    groupings: {
      domains: [],
      countries: [],
      languages: [],
    },
    articles: [],
    error: {
      reason,
      detail: trimText(detail, 600),
    },
    notice: "GDELT est la seule source de données. Aucune métrique décorative n'est synthétisée quand la source est indisponible.",
  };
}

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "Palm-World-Pulse/1.0 (+https://ma-ligne-de-vie.fr)",
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function GET() {
  const generatedAt = new Date().toISOString();
  const url = buildGdeltUrl();

  let response;
  try {
    response = await fetchWithTimeout(url);
  } catch (error) {
    const isAbort = error?.name === "AbortError";
    return json(
      unavailablePayload({
        generatedAt,
        url,
        reason: isAbort ? `Timeout après ${REQUEST_TIMEOUT_MS} ms` : "Erreur réseau vers GDELT",
        detail: String(error?.message || error),
      })
    );
  }

  const raw = await response.text();
  if (!response.ok) {
    return json(
      unavailablePayload({
        generatedAt,
        url,
        status: response.status,
        reason: `GDELT a répondu HTTP ${response.status}`,
        detail: raw,
      })
    );
  }

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch (error) {
    return json(
      unavailablePayload({
        generatedAt,
        url,
        status: response.status,
        reason: "Réponse GDELT non JSON",
        detail: `${String(error?.message || error)} — ${raw}`,
      })
    );
  }

  const articles = Array.isArray(payload?.articles)
    ? payload.articles.map(normalizeArticle).filter(Boolean)
    : [];

  const uniqueArticles = [];
  const seen = new Set();
  for (const article of articles) {
    if (seen.has(article.url)) continue;
    seen.add(article.url);
    uniqueArticles.push(article);
  }

  const domains = countBy(uniqueArticles, "domain");
  const countries = countBy(uniqueArticles, "sourceCountry");
  const languages = countBy(uniqueArticles, "language");
  const domainCount = distinctCount(uniqueArticles, "domain");
  const countryCount = distinctCount(uniqueArticles, "sourceCountry");
  const languageCount = distinctCount(uniqueArticles, "language");

  return json({
    state: uniqueArticles.length > 0 ? "ok" : "empty",
    generatedAt,
    source: {
      name: "GDELT 2.0 DOC API",
      url: url.toString(),
      status: response.status,
      timespan: TIME_SPAN,
      maxRecords: MAX_RECORDS,
    },
    query: QUERY,
    counts: {
      articles: uniqueArticles.length,
      domains: domainCount,
      countries: countryCount,
      languages: languageCount,
    },
    groupings: {
      domains,
      countries,
      languages,
    },
    articles: uniqueArticles,
    notice: "Chaque particule et compteur provient exclusivement du tableau articles[] retourné par GDELT.",
  });
}
