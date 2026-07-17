import { WORLD_PULSE_UNCLASSIFIED_LABEL, isWorldPulseClassifiedLabel } from "./world-pulse-signals.js";

export const WORLD_PULSE_FILTER_ALL = "all";

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function trimText(value, max = 160) {
  if (typeof value !== "string") return "";
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function normalizeFilterValue(value) {
  const text = trimText(String(value ?? ""), 120);
  return text && text !== WORLD_PULSE_FILTER_ALL ? text : WORLD_PULSE_FILTER_ALL;
}

export function normalizeWorldPulseFilters(filters = {}) {
  return {
    region: normalizeFilterValue(filters.region),
    country: normalizeFilterValue(filters.country),
    source: normalizeFilterValue(filters.source),
    category: normalizeFilterValue(filters.category),
  };
}

function sourceLocationForArticle(article) {
  const location = article?.sourceLocation;
  if (!location?.code) return null;
  return {
    code: trimText(location.code, 8).toUpperCase(),
    label: trimText(location.label, 80) || trimText(article?.sourceCountry, 80) || location.code,
    verified: location.verified !== false,
  };
}

function sourceCountryKey(article) {
  const location = sourceLocationForArticle(article);
  return location?.code || trimText(article?.sourceCountry, 80) || "Non précisé";
}

function sourceCountryLabel(article) {
  const location = sourceLocationForArticle(article);
  return location?.label || trimText(article?.sourceCountry, 80) || "Non précisé";
}

function eventLocationForArticle(article) {
  const code = trimText(article?.eventCountryIso, 8).toUpperCase();
  const label = trimText(article?.eventCountry, 80);
  if (!code || !label) return null;
  return {
    code,
    label,
    verified: true,
  };
}

function eventCountryKey(article) {
  const location = eventLocationForArticle(article);
  return location?.code || "NON_LOCALISE";
}

function eventCountryLabel(article) {
  const location = eventLocationForArticle(article);
  return location?.label || "Non localisé";
}

function mediaNameForArticle(article) {
  return trimText(article?.mediaName || article?.sourceType || article?.domain, 120) || "Source non précisée";
}

function categoryForArticle(article) {
  return trimText(article?.label, 120) || WORLD_PULSE_UNCLASSIFIED_LABEL;
}

function timestampMs(article) {
  const parsed = Date.parse(article?.seenAt || "");
  return Number.isFinite(parsed) ? parsed : null;
}

function compareArticlesByDateDesc(left, right) {
  const leftTime = timestampMs(left) ?? -Infinity;
  const rightTime = timestampMs(right) ?? -Infinity;
  if (rightTime !== leftTime) return rightTime - leftTime;
  return String(left?.title || "").localeCompare(String(right?.title || ""), "fr");
}

function countBy(items, getValue, decorate = () => ({})) {
  const counts = new Map();
  for (const item of items) {
    const value = trimText(getValue(item), 140) || "Non précisé";
    const current = counts.get(value) || { label: value, value, count: 0, ...decorate(value, item) };
    current.count += 1;
    counts.set(value, current);
  }
  return [...counts.values()].sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, "fr"));
}

function distinctCount(items, getValue) {
  return new Set(items.map(getValue).filter(Boolean)).size;
}

function filterOptions(articles) {
  return {
    regions: countBy(articles, (article) => article.sourceRegion || "Non précisée"),
    countries: countBy(articles.filter((article) => eventLocationForArticle(article)?.code), eventCountryKey, (_value, article) => ({
      label: eventCountryLabel(article),
      code: eventLocationForArticle(article)?.code || null,
      verified: Boolean(eventLocationForArticle(article)?.code),
    })).map((option) => ({ ...option, value: option.code || option.value })),
    sources: countBy(articles, mediaNameForArticle),
    categories: countBy(articles, categoryForArticle, (value) => ({
      thematic: isWorldPulseClassifiedLabel(value),
    })),
  };
}

