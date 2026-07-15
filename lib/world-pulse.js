const GDELT_ENDPOINT = "https://api.gdeltproject.org/api/v2/doc/doc";
const QUERY_TERMS = [
  "climate",
  "conflict",
  "economy",
  "health",
];
const QUERY = `(${QUERY_TERMS.join(" OR ")}) sourceCountry:US sourceCountry:GB sourceCountry:FR`;
const MAX_RECORDS = 25;
const TIME_SPAN = "12h";
const CACHE_TTL_MS = 5 * 60 * 1000;
const GDELT_TIMEOUT_MS = 2500;
const RSS_TIMEOUT_MS = 2500;

const DEFAULT_RSS_FEEDS = [
  { name: "BBC News World", url: "https://feeds.bbci.co.uk/news/world/rss.xml", language: "English" },
  { name: "France 24 Monde", url: "https://www.france24.com/fr/rss", language: "French" },
  { name: "NPR World", url: "https://feeds.npr.org/1004/rss.xml", language: "English" },
];

const SIGNAL_LABELS = [
  {
    label: "Climat",
    keywords: ["climate", "climat", "weather", "météo", "carbon", "emission", "flood", "wildfire", "drought", "inondation", "sécheresse"],
  },
  {
    label: "Conflit",
    keywords: ["conflict", "conflit", "war", "guerre", "military", "attack", "violence", "missile", "hostage", "armée", "attaque"],
  },
  {
    label: "Économie",
    keywords: ["economy", "economic", "économie", "inflation", "market", "trade", "gdp", "growth", "stocks", "bourse", "industrie"],
  },
  {
    label: "Santé",
    keywords: ["health", "santé", "disease", "virus", "hospital", "vaccine", "pandemic", "médecin", "hôpital"],
  },
  {
    label: "Énergie",
    keywords: ["energy", "énergie", "oil", "gas", "power", "electric", "nuclear", "renewable", "pétrole", "gaz"],
  },
  {
    label: "Migration",
    keywords: ["migration", "migrant", "refugee", "asylum", "border", "immigration", "réfugié", "frontière"],
  },
  {
    label: "Élections",
    keywords: ["election", "élection", "vote", "poll", "campaign", "ballot", "president", "parliament", "scrutin"],
  },
  {
    label: "Technologie",
    keywords: ["technology", "tech", "ai", "artificial intelligence", "cyber", "software", "semiconductor", "technologie"],
  },
];

const XML_ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

export function createPulseCache() {
  return { payload: null, expiresAt: 0 };
}

const moduleCache = createPulseCache();

function numberFromEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function nowDate(now) {
  const value = typeof now === "function" ? now() : new Date();
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function trimText(value, max = 500) {
  if (typeof value !== "string") return "";
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function stripTags(value) {
  return trimText(String(value || "").replace(/<[^>]*>/g, " "));
}

function decodeXmlEntities(value) {
  return String(value || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(Number.parseInt(decimal, 10)))
    .replace(/&([a-z]+);/gi, (match, name) => XML_ENTITIES[name.toLowerCase()] || match);
}

function safeUrl(value) {
  if (typeof value !== "string") return null;
  try {
    const parsed = new URL(decodeXmlEntities(value).trim());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function canonicalUrl(value) {
  const url = safeUrl(value);
  if (!url) return null;
  const parsed = new URL(url);
  parsed.hash = "";
  for (const key of [...parsed.searchParams.keys()]) {
    if (/^utm_/i.test(key) || ["fbclid", "gclid", "mc_cid", "mc_eid"].includes(key.toLowerCase())) {
      parsed.searchParams.delete(key);
    }
  }
  return parsed.toString();
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
  return parseLooseDate(value);
}

function parseLooseDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function stableHash(value) {
  const input = String(value || "world-pulse");
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function classifyMediaSignal(...parts) {
  const text = parts.map((part) => trimText(part, 1000).toLowerCase()).join(" ");
  for (const signal of SIGNAL_LABELS) {
    if (signal.keywords.some((keyword) => text.includes(keyword.toLowerCase()))) {
      return {
        label: signal.label,
        labelType: "classification estimative",
        labelBasis: "mots-clés du titre/description",
      };
    }
  }
  return {
    label: "Autre signal",
    labelType: "classification estimative",
    labelBasis: "aucun mot-clé prioritaire détecté",
  };
}

function normalizeArticle(article, index) {
  const url = canonicalUrl(article?.url);
  const title = trimText(article?.title, 220);
  if (!url || !title) return null;

  const domain = trimText(article?.domain, 80) || hostnameFromUrl(url);
  const seenAt = parseGdeltDate(article?.seendate);
  const sourceCountry = trimText(article?.sourcecountry, 80) || "Non précisé";
  const language = trimText(article?.language, 80) || "Non précisé";
  const image = safeUrl(article?.socialimage);
  const signal = classifyMediaSignal(title, domain, sourceCountry);
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
    sourceType: "GDELT",
    ...signal,
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

function dedupeArticles(articles) {
  const uniqueArticles = [];
  const seen = new Set();
  for (const article of articles) {
    const key = canonicalUrl(article?.url);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    uniqueArticles.push({ ...article, url: key });
  }
  return uniqueArticles;
}

function buildGdeltUrl(endpoint = process.env.WORLD_PULSE_GDELT_ENDPOINT || GDELT_ENDPOINT) {
  const url = new URL(endpoint);
  url.searchParams.set("query", QUERY);
  url.searchParams.set("mode", "artlist");
  url.searchParams.set("format", "json");
  url.searchParams.set("maxrecords", String(numberFromEnv("WORLD_PULSE_MAX_RECORDS", MAX_RECORDS)));
  url.searchParams.set("sort", "datedesc");
  url.searchParams.set("timespan", TIME_SPAN);
  return url;
}

function parseRssFeedOverrides() {
  const raw = trimText(process.env.WORLD_PULSE_RSS_FEEDS, 4000);
  if (!raw) return DEFAULT_RSS_FEEDS;
  return raw
    .split(/[\n,;]+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [name, url] = entry.includes("|") ? entry.split("|", 2) : [null, entry];
      const safe = safeUrl(url);
      if (!safe) return null;
      return { name: trimText(name, 80) || hostnameFromUrl(safe), url: safe, language: "Non précisé" };
    })
    .filter(Boolean);
}

async function fetchWithTimeout(url, { fetchImpl, timeoutMs, headers }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, {
      cache: "no-store",
      signal: controller.signal,
      headers,
    });
  } finally {
    clearTimeout(timer);
  }
}

function describeFetchError(error, source, timeoutReason) {
  const isAbort = error?.name === "AbortError";
  return {
    source,
    reason: isAbort ? timeoutReason : `Erreur réseau ${source}`,
    detail: trimText(String(error?.message || error), 600),
  };
}

async function fetchGdelt({ fetchImpl, timeoutMs }) {
  const url = buildGdeltUrl();
  let response;
  try {
    response = await fetchWithTimeout(url, {
      fetchImpl,
      timeoutMs,
      headers: {
        Accept: "application/json",
        "User-Agent": "LePoulsDuMonde/1.0 (GDELT dashboard)",
      },
    });
  } catch (error) {
    return {
      ok: false,
      error: { ...describeFetchError(error, "gdelt", "Timeout GDELT"), url: url.toString() },
    };
  }

  const raw = await response.text();
  if (!response.ok) {
    return {
      ok: false,
      error: {
        source: "GDELT",
        url: url.toString(),
        status: response.status,
        reason: `HTTP GDELT ${response.status}`,
        detail: trimText(raw, 600),
      },
    };
  }

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch (error) {
    return {
      ok: false,
      error: {
        source: "GDELT",
        url: url.toString(),
        status: response.status,
        reason: "Réponse GDELT non JSON",
        detail: trimText(`${String(error?.message || error)} — ${raw}`, 600),
      },
    };
  }

  const articles = Array.isArray(payload?.articles)
    ? dedupeArticles(payload.articles.map(normalizeArticle).filter(Boolean))
    : [];

  return {
    ok: true,
    url: url.toString(),
    status: response.status,
    articles,
  };
}

function extractTag(block, tag) {
  const regex = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i");
  const match = block.match(regex);
  return match ? trimText(decodeXmlEntities(match[1]), 1000) : "";
}

function extractAtomLink(block) {
  const match = block.match(/<link\b[^>]*\bhref=["']([^"']+)["'][^>]*>/i);
  return match ? trimText(decodeXmlEntities(match[1]), 1000) : "";
}

function parseRssItems(xml, feed) {
  const text = String(xml || "").slice(0, 250_000);
  const blocks = [...text.matchAll(/<item\b[\s\S]*?<\/item>/gi)].map((match) => match[0]);
  const atomBlocks = blocks.length > 0 ? [] : [...text.matchAll(/<entry\b[\s\S]*?<\/entry>/gi)].map((match) => match[0]);
  const entries = blocks.length > 0 ? blocks : atomBlocks;

  return entries.map((block, index) => {
    const title = trimText(stripTags(decodeXmlEntities(extractTag(block, "title"))), 220);
    const link = canonicalUrl(extractTag(block, "link") || extractAtomLink(block) || extractTag(block, "guid"));
    if (!title || !link) return null;
    const description = stripTags(decodeXmlEntities(extractTag(block, "description") || extractTag(block, "summary") || extractTag(block, "content")));
    const seenAt = parseLooseDate(extractTag(block, "pubDate") || extractTag(block, "updated") || extractTag(block, "published"));
    const image = safeUrl(extractTag(block, "media:thumbnail") || extractTag(block, "enclosure"));
    const signal = classifyMediaSignal(title, description, feed.name);
    return {
      id: stableHash(`${link}|${seenAt || index}|rss`).toString(36),
      title,
      url: link,
      domain: hostnameFromUrl(link),
      sourceCountry: "RSS public",
      language: trimText(feed.language, 80) || "Non précisé",
      seenAt,
      image,
      sourceType: feed.name,
      summary: trimText(description, 260),
      ...signal,
    };
  }).filter(Boolean);
}

async function fetchSingleRssFeed(feed, { fetchImpl, timeoutMs }) {
  try {
    const response = await fetchWithTimeout(feed.url, {
      fetchImpl,
      timeoutMs,
      headers: {
        Accept: "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
        "User-Agent": "LePoulsDuMonde/1.0 (GDELT dashboard)",
      },
    });
    const raw = await response.text();
    if (!response.ok) {
      return {
        ok: false,
        error: {
          source: "RSS_FALLBACK",
          feed: feed.name,
          url: feed.url,
          status: response.status,
          reason: `HTTP RSS ${response.status}`,
          detail: trimText(raw, 600),
        },
      };
    }
    const articles = parseRssItems(raw, feed);
    if (articles.length === 0) {
      return {
        ok: false,
        error: {
          source: "RSS_FALLBACK",
          feed: feed.name,
          url: feed.url,
          status: response.status,
          reason: "Flux RSS sans item exploitable",
          detail: "Aucun item avec titre et lien HTTP(S).",
        },
      };
    }
    return { ok: true, feed, status: response.status, articles };
  } catch (error) {
    return {
      ok: false,
      error: {
        ...describeFetchError(error, "rss_fallback", "Timeout RSS"),
        feed: feed.name,
        url: feed.url,
      },
    };
  }
}

async function fetchRssFallback({ fetchImpl, timeoutMs, feeds }) {
  const results = await Promise.all(feeds.map((feed) => fetchSingleRssFeed(feed, { fetchImpl, timeoutMs })));
  const articles = dedupeArticles(results.flatMap((result) => (result.ok ? result.articles : []))).slice(0, MAX_RECORDS);
  const errors = results.filter((result) => !result.ok).map((result) => result.error);
  const okFeeds = results.filter((result) => result.ok).map((result) => ({ name: result.feed.name, url: result.feed.url, status: result.status }));
  return { ok: articles.length > 0, articles, errors, okFeeds };
}

function buildDataPayload({ state, stateLabel, generatedAt, source, query, articles, notice, cacheTtlMs, cacheStatus = "miss" }) {
  const domains = countBy(articles, "domain");
  const countries = countBy(articles, "sourceCountry");
  const languages = countBy(articles, "language");
  const labels = countBy(articles, "label");
  const timestamp = Date.parse(generatedAt);
  return {
    state,
    stateLabel,
    generatedAt,
    servedAt: generatedAt,
    freshnessSeconds: 0,
    source: {
      ...source,
      cached: false,
    },
    cache: {
      status: cacheStatus,
      ttlSeconds: Math.floor(cacheTtlMs / 1000),
      expiresAt: new Date(timestamp + cacheTtlMs).toISOString(),
    },
    query,
    counts: {
      articles: articles.length,
      domains: distinctCount(articles, "domain"),
      countries: distinctCount(articles, "sourceCountry"),
      languages: distinctCount(articles, "language"),
      labels: distinctCount(articles, "label"),
    },
    groupings: {
      domains,
      countries,
      languages,
      labels,
    },
    articles,
    notice,
  };
}

function buildUnavailablePayload({ generatedAt, gdeltError, rssErrors, feeds, cacheTtlMs }) {
  return {
    state: "unavailable",
    stateLabel: "Indisponible",
    generatedAt,
    servedAt: generatedAt,
    freshnessSeconds: 0,
    source: {
      active: "none",
      name: "Aucune source active",
      cached: false,
      primary: "GDELT 2.0 DOC API",
      fallback: "RSS public",
      feeds: feeds.map((feed) => ({ name: feed.name, url: feed.url })),
    },
    cache: {
      status: "bypass",
      ttlSeconds: Math.floor(cacheTtlMs / 1000),
    },
    query: QUERY,
    counts: {
      articles: 0,
      domains: 0,
      countries: 0,
      languages: 0,
      labels: 0,
    },
    groupings: {
      domains: [],
      countries: [],
      languages: [],
      labels: [],
    },
    articles: [],
    error: {
      reason: "GDELT et le fallback RSS sont indisponibles",
      causes: [gdeltError, ...rssErrors].filter(Boolean),
      detail: trimText([gdeltError, ...rssErrors].filter(Boolean).map((cause) => `${cause.source}: ${cause.reason}`).join(" | "), 600),
    },
    notice: "Aucune donnée de démonstration n'est générée : les compteurs restent à zéro tant que GDELT et les flux RSS publics sont indisponibles.",
  };
}

function cloneForCacheHit(payload, servedAtDate, expiresAt) {
  const generatedAtMs = Date.parse(payload.generatedAt);
  const servedAtMs = servedAtDate.getTime();
  const copy = JSON.parse(JSON.stringify(payload));
  copy.servedAt = servedAtDate.toISOString();
  copy.freshnessSeconds = Math.max(0, Math.floor((servedAtMs - generatedAtMs) / 1000));
  copy.source = { ...copy.source, cached: true };
  copy.cache = {
    ...copy.cache,
    status: "hit",
    expiresAt: new Date(expiresAt).toISOString(),
    remainingSeconds: Math.max(0, Math.ceil((expiresAt - servedAtMs) / 1000)),
  };
  return copy;
}

function saveCache(cache, payload, nowMs, cacheTtlMs) {
  if (payload.state === "unavailable") return;
  cache.payload = JSON.parse(JSON.stringify(payload));
  cache.expiresAt = nowMs + cacheTtlMs;
}

function cacheTtlFromEnv() {
  return Math.max(CACHE_TTL_MS, numberFromEnv("WORLD_PULSE_CACHE_TTL_MS", CACHE_TTL_MS));
}

export async function getWorldPulse({ cache = moduleCache, fetchImpl = fetch, now, cacheTtlMs, gdeltTimeoutMs, rssTimeoutMs, rssFeeds } = {}) {
  const servedAt = nowDate(now);
  const nowMs = servedAt.getTime();
  const ttl = cacheTtlMs || cacheTtlFromEnv();
  const effectiveGdeltTimeout = gdeltTimeoutMs || numberFromEnv("WORLD_PULSE_GDELT_TIMEOUT_MS", GDELT_TIMEOUT_MS);
  const effectiveRssTimeout = rssTimeoutMs || numberFromEnv("WORLD_PULSE_RSS_TIMEOUT_MS", RSS_TIMEOUT_MS);
  const feeds = Array.isArray(rssFeeds) && rssFeeds.length > 0 ? rssFeeds : parseRssFeedOverrides();

  if (cache?.payload && cache.expiresAt > nowMs) {
    return cloneForCacheHit(cache.payload, servedAt, cache.expiresAt);
  }

  const generatedAt = servedAt.toISOString();
  const gdelt = await fetchGdelt({ fetchImpl, timeoutMs: effectiveGdeltTimeout });

  if (gdelt.ok) {
    const payload = buildDataPayload({
      state: "ok",
      stateLabel: "OK — GDELT",
      generatedAt,
      source: {
        active: "GDELT",
        name: "GDELT 2.0 DOC API",
        url: gdelt.url,
        status: gdelt.status,
        timespan: TIME_SPAN,
        maxRecords: numberFromEnv("WORLD_PULSE_MAX_RECORDS", MAX_RECORDS),
      },
      query: QUERY,
      articles: gdelt.articles,
      cacheTtlMs: ttl,
      notice: "GDELT reste la source primaire. Chaque particule et compteur provient d'un lien article réel, avec label expérimental estimé par mots-clés.",
    });
    saveCache(cache, payload, nowMs, ttl);
    return payload;
  }

  const rss = await fetchRssFallback({ fetchImpl, timeoutMs: effectiveRssTimeout, feeds });
  if (rss.ok) {
    const payload = buildDataPayload({
      state: "partial",
      stateLabel: "Partiel — RSS_FALLBACK",
      generatedAt,
      source: {
        active: "RSS_FALLBACK",
        name: "RSS_FALLBACK — flux publics",
        feeds: rss.okFeeds,
        status: "ok",
        primaryError: gdelt.error,
      },
      query: QUERY,
      articles: rss.articles,
      cacheTtlMs: ttl,
      notice: "GDELT reste prioritaire ; ce rendu utilise uniquement des liens réels issus de flux RSS publics car la source primaire a échoué.",
    });
    saveCache(cache, payload, nowMs, ttl);
    return payload;
  }

  return buildUnavailablePayload({
    generatedAt,
    gdeltError: gdelt.error,
    rssErrors: rss.errors,
    feeds,
    cacheTtlMs: ttl,
  });
}

export function responseHeadersForPayload(payload) {
  if (payload?.state === "unavailable") {
    return { "Cache-Control": "no-store, max-age=0" };
  }
  const ttl = Math.max(300, Number(payload?.cache?.ttlSeconds || 300));
  return {
    "Cache-Control": `public, max-age=0, s-maxage=${ttl}, stale-while-revalidate=${ttl}`,
  };
}
