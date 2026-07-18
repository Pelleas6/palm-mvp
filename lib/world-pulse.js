import { gunzipSync } from "node:zlib";

import {
  WORLD_PULSE_QUERY_TERMS,
  WORLD_PULSE_UNCLASSIFIED_LABEL,
  colorForWorldPulseSignalLabel,
  findWorldPulseSignalCategory,
  isWorldPulseClassifiedLabel,
} from "./world-pulse-signals.js";
import {
  placePointInsideCountry,
  resolveVerifiedSourceCountry,
  sourceRegionForVerifiedCountry,
} from "./world-pulse-geography.js";
import { resolveEventCountryFromArticle } from "./world-pulse-event-geolocation.js";

const GDELT_ENDPOINT = "https://api.gdeltproject.org/api/v2/doc/doc";
const GDELT_WEB_NGRAMS_BASE_URL = "https://storage.googleapis.com/data.gdeltproject.org/gdeltv5/weblegacy/ngrams";
const QUERY_TERMS = WORLD_PULSE_QUERY_TERMS;
const QUERY = `(${QUERY_TERMS.join(" OR ")})`;
const GDELT_CANARY_QUERY = "climate";
const GDELT_CANARY_MAX_RECORDS = 1;
const RECENT_WINDOW_MS = 48 * 60 * 60 * 1000;
const GDELT_CANARY_TIME_SPAN = "15m";
const CACHE_TTL_MS = 15 * 60 * 1000;
const STALE_IF_ERROR_MS = 24 * 60 * 60 * 1000;
const GDELT_CANARY_INTERVAL_MS = 60 * 60 * 1000;
const GDELT_CANARY_DELAY_MS = 30 * 1000;
const GDELT_WEB_NGRAMS_CYCLE_MINUTES = 15;
const GDELT_WEB_NGRAMS_DELAY_MINUTES = 105;
const GDELT_WEB_NGRAMS_AUDITED_SEED_TIMESTAMP = "20260716183100";
const GDELT_WEB_NGRAMS_MIN_CHECK_INTERVAL_MS = GDELT_WEB_NGRAMS_CYCLE_MINUTES * 60 * 1000;
const GDELT_TIMEOUT_MS = 30 * 1000;
const RSS_TIMEOUT_MS = 5500;
const RSS_FETCH_CONCURRENCY = 10;
const NGRAMS_TIMEOUT_MS = 2500;
const MAX_HTTP_RESPONSE_BYTES = 1_500_000;
const MEDIA_MARKER_MIN_SIZE = 6;
const MEDIA_MARKER_MAX_SIZE = 8;
const ARTICLE_PARTICLE_MIN_SIZE = 3;
const ARTICLE_PARTICLE_MAX_SIZE = 5;
const NEARBY_ARTICLE_CLUSTER_DISTANCE = 4.5;
const GDELT_EMERGING_TREND_LABEL = "Tendance émergente";
const GDELT_RAW_TREND_LIMIT = 12;
const GDELT_EMERGING_TREND_LIMIT = 8;
const GDELT_TREND_STOPWORDS = new Set([
  "about", "after", "also", "avec", "dans", "from", "have", "into", "leur", "more", "news", "over", "pour", "that", "the", "their", "this", "vers", "will", "with",
  "aux", "des", "les", "une", "sur", "qui", "que", "and", "for", "are", "was", "were", "been", "being", "than", "then", "when", "where", "what", "why", "how",
]);

