import { gunzipSync } from "node:zlib";

import { WORLD_PULSE_QUERY_TERMS, findWorldPulseSignalCategory } from "./world-pulse-signals.js";

const GDELT_ENDPOINT = "https://api.gdeltproject.org/api/v2/doc/doc";
const GDELT_WEB_NGRAMS_BASE_URL = "https://storage.googleapis.com/data.gdeltproject.org/gdeltv5/weblegacy/ngrams";
const QUERY_TERMS = WORLD_PULSE_QUERY_TERMS;
const QUERY = `(${QUERY_TERMS.join(" OR ")})`;
const MAX_RECORDS = 50;
const MAX_ARTICLES_PER_MEDIA = 5;
const RECENT_WINDOW_MS = 48 * 60 * 60 * 1000;
const TIME_SPAN = "12h";
const CACHE_TTL_MS = 15 * 60 * 1000;
const STALE_IF_ERROR_MS = 24 * 60 * 60 * 1000;
const GDELT_CANARY_INTERVAL_MS = 60 * 60 * 1000;
const GDELT_CANARY_DELAY_MS = 30 * 1000;
const GDELT_WEB_NGRAMS_CYCLE_MINUTES = 15;
const GDELT_WEB_NGRAMS_DELAY_MINUTES = 5;
const GDELT_TIMEOUT_MS = 30 * 1000;
const RSS_TIMEOUT_MS = 2500;
const NGRAMS_TIMEOUT_MS = 2500;
const MEDIA_MARKER_MIN_SIZE = 6;
const MEDIA_MARKER_MAX_SIZE = 8;
const ARTICLE_PARTICLE_MIN_SIZE = 3;
const ARTICLE_PARTICLE_MAX_SIZE = 5;
const NEARBY_MEDIA_CLUSTER_DISTANCE = 7.5;
const NEARBY_ARTICLE_CLUSTER_DISTANCE = 7.5;

const DEFAULT_RSS_FEEDS = [
  { name: "BBC News World", region: "Europe", url: "https://feeds.bbci.co.uk/news/world/rss.xml", language: "English", sourceCountry: "United Kingdom" },
  { name: "France 24 Monde", region: "Europe", url: "https://www.france24.com/fr/rss", language: "French", sourceCountry: "France" },
  { name: "Deutsche Welle Top Stories", region: "Europe", url: "https://rss.dw.com/rdf/rss-en-all", language: "English", sourceCountry: "Germany" },
  { name: "Africanews", region: "Africa", url: "https://www.africanews.com/feed/rss", language: "English", sourceCountry: "Republic of Congo" },
  { name: "Al Jazeera", region: "Middle East", url: "https://www.aljazeera.com/xml/rss/all.xml", language: "English", sourceCountry: "Qatar" },
  { name: "The Hindu International", region: "Asia", url: "https://www.thehindu.com/news/international/feeder/default.rss", language: "English", sourceCountry: "India" },
  { name: "NHK World", region: "Asia", url: "https://www3.nhk.or.jp/rss/news/cat0.xml", language: "English", sourceCountry: "Japan" },
  { name: "ABC Australia World", region: "Oceania", url: "https://www.abc.net.au/news/feed/51120/rss.xml", language: "English", sourceCountry: "Australia" },
  { name: "NPR World", region: "North America", url: "https://feeds.npr.org/1004/rss.xml", language: "English", sourceCountry: "United States" },
  { name: "CBC World", region: "North America", url: "https://www.cbc.ca/cmlink/rss-world", language: "English", sourceCountry: "Canada" },
  { name: "Agência Brasil", region: "South America", url: "https://agenciabrasil.ebc.com.br/rss.xml", language: "Portuguese", sourceCountry: "Brazil" },
];