export function articleMatchesWorldPulseFilters(article, filters = {}) {
  const normalized = normalizeWorldPulseFilters(filters);
  if (normalized.region !== WORLD_PULSE_FILTER_ALL && trimText(article?.sourceRegion, 120) !== normalized.region) return false;
  if (normalized.country !== WORLD_PULSE_FILTER_ALL) {
    const location = eventLocationForArticle(article);
    const countryValue = location?.code || eventCountryLabel(article);
    if (countryValue !== normalized.country && eventCountryLabel(article) !== normalized.country) return false;
  }
  if (normalized.source !== WORLD_PULSE_FILTER_ALL && mediaNameForArticle(article) !== normalized.source) return false;
  if (normalized.category !== WORLD_PULSE_FILTER_ALL && categoryForArticle(article) !== normalized.category) return false;
  return true;
}

function articleIdFromParticle(point) {
  return trimText(point?.articleId, 140) || trimText(point?.id, 180).replace(/:particle$/, "");
}

function articleIdsFromCluster(cluster) {
  const ids = new Set();
  for (const entry of safeArray(cluster?.articles)) {
    const articleId = trimText(entry?.articleId, 140) || trimText(entry?.id, 180).replace(/:particle$/, "");
    if (articleId) ids.add(articleId);
  }
  return ids;
}

function groupKeyForArticle(article) {
  return `${sourceCountryKey(article)}:${mediaNameForArticle(article)}`;
}

function groupKeyForMarker(marker) {
  return `${trimText(marker?.location?.code || marker?.sourceCountry, 80)}:${trimText(marker?.mediaName, 120)}`;
}

function dominantCategory(articles) {
  return countBy(articles, categoryForArticle)[0]?.label || WORLD_PULSE_UNCLASSIFIED_LABEL;
}

function latestTitles(articles, limit = 5) {
  return [...articles]
    .sort(compareArticlesByDateDesc)
    .slice(0, limit)
    .map((article) => ({
      id: article.id || null,
      title: trimText(article.title, 220) || "Article sans titre",
      url: article.url || null,
      mediaName: mediaNameForArticle(article),
      seenAt: article.seenAt || null,
      label: categoryForArticle(article),
    }));
}

function latestSeenAt(articles) {
  const latest = [...articles].sort(compareArticlesByDateDesc).find((article) => timestampMs(article) != null);
  return latest?.seenAt || null;
}

function deriveMediaMarkers(payload, filteredArticles) {
  const originalMarkers = new Map(safeArray(payload?.mediaMarkers).map((marker) => [groupKeyForMarker(marker), marker]));
  const groups = new Map();
  for (const article of filteredArticles) {
    if (!sourceLocationForArticle(article)?.code) continue;
    const key = groupKeyForArticle(article);
    const current = groups.get(key) || [];
    current.push(article);
    groups.set(key, current);
  }
  return [...groups.entries()].map(([key, articles]) => {
    const marker = originalMarkers.get(key);
    if (!marker) return null;
    return {
      ...marker,
      articleCount: articles.length,
      label: dominantCategory(articles),
      latestSeenAt: latestSeenAt(articles),
      sampleTitles: latestTitles(articles, 3).map((article) => article.title),
    };
  }).filter(Boolean).sort((left, right) => right.articleCount - left.articleCount || left.mediaName.localeCompare(right.mediaName, "fr"));
}

function deriveArticleParticles(payload, filteredArticleIds) {
  return safeArray(payload?.articleParticles)
    .filter((particle) => filteredArticleIds.has(articleIdFromParticle(particle)))
    .map((particle) => ({ ...particle, articleId: articleIdFromParticle(particle) }));
}

function deriveArticleClusters(payload, filteredArticleIds) {
  return safeArray(payload?.articleClusters).map((cluster) => {
    const representedIds = articleIdsFromCluster(cluster);
    const representedArticles = safeArray(cluster?.articles).filter((entry) => {
      const articleId = trimText(entry?.articleId, 140) || trimText(entry?.id, 180).replace(/:particle$/, "");
      return filteredArticleIds.has(articleId);
    });
    if (representedIds.size === 0) {
      return filteredArticleIds.size > 0 ? cluster : null;
    }
    if (representedArticles.length < 2) return null;
    return {
      ...cluster,
      count: representedArticles.length,
      articleCount: representedArticles.length,
      articles: representedArticles,
      mediaNames: [...new Set(representedArticles.map((entry) => trimText(entry.mediaName, 120)).filter(Boolean))].sort((left, right) => left.localeCompare(right, "fr")),
      sampleTitles: representedArticles.slice(0, 5).map((entry) => entry.title).filter(Boolean),
    };
  }).filter(Boolean).sort((left, right) => Number(right.count || 0) - Number(left.count || 0) || String(left.label || "").localeCompare(String(right.label || ""), "fr"));
}