const DEFAULT_RSS_FEEDS = [
  { name: "BBC News World", region: "Europe", url: "https://feeds.bbci.co.uk/news/world/rss.xml", language: "English", sourceCountry: "United Kingdom" },
  // Sélection de flux directs publics à partir des listes RSS maintenues :
  // chaque ajout est plafonné pour préserver la diversité des médias et la lisibilité de la carte.
  { name: "BBC News Africa", region: "Africa", url: "https://feeds.bbci.co.uk/news/world/africa/rss.xml", language: "English", sourceCountry: "United Kingdom", maxItems: 14 },
  { name: "BBC News Asia", region: "Asia", url: "https://feeds.bbci.co.uk/news/world/asia/rss.xml", language: "English", sourceCountry: "United Kingdom", maxItems: 14 },
  { name: "BBC News India", region: "Asia", url: "https://feeds.bbci.co.uk/news/world/asia/india/rss.xml", language: "English", sourceCountry: "United Kingdom", maxItems: 14 },
  { name: "BBC News Latin America", region: "South America", url: "https://feeds.bbci.co.uk/news/world/latin_america/rss.xml", language: "English", sourceCountry: "United Kingdom", maxItems: 14 },
  { name: "BBC News Middle East", region: "Middle East", url: "https://feeds.bbci.co.uk/news/world/middle_east/rss.xml", language: "English", sourceCountry: "United Kingdom", maxItems: 14 },
  { name: "France 24 Monde", region: "Europe", url: "https://www.france24.com/fr/rss", language: "French", sourceCountry: "France" },
  { name: "France 24 Middle East", region: "Middle East", url: "https://www.france24.com/en/middle-east/rss", language: "English", sourceCountry: "France", maxItems: 14 },
  { name: "Deutsche Welle Top Stories", region: "Europe", url: "https://rss.dw.com/rdf/rss-en-all", language: "English", sourceCountry: "Germany" },
  { name: "Ukrainska Pravda English", region: "Europe", url: "https://www.pravda.com.ua/eng/rss/", language: "English", sourceCountry: "Ukraine" },
  { name: "Daily Sabah World", region: "Middle East", url: "https://www.dailysabah.com/rss/world", language: "English", sourceCountry: "Turkey" },
  { name: "Africanews", region: "Africa", url: "https://www.africanews.com/feed/rss", language: "English", sourceCountry: "Republic of Congo" },
  { name: "Premium Times", region: "Africa", url: "https://www.premiumtimesng.com/feed", language: "English", sourceCountry: "Nigeria" },
  { name: "Al Jazeera", region: "Middle East", url: "https://www.aljazeera.com/xml/rss/all.xml", language: "English", sourceCountry: "Qatar" },
  { name: "Arab News", region: "Middle East", url: "https://www.arabnews.com/rss.xml", language: "English", sourceCountry: "Saudi Arabia" },
  { name: "The Daily Star", region: "Asia", url: "https://www.thedailystar.net/rss.xml", language: "English", sourceCountry: "Bangladesh" },
  { name: "Kathmandu Post", region: "Asia", url: "https://kathmandupost.com/rss", language: "English", sourceCountry: "Nepal" },
  { name: "Bangkok Post", region: "Asia", url: "https://www.bangkokpost.com/rss/data/topstories.xml", language: "English", sourceCountry: "Thailand" },
  { name: "Laotian Times", region: "Asia", url: "https://laotiantimes.com/feed/", language: "English", sourceCountry: "Laos" },
  { name: "VNExpress", region: "Asia", url: "https://vnexpress.net/rss/tin-moi-nhat.rss", language: "Vietnamese", sourceCountry: "Vietnam" },
  { name: "Rappler", region: "Asia", url: "https://www.rappler.com/feed/", language: "English", sourceCountry: "Philippines" },
  { name: "CNA", region: "Asia", url: "https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml", language: "English", sourceCountry: "Singapore" },
  { name: "NHK World", region: "Asia", url: "https://www3.nhk.or.jp/rss/news/cat0.xml", language: "English", sourceCountry: "Japan" },
  { name: "ABC Australia World", region: "Oceania", url: "https://www.abc.net.au/news/feed/51120/rss.xml", language: "English", sourceCountry: "Australia" },
  { name: "NPR World", region: "North America", url: "https://feeds.npr.org/1004/rss.xml", language: "English", sourceCountry: "United States" },
  { name: "CBC World", region: "North America", url: "https://www.cbc.ca/cmlink/rss-world", language: "English", sourceCountry: "Canada" },
  { name: "Mexico News Daily", region: "North America", url: "https://mexiconewsdaily.com/feed/", language: "English", sourceCountry: "Mexico" },
  { name: "Prensa Libre", region: "North America", url: "https://www.prensalibre.com/feed/", language: "Spanish", sourceCountry: "Guatemala" },
  { name: "Agência Brasil", region: "South America", url: "https://agenciabrasil.ebc.com.br/rss.xml", language: "Portuguese", sourceCountry: "Brazil" },
  { name: "El Tiempo Mundo", region: "South America", url: "https://www.eltiempo.com/rss/mundo.xml", language: "Spanish", sourceCountry: "Colombia" },
  { name: "Agencia Andina", region: "South America", url: "https://andina.pe/agencia/rss.aspx", language: "Spanish", sourceCountry: "Peru" },
  { name: "Cooperativa", region: "South America", url: "https://www.cooperativa.cl/noticias/site/tax/port/all/rss____1.xml", language: "Spanish", sourceCountry: "Chile" },
  { name: "Antara", region: "Asia", url: "https://www.antaranews.com/rss/terkini.xml", language: "Indonesian", sourceCountry: "Indonesia" },
  { name: "El País", region: "Europe", url: "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada", language: "Spanish", sourceCountry: "Spain" },
  { name: "RNZ", region: "Oceania", url: "https://www.rnz.co.nz/rss/national.xml", language: "English", sourceCountry: "New Zealand" },
  { name: "FBC News", region: "Oceania", url: "https://www.fbcnews.com.fj/rss/", language: "English", sourceCountry: "Fiji" },
  { name: "SABC News", region: "Africa", url: "https://www.sabcnews.com/sabcnews/feed/", language: "English", sourceCountry: "South Africa" },
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
  return {
    payload: null,
    expiresAt: 0,
    staleExpiresAt: 0,
    canary: {
      lastCheckedAt: 0,
      health: null,
      pending: false,
      backoffUntil: 0,
    },
    ngrams: {
      lastCheckedAt: 0,
      lastResult: null,
      lastValid: null,
      pending: null,
    },
  };
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

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
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

function normalizeLocationKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeTitleKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&[a-z]+;/gi, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function resolveSourceLocation(value, basis = "sourceCountry") {
  return resolveVerifiedSourceCountry(value, basis);
}

function sourceRegionForCountry(value, fallback = "Non précisée") {
  return sourceRegionForVerifiedCountry(value, trimText(fallback, 80) || "Non précisée");
}

function articleTimestamp(article) {
  const timestamp = Date.parse(article?.seenAt || "");
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function isRecentArticle(article, referenceDate) {
  const timestamp = articleTimestamp(article);
  const reference = referenceDate instanceof Date ? referenceDate.getTime() : Date.now();
  return timestamp > 0 && Math.abs(reference - timestamp) <= RECENT_WINDOW_MS;
}

function sortArticlesByDateDesc(articles) {
  return [...articles].sort((left, right) => {
    const delta = articleTimestamp(right) - articleTimestamp(left);
    if (delta !== 0) return delta;
    return String(left?.title || "").localeCompare(String(right?.title || ""), "fr");
  });
}

function mediaNameForArticle(article) {
  return trimText(article?.mediaName || article?.sourceType || article?.domain, 100) || hostnameFromUrl(article?.url);
}

function mediaKeyForArticle(article) {
  return normalizeLocationKey(mediaNameForArticle(article)) || canonicalUrl(article?.url) || stableHash(article?.title).toString(36);
}

function buildSourceHealth({ source, region, url, http = null, xml = false, articles = 0, recent = false, state = "UNKNOWN", detail = "", checkedAt = null, ...extra }) {
  return {
    source,
    region: trimText(region, 80) || "Non précisée",
    url,
    http,
    xml: Boolean(xml),
    articles: Number.isFinite(articles) ? articles : 0,
    recent: Boolean(recent),
    state,
    detail: trimText(detail, 320),
    checkedAt,
    ...extra,
  };
}

function cloneJson(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function classifyMediaSignal(title, summary = "") {
  const signal = findWorldPulseSignalCategory(trimText(title, 1000), trimText(summary, 1000));
  const classified = isWorldPulseClassifiedLabel(signal.label);
  const matchedTerms = Array.isArray(signal.matches) ? signal.matches.slice(0, 4) : [];
  return {
    label: signal.label,
    labelType: classified ? "registre déterministe" : "non déterminé",
    labelBasis: classified
      ? `mots-clés titre/résumé : ${matchedTerms.join(", ") || "registre détecté"}`
      : "aucun mot-clé du registre détecté dans le titre ou le résumé",
    classified,
  };
}

function normalizeArticle(article, index) {
  const url = canonicalUrl(article?.url);
  const title = trimText(article?.title, 220);
  if (!url || !title) return null;

  const domain = trimText(article?.domain, 80) || hostnameFromUrl(url);
  const seenAt = parseGdeltDate(article?.seendate);
  const sourceCountry = trimText(article?.sourcecountry, 80) || "Non précisé";
  const sourceLocation = resolveSourceLocation(sourceCountry, "sourceCountry");
  const sourceRegion = sourceRegionForCountry(sourceCountry);
  const language = trimText(article?.language, 80) || "Non précisé";
  const image = safeUrl(article?.socialimage);
  const signal = classifyMediaSignal(title);
  const idSeed = `${url}|${article?.seendate || index}`;

  return {
    id: stableHash(idSeed).toString(36),
    title,
    url,
    domain,
    mediaName: domain,
    sourceCountry,
    sourceRegion,
    sourceLocation,
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

function buildClassificationSummary(items) {
  const list = Array.isArray(items) ? items : [];
  const categories = countBy(list, "label");
  const thematicCategories = categories.filter((item) => isWorldPulseClassifiedLabel(item.label));
  const classified = list.filter((item) => isWorldPulseClassifiedLabel(item?.label)).length;
  const total = list.length;
  const unclassified = Math.max(0, total - classified);
  return {
    total,
    classified,
    unclassified,
    coveragePct: total > 0 ? Math.round((classified / total) * 100) : 0,
    categories,
    thematicCategories,
  };
}

function countBySourceLocation(articles) {
  const counts = new Map();
  for (const article of articles) {
    if (!article?.sourceLocation) continue;
    const label = article.sourceLocation.label;
    const code = article.sourceLocation.code;
    const key = `${code}:${label}`;
    const current = counts.get(key) || { label, code, count: 0 };
    current.count += 1;
    counts.set(key, current);
  }
  return [...counts.values()]
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, "fr"))
    .slice(0, 8);
}

function countByEventLocation(articles) {
  const counts = new Map();
  for (const article of articles) {
    const location = eventLocationForArticle(article);
    if (!location?.code) continue;
    const label = location.label;
    const code = location.code;
    const key = `${code}:${label}`;
    const current = counts.get(key) || { label, code, value: code, count: 0 };
    current.count += 1;
    counts.set(key, current);
  }
  return [...counts.values()]
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, "fr"));
}

function distinctCount(articles, field) {
  const values = new Set();
  for (const article of articles) {
    values.add(trimText(article?.[field], 100) || "Non précisé");
  }
  return values.size;
}

function distinctKnownCount(articles, field) {
  const values = new Set();
  for (const article of articles) {
    const value = trimText(article?.[field], 100);
    if (value && value !== "Non précisé") values.add(value);
  }
  return values.size;
}

function dedupeArticles(articles) {
  const uniqueArticles = [];
  const seenUrls = new Set();
  const seenTitles = new Set();
  for (const article of articles) {
    const urlKey = canonicalUrl(article?.url);
    const titleKey = normalizeTitleKey(article?.title);
    if (!urlKey || !titleKey) continue;
    if (seenUrls.has(urlKey) || seenTitles.has(titleKey)) continue;
    seenUrls.add(urlKey);
    seenTitles.add(titleKey);
    uniqueArticles.push({ ...article, url: urlKey });
  }
  return uniqueArticles;
}

function distinctSourceLocationCount(articles) {
  const values = new Set();
  for (const article of articles) {
    if (article?.sourceLocation?.code) values.add(article.sourceLocation.code);
  }
  return values.size;
}

function dominantLabel(articles) {
  const counts = countBy(articles, "label");
  const thematic = counts.find((item) => isWorldPulseClassifiedLabel(item.label));
  return thematic?.label || counts[0]?.label || WORLD_PULSE_UNCLASSIFIED_LABEL;
}

function eventLocationForArticle(article) {
  if (!article?.eventCountryIso || !article?.eventCountry) return null;
  const location = resolveVerifiedSourceCountry(article.eventCountryIso, "eventCountry");
  if (!location?.code) return null;
  return {
    ...location,
    label: article.eventCountry || location.label,
    basis: "eventCountry",
  };
}

function compareArticlesForMap(left, right) {
  const leftLocation = eventLocationForArticle(left)?.code || "";
  const rightLocation = eventLocationForArticle(right)?.code || "";
  const locationDelta = leftLocation.localeCompare(rightLocation, "fr");
  if (locationDelta !== 0) return locationDelta;
  const mediaDelta = mediaNameForArticle(left).localeCompare(mediaNameForArticle(right), "fr");
  if (mediaDelta !== 0) return mediaDelta;
  const timeDelta = articleTimestamp(right) - articleTimestamp(left);
  if (timeDelta !== 0) return timeDelta;
  return String(left?.id || left?.url || left?.title || "").localeCompare(String(right?.id || right?.url || right?.title || ""), "fr");
}

function locationDistance(left, right) {
  if (!left || !right) return Number.POSITIVE_INFINITY;
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function buildMediaMarkers(articles) {
  const groups = new Map();
  for (const article of articles) {
    const location = article?.sourceLocation;
    if (!location?.code) continue;
    const mediaName = mediaNameForArticle(article);
    const key = `${location.code}:${normalizeLocationKey(mediaName)}`;
    const current = groups.get(key) || {
      id: stableHash(key).toString(36),
      mediaName,
      sourceType: article.sourceType,
      domain: article.domain,
      sourceCountry: article.sourceCountry,
      sourceRegion: article.sourceRegion,
      location,
      articles: [],
    };
    current.articles.push(article);
    if (article.sourceType && !current.sourceType) current.sourceType = article.sourceType;
    groups.set(key, current);
  }

  const points = [];
  for (const entry of [...groups.values()].sort((left, right) => left.location.code.localeCompare(right.location.code, "fr") || left.mediaName.localeCompare(right.mediaName, "fr"))) {
    const articleCount = entry.articles.length;
    const placement = placePointInsideCountry(entry.location.code, `${entry.location.code}:${entry.mediaName}:media-marker`);
    if (!placement) continue;
    const latestSeenAt = sortArticlesByDateDesc(entry.articles)[0]?.seenAt || null;
    points.push({
      id: entry.id,
      kind: "media",
      mediaName: entry.mediaName,
      sourceType: entry.sourceType,
      domain: entry.domain,
      sourceCountry: entry.sourceCountry,
      sourceRegion: entry.sourceRegion,
      location: entry.location,
      x: placement.x,
      y: placement.y,
      coordinates: placement.coordinates,
      articleCount,
      size: clamp(
        Math.round(MEDIA_MARKER_MIN_SIZE + Math.min(MEDIA_MARKER_MAX_SIZE - MEDIA_MARKER_MIN_SIZE, Math.sqrt(articleCount) * 0.85)),
        MEDIA_MARKER_MIN_SIZE,
        MEDIA_MARKER_MAX_SIZE
      ),
      label: dominantLabel(entry.articles),
      latestSeenAt,
      url: entry.articles[0]?.url || null,
      sampleTitles: entry.articles.slice(0, 3).map((article) => article.title),
      positioning: {
        ...placement.positioning,
        basis: "verified_media_country_marker",
      },
    });
  }

  return points.sort((left, right) => right.articleCount - left.articleCount || left.mediaName.localeCompare(right.mediaName, "fr"));
}

function buildOffMapArticle(article, reason = "event_country_not_detected", label = "Événement non localisé", detail = null) {
  return {
    id: article?.id || stableHash(`${article?.url || article?.title}:off-map`).toString(36),
    title: article?.title || "Article sans titre",
    url: article?.url || null,
    mediaName: mediaNameForArticle(article),
    sourceCountry: article?.sourceCountry || "Non précisé",
    sourceRegion: article?.sourceRegion || "Non précisée",
    eventCountry: article?.eventCountry || null,
    eventCountryIso: article?.eventCountryIso || null,
    confidence: Number(article?.confidence || 0),
    matchType: article?.matchType || "none",
    evidence: article?.evidence || null,
    label: article?.label || WORLD_PULSE_UNCLASSIFIED_LABEL,
    reason,
    reasonLabel: label,
    detail: detail || `${label} : aucun pays d'événement explicite détecté dans le titre/résumé RSS. Le pays du média source (${article?.sourceCountry || "Non précisé"}) n'est pas utilisé comme secours.`,
  };
}

function buildArticleParticle(article) {
  const location = eventLocationForArticle(article);
  if (!location?.code) {
    return { offMap: buildOffMapArticle(article) };
  }
  const seed = `${article.id || article.url || article.title}:${location.code}:event-particle`;
  const placement = placePointInsideCountry(location.code, seed);
  if (!placement) {
    return {
      offMap: buildOffMapArticle(
        article,
        "event_country_geometry_position_failed",
        "Placement événement dans géométrie pays impossible",
        `Pays de l'événement ${location.label} détecté dans le contenu, mais aucun point interne n'a pu être calculé dans la géométrie embarquée.`
      ),
    };
  }
  const sizeOffset = stableHash(`${article.id || article.url}:particle-size`) % (ARTICLE_PARTICLE_MAX_SIZE - ARTICLE_PARTICLE_MIN_SIZE + 1);
  return {
    particle: {
      id: `${article.id || stableHash(article.url).toString(36)}:particle`,
      articleId: article.id || null,
      kind: "article",
      title: article.title,
      mediaName: mediaNameForArticle(article),
      sourceType: article.sourceType,
      domain: article.domain,
      sourceCountry: article.sourceCountry,
      sourceRegion: article.sourceRegion,
      sourceLocation: article.sourceLocation || null,
      eventCountry: article.eventCountry,
      eventCountryIso: article.eventCountryIso,
      confidence: Number(article.confidence || 0),
      matchType: article.matchType || "none",
      evidence: article.evidence || null,
      location,
      x: placement.x,
      y: placement.y,
      coordinates: placement.coordinates,
      size: ARTICLE_PARTICLE_MIN_SIZE + sizeOffset,
      label: article.label || WORLD_PULSE_UNCLASSIFIED_LABEL,
      seenAt: article.seenAt || null,
      url: article.url || null,
      positioning: {
        ...placement.positioning,
        basis: "verified_event_country_geometry",
        eventCountryIso2: location.code,
        eventCountryLabel: location.label,
      },
    },
  };
}

function buildArticleClusters(particles) {
  const clusteredParticles = particles.map((particle) => ({ ...particle }));
  const buckets = new Map();
  for (const particle of clusteredParticles) {
    const key = `${particle.location?.code || "XX"}:${particle.label || WORLD_PULSE_UNCLASSIFIED_LABEL}`;
    const bucket = buckets.get(key) || [];
    bucket.push(particle);
    buckets.set(key, bucket);
  }

  const clusters = [];
  for (const bucket of buckets.values()) {
    const localClusters = [];
    for (const particle of bucket.sort((left, right) => left.x - right.x || left.y - right.y || String(left.id).localeCompare(String(right.id), "fr"))) {
      let target = localClusters.find((cluster) => locationDistance(cluster.center, particle) <= NEARBY_ARTICLE_CLUSTER_DISTANCE);
      if (!target) {
        target = { entries: [], center: { x: particle.x, y: particle.y } };
        localClusters.push(target);
      }
      target.entries.push(particle);
      target.center = {
        x: target.entries.reduce((sum, entry) => sum + entry.x, 0) / target.entries.length,
        y: target.entries.reduce((sum, entry) => sum + entry.y, 0) / target.entries.length,
      };
    }

    for (const cluster of localClusters.filter((item) => item.entries.length > 1)) {
      const entries = cluster.entries.sort((left, right) => String(left.title || "").localeCompare(String(right.title || ""), "fr"));
      const first = entries[0];
      const id = stableHash(`article-cluster:${entries.map((entry) => entry.id).join("|")}`).toString(36);
      for (const entry of entries) entry.clusterId = id;
      clusters.push({
        id,
        kind: "article-cluster",
        label: first.label || WORLD_PULSE_UNCLASSIFIED_LABEL,
        location: first.location,
        sourceCountry: first.sourceCountry,
        sourceRegion: first.sourceRegion,
        eventCountry: first.eventCountry,
        eventCountryIso: first.eventCountryIso,
        matchType: first.matchType || "none",
        evidence: first.evidence || null,
        x: Number(cluster.center.x.toFixed(2)),
        y: Number(cluster.center.y.toFixed(2)),
        // Le diamètre encode le volume : une bulle de 6 articles doit rester
        // nettement plus large qu'une bulle de 2 sur la grande carte.
        size: clamp(Math.round(13 + Math.sqrt(entries.length) * 8), 22, 50),
        count: entries.length,
        articleCount: entries.length,
        mediaNames: [...new Set(entries.map((entry) => entry.mediaName))].sort((left, right) => left.localeCompare(right, "fr")),
        sampleTitles: entries.slice(0, 5).map((entry) => entry.title),
        articles: entries.map((entry) => ({ id: entry.id, articleId: entry.articleId || null, title: entry.title, url: entry.url, mediaName: entry.mediaName })),
        positioning: {
          basis: "visual_cluster_same_event_country_category",
          eventCountryIso2: first.location?.code || null,
          eventCountryLabel: first.location?.label || null,
          category: first.label || WORLD_PULSE_UNCLASSIFIED_LABEL,
          distanceThreshold: NEARBY_ARTICLE_CLUSTER_DISTANCE,
          representedParticleIds: entries.map((entry) => entry.id),
        },
      });
    }
  }
  return {
    particles: clusteredParticles,
    clusters: clusters.sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, "fr")),
  };
}