const SOURCE_LOCATION_ENTRIES = [
  { code: "US", label: "États-Unis", x: 22, y: 42, aliases: ["US", "USA", "United States", "United States of America", "Etats-Unis", "États-Unis"] },
  { code: "GB", label: "Royaume-Uni", x: 46, y: 36, aliases: ["GB", "UK", "United Kingdom", "Great Britain", "Britain", "England", "Royaume-Uni"] },
  { code: "FR", label: "France", x: 48, y: 43, aliases: ["FR", "France"] },
  { code: "DE", label: "Allemagne", x: 50, y: 40, aliases: ["DE", "Germany", "Deutschland", "Allemagne"] },
  { code: "IT", label: "Italie", x: 51, y: 47, aliases: ["IT", "Italy", "Italia", "Italie"] },
  { code: "ES", label: "Espagne", x: 46, y: 48, aliases: ["ES", "Spain", "España", "Espagne"] },
  { code: "CA", label: "Canada", x: 22, y: 28, aliases: ["CA", "Canada"] },
  { code: "BR", label: "Brésil", x: 36, y: 69, aliases: ["BR", "Brazil", "Brasil", "Brésil"] },
  { code: "MX", label: "Mexique", x: 19, y: 52, aliases: ["MX", "Mexico", "Mexique"] },
  { code: "AR", label: "Argentine", x: 32, y: 82, aliases: ["AR", "Argentina", "Argentine"] },
  { code: "CL", label: "Chili", x: 29, y: 78, aliases: ["CL", "Chile", "Chili"] },
  { code: "CO", label: "Colombie", x: 27, y: 62, aliases: ["CO", "Colombia", "Colombie"] },
  { code: "ZA", label: "Afrique du Sud", x: 55, y: 80, aliases: ["ZA", "South Africa", "Afrique du Sud"] },
  { code: "NG", label: "Nigeria", x: 51, y: 61, aliases: ["NG", "Nigeria", "Nigéria"] },
  { code: "CG", label: "République du Congo", x: 53, y: 66, aliases: ["CG", "Congo", "Republic of Congo", "République du Congo", "Republique du Congo"] },
  { code: "EG", label: "Égypte", x: 56, y: 53, aliases: ["EG", "Egypt", "Égypte", "Egypte"] },
  { code: "KE", label: "Kenya", x: 59, y: 66, aliases: ["KE", "Kenya"] },
  { code: "TR", label: "Turquie", x: 56, y: 47, aliases: ["TR", "Turkey", "Türkiye", "Turquie"] },
  { code: "UA", label: "Ukraine", x: 56, y: 40, aliases: ["UA", "Ukraine"] },
  { code: "RU", label: "Russie", x: 66, y: 31, aliases: ["RU", "Russia", "Russian Federation", "Russie"] },
  { code: "CN", label: "Chine", x: 74, y: 47, aliases: ["CN", "China", "Chine"] },
  { code: "IN", label: "Inde", x: 68, y: 58, aliases: ["IN", "India", "Inde"] },
  { code: "JP", label: "Japon", x: 84, y: 48, aliases: ["JP", "Japan", "Japon"] },
  { code: "KR", label: "Corée du Sud", x: 80, y: 49, aliases: ["KR", "South Korea", "Korea", "Corée du Sud", "Coree du Sud"] },
  { code: "AU", label: "Australie", x: 80, y: 77, aliases: ["AU", "Australia", "Australie"] },
  { code: "ID", label: "Indonésie", x: 75, y: 68, aliases: ["ID", "Indonesia", "Indonésie", "Indonesie"] },
  { code: "SG", label: "Singapour", x: 73, y: 65, aliases: ["SG", "Singapore", "Singapour"] },
  { code: "AE", label: "Émirats arabes unis", x: 61, y: 57, aliases: ["AE", "United Arab Emirates", "UAE", "Émirats arabes unis", "Emirats arabes unis"] },
  { code: "QA", label: "Qatar", x: 60, y: 54, aliases: ["QA", "Qatar"] },
  { code: "SA", label: "Arabie saoudite", x: 59, y: 57, aliases: ["SA", "Saudi Arabia", "Arabie saoudite"] },
  { code: "IL", label: "Israël", x: 57, y: 52, aliases: ["IL", "Israel", "Israël"] },
];

const SOURCE_LOCATIONS_BY_KEY = new Map(
  SOURCE_LOCATION_ENTRIES.flatMap((entry) => [entry.code, entry.label, ...entry.aliases].map((alias) => [normalizeLocationKey(alias), entry]))
);