function keepClusterVisibility(particles, clusters) {
  const visibleClusterIds = new Set(clusters.map((cluster) => cluster.id));
  return particles.map((particle) => {
    if (!particle.clusterId || visibleClusterIds.has(particle.clusterId)) return particle;
    const copy = { ...particle };
    delete copy.clusterId;
    return copy;
  });
}

function buildCounts(articles, particles, clusters, offMapArticles) {
  const eventCountries = distinctCount(articles, (article) => eventLocationForArticle(article)?.code);
  return {
    articles: articles.length,
    mediaSources: distinctCount(articles, mediaNameForArticle),
    countries: eventCountries,
    eventCountries,
    sourceCountries: distinctCount(articles, sourceCountryKey),
    sourceRegions: distinctCount(articles, (article) => trimText(article.sourceRegion, 120) || "Non précisée"),
    categories: distinctCount(articles, categoryForArticle),
    articleParticles: particles.length,
    articleClusters: clusters.length,
    offMapArticles: offMapArticles.length,
    eventLocalizedArticles: particles.length,
    eventUnlocalizedArticles: offMapArticles.length,
    rssClassifiedArticles: articles.filter((article) => isWorldPulseClassifiedLabel(categoryForArticle(article))).length,
    rssUnclassifiedArticles: articles.filter((article) => !isWorldPulseClassifiedLabel(categoryForArticle(article))).length,
  };
}

function buildGroupings(articles, offMapArticles) {
  return {
    domains: countBy(articles, (article) => article.domain || "Non précisé"),
    mediaSources: countBy(articles, mediaNameForArticle),
    countries: countBy(articles.filter((article) => eventLocationForArticle(article)?.code), eventCountryKey, (_value, article) => ({
      label: eventCountryLabel(article),
      code: eventLocationForArticle(article)?.code || null,
    })).map((item) => ({ ...item, value: item.code || item.value })),
    eventCountries: countBy(articles.filter((article) => eventLocationForArticle(article)?.code), eventCountryKey, (_value, article) => ({
      label: eventCountryLabel(article),
      code: eventLocationForArticle(article)?.code || null,
    })).map((item) => ({ ...item, value: item.code || item.value })),
    sourceCountries: countBy(articles, sourceCountryKey, (_value, article) => ({
      label: sourceCountryLabel(article),
      code: sourceLocationForArticle(article)?.code || null,
    })).map((item) => ({ ...item, value: item.code || item.value })),
    sourceRegions: countBy(articles, (article) => article.sourceRegion || "Non précisée"),
    locations: countBy(articles.filter((article) => eventLocationForArticle(article)?.code), eventCountryKey, (_value, article) => ({
      label: eventCountryLabel(article),
      code: eventLocationForArticle(article)?.code || null,
    })).map((item) => ({ ...item, value: item.code || item.value })),
    sourceLocations: countBy(articles.filter((article) => sourceLocationForArticle(article)?.code), sourceCountryKey, (_value, article) => ({
      label: sourceCountryLabel(article),
      code: sourceLocationForArticle(article)?.code || null,
    })).map((item) => ({ ...item, value: item.code || item.value })),
    languages: countBy(articles, (article) => article.language || "Non précisé"),
    labels: countBy(articles, categoryForArticle, (value) => ({ thematic: isWorldPulseClassifiedLabel(value) })),
    rssCategories: countBy(articles, categoryForArticle, (value) => ({ thematic: isWorldPulseClassifiedLabel(value) })),
    offMapReasons: countBy(offMapArticles, (article) => article.reasonLabel || article.reason || "Hors carte"),
  };
}