function buildArticleParticleModel(articles) {
  const particles = [];
  const offMapArticles = [];
  for (const article of [...articles].sort(compareArticlesForMap)) {
    const result = buildArticleParticle(article);
    if (result.particle) particles.push(result.particle);
    if (result.offMap) offMapArticles.push(result.offMap);
  }
  const clustered = buildArticleClusters(particles);
  return {
    articleParticles: clustered.particles,
    articleClusters: clustered.clusters,
    offMapArticles,
  };
}

function buildMapModel(articles) {
  const mediaMarkers = buildMediaMarkers(articles);
  const articleModel = buildArticleParticleModel(articles);
  const visibleEventPoints = [
    ...articleModel.articleClusters,
    ...articleModel.articleParticles.filter((particle) => !particle.clusterId),
  ];
  return {
    mediaMarkers,
    mapPoints: visibleEventPoints,
    ...articleModel,
  };
}

function buildGdeltUrl(endpoint = process.env.WORLD_PULSE_GDELT_ENDPOINT || GDELT_ENDPOINT) {
  const url = new URL(endpoint);
  url.searchParams.set("query", trimText(process.env.WORLD_PULSE_GDELT_CANARY_QUERY, 240) || GDELT_CANARY_QUERY);
  url.searchParams.set("mode", "artlist");
  url.searchParams.set("format", "json");
  url.searchParams.set("maxrecords", String(numberFromEnv("WORLD_PULSE_GDELT_CANARY_MAX_RECORDS", GDELT_CANARY_MAX_RECORDS)));
  url.searchParams.set("sort", "datedesc");
  url.searchParams.set("timespan", trimText(process.env.WORLD_PULSE_GDELT_CANARY_TIMESPAN, 40) || GDELT_CANARY_TIME_SPAN);
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
      const [name, url, sourceCountry, language, region] = entry.includes("|")
        ? entry.split("|").map((part) => part.trim())
        : [null, entry, null, null, null];
      const safe = safeUrl(url);
      if (!safe) return null;
      const feedSourceCountry = trimText(sourceCountry, 80) || "Non précisé";
      return {
        name: trimText(name, 80) || hostnameFromUrl(safe),
        region: trimText(region, 80) || sourceRegionForCountry(feedSourceCountry),
        url: safe,
        language: trimText(language, 80) || "Non précisé",
        sourceCountry: feedSourceCountry,
      };
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

function responseTooLargeError(maxBytes) {
  const error = new Error(`Réponse source trop volumineuse (limite ${Math.round(maxBytes / 1024)} Ko)`);
  error.code = "RESPONSE_TOO_LARGE";
  return error;
}

async function readResponseBuffer(response, maxBytes) {
  const declaredLength = Number(response?.headers?.get?.("content-length") || "");
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw responseTooLargeError(maxBytes);
  }

  if (!response?.body || typeof response.body.getReader !== "function") {
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > maxBytes) throw responseTooLargeError(maxBytes);
    return buffer;
  }

  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = Buffer.from(value);
      total += chunk.length;
      if (total > maxBytes) {
        await reader.cancel().catch(() => {});
        throw responseTooLargeError(maxBytes);
      }
      chunks.push(chunk);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, total);
}

async function readResponseText(response, { allowGzip = false, maxBytes = MAX_HTTP_RESPONSE_BYTES } = {}) {
  const buffer = await readResponseBuffer(response, maxBytes);
  if (allowGzip && buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b) {
    return gunzipSync(buffer, { maxOutputLength: maxBytes }).toString("utf8");
  }
  return buffer.toString("utf8");
}

function looksRateLimited(status, body = "") {
  if (status === 429) return true;
  const text = trimText(body, 1000);
  return /your query has been rate\s*-?\s*limited/i.test(text)
    || /\b(?:too many requests|quota exceeded)\b/i.test(text)
    || /\bthrottl(?:ed|ing)\b/i.test(text)
    || /\brate\s*-?\s*limit(?:ed|ing)?\s+(?:by|detected|exceeded|error)\b/i.test(text);
}

function parseRetryAfterMs(value, referenceDate) {
  const raw = trimText(value, 120);
  if (!raw) return null;
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return referenceDate.getTime() + Math.ceil(seconds) * 1000;
  }
  const httpDateMs = Date.parse(raw);
  return Number.isFinite(httpDateMs) && httpDateMs > referenceDate.getTime() ? httpDateMs : null;
}

function isoFromMs(value) {
  return Number.isFinite(value) && value > 0 ? new Date(value).toISOString() : null;
}