const SOURCE_REGION_BY_CODE = {
  US: "North America",
  CA: "North America",
  MX: "North America",
  GB: "Europe",
  FR: "Europe",
  DE: "Europe",
  IT: "Europe",
  ES: "Europe",
  UA: "Europe",
  RU: "Europe/Asia",
  BR: "South America",
  AR: "South America",
  CL: "South America",
  CO: "South America",
  ZA: "Africa",
  NG: "Africa",
  CG: "Africa",
  EG: "Africa",
  KE: "Africa",
  TR: "Middle East",
  AE: "Middle East",
  QA: "Middle East",
  SA: "Middle East",
  IL: "Middle East",
  CN: "Asia",
  IN: "Asia",
  JP: "Asia",
  KR: "Asia",
  ID: "Asia",
  SG: "Asia",
  AU: "Oceania",
};

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
  const key = normalizeLocationKey(value);
  if (!key || key === "non precise" || key === "rss public" || key === "unknown") return null;
  const entry = SOURCE_LOCATIONS_BY_KEY.get(key);
  if (!entry) return null;
  return {
    label: entry.label,
    code: entry.code,
    x: entry.x,
    y: entry.y,
    basis,
  };
}

function sourceRegionForCountry(value, fallback = "Non précisée") {
  const key = normalizeLocationKey(value);
  const entry = key ? SOURCE_LOCATIONS_BY_KEY.get(key) : null;
  return (entry && SOURCE_REGION_BY_CODE[entry.code]) || trimText(fallback, 80) || "Non précisée";
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

function limitArticlesPerMedia(articles, limit = MAX_ARTICLES_PER_MEDIA) {
  const counts = new Map();
  const limited = [];
  for (const article of sortArticlesByDateDesc(articles)) {
    const key = mediaKeyForArticle(article);
    const count = counts.get(key) || 0;
    if (count >= limit) continue;
    counts.set(key, count + 1);
    limited.push(article);
  }
  return limited;
}

function capArticlesAcrossMedia(articles, maxRecords) {
  const buckets = new Map();
  for (const article of sortArticlesByDateDesc(articles)) {
    const key = mediaKeyForArticle(article);
    const bucket = buckets.get(key) || [];
    bucket.push(article);
    buckets.set(key, bucket);
  }
  const orderedBuckets = [...buckets.values()].sort((left, right) => {
    const delta = articleTimestamp(right[0]) - articleTimestamp(left[0]);
    if (delta !== 0) return delta;
    return mediaNameForArticle(left[0]).localeCompare(mediaNameForArticle(right[0]), "fr");
  });
  const capped = [];
  for (let round = 0; capped.length < maxRecords; round += 1) {
    let added = false;
    for (const bucket of orderedBuckets) {
      if (bucket[round]) {
        capped.push(bucket[round]);
        added = true;
        if (capped.length >= maxRecords) break;
      }
    }
    if (!added) break;
  }
  return sortArticlesByDateDesc(capped);
}

function buildSourceHealth({ source, region, url, http = null, xml = false, articles = 0, recent = false, state = "UNKNOWN", detail = "", checkedAt = null }) {
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
  };
}