function deriveOffMapArticles(payload, filteredArticleIds) {
  return safeArray(payload?.offMapArticles).filter((article) => filteredArticleIds.has(trimText(article?.id, 140)));
}

function buildNonDeterminedSummary(articles) {
  const nonDetermined = articles.filter((article) => !isWorldPulseClassifiedLabel(categoryForArticle(article)));
  const classified = articles.length - nonDetermined.length;
  return {
    label: WORLD_PULSE_UNCLASSIFIED_LABEL,
    count: nonDetermined.length,
    examples: latestTitles(nonDetermined, 3),
    coveragePct: articles.length > 0 ? Math.round((classified / articles.length) * 100) : 0,
    notice: nonDetermined.length > 0
      ? `${nonDetermined.length} article(s) sans mot-clé du registre déterministe : ${WORLD_PULSE_UNCLASSIFIED_LABEL} n'est pas interprété comme un thème utile.`
      : "Tous les articles filtrés correspondent au registre déterministe.",
  };
}

function buildTimeWindow(validDates, latestMs, windowHours) {
  const windowMs = windowHours * 60 * 60 * 1000;
  const oldestMs = validDates[0] ?? null;
  const threshold = latestMs - windowMs;
  const count = validDates.filter((value) => value >= threshold && value <= latestMs).length;
  const complete = oldestMs != null && oldestMs <= threshold;
  return {
    hours: windowHours,
    count,
    complete,
    message: complete
      ? `Fenêtre ${windowHours} h couverte par les dates RSS reçues.`
      : `Fenêtre ${windowHours} h incomplète : le plus ancien horodatage RSS reçu ne remonte pas à ${windowHours} h avant le dernier article.`,
  };
}

export function buildWorldPulseTimeWindows(articles) {
  const validDates = articles
    .map(timestampMs)
    .filter((value) => value != null)
    .sort((left, right) => left - right);
  const missingDateCount = articles.length - validDates.length;
  if (validDates.length === 0) {
    return {
      validDateCount: 0,
      missingDateCount,
      referenceSeenAt: null,
      oldestSeenAt: null,
      last6h: { hours: 6, count: 0, complete: false, message: "Fenêtre 6 h incomplète : aucun horodatage RSS exploitable." },
      last24h: { hours: 24, count: 0, complete: false, message: "Fenêtre 24 h incomplète : aucun horodatage RSS exploitable." },
      notice: "Lecture temporelle impossible sans dates RSS reçues ; aucune date n'est inventée.",
    };
  }
  const oldestMs = validDates[0];
  const latestMs = validDates.at(-1);
  return {
    validDateCount: validDates.length,
    missingDateCount,
    referenceSeenAt: new Date(latestMs).toISOString(),
    oldestSeenAt: new Date(oldestMs).toISOString(),
    last6h: buildTimeWindow(validDates, latestMs, 6),
    last24h: buildTimeWindow(validDates, latestMs, 24),
    notice: missingDateCount > 0
      ? `${missingDateCount} article(s) sans date RSS exploitable exclus de la lecture temporelle ; seules les dates RSS reçues sont comptées.`
      : "Lecture temporelle calculée exclusivement depuis les dates RSS reçues.",
  };
}

function selectionArticles(payload, filteredArticles, selection, derived) {
  if (!selection?.type) return [];
  if (selection.type === "country") {
    const code = trimText(selection.code || selection.value, 12).toUpperCase();
    return filteredArticles.filter((article) => eventLocationForArticle(article)?.code === code);
  }
  if (selection.type === "marker") {
    const marker = derived.mediaMarkers.find((item) => item.id === selection.id);
    if (!marker) return [];
    const key = groupKeyForMarker(marker);
    return filteredArticles.filter((article) => groupKeyForArticle(article) === key);
  }
  if (selection.type === "cluster") {
    const cluster = derived.articleClusters.find((item) => item.id === selection.id) || safeArray(payload?.articleClusters).find((item) => item.id === selection.id);
    const ids = articleIdsFromCluster(cluster);
    return filteredArticles.filter((article) => ids.has(article.id));
  }
  if (selection.type === "article") {
    return filteredArticles.filter((article) => article.id === selection.id);
  }
  return [];
}