function gdeltTimestamp(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}00`;
}

function parseGdeltTimestampMs(value) {
  const match = String(value || "").match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})00$/);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match;
  const ms = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), 0, 0);
  return Number.isFinite(ms) ? ms : null;
}

function webNgramsDelayMinutes() {
  return numberFromEnv("WORLD_PULSE_NGRAMS_DELAY_MINUTES", GDELT_WEB_NGRAMS_DELAY_MINUTES);
}

function webNgramsTimestamp(referenceDate) {
  const slot = new Date(referenceDate.getTime() - webNgramsDelayMinutes() * 60 * 1000);
  slot.setUTCSeconds(0, 0);
  const cycleStartMinute = Math.floor(slot.getUTCMinutes() / GDELT_WEB_NGRAMS_CYCLE_MINUTES) * GDELT_WEB_NGRAMS_CYCLE_MINUTES;
  slot.setUTCMinutes(cycleStartMinute + 1);
  return gdeltTimestamp(slot);
}

function webNgramsSeedTimestamp(referenceDate, ngramsCache) {
  if (ngramsCache?.lastValid) return null;
  const raw = trimText(process.env.WORLD_PULSE_NGRAMS_SEED_TIMESTAMP, 40) || GDELT_WEB_NGRAMS_AUDITED_SEED_TIMESTAMP;
  const seedMs = parseGdeltTimestampMs(raw);
  if (!seedMs || seedMs > referenceDate.getTime()) return null;
  return raw;
}

function webNgramsCandidateTimestamp(referenceDate, ngramsCache) {
  return webNgramsSeedTimestamp(referenceDate, ngramsCache) || webNgramsTimestamp(referenceDate);
}

function webNgramsTocUrl(referenceDate, baseUrl = process.env.WORLD_PULSE_NGRAMS_BASE_URL || GDELT_WEB_NGRAMS_BASE_URL, ngramsCache = null) {
  const safeBase = String(baseUrl || GDELT_WEB_NGRAMS_BASE_URL).replace(/\/+$/, "");
  const timestamp = webNgramsCandidateTimestamp(referenceDate, ngramsCache);
  return {
    timestamp,
    url: `${safeBase}/${timestamp}.toc.json.gz`,
  };
}

function describeFetchError(error, source, timeoutReason) {
  const isAbort = error?.name === "AbortError";
  const tooLarge = error?.code === "RESPONSE_TOO_LARGE";
  return {
    source,
    reason: isAbort ? timeoutReason : tooLarge ? "Réponse source rejetée : volume excessif" : `Erreur réseau ${source}`,
    detail: trimText(String(error?.message || error), 600),
  };
}

function sourceFailureState(error) {
  if (error?.name === "AbortError") return "TIMEOUT";
  if (error?.code === "RESPONSE_TOO_LARGE") return "INVALID_RESPONSE";
  return "HTTP_ERROR";
}

async function fetchGdeltCanary({ fetchImpl, timeoutMs, referenceDate }) {
  const url = buildGdeltUrl();
  const checkedAt = referenceDate.toISOString();
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
    const described = describeFetchError(error, "GDELT_DOC_CANARY", "Timeout GDELT DOC canary");
    return {
      ok: false,
      error: { ...described, url: url.toString() },
      health: buildSourceHealth({
        source: "GDELT 2.0 DOC API canary",
        region: "Global canary ≤1/h",
        url: url.toString(),
        http: "ERR",
        state: sourceFailureState(error),
        detail: described.detail,
        checkedAt,
      }),
    };
  }

  let raw;
  try {
    raw = await readResponseText(response);
  } catch (error) {
    const described = describeFetchError(error, "GDELT_DOC_CANARY", "Timeout GDELT DOC canary");
    return {
      ok: false,
      error: { ...described, url: url.toString(), status: response.status },
      health: buildSourceHealth({
        source: "GDELT 2.0 DOC API canary",
        region: "Global canary ≤1/h",
        url: url.toString(),
        http: response.status,
        state: sourceFailureState(error),
        detail: described.detail,
        checkedAt,
      }),
    };
  }
  if (looksRateLimited(response.status, raw)) {
    const retryAfterMs = parseRetryAfterMs(response.headers?.get?.("retry-after"), referenceDate);
    const nextAttemptMs = Math.max(referenceDate.getTime() + GDELT_CANARY_INTERVAL_MS, retryAfterMs || 0);
    const nextAttemptAt = isoFromMs(nextAttemptMs);
    const detail = trimText(`Limité par GDELT DOC ; prochaine tentative ${nextAttemptAt || "selon cadence horaire"}. ${raw}`, 600);
    return {
      ok: false,
      retryAfterMs,
      nextAttemptAt,
      error: {
        source: "GDELT_DOC_CANARY",
        url: url.toString(),
        status: response.status,
        reason: "GDELT DOC limité / prochaine tentative planifiée",
        detail,
        nextAttemptAt,
      },
      health: buildSourceHealth({
        source: "GDELT 2.0 DOC API canary",
        region: "Global canary ≤1/h",
        url: url.toString(),
        http: response.status,
        state: "RATE_LIMITED",
        detail,
        checkedAt,
        nextAttemptAt,
      }),
    };
  }
  if (!response.ok) {
    return {
      ok: false,
      error: {
        source: "GDELT_DOC_CANARY",
        url: url.toString(),
        status: response.status,
        reason: `HTTP GDELT DOC canary ${response.status}`,
        detail: trimText(raw, 600),
      },
      health: buildSourceHealth({
        source: "GDELT 2.0 DOC API canary",
        region: "Global canary ≤1/h",
        url: url.toString(),
        http: response.status,
        state: "HTTP_ERROR",
        detail: raw,
        checkedAt,
      }),
    };
  }

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch (error) {
    return {
      ok: false,
      error: {
        source: "GDELT_DOC_CANARY",
        url: url.toString(),
        status: response.status,
        reason: "Réponse GDELT DOC canary non JSON",
        detail: trimText(`${String(error?.message || error)} — ${raw}`, 600),
      },
      health: buildSourceHealth({
        source: "GDELT 2.0 DOC API canary",
        region: "Global canary ≤1/h",
        url: url.toString(),
        http: response.status,
        state: "INVALID_RESPONSE",
        detail: `${String(error?.message || error)} — ${raw}`,
        checkedAt,
      }),
    };
  }

  const normalizedArticles = Array.isArray(payload?.articles)
    ? dedupeArticles(payload.articles.map(normalizeArticle).filter(Boolean))
    : [];
  const articles = normalizedArticles.slice(0, numberFromEnv("WORLD_PULSE_GDELT_CANARY_MAX_RECORDS", GDELT_CANARY_MAX_RECORDS));

  return {
    ok: true,
    url: url.toString(),
    status: response.status,
    articles,
    health: buildSourceHealth({
      source: "GDELT 2.0 DOC API canary",
      region: "Global canary ≤1/h",
      url: url.toString(),
      http: response.status,
      xml: true,
      articles: normalizedArticles.length,
      recent: normalizedArticles.some((article) => isRecentArticle(article, referenceDate)),
      state: "OK",
      checkedAt,
    }),
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
  const maxItems = Number(feed?.maxItems);
  const itemLimit = Number.isFinite(maxItems) && maxItems > 0 ? clamp(Math.floor(maxItems), 1, 60) : 250;
  const entries = (blocks.length > 0 ? blocks : atomBlocks).slice(0, itemLimit);

  return entries.map((block, index) => {
    const title = trimText(stripTags(decodeXmlEntities(extractTag(block, "title"))), 220);
    const link = canonicalUrl(extractTag(block, "link") || extractAtomLink(block) || extractTag(block, "guid"));
    if (!title || !link) return null;
    const description = stripTags(decodeXmlEntities(extractTag(block, "description") || extractTag(block, "summary") || extractTag(block, "content")));
    const seenAt = parseLooseDate(extractTag(block, "pubDate") || extractTag(block, "updated") || extractTag(block, "published"));
    const image = safeUrl(extractTag(block, "media:thumbnail") || extractTag(block, "enclosure"));
    const sourceCountry = trimText(feed.sourceCountry, 80) || "Non précisé";
    const sourceLocation = resolveSourceLocation(sourceCountry, "rssFeedCountry");
    const sourceRegion = trimText(feed.region, 80) || sourceRegionForCountry(sourceCountry);
    const signal = classifyMediaSignal(title, description);
    const eventLocation = resolveEventCountryFromArticle({ title, summary: description });
    return {
      id: stableHash(`${link}|${seenAt || index}|rss`).toString(36),
      title,
      url: link,
      domain: hostnameFromUrl(link),
      mediaName: trimText(feed.name, 100) || hostnameFromUrl(link),
      sourceCountry,
      sourceRegion,
      sourceLocation,
      language: trimText(feed.language, 80) || "Non précisé",
      seenAt,
      image,
      sourceType: feed.name,
      summary: trimText(description, 260),
      ...eventLocation,
      ...signal,
    };
  }).filter(Boolean);
}

async function fetchSingleRssFeed(feed, { fetchImpl, timeoutMs, referenceDate }) {
  try {
    const response = await fetchWithTimeout(feed.url, {
      fetchImpl,
      timeoutMs,
      headers: {
        Accept: "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
        "User-Agent": "LePoulsDuMonde/1.0 (GDELT dashboard)",
      },
    });
    const raw = await readResponseText(response);
    const rateLimited = looksRateLimited(response.status, raw);
    if (!response.ok) {
      return {
        ok: false,
        error: {
          source: "RSS_PUBLIC",
          feed: feed.name,
          url: feed.url,
          status: response.status,
          reason: rateLimited ? "Rate limiting RSS détecté" : `HTTP RSS ${response.status}`,
          detail: trimText(raw, 600),
        },
        health: buildSourceHealth({
          source: feed.name,
          region: feed.region || sourceRegionForCountry(feed.sourceCountry),
          url: feed.url,
          http: response.status,
          state: rateLimited ? "RATE_LIMITED" : "HTTP_ERROR",
          detail: raw,
        }),
      };
    }
    const xml = /<rss|<feed|<rdf:RDF/i.test(raw);
    const parsedArticles = xml ? parseRssItems(raw, feed) : [];
    const health = buildSourceHealth({
      source: feed.name,
      region: feed.region || sourceRegionForCountry(feed.sourceCountry),
      url: feed.url,
      http: response.status,
      xml,
      articles: parsedArticles.length,
      recent: parsedArticles.some((article) => isRecentArticle(article, referenceDate)),
      state: !xml ? "INVALID_RESPONSE" : parsedArticles.length > 0 ? "OK" : "INVALID_RESPONSE",
      detail: !xml ? raw : "",
    });
    if (parsedArticles.length === 0) {
      return {
        ok: false,
        error: {
          source: "RSS_PUBLIC",
          feed: feed.name,
          url: feed.url,
          status: response.status,
          reason: xml ? "Flux RSS sans item exploitable" : "Réponse RSS non XML",
          detail: xml ? "Aucun item avec titre et lien HTTP(S)." : trimText(raw, 600),
        },
        health,
      };
    }
    return { ok: true, feed, status: response.status, articles: parsedArticles, health };
  } catch (error) {
    const described = describeFetchError(error, "RSS_PUBLIC", "Timeout RSS");
    return {
      ok: false,
      error: {
        ...described,
        feed: feed.name,
        url: feed.url,
      },
      health: buildSourceHealth({
        source: feed.name,
        region: feed.region || sourceRegionForCountry(feed.sourceCountry),
        url: feed.url,
        http: "ERR",
        state: sourceFailureState(error),
        detail: described.detail,
      }),
    };
  }
}

async function settleWithConcurrency(items, task, concurrency) {
  const settled = new Array(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(items.length, Math.max(1, concurrency)) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      try {
        settled[index] = { status: "fulfilled", value: await task(items[index]) };
      } catch (reason) {
        settled[index] = { status: "rejected", reason };
      }
    }
  });
  await Promise.all(workers);
  return settled;
}

async function fetchRssFallback({ fetchImpl, timeoutMs, feeds, referenceDate }) {
  // Les flux sont indépendants, mais les lancer tous en même temps finit par
  // saturer certains environnements serverless lorsque la couverture grandit.
  // Cette limite conserve une lecture rapide tout en évitant une vague de
  // timeouts corrélés qui ferait clignoter l'interface au rechargement.
  const concurrency = Math.floor(numberFromEnv("WORLD_PULSE_RSS_CONCURRENCY", RSS_FETCH_CONCURRENCY));
  const settled = await settleWithConcurrency(
    feeds,
    (feed) => fetchSingleRssFeed(feed, { fetchImpl, timeoutMs, referenceDate }),
    concurrency,
  );
  const results = settled.map((result, index) => {
    if (result.status === "fulfilled") return result.value;
    const feed = feeds[index];
    return {
      ok: false,
      error: {
        source: "RSS_PUBLIC",
        feed: feed.name,
        url: feed.url,
        reason: "Exception RSS non interceptée",
        detail: trimText(String(result.reason?.message || result.reason), 600),
      },
      health: buildSourceHealth({
        source: feed.name,
        region: feed.region || sourceRegionForCountry(feed.sourceCountry),
        url: feed.url,
        http: "ERR",
        state: "HTTP_ERROR",
        detail: String(result.reason?.message || result.reason),
      }),
    };
  });
  const fetchedArticles = results.reduce((sum, result) => sum + (result.ok ? result.articles.length : 0), 0);
  const articles = sortArticlesByDateDesc(dedupeArticles(results.flatMap((result) => (result.ok ? result.articles : []))));
  const errors = results.filter((result) => !result.ok).map((result) => result.error);
  const health = results.map((result) => result.health).filter(Boolean);
  const okFeeds = results
    .filter((result) => result.ok)
    .map((result) => ({
      name: result.feed.name,
      region: result.feed.region || sourceRegionForCountry(result.feed.sourceCountry),
      url: result.feed.url,
      sourceCountry: result.feed.sourceCountry || "Non précisé",
      status: result.status,
      articles: result.articles.length,
    }));
  return { ok: articles.length > 0, articles, errors, okFeeds, health, fetchedArticles, truncatedArticles: 0 };
}

function parseTocJsonLines(raw) {
  const lines = String(raw || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];
  return lines.map((line) => JSON.parse(line));
}

function normalizeTocEntry(entry, index) {
  const url = canonicalUrl(entry?.url);
  const title = trimText(entry?.title, 220);
  if (!url || !title) return null;
  const seenAt = parseLooseDate(entry?.date);
  const language = trimText(entry?.lang, 40) || "Non précisé";
  const signal = classifyMediaSignal(title);
  return {
    id: entry?.ID ?? index,
    title,
    url,
    domain: hostnameFromUrl(url),
    language,
    seenAt,
    ...signal,
  };
}

function normalizeTrendTerm(value) {
  const term = trimText(value, 80)
    .toLocaleLowerCase("fr-FR")
    .replace(/^[’'\-]+|[’'\-]+$/g, "");
  if (!term || GDELT_TREND_STOPWORDS.has(term)) return null;
  if (term.length < 3 && !["ai", "ia"].includes(term)) return null;
  return term;
}

function trendTermsFromTitle(title) {
  return [...String(title || "").matchAll(/[\p{L}\p{N}][\p{L}\p{N}’'\-]{1,}/gu)]
    .map((match) => normalizeTrendTerm(match[0]))
    .filter(Boolean);
}

function countTrendCategories(trends) {
  const counts = new Map();
  for (const trend of trends) {
    if (!trend?.classified) continue;
    const current = counts.get(trend.label) || { label: trend.label, count: 0, color: trend.color };
    current.count += trend.volume;
    counts.set(trend.label, current);
  }
  return [...counts.values()]
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, "fr"));
}

function buildRawGdeltTrends(documents, { timestamp }) {
  const trends = new Map();
  const tocDate = parseGdeltDate(timestamp);
  for (const document of documents) {
    const terms = new Set(trendTermsFromTitle(document.title));
    for (const term of terms) {
      const signal = findWorldPulseSignalCategory(term);
      const classified = isWorldPulseClassifiedLabel(signal.label);
      const current = trends.get(term) || {
        term,
        volume: 0,
        tocTimestamp: timestamp || null,
        tocDate: tocDate || document.seenAt || null,
        examples: [],
        label: classified ? signal.label : GDELT_EMERGING_TREND_LABEL,
        labelType: classified ? "registre déterministe fort" : "tendance émergente sans thème fiable",
        classified,
        deterministicScore: classified ? 1 : 0,
        color: classified ? colorForWorldPulseSignalLabel(signal.label) : null,
      };
      current.volume += 1;
      if (current.examples.length < 3) {
        current.examples.push({
          title: document.title,
          url: document.url,
          language: document.language,
          seenAt: document.seenAt,
        });
      }
      trends.set(term, current);
    }
  }
  const rawTrends = [...trends.values()]
    .sort((left, right) => right.volume - left.volume || Number(right.classified) - Number(left.classified) || left.term.localeCompare(right.term, "fr"))
    .slice(0, GDELT_RAW_TREND_LIMIT);
  const classifiedTrends = rawTrends.filter((trend) => trend.classified);
  const allEmergingTrends = rawTrends.filter((trend) => !trend.classified);
  const emergingTrends = allEmergingTrends.slice(0, GDELT_EMERGING_TREND_LIMIT);
  return {
    rawTrends,
    classifiedTrends,
    emergingTrends,
    thematicCategories: countTrendCategories(classifiedTrends),
    classification: {
      total: rawTrends.length,
      classified: classifiedTrends.length,
      unclassified: allEmergingTrends.length,
      coveragePct: rawTrends.length > 0 ? Math.round((classifiedTrends.length / rawTrends.length) * 100) : 0,
    },
  };
}

function buildWebNgramsTrends(entries, { timestamp, url, checkedAt = null, state = "OK", stale = false, error = null, toc = null } = {}) {
  const documents = entries.map(normalizeTocEntry).filter(Boolean);
  const trendModel = buildRawGdeltTrends(documents, { timestamp });
  const labels = trendModel.thematicCategories;
  const languages = countBy(documents, "language");
  const validatedToc = toc || {
    url,
    timestamp,
    documents: documents.length,
    fetchedAt: checkedAt,
    validatedUrl: url,
    validatedTimestamp: timestamp,
    validatedDocuments: documents.length,
    validatedAt: checkedAt,
  };
  return {
    source: "GDELT_WEB_NGRAMS_TOC",
    url,
    timestamp,
    state,
    status: state === "STALE" ? "DEGRADE" : state,
    stale: Boolean(stale),
    degraded: Boolean(stale) || state === "STALE",
    checkedAt,
    toc: validatedToc,
    error,
    cycleMinutes: GDELT_WEB_NGRAMS_CYCLE_MINUTES,
    delayMinutes: webNgramsDelayMinutes(),
    documents: documents.length,
    labels,
    categories: labels,
    thematicCategories: trendModel.thematicCategories,
    rawTrends: trendModel.rawTrends,
    classifiedTrends: trendModel.classifiedTrends,
    emergingTrends: trendModel.emergingTrends,
    classification: trendModel.classification,
    languages,
    topTitles: documents.slice(0, 8).map((document) => ({
      title: document.title,
      url: document.url,
      language: document.language,
      label: document.label,
    })),
  };
}

function emptyWebNgramsTrends({ timestamp = null, url = null, checkedAt = null, state = "UNAVAILABLE", error = null } = {}) {
  return {
    source: "GDELT_WEB_NGRAMS_TOC",
    url,
    timestamp,
    state,
    status: state,
    stale: false,
    degraded: state !== "OK",
    checkedAt,
    toc: {
      url,
      timestamp,
      documents: 0,
      fetchedAt: null,
      validatedUrl: null,
      validatedTimestamp: null,
      validatedDocuments: 0,
      validatedAt: null,
    },
    error,
    cycleMinutes: GDELT_WEB_NGRAMS_CYCLE_MINUTES,
    delayMinutes: webNgramsDelayMinutes(),
    documents: 0,
    labels: [],
    categories: [],
    thematicCategories: [],
    rawTrends: [],
    classifiedTrends: [],
    emergingTrends: [],
    classification: {
      total: 0,
      classified: 0,
      unclassified: 0,
      coveragePct: 0,
    },
    languages: [],
    topTitles: [],
  };
}

async function fetchWebNgramsTocAttempt({ fetchImpl, timeoutMs, referenceDate, ngramsCache }) {
  const { timestamp, url } = webNgramsTocUrl(referenceDate, undefined, ngramsCache);
  const checkedAt = referenceDate.toISOString();
  try {
    const response = await fetchWithTimeout(url, {
      fetchImpl,
      timeoutMs,
      headers: {
        Accept: "application/json, application/x-ndjson, application/gzip, */*;q=0.8",
        "User-Agent": "LePoulsDuMonde/1.0 (GDELT Web N-Grams TOC)",
      },
    });
    const raw = await readResponseText(response, { allowGzip: true });
    if (looksRateLimited(response.status, raw)) {
      const error = { source: "GDELT_WEB_NGRAMS_TOC", url, status: response.status, reason: "Rate limiting GDELT Web N-Grams détecté", detail: trimText(raw, 600) };
      return {
        ok: false,
        trends: emptyWebNgramsTrends({ timestamp, url, checkedAt, state: "RATE_LIMITED", error }),
        error,
        health: buildSourceHealth({ source: "GDELT Web N-Grams TOC", region: "Global trends", url, http: response.status, state: "RATE_LIMITED", detail: raw, checkedAt }),
      };
    }
    if (!response.ok) {
      const error = { source: "GDELT_WEB_NGRAMS_TOC", url, status: response.status, reason: `HTTP GDELT Web N-Grams ${response.status}`, detail: trimText(raw, 600) };
      return {
        ok: false,
        trends: emptyWebNgramsTrends({ timestamp, url, checkedAt, state: "HTTP_ERROR", error }),
        error,
        health: buildSourceHealth({ source: "GDELT Web N-Grams TOC", region: "Global trends", url, http: response.status, state: "HTTP_ERROR", detail: raw, checkedAt }),
      };
    }
    let entries;
    try {
      entries = parseTocJsonLines(raw);
    } catch (error) {
      const invalidError = { source: "GDELT_WEB_NGRAMS_TOC", url, status: response.status, reason: "TOC GDELT Web N-Grams invalide", detail: trimText(`${String(error?.message || error)} — ${raw}`, 600) };
      return {
        ok: false,
        trends: emptyWebNgramsTrends({ timestamp, url, checkedAt, state: "INVALID_RESPONSE", error: invalidError }),
        error: invalidError,
        health: buildSourceHealth({ source: "GDELT Web N-Grams TOC", region: "Global trends", url, http: response.status, state: "INVALID_RESPONSE", detail: `${String(error?.message || error)} — ${raw}`, checkedAt }),
      };
    }
    const trends = buildWebNgramsTrends(entries, { timestamp, url, checkedAt });
    if (trends.documents === 0) {
      const error = { source: "GDELT_WEB_NGRAMS_TOC", url, status: response.status, reason: "TOC GDELT Web N-Grams sans document exploitable" };
      return {
        ok: false,
        trends: { ...trends, state: "INVALID_RESPONSE", status: "INVALID_RESPONSE", degraded: true, error },
        error,
        health: buildSourceHealth({ source: "GDELT Web N-Grams TOC", region: "Global trends", url, http: response.status, xml: true, articles: 0, state: "INVALID_RESPONSE", detail: "Aucun document avec titre et URL HTTP(S).", checkedAt }),
      };
    }
    return {
      ok: true,
      trends,
      health: buildSourceHealth({ source: "GDELT Web N-Grams TOC", region: "Global trends", url, http: response.status, xml: true, articles: trends.documents, recent: true, state: "OK", checkedAt }),
    };
  } catch (error) {
    const described = describeFetchError(error, "GDELT_WEB_NGRAMS_TOC", "Timeout GDELT Web N-Grams TOC");
    const fetchError = { ...described, url };
    return {
      ok: false,
      trends: emptyWebNgramsTrends({ timestamp, url, checkedAt, state: sourceFailureState(error), error: fetchError }),
      error: fetchError,
      health: buildSourceHealth({ source: "GDELT Web N-Grams TOC", region: "Global trends", url, http: "ERR", state: sourceFailureState(error), detail: described.detail, checkedAt }),
    };
  }
}

function ensureWebNgramsCache(cache) {
  if (!cache.ngrams) {
    cache.ngrams = { lastCheckedAt: 0, lastResult: null, lastValid: null, pending: null };
  }
  return cache.ngrams;
}

function validTocRecordFromResult(result) {
  if (!result?.ok || !result?.trends || Number(result.trends.documents || 0) <= 0) return null;
  return {
    url: result.trends.url,
    timestamp: result.trends.timestamp,
    documents: Number(result.trends.documents || 0),
    fetchedAt: result.trends.checkedAt || result.health?.checkedAt || null,
    trends: cloneJson(result.trends),
  };
}

function buildStaleWebNgramsResult(lastValid, failedResult, referenceDate, { skipped = false } = {}) {
  const attemptedError = failedResult?.error || {
    source: "GDELT_WEB_NGRAMS_TOC",
    url: failedResult?.trends?.url || null,
    reason: skipped
      ? "Contrôle GDELT Web N-Grams différé par cadence prudente 15 min"
      : "GDELT Web N-Grams indisponible",
  };
  const attemptedHealth = failedResult?.health || null;
  const baseTrends = cloneJson(lastValid?.trends) || emptyWebNgramsTrends();
  const checkedAt = referenceDate.toISOString();
  const attemptedStatus = attemptedError.status ?? attemptedHealth?.http ?? null;
  const attemptedUrl = attemptedError.url || failedResult?.trends?.url || null;
  const attemptedAt = attemptedHealth?.checkedAt || failedResult?.trends?.checkedAt || checkedAt;
  const toc = {
    ...(baseTrends.toc || {}),
    url: lastValid?.url || baseTrends.url || null,
    timestamp: lastValid?.timestamp || baseTrends.timestamp || null,
    documents: Number(lastValid?.documents ?? baseTrends.documents ?? 0),
    fetchedAt: lastValid?.fetchedAt || baseTrends.checkedAt || null,
    validatedUrl: lastValid?.url || baseTrends.url || null,
    validatedTimestamp: lastValid?.timestamp || baseTrends.timestamp || null,
    validatedDocuments: Number(lastValid?.documents ?? baseTrends.documents ?? 0),
    validatedAt: lastValid?.fetchedAt || baseTrends.checkedAt || null,
    lastAttemptedUrl: attemptedUrl,
    lastAttemptedAt: attemptedAt,
    lastAttemptStatus: attemptedStatus,
  };
  const detailParts = [
    `Dernier TOC valide conservé : ${toc.validatedTimestamp || "horodatage inconnu"}`,
    `${toc.validatedDocuments} document(s)`,
    `URL valide : ${toc.validatedUrl || "non précisée"}`,
    attemptedError?.reason ? `incident courant : ${attemptedError.reason}` : null,
  ].filter(Boolean);
  const trends = {
    ...baseTrends,
    state: "STALE",
    status: "DEGRADE",
    stale: true,
    degraded: true,
    checkedAt,
    toc,
    error: attemptedError,
  };
  return {
    ok: false,
    trends,
    error: attemptedError,
    health: buildSourceHealth({
      source: "GDELT Web N-Grams TOC",
      region: "Global trends",
      url: toc.validatedUrl,
      http: attemptedStatus,
      xml: true,
      articles: toc.validatedDocuments,
      recent: false,
      state: "STALE",
      detail: detailParts.join(" | "),
      checkedAt,
    }),
  };
}

async function fetchWebNgramsToc({ cache, fetchImpl, timeoutMs, referenceDate }) {
  const ngramsCache = ensureWebNgramsCache(cache);
  const nowMs = referenceDate.getTime();
  if (ngramsCache.pending) return ngramsCache.pending;

  const withinCadence = ngramsCache.lastCheckedAt > 0
    && nowMs - ngramsCache.lastCheckedAt < GDELT_WEB_NGRAMS_MIN_CHECK_INTERVAL_MS;
  if (withinCadence && ngramsCache.lastResult) {
    if (ngramsCache.lastValid && !ngramsCache.lastResult.ok) {
      return buildStaleWebNgramsResult(ngramsCache.lastValid, ngramsCache.lastResult, referenceDate, { skipped: true });
    }
    return cloneJson(ngramsCache.lastResult);
  }

  ngramsCache.lastCheckedAt = nowMs;
  ngramsCache.pending = fetchWebNgramsTocAttempt({ fetchImpl, timeoutMs, referenceDate, ngramsCache })
    .then((result) => {
      const valid = validTocRecordFromResult(result);
      const finalResult = valid
        ? result
        : ngramsCache.lastValid
          ? buildStaleWebNgramsResult(ngramsCache.lastValid, result, referenceDate)
          : result;
      if (valid) ngramsCache.lastValid = valid;
      ngramsCache.lastResult = cloneJson(finalResult);
      return finalResult;
    })
    .finally(() => {
      ngramsCache.pending = null;
    });
  return ngramsCache.pending;
}

function buildDataPayload({ state, stateLabel, generatedAt, source, query, articles, notice, cacheTtlMs, cacheStatus = "miss", sourceHealth = [], globalTrends = emptyWebNgramsTrends(), rssStats = {} }) {
  const domains = countBy(articles, "domain");
  const sourceCountries = countBy(articles, "sourceCountry");
  const sourceRegions = countBy(articles, "sourceRegion");
  const mediaSources = countBy(articles, "mediaName");
  const sourceLocations = countBySourceLocation(articles);
  const eventCountries = countByEventLocation(articles);
  const countries = eventCountries;
  const locations = eventCountries;
  const languages = countBy(articles, "language");
  const rssClassification = buildClassificationSummary(articles);
  const labels = rssClassification.categories;
  const mapModel = buildMapModel(articles);
  const { mediaMarkers, mapPoints, articleParticles, articleClusters, offMapArticles } = mapModel;
  const localized = articleParticles.length;
  const eventLocalizedArticles = localized;
  const eventUnlocalizedArticles = offMapArticles.length;
  const rssFetchedArticles = Number.isFinite(rssStats.fetchedArticles) ? rssStats.fetchedArticles : articles.length;
  const rssTruncatedArticles = Number.isFinite(rssStats.truncatedArticles) ? rssStats.truncatedArticles : 0;
  const offMapReasons = countBy(offMapArticles, "reasonLabel");
  const unavailableSources = sourceHealth.filter((entry) => !["OK"].includes(entry.state)).length;
  const rssSourceHealth = sourceHealth.filter((entry) => entry?.source && !["GDELT Web N-Grams TOC", "GDELT 2.0 DOC API canary", "Cache serveur"].includes(entry.source));
  const rssActiveSources = rssSourceHealth.filter((entry) => entry.state === "OK").length;
  const rssSourcesInError = rssSourceHealth.filter((entry) => entry.state !== "OK").length;
  const rssAuditedSources = rssSourceHealth.length;
  const gdeltCategories = Array.isArray(globalTrends?.categories) ? globalTrends.categories : (Array.isArray(globalTrends?.labels) ? globalTrends.labels : []);
  const gdeltThematicCategories = Array.isArray(globalTrends?.thematicCategories)
    ? globalTrends.thematicCategories
    : gdeltCategories.filter((item) => isWorldPulseClassifiedLabel(item.label));
  const gdeltRawTrends = Array.isArray(globalTrends?.rawTrends) ? globalTrends.rawTrends : [];
  const gdeltEmergingTrends = Array.isArray(globalTrends?.emergingTrends) ? globalTrends.emergingTrends : [];
  const gdeltClassification = globalTrends?.classification || {
    total: Number(globalTrends?.documents || 0),
    classified: gdeltThematicCategories.reduce((sum, item) => sum + (Number(item.count) || 0), 0),
    unclassified: 0,
    coveragePct: Number(globalTrends?.documents || 0) > 0 ? 100 : 0,
  };
  const rssMediaSources = distinctCount(articles, "mediaName");
  const rssKnownMediaCountries = distinctKnownCount(articles, "sourceCountry");
  const timestamp = Date.parse(generatedAt);
  const rssScope = {
    source: "RSS_PUBLIC",
    period: "dernier rafraîchissement serveur, cache ≥15 min, sans plafond fixe de particules ; hors carte explicite",
    fetched: rssFetchedArticles,
    articles: articles.length,
    rendered: eventLocalizedArticles,
    offMap: eventUnlocalizedArticles,
    truncated: rssTruncatedArticles,
    uniqueMedia: rssMediaSources,
    knownMediaCountries: rssKnownMediaCountries,
    eventLocalizedArticles,
    eventUnlocalizedArticles,
    eventCountries: eventCountries.length,
    thematicCategories: rssClassification.thematicCategories.length,
    unclassifiedArticles: rssClassification.unclassified,
    classificationCoveragePct: rssClassification.coveragePct,
  };
  const gdeltScope = {
    source: "GDELT_WEB_NGRAMS_TOC",
    period: `cycle ${globalTrends?.cycleMinutes || GDELT_WEB_NGRAMS_CYCLE_MINUTES} min, retard ~${globalTrends?.delayMinutes || GDELT_WEB_NGRAMS_DELAY_MINUTES} min`,
    state: globalTrends?.state || "UNAVAILABLE",
    status: globalTrends?.status || globalTrends?.state || "UNAVAILABLE",
    stale: Boolean(globalTrends?.stale),
    url: globalTrends?.url || null,
    timestamp: globalTrends?.timestamp || null,
    checkedAt: globalTrends?.checkedAt || null,
    toc: globalTrends?.toc || null,
    documents: Number(globalTrends?.documents || 0),
    rawTrends: gdeltRawTrends.length,
    emergingTrends: gdeltEmergingTrends.length,
    thematicCategories: gdeltThematicCategories.length,
    unclassifiedDocuments: Number(gdeltClassification.unclassified || 0),
    classificationCoveragePct: Number(gdeltClassification.coveragePct || 0),
  };
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
      mediaSources: rssMediaSources,
      countries: eventCountries.length,
      eventCountries: eventCountries.length,
      sourceCountries: distinctCount(articles, "sourceCountry"),
      sourceRegions: distinctCount(articles, "sourceRegion"),
      sourceLocations: distinctSourceLocationCount(articles),
      languages: distinctCount(articles, "language"),
      labels: distinctCount(articles, "label"),
      rssArticlesFetched: rssFetchedArticles,
      rssArticles: articles.length,
      rssArticlesRendered: localized,
      rssArticlesOffMap: offMapArticles.length,
      rssArticlesTruncated: rssTruncatedArticles,
      rssMediaSources,
      rssActiveSources,
      rssAuditedSources,
      rssSourcesInError,
      rssKnownMediaCountries,
      rssCategories: rssClassification.thematicCategories.length,
      rssClassifiedArticles: rssClassification.classified,
      rssUnclassifiedArticles: rssClassification.unclassified,
      rssClassificationCoveragePct: rssClassification.coveragePct,
      gdeltNgramsDocuments: gdeltScope.documents,
      gdeltNgramsRawTrends: gdeltScope.rawTrends,
      gdeltNgramsCategories: gdeltScope.thematicCategories,
      gdeltNgramsEmergingTrends: gdeltScope.emergingTrends,
      gdeltNgramsUnclassifiedDocuments: gdeltScope.unclassifiedDocuments,
      gdeltNgramsClassificationCoveragePct: gdeltScope.classificationCoveragePct,
      localized,
      unlocalized: eventUnlocalizedArticles,
      eventLocalizedArticles,
      eventUnlocalizedArticles,
      mediaMarkers: mediaMarkers.length,
      articleParticles: articleParticles.length,
      articleClusters: articleClusters.length,
      articleVisiblePoints: articleParticles.length - articleParticles.filter((particle) => particle.clusterId).length + articleClusters.length,
      offMapArticles: offMapArticles.length,
      mapPoints: mapPoints.length,
      unavailableSources,
    },
    groupings: {
      domains,
      mediaSources,
      countries,
      eventCountries,
      sourceCountries,
      sourceRegions,
      sourceLocations,
      locations,
      languages,
      labels,
      rssCategories: labels,
      gdeltNgramsCategories: gdeltThematicCategories,
      offMapReasons,
    },
    dataScopes: {
      rss: rssScope,
      gdeltNgrams: gdeltScope,
    },
    mapPoints,
    mediaMarkers,
    articleParticles,
    articleClusters,
    offMapArticles,
    globalTrends,
    sourceHealth,
    articles,
    notice,
  };
}

function buildUnavailablePayload({ generatedAt, rssErrors, feeds, cacheTtlMs, sourceHealth = [], globalTrends = emptyWebNgramsTrends(), trendsError = null, canaryError = null }) {
  const gdeltCategories = Array.isArray(globalTrends?.categories) ? globalTrends.categories : (Array.isArray(globalTrends?.labels) ? globalTrends.labels : []);
  const gdeltThematicCategories = Array.isArray(globalTrends?.thematicCategories)
    ? globalTrends.thematicCategories
    : gdeltCategories.filter((item) => isWorldPulseClassifiedLabel(item.label));
  const gdeltRawTrends = Array.isArray(globalTrends?.rawTrends) ? globalTrends.rawTrends : [];
  const gdeltEmergingTrends = Array.isArray(globalTrends?.emergingTrends) ? globalTrends.emergingTrends : [];
  const rssSourceHealth = sourceHealth.filter((entry) => entry?.source && !["GDELT Web N-Grams TOC", "GDELT 2.0 DOC API canary", "Cache serveur"].includes(entry.source));
  const rssActiveSources = rssSourceHealth.filter((entry) => entry.state === "OK").length;
  const rssSourcesInError = rssSourceHealth.filter((entry) => entry.state !== "OK").length;
  const rssAuditedSources = rssSourceHealth.length || feeds.length;
  const gdeltClassification = globalTrends?.classification || {
    total: Number(globalTrends?.documents || 0),
    classified: gdeltThematicCategories.reduce((sum, item) => sum + (Number(item.count) || 0), 0),
    unclassified: 0,
    coveragePct: Number(globalTrends?.documents || 0) > 0 ? 100 : 0,
  };
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
      primary: "RSS public",
      trends: "GDELT Web N-Grams TOC",
      canary: "GDELT 2.0 DOC API canary",
      feeds: feeds.map((feed) => ({ name: feed.name, region: feed.region || sourceRegionForCountry(feed.sourceCountry), url: feed.url })),
    },
    cache: {
      status: "bypass",
      ttlSeconds: Math.floor(cacheTtlMs / 1000),
    },
    query: QUERY,
    counts: {
      articles: 0,
      domains: 0,
      mediaSources: 0,
      countries: 0,
      eventCountries: 0,
      sourceCountries: 0,
      sourceRegions: 0,
      sourceLocations: 0,
      languages: 0,
      labels: 0,
      rssArticlesFetched: 0,
      rssArticles: 0,
      rssArticlesRendered: 0,
      rssArticlesOffMap: 0,
      rssArticlesTruncated: 0,
      rssMediaSources: 0,
      rssActiveSources,
      rssAuditedSources,
      rssSourcesInError,
      rssKnownMediaCountries: 0,
      rssCategories: 0,
      rssClassifiedArticles: 0,
      rssUnclassifiedArticles: 0,
      rssClassificationCoveragePct: 0,
      gdeltNgramsDocuments: Number(globalTrends?.documents || 0),
      gdeltNgramsRawTrends: gdeltRawTrends.length,
      gdeltNgramsCategories: gdeltThematicCategories.length,
      gdeltNgramsEmergingTrends: gdeltEmergingTrends.length,
      gdeltNgramsUnclassifiedDocuments: Number(gdeltClassification.unclassified || 0),
      gdeltNgramsClassificationCoveragePct: Number(gdeltClassification.coveragePct || 0),
      localized: 0,
      unlocalized: 0,
      eventLocalizedArticles: 0,
      eventUnlocalizedArticles: 0,
      mediaMarkers: 0,
      articleParticles: 0,
      articleClusters: 0,
      articleVisiblePoints: 0,
      offMapArticles: 0,
      mapPoints: 0,
      unavailableSources: sourceHealth.filter((entry) => entry.state !== "OK").length,
    },
    groupings: {
      domains: [],
      mediaSources: [],
      countries: [],
      eventCountries: [],
      sourceCountries: [],
      sourceRegions: [],
      sourceLocations: [],
      locations: [],
      languages: [],
      labels: [],
      rssCategories: [],
      gdeltNgramsCategories: gdeltThematicCategories,
      offMapReasons: [],
    },
    dataScopes: {
      rss: {
        source: "RSS_PUBLIC",
        period: "dernier rafraîchissement serveur, cache ≥15 min, sans plafond fixe de particules ; hors carte explicite",
        fetched: 0,
        articles: 0,
        rendered: 0,
        offMap: 0,
        truncated: 0,
        uniqueMedia: 0,
        knownMediaCountries: 0,
        thematicCategories: 0,
        unclassifiedArticles: 0,
        classificationCoveragePct: 0,
      },
      gdeltNgrams: {
        source: "GDELT_WEB_NGRAMS_TOC",
        period: `cycle ${globalTrends?.cycleMinutes || GDELT_WEB_NGRAMS_CYCLE_MINUTES} min, retard ~${globalTrends?.delayMinutes || GDELT_WEB_NGRAMS_DELAY_MINUTES} min`,
        state: globalTrends?.state || "UNAVAILABLE",
        status: globalTrends?.status || globalTrends?.state || "UNAVAILABLE",
        stale: Boolean(globalTrends?.stale),
        url: globalTrends?.url || null,
        timestamp: globalTrends?.timestamp || null,
        checkedAt: globalTrends?.checkedAt || null,
        toc: globalTrends?.toc || null,
        documents: Number(globalTrends?.documents || 0),
        rawTrends: gdeltRawTrends.length,
        emergingTrends: gdeltEmergingTrends.length,
        thematicCategories: gdeltThematicCategories.length,
        unclassifiedDocuments: Number(gdeltClassification.unclassified || 0),
        classificationCoveragePct: Number(gdeltClassification.coveragePct || 0),
      },
    },
    mapPoints: [],
    mediaMarkers: [],
    articleParticles: [],
    articleClusters: [],
    offMapArticles: [],
    globalTrends,
    sourceHealth,
    articles: [],
    error: {
      reason: "RSS public indisponible ou sans article exploitable",
      causes: [...rssErrors, trendsError, canaryError].filter(Boolean),
      detail: trimText([...rssErrors, trendsError, canaryError].filter(Boolean).map((cause) => `${cause.source}: ${cause.reason}`).join(" | "), 600),
    },
    notice: "Aucune donnée de démonstration n'est générée : les compteurs restent à zéro tant que les flux RSS publics ne livrent aucun article exploitable.",
  };
}

function mergeCanaryHealth(items, canaryHealth) {
  const list = Array.isArray(items) ? [...items] : [];
  if (!canaryHealth) return list;
  const index = list.findIndex((entry) => entry.source === canaryHealth.source);
  if (index >= 0) list[index] = canaryHealth;
  else list.push(canaryHealth);
  return list;
}

function cloneForCacheHit(payload, servedAtDate, expiresAt, { status = "hit", staleExpiresAt = 0, refreshErrors = [], canaryHealth = null } = {}) {
  const generatedAtMs = Date.parse(payload.generatedAt);
  const servedAtMs = servedAtDate.getTime();
  const copy = JSON.parse(JSON.stringify(payload));
  copy.servedAt = servedAtDate.toISOString();
  copy.freshnessSeconds = Math.max(0, Math.floor((servedAtMs - generatedAtMs) / 1000));
  copy.source = { ...copy.source, cached: true };
  copy.sourceHealth = mergeCanaryHealth(copy.sourceHealth, canaryHealth);
  copy.cache = {
    ...copy.cache,
    status,
    expiresAt: new Date(expiresAt).toISOString(),
    remainingSeconds: Math.max(0, Math.ceil((expiresAt - servedAtMs) / 1000)),
  };
  if (staleExpiresAt) {
    copy.cache.staleExpiresAt = new Date(staleExpiresAt).toISOString();
    copy.cache.staleRemainingSeconds = Math.max(0, Math.ceil((staleExpiresAt - servedAtMs) / 1000));
  }
  if (status === "stale-if-error") {
    copy.sourceHealth = [
      ...(Array.isArray(copy.sourceHealth) ? copy.sourceHealth : []),
      buildSourceHealth({
        source: "Cache serveur",
        region: "Mémoire partagée",
        url: null,
        http: null,
        state: "CACHE_STALE",
        detail: refreshErrors.map((error) => `${error.source || "source"}: ${error.reason || error.detail || "erreur"}`).join(" | "),
        checkedAt: servedAtDate.toISOString(),
      }),
    ];
    copy.notice = `${copy.notice || ""} Cache stale-if-error servi car le rafraîchissement externe a échoué.`.trim();
  }
  return copy;
}

function saveCache(cache, payload, nowMs, cacheTtlMs) {
  if (payload.state === "unavailable") return;
  cache.payload = JSON.parse(JSON.stringify(payload));
  cache.expiresAt = nowMs + cacheTtlMs;
  cache.staleExpiresAt = nowMs + STALE_IF_ERROR_MS;
}

function cacheTtlFromEnv() {
  return Math.max(CACHE_TTL_MS, numberFromEnv("WORLD_PULSE_CACHE_TTL_MS", CACHE_TTL_MS));
}

function ensureCanaryCache(cache) {
  if (!cache.canary) {
    cache.canary = { lastCheckedAt: 0, health: null, pending: false, backoffUntil: 0 };
  }
  if (!Number.isFinite(cache.canary.backoffUntil)) cache.canary.backoffUntil = 0;
  return cache.canary;
}

function nextCanaryAttemptMs(canary) {
  const cadenceMs = (canary.lastCheckedAt || 0) + GDELT_CANARY_INTERVAL_MS;
  return Math.max(cadenceMs, canary.backoffUntil || 0);
}

function withCanaryNextAttempt(health, canary) {
  if (!health) return null;
  const nextAttemptAt = isoFromMs(nextCanaryAttemptMs(canary));
  return nextAttemptAt ? { ...health, nextAttemptAt } : health;
}

function recordCanaryResult(canary, result, nowMs) {
  canary.lastCheckedAt = nowMs;
  const retryAfterMs = Number(result?.retryAfterMs || 0);
  canary.backoffUntil = Number.isFinite(retryAfterMs) && retryAfterMs > nowMs
    ? Math.max(nowMs + GDELT_CANARY_INTERVAL_MS, retryAfterMs)
    : 0;
  canary.health = withCanaryNextAttempt(result?.health || null, canary);
  return canary.health;
}

function recordCanaryException(canary, error, referenceDate, nowMs) {
  canary.lastCheckedAt = nowMs;
  canary.backoffUntil = 0;
  canary.health = withCanaryNextAttempt(buildSourceHealth({
    source: "GDELT 2.0 DOC API canary",
    region: "Global canary ≤1/h",
    url: buildGdeltUrl().toString(),
    http: "ERR",
    state: "HTTP_ERROR",
    detail: String(error?.message || error),
    checkedAt: referenceDate.toISOString(),
  }), canary);
  return canary.health;
}

function canRunGdeltCanary(cache, nowMs) {
  const canary = ensureCanaryCache(cache);
  return !canary.pending && nowMs >= nextCanaryAttemptMs(canary);
}

async function runGdeltCanary(cache, { fetchImpl, timeoutMs, referenceDate, delayMs = GDELT_CANARY_DELAY_MS }) {
  const nowMs = referenceDate.getTime();
  if (!canRunGdeltCanary(cache, nowMs)) return ensureCanaryCache(cache).health;
  const canary = ensureCanaryCache(cache);
  canary.pending = true;
  try {
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    const result = await fetchGdeltCanary({ fetchImpl, timeoutMs, referenceDate });
    return recordCanaryResult(canary, result, nowMs);
  } finally {
    canary.pending = false;
  }
}

function scheduleGdeltCanary(cache, { fetchImpl, timeoutMs, referenceDate, delayMs = GDELT_CANARY_DELAY_MS }) {
  const nowMs = referenceDate.getTime();
  if (!canRunGdeltCanary(cache, nowMs)) return;
  const canary = ensureCanaryCache(cache);
  canary.pending = true;
  setTimeout(() => {
    fetchGdeltCanary({ fetchImpl, timeoutMs, referenceDate })
      .then((result) => {
        recordCanaryResult(canary, result, nowMs);
      })
      .catch((error) => {
        recordCanaryException(canary, error, referenceDate, nowMs);
      })
      .finally(() => {
        canary.pending = false;
      });
  }, Math.max(0, delayMs)).unref?.();
}

export async function getWorldPulse({
  cache = moduleCache,
  fetchImpl = fetch,
  now,
  cacheTtlMs,
  gdeltTimeoutMs,
  rssTimeoutMs,
  ngramsTimeoutMs,
  gdeltCanaryDelayMs,
  awaitGdeltCanary = false,
  rssFeeds,
} = {}) {
  const servedAt = nowDate(now);
  const nowMs = servedAt.getTime();
  const ttl = Math.max(CACHE_TTL_MS, cacheTtlMs || cacheTtlFromEnv());
  const effectiveGdeltTimeout = gdeltTimeoutMs || numberFromEnv("WORLD_PULSE_GDELT_TIMEOUT_MS", GDELT_TIMEOUT_MS);
  const effectiveRssTimeout = rssTimeoutMs || numberFromEnv("WORLD_PULSE_RSS_TIMEOUT_MS", RSS_TIMEOUT_MS);
  const effectiveNgramsTimeout = ngramsTimeoutMs || numberFromEnv("WORLD_PULSE_NGRAMS_TIMEOUT_MS", NGRAMS_TIMEOUT_MS);
  const effectiveCanaryDelay = Number.isFinite(Number(gdeltCanaryDelayMs))
    ? Math.max(0, Number(gdeltCanaryDelayMs))
    : numberFromEnv("WORLD_PULSE_GDELT_CANARY_DELAY_MS", GDELT_CANARY_DELAY_MS);
  const feeds = Array.isArray(rssFeeds) && rssFeeds.length > 0 ? rssFeeds : parseRssFeedOverrides();

  if (cache?.payload && cache.expiresAt > nowMs) {
    return cloneForCacheHit(cache.payload, servedAt, cache.expiresAt, { staleExpiresAt: cache.staleExpiresAt, canaryHealth: ensureCanaryCache(cache).health });
  }

  const generatedAt = servedAt.toISOString();
  const [rss, ngrams] = await Promise.all([
    fetchRssFallback({ fetchImpl, timeoutMs: effectiveRssTimeout, feeds, referenceDate: servedAt }),
    fetchWebNgramsToc({ cache, fetchImpl, timeoutMs: effectiveNgramsTimeout, referenceDate: servedAt }),
  ]);

  let canaryHealth = ensureCanaryCache(cache).health;
  if (awaitGdeltCanary) {
    canaryHealth = await runGdeltCanary(cache, {
      fetchImpl,
      timeoutMs: effectiveGdeltTimeout,
      referenceDate: servedAt,
      delayMs: effectiveCanaryDelay,
    });
  } else {
    scheduleGdeltCanary(cache, {
      fetchImpl,
      timeoutMs: effectiveGdeltTimeout,
      referenceDate: servedAt,
      delayMs: effectiveCanaryDelay,
    });
  }

  const sourceHealth = [...(rss.health || []), ngrams.health, canaryHealth].filter(Boolean);
  if (rss.ok) {
    const payload = buildDataPayload({
      state: "ok",
      stateLabel: "OK — RSS public",
      generatedAt,
      source: {
        active: "RSS_PUBLIC",
        name: "RSS public — flux opérationnels",
        feeds: rss.okFeeds,
        status: "OK",
        trends: ngrams.ok ? "OK" : ngrams.health?.state || "UNKNOWN",
        gdeltDocCanary: canaryHealth?.state || "NOT_CHECKED",
      },
      query: QUERY,
      articles: rss.articles,
      sourceHealth,
      globalTrends: ngrams.trends,
      rssStats: {
        fetchedArticles: rss.fetchedArticles,
        truncatedArticles: rss.truncatedArticles,
      },
      cacheTtlMs: ttl,
      notice: "RSS public est la source opérationnelle temps réel. Les tendances globales proviennent de GDELT Web N-Grams TOC ; GDELT DOC est limité à un canari technique horaire.",
    });
    saveCache(cache, payload, nowMs, ttl);
    return payload;
  }

  const refreshErrors = [...(rss.errors || []), ngrams.error].filter(Boolean);
  if (cache?.payload && cache.staleExpiresAt > nowMs) {
    return cloneForCacheHit(cache.payload, servedAt, cache.expiresAt, {
      status: "stale-if-error",
      staleExpiresAt: cache.staleExpiresAt,
      refreshErrors,
      canaryHealth: ensureCanaryCache(cache).health,
    });
  }

  return buildUnavailablePayload({
    generatedAt,
    rssErrors: rss.errors,
    feeds,
    sourceHealth,
    globalTrends: ngrams.trends,
    trendsError: ngrams.error,
    canaryError: canaryHealth?.state && canaryHealth.state !== "OK" ? { source: "GDELT_DOC_CANARY", reason: canaryHealth.state, detail: canaryHealth.detail } : null,
    cacheTtlMs: ttl,
  });
}

export function assertDashboardPayload(payload) {
  const errors = [];
  const requireObject = (name, value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) errors.push(`${name} object missing`);
  };
  const requireArray = (name, value) => {
    if (!Array.isArray(value)) errors.push(`${name} array missing`);
  };

  requireObject("payload", payload);
  requireObject("counts", payload?.counts);
  requireObject("groupings", payload?.groupings);
  requireObject("dataScopes", payload?.dataScopes);
  requireObject("source", payload?.source);
  requireArray("articles", payload?.articles);
  requireArray("sourceHealth", payload?.sourceHealth);
  requireArray("mediaMarkers", payload?.mediaMarkers);
  requireArray("articleParticles", payload?.articleParticles);
  requireArray("articleClusters", payload?.articleClusters);
  requireArray("offMapArticles", payload?.offMapArticles);

  if (errors.length === 0) {
    const counts = payload.counts;
    const articles = payload.articles;
    const exactCounts = [
      ["articles", articles.length],
      ["rssArticles", articles.length],
      ["articleParticles", payload.articleParticles.length],
      ["articleClusters", payload.articleClusters.length],
      ["offMapArticles", payload.offMapArticles.length],
      ["mediaMarkers", payload.mediaMarkers.length],
    ];
    for (const [key, expected] of exactCounts) {
      if (counts[key] !== expected) errors.push(`counts.${key}=${counts[key]} expected ${expected}`);
    }
    if (articles.length > 0 && payload.state === "unavailable") {
      errors.push("articles present while state is unavailable");
    }
    if (articles.length > 0 && payload.source?.active === "none") {
      errors.push("articles present while source.active is none");
    }
  }

  if (errors.length > 0) {
    throw new Error(`DashboardPayload invalid: ${errors.join("; ")}`);
  }
  return payload;
}

export async function getWorldPulseDashboardPayload(options = {}) {
  return assertDashboardPayload(await getWorldPulse(options));
}

export function getWorldPulseSourceHealthSnapshot({ cache = moduleCache, now } = {}) {
  const servedAt = nowDate(now);
  const payload = cache?.payload || null;
  const generatedAtMs = Date.parse(payload?.generatedAt || "");
  return {
    state: payload ? "ok" : "empty",
    generatedAt: payload?.generatedAt || null,
    servedAt: servedAt.toISOString(),
    freshnessSeconds: Number.isFinite(generatedAtMs) ? Math.max(0, Math.floor((servedAt.getTime() - generatedAtMs) / 1000)) : null,
    cache: {
      status: payload ? "memory" : "empty",
      expiresAt: cache?.expiresAt ? new Date(cache.expiresAt).toISOString() : null,
      staleExpiresAt: cache?.staleExpiresAt ? new Date(cache.staleExpiresAt).toISOString() : null,
    },
    items: mergeCanaryHealth(Array.isArray(payload?.sourceHealth) ? JSON.parse(JSON.stringify(payload.sourceHealth)) : [], cache?.canary?.health),
    globalTrends: payload?.globalTrends ? JSON.parse(JSON.stringify(payload.globalTrends)) : emptyWebNgramsTrends(),
  };
}

export function responseHeadersForPayload(payload) {
  if (payload?.state === "unavailable") {
    return { "Cache-Control": "no-store, max-age=0" };
  }
  const ttl = Math.max(900, Number(payload?.cache?.ttlSeconds || 900));
  return {
    "Cache-Control": `public, max-age=0, s-maxage=${ttl}, stale-while-revalidate=${ttl}, stale-if-error=${Math.floor(STALE_IF_ERROR_MS / 1000)}`,
  };
}