function classifyMediaSignal(...parts) {
  const signal = findWorldPulseSignalCategory(...parts.map((part) => trimText(part, 1000)));
  return {
    label: signal.label,
    labelType: "classification estimative",
    labelBasis: signal.label === "Autre signal" ? "aucun mot-clé prioritaire détecté" : "mots-clés du titre/description",
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
  const signal = classifyMediaSignal(title, domain, sourceCountry);
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

function distinctCount(articles, field) {
  const values = new Set();
  for (const article of articles) {
    values.add(trimText(article?.[field], 100) || "Non précisé");
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
  return counts[0]?.label || "Autre signal";
}

function compareArticlesForMap(left, right) {
  const leftLocation = left?.sourceLocation?.code || "";
  const rightLocation = right?.sourceLocation?.code || "";
  const locationDelta = leftLocation.localeCompare(rightLocation, "fr");
  if (locationDelta !== 0) return locationDelta;
  const mediaDelta = mediaNameForArticle(left).localeCompare(mediaNameForArticle(right), "fr");
  if (mediaDelta !== 0) return mediaDelta;
  const timeDelta = articleTimestamp(right) - articleTimestamp(left);
  if (timeDelta !== 0) return timeDelta;
  return String(left?.id || left?.url || left?.title || "").localeCompare(String(right?.id || right?.url || right?.title || ""), "fr");
}

function offsetNearLocation(location, index, count, { baseRadius = 1.25, growth = 0.28, maxRadius = 5.6 } = {}) {
  if (count <= 1) {
    return { x: location.x, y: location.y };
  }
  const angle = (-Math.PI / 2) + (2 * Math.PI * index) / count;
  const radius = Math.min(maxRadius, baseRadius + count * growth);
  return {
    x: clamp(location.x + Math.cos(angle) * radius, 4, 96),
    y: clamp(location.y + Math.sin(angle) * radius * 0.72, 8, 88),
  };
}

function spiralAroundLocation(location, index, count) {
  if (count <= 1) {
    return { x: location.x, y: location.y };
  }
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const angle = (-Math.PI / 2) + index * goldenAngle;
  const radius = count <= 4 ? 3.8 : Math.min(6.8, 0.85 + Math.sqrt(index + 1) * 0.7);
  return {
    x: clamp(location.x + Math.cos(angle) * radius, 4, 96),
    y: clamp(location.y + Math.sin(angle) * radius * 0.72, 8, 88),
  };
}

function locationDistance(left, right) {
  if (!left || !right) return Number.POSITIVE_INFINITY;
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function averageClusterLocation(entries, getLocation) {
  const usable = entries
    .map(getLocation)
    .filter((location) => location && Number.isFinite(location.x) && Number.isFinite(location.y));
  if (usable.length === 0) return null;
  const x = usable.reduce((sum, location) => sum + location.x, 0) / usable.length;
  const y = usable.reduce((sum, location) => sum + location.y, 0) / usable.length;
  return {
    code: "NEARBY_CLUSTER",
    label: "Cluster de coordonnées proches",
    x,
    y,
    basis: "nearbyCoordinateCluster",
  };
}

function clusterByNearbyLocation(entries, getLocation, threshold) {
  const clusters = [];
  for (const entry of entries) {
    const location = getLocation(entry);
    if (!location || !Number.isFinite(location.x) || !Number.isFinite(location.y)) continue;
    let target = clusters.find((cluster) => locationDistance(cluster.center, location) <= threshold);
    if (!target) {
      target = clusters.find((cluster) => cluster.entries.some((clusterEntry) => locationDistance(getLocation(clusterEntry), location) <= threshold));
    }
    if (!target) {
      clusters.push({ entries: [entry], center: { ...location } });
      continue;
    }
    target.entries.push(entry);
    target.center = averageClusterLocation(target.entries, getLocation) || target.center;
  }
  return clusters;
}

function buildMediaMarkers(articles) {
  const groups = new Map();
  for (const article of articles) {
    const location = article?.sourceLocation;
    if (!location || !Number.isFinite(location.x) || !Number.isFinite(location.y)) continue;
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
  const clusteredGroups = clusterByNearbyLocation(
    [...groups.values()].sort((left, right) => left.location.x - right.location.x || left.location.y - right.location.y || left.mediaName.localeCompare(right.mediaName, "fr")),
    (group) => group.location,
    NEARBY_MEDIA_CLUSTER_DISTANCE
  );
  for (const cluster of clusteredGroups) {
    const entries = cluster.entries;
    entries.sort((left, right) => left.mediaName.localeCompare(right.mediaName, "fr"));
    const count = entries.length;
    entries.forEach((entry, index) => {
      const articleCount = entry.articles.length;
      const origin = count > 1 ? cluster.center : entry.location;
      const { x, y } = offsetNearLocation(origin, index, count, { baseRadius: 2.6, growth: 0.55, maxRadius: 7.4 });
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
        x: Number(x.toFixed(2)),
        y: Number(y.toFixed(2)),
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
        positioning: "media_source_marker",
      });
    });
  }

  return points.sort((left, right) => right.articleCount - left.articleCount || left.mediaName.localeCompare(right.mediaName, "fr"));
}

function buildArticleParticles(articles) {
  const particles = [];
  const clusteredArticles = clusterByNearbyLocation(
    [...articles].filter((item) => item?.sourceLocation).sort(compareArticlesForMap),
    (article) => article.sourceLocation,
    NEARBY_ARTICLE_CLUSTER_DISTANCE
  );
  for (const cluster of clusteredArticles) {
    const entries = cluster.entries;
    entries.sort(compareArticlesForMap);
    const count = entries.length;
    entries.forEach((article, index) => {
      const origin = count > 1 ? cluster.center : article.sourceLocation;
      const { x, y } = spiralAroundLocation(origin, index, count);
      const sizeOffset = stableHash(`${article.id || article.url}:particle-size`) % (ARTICLE_PARTICLE_MAX_SIZE - ARTICLE_PARTICLE_MIN_SIZE + 1);
      particles.push({
        id: `${article.id || stableHash(article.url).toString(36)}:particle`,
        kind: "article",
        title: article.title,
        mediaName: mediaNameForArticle(article),
        sourceType: article.sourceType,
        domain: article.domain,
        sourceCountry: article.sourceCountry,
        sourceRegion: article.sourceRegion,
        location: article.sourceLocation,
        x: Number(x.toFixed(2)),
        y: Number(y.toFixed(2)),
        size: ARTICLE_PARTICLE_MIN_SIZE + sizeOffset,
        label: article.label || "Autre signal",
        seenAt: article.seenAt || null,
        url: article.url || null,
        positioning: "article_source_particle",
      });
    });
  }
  return particles;
}

function buildMapPoints(articles) {
  return buildMediaMarkers(articles);
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

async function readResponseText(response, { allowGzip = false } = {}) {
  const buffer = Buffer.from(await response.arrayBuffer());
  if (allowGzip && buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b) {
    return gunzipSync(buffer).toString("utf8");
  }
  return buffer.toString("utf8");
}

function looksRateLimited(status, body = "") {
  return status === 429 || /rate\s*-?limit|too many requests|quota|throttl/i.test(String(body || ""));
}

function gdeltTimestamp(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}00`;
}

function webNgramsTimestamp(referenceDate) {
  const slot = new Date(referenceDate.getTime() - GDELT_WEB_NGRAMS_DELAY_MINUTES * 60 * 1000);
  slot.setUTCSeconds(0, 0);
  slot.setUTCMinutes(Math.floor(slot.getUTCMinutes() / GDELT_WEB_NGRAMS_CYCLE_MINUTES) * GDELT_WEB_NGRAMS_CYCLE_MINUTES);
  return gdeltTimestamp(slot);
}

function webNgramsTocUrl(referenceDate, baseUrl = process.env.WORLD_PULSE_NGRAMS_BASE_URL || GDELT_WEB_NGRAMS_BASE_URL) {
  const safeBase = String(baseUrl || GDELT_WEB_NGRAMS_BASE_URL).replace(/\/+$/, "");
  const timestamp = webNgramsTimestamp(referenceDate);
  return {
    timestamp,
    url: `${safeBase}/${timestamp}.toc.json.gz`,
  };
}

function describeFetchError(error, source, timeoutReason) {
  const isAbort = error?.name === "AbortError";
  return {
    source,
    reason: isAbort ? timeoutReason : `Erreur réseau ${source}`,
    detail: trimText(String(error?.message || error), 600),
  };
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
        state: error?.name === "AbortError" ? "TIMEOUT" : "HTTP_ERROR",
        detail: described.detail,
        checkedAt,
      }),
    };
  }

  const raw = await readResponseText(response);
  if (looksRateLimited(response.status, raw)) {
    return {
      ok: false,
      error: {
        source: "GDELT_DOC_CANARY",
        url: url.toString(),
        status: response.status,
        reason: "Rate limiting GDELT DOC détecté",
        detail: trimText(raw, 600),
      },
      health: buildSourceHealth({
        source: "GDELT 2.0 DOC API canary",
        region: "Global canary ≤1/h",
        url: url.toString(),
        http: response.status,
        state: "RATE_LIMITED",
        detail: raw,
        checkedAt,
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
  const perMediaArticles = limitArticlesPerMedia(normalizedArticles);
  const articles = capArticlesAcrossMedia(perMediaArticles, numberFromEnv("WORLD_PULSE_MAX_RECORDS", MAX_RECORDS));

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
  const entries = blocks.length > 0 ? blocks : atomBlocks;

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
    const signal = classifyMediaSignal(title, description, feed.name);
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
    const articles = limitArticlesPerMedia(parsedArticles, MAX_ARTICLES_PER_MEDIA);
    return { ok: true, feed, status: response.status, articles, health };
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
        state: error?.name === "AbortError" ? "TIMEOUT" : "HTTP_ERROR",
        detail: described.detail,
      }),
    };
  }
}

async function fetchRssFallback({ fetchImpl, timeoutMs, feeds, referenceDate }) {
  const settled = await Promise.allSettled(feeds.map((feed) => fetchSingleRssFeed(feed, { fetchImpl, timeoutMs, referenceDate })));
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
  const perMediaArticles = limitArticlesPerMedia(dedupeArticles(results.flatMap((result) => (result.ok ? result.articles : []))));
  const articles = capArticlesAcrossMedia(perMediaArticles, numberFromEnv("WORLD_PULSE_MAX_RECORDS", MAX_RECORDS));
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
  return { ok: articles.length > 0, articles, errors, okFeeds, health };
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
  const signal = classifyMediaSignal(title, language, hostnameFromUrl(url));
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

function buildWebNgramsTrends(entries, { timestamp, url }) {
  const documents = entries.map(normalizeTocEntry).filter(Boolean);
  const labels = countBy(documents, "label");
  const languages = countBy(documents, "language");
  return {
    source: "GDELT_WEB_NGRAMS_TOC",
    url,
    timestamp,
    cycleMinutes: GDELT_WEB_NGRAMS_CYCLE_MINUTES,
    delayMinutes: GDELT_WEB_NGRAMS_DELAY_MINUTES,
    documents: documents.length,
    labels,
    languages,
    topTitles: documents.slice(0, 8).map((document) => ({
      title: document.title,
      url: document.url,
      language: document.language,
      label: document.label,
    })),
  };
}

function emptyWebNgramsTrends({ timestamp = null, url = null } = {}) {
  return {
    source: "GDELT_WEB_NGRAMS_TOC",
    url,
    timestamp,
    cycleMinutes: GDELT_WEB_NGRAMS_CYCLE_MINUTES,
    delayMinutes: GDELT_WEB_NGRAMS_DELAY_MINUTES,
    documents: 0,
    labels: [],
    languages: [],
    topTitles: [],
  };
}

async function fetchWebNgramsToc({ fetchImpl, timeoutMs, referenceDate }) {
  const { timestamp, url } = webNgramsTocUrl(referenceDate);
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
      return {
        ok: false,
        trends: emptyWebNgramsTrends({ timestamp, url }),
        error: { source: "GDELT_WEB_NGRAMS_TOC", url, status: response.status, reason: "Rate limiting GDELT Web N-Grams détecté", detail: trimText(raw, 600) },
        health: buildSourceHealth({ source: "GDELT Web N-Grams TOC", region: "Global trends", url, http: response.status, state: "RATE_LIMITED", detail: raw, checkedAt: referenceDate.toISOString() }),
      };
    }
    if (!response.ok) {
      return {
        ok: false,
        trends: emptyWebNgramsTrends({ timestamp, url }),
        error: { source: "GDELT_WEB_NGRAMS_TOC", url, status: response.status, reason: `HTTP GDELT Web N-Grams ${response.status}`, detail: trimText(raw, 600) },
        health: buildSourceHealth({ source: "GDELT Web N-Grams TOC", region: "Global trends", url, http: response.status, state: "HTTP_ERROR", detail: raw, checkedAt: referenceDate.toISOString() }),
      };
    }
    let entries;
    try {
      entries = parseTocJsonLines(raw);
    } catch (error) {
      return {
        ok: false,
        trends: emptyWebNgramsTrends({ timestamp, url }),
        error: { source: "GDELT_WEB_NGRAMS_TOC", url, status: response.status, reason: "TOC GDELT Web N-Grams invalide", detail: trimText(`${String(error?.message || error)} — ${raw}`, 600) },
        health: buildSourceHealth({ source: "GDELT Web N-Grams TOC", region: "Global trends", url, http: response.status, state: "INVALID_RESPONSE", detail: `${String(error?.message || error)} — ${raw}`, checkedAt: referenceDate.toISOString() }),
      };
    }
    const trends = buildWebNgramsTrends(entries, { timestamp, url });
    if (trends.documents === 0) {
      return {
        ok: false,
        trends,
        error: { source: "GDELT_WEB_NGRAMS_TOC", url, status: response.status, reason: "TOC GDELT Web N-Grams sans document exploitable" },
        health: buildSourceHealth({ source: "GDELT Web N-Grams TOC", region: "Global trends", url, http: response.status, xml: true, articles: 0, state: "INVALID_RESPONSE", detail: "Aucun document avec titre et URL HTTP(S).", checkedAt: referenceDate.toISOString() }),
      };
    }
    return {
      ok: true,
      trends,
      health: buildSourceHealth({ source: "GDELT Web N-Grams TOC", region: "Global trends", url, http: response.status, xml: true, articles: trends.documents, recent: true, state: "OK", checkedAt: referenceDate.toISOString() }),
    };
  } catch (error) {
    const described = describeFetchError(error, "GDELT_WEB_NGRAMS_TOC", "Timeout GDELT Web N-Grams TOC");
    return {
      ok: false,
      trends: emptyWebNgramsTrends({ timestamp, url }),
      error: { ...described, url },
      health: buildSourceHealth({ source: "GDELT Web N-Grams TOC", region: "Global trends", url, http: "ERR", state: error?.name === "AbortError" ? "TIMEOUT" : "HTTP_ERROR", detail: described.detail, checkedAt: referenceDate.toISOString() }),
    };
  }
}

function buildDataPayload({ state, stateLabel, generatedAt, source, query, articles, notice, cacheTtlMs, cacheStatus = "miss", sourceHealth = [], globalTrends = emptyWebNgramsTrends() }) {
  const domains = countBy(articles, "domain");
  const countries = countBy(articles, "sourceCountry");
  const sourceRegions = countBy(articles, "sourceRegion");
  const mediaSources = countBy(articles, "mediaName");
  const locations = countBySourceLocation(articles);
  const languages = countBy(articles, "language");
  const labels = countBy(articles, "label");
  const localized = articles.filter((article) => article?.sourceLocation).length;
  const mediaMarkers = buildMediaMarkers(articles);
  const articleParticles = buildArticleParticles(articles);
  const unavailableSources = sourceHealth.filter((entry) => !["OK"].includes(entry.state)).length;
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
      mediaSources: distinctCount(articles, "mediaName"),
      countries: distinctCount(articles, "sourceCountry"),
      sourceRegions: distinctCount(articles, "sourceRegion"),
      sourceLocations: distinctSourceLocationCount(articles),
      languages: distinctCount(articles, "language"),
      labels: distinctCount(articles, "label"),
      localized,
      unlocalized: Math.max(0, articles.length - localized),
      mediaMarkers: mediaMarkers.length,
      articleParticles: articleParticles.length,
      mapPoints: mediaMarkers.length,
      unavailableSources,
    },
    groupings: {
      domains,
      mediaSources,
      countries,
      sourceRegions,
      locations,
      languages,
      labels,
    },
    mapPoints: mediaMarkers,
    mediaMarkers,
    articleParticles,
    globalTrends,
    sourceHealth,
    articles,
    notice,
  };
}

function buildUnavailablePayload({ generatedAt, rssErrors, feeds, cacheTtlMs, sourceHealth = [], globalTrends = emptyWebNgramsTrends(), trendsError = null, canaryError = null }) {
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
      sourceRegions: 0,
      sourceLocations: 0,
      languages: 0,
      labels: 0,
      localized: 0,
      unlocalized: 0,
      mediaMarkers: 0,
      articleParticles: 0,
      mapPoints: 0,
      unavailableSources: sourceHealth.filter((entry) => entry.state !== "OK").length,
    },
    groupings: {
      domains: [],
      mediaSources: [],
      countries: [],
      sourceRegions: [],
      locations: [],
      languages: [],
      labels: [],
    },
    mapPoints: [],
    mediaMarkers: [],
    articleParticles: [],
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
    cache.canary = { lastCheckedAt: 0, health: null, pending: false };
  }
  return cache.canary;
}

function canRunGdeltCanary(cache, nowMs) {
  const canary = ensureCanaryCache(cache);
  return !canary.pending && nowMs - (canary.lastCheckedAt || 0) >= GDELT_CANARY_INTERVAL_MS;
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
    canary.lastCheckedAt = nowMs;
    canary.health = result.health || null;
    return canary.health;
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
        canary.lastCheckedAt = nowMs;
        canary.health = result.health || null;
      })
      .catch((error) => {
        canary.lastCheckedAt = nowMs;
        canary.health = buildSourceHealth({
          source: "GDELT 2.0 DOC API canary",
          region: "Global canary ≤1/h",
          url: buildGdeltUrl().toString(),
          http: "ERR",
          state: "HTTP_ERROR",
          detail: String(error?.message || error),
          checkedAt: referenceDate.toISOString(),
        });
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
    fetchWebNgramsToc({ fetchImpl, timeoutMs: effectiveNgramsTimeout, referenceDate: servedAt }),
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