function selectionLabel(selection, articles) {
  if (selection?.type === "country") return `Pays événement : ${eventCountryLabel(articles[0])}`;
  if (selection?.type === "marker") return `Repère média : ${mediaNameForArticle(articles[0])}`;
  if (selection?.type === "cluster") return `Cluster événements : ${eventCountryLabel(articles[0])}`;
  if (selection?.type === "article") return `Article : ${trimText(articles[0]?.title, 120)}`;
  return "Sélection";
}

function buildSelectionSummary(selection, articles) {
  if (!selection?.type || articles.length === 0) return null;
  const eventCountries = countBy(articles.filter((article) => eventLocationForArticle(article)?.code), eventCountryKey, (_value, article) => ({
    code: eventLocationForArticle(article)?.code || null,
    label: eventCountryLabel(article),
  })).map((item) => ({ code: item.code, label: item.label }));
  const sourceCountries = countBy(articles, sourceCountryKey, (_value, article) => ({
    code: sourceLocationForArticle(article)?.code || null,
    label: sourceCountryLabel(article),
  })).map((item) => ({ code: item.code, label: item.label }));
  const isMediaLayer = selection.type === "marker";
  return {
    kind: selection.type,
    id: selection.id || selection.code || selection.value || null,
    label: selectionLabel(selection, articles),
    articleCount: articles.length,
    eventCountries,
    sourceCountries,
    mediaNames: countBy(articles, mediaNameForArticle).map((item) => item.label),
    categories: countBy(articles, categoryForArticle, (value) => ({ thematic: isWorldPulseClassifiedLabel(value) })),
    latestSeenAt: latestSeenAt(articles),
    latestTitles: latestTitles(articles, 5),
    isoVerified: isMediaLayer
      ? articles.every((article) => Boolean(sourceLocationForArticle(article)?.code))
      : articles.every((article) => Boolean(eventLocationForArticle(article)?.code)),
    basis: isMediaLayer
      ? "Pays du média source : couche de provenance séparée, non utilisée comme géolocalisation d'événement."
      : "Pays de l'événement détecté dans le contenu RSS (titre/résumé) ; aucun pays média source n'est utilisé comme secours.",
  };
}

export function deriveWorldPulseExploration(payload = {}, filters = {}, selection = null) {
  const normalizedFilters = normalizeWorldPulseFilters(filters);
  const allArticles = safeArray(payload?.articles);
  const filteredArticles = allArticles.filter((article) => articleMatchesWorldPulseFilters(article, normalizedFilters));
  const filteredArticleIds = new Set(filteredArticles.map((article) => article.id).filter(Boolean));
  const mediaMarkers = deriveMediaMarkers(payload, filteredArticles);
  const rawParticles = deriveArticleParticles(payload, filteredArticleIds);
  const articleClusters = deriveArticleClusters(payload, filteredArticleIds);
  const articleParticles = keepClusterVisibility(rawParticles, articleClusters);
  const offMapArticles = deriveOffMapArticles(payload, filteredArticleIds);
  const derived = { mediaMarkers, articleParticles, articleClusters };
  const selectedArticles = selectionArticles(payload, filteredArticles, selection, derived);

  return {
    filters: normalizedFilters,
    filterOptions: filterOptions(allArticles),
    filteredArticles,
    articles: filteredArticles,
    mediaMarkers,
    articleParticles,
    articleClusters,
    offMapArticles,
    counts: buildCounts(filteredArticles, articleParticles, articleClusters, offMapArticles),
    groupings: buildGroupings(filteredArticles, offMapArticles),
    categories: countBy(filteredArticles, categoryForArticle, (value) => ({ thematic: isWorldPulseClassifiedLabel(value) })),
    nonDetermined: buildNonDeterminedSummary(filteredArticles),
    timeWindows: buildWorldPulseTimeWindows(filteredArticles),
    availableCountryCodes: [...new Set(filteredArticles.map((article) => eventLocationForArticle(article)?.code).filter(Boolean))],
    selection: buildSelectionSummary(selection, selectedArticles),
  };
}
