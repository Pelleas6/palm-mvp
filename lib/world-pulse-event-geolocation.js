import { resolveVerifiedSourceCountry } from "./world-pulse-geography.js";

const EVENT_COUNTRY_ALIASES = Object.freeze({
  US: ["United States", "United States of America", "États-Unis", "Etats-Unis"],
  GB: ["United Kingdom", "Royaume-Uni", "Great Britain"],
  FR: ["France"],
  DE: ["Germany", "Deutschland", "Allemagne"],
  IT: ["Italy", "Italia", "Italie"],
  ES: ["Spain", "España", "Espagne"],
  CA: ["Canada"],
  BR: ["Brazil", "Brasil", "Brésil"],
  PK: ["Pakistan"],
  MX: ["Mexico", "Mexique"],
  AR: ["Argentina", "Argentine"],
  CL: ["Chile", "Chili"],
  CO: ["Colombia", "Colombie"],
  ZA: ["South Africa", "Afrique du Sud"],
  NG: ["Nigeria", "Nigéria"],
  CG: ["Republic of Congo", "République du Congo", "Republique du Congo"],
  DZ: ["Algeria", "Algérie", "Algerie"],
  EG: ["Egypt", "Égypte", "Egypte"],
  KE: ["Kenya"],
  TR: ["Turkey", "Türkiye", "Turquie"],
  UA: ["Ukraine"],
  RU: ["Russia", "Russian Federation", "Russie"],
  CN: ["China", "Chine"],
  BD: ["Bangladesh"],
  NP: ["Nepal", "Népal"],
  TH: ["Thailand", "Thaïlande", "Thailande"],
  VN: ["Vietnam", "Viet Nam", "Viêt Nam"],
  PH: ["Philippines"],
  IN: ["India", "Inde"],
  JP: ["Japan", "Japon"],
  KR: ["South Korea", "Corée du Sud", "Coree du Sud"],
  AU: ["Australia", "Australie"],
  NZ: ["New Zealand", "Nouvelle-Zélande", "Nouvelle Zelande"],
  ID: ["Indonesia", "Indonésie", "Indonesie"],
  SG: ["Singapore", "Singapour"],
  AE: ["United Arab Emirates", "Emirats arabes unis", "Émirats arabes unis"],
  QA: ["Qatar"],
  SA: ["Saudi Arabia", "Arabie saoudite"],
  IL: ["Israel", "Israël"],
  IR: ["Iran", "Islamic Republic of Iran", "République islamique d'Iran", "Republique islamique d Iran"],
});

const EVENT_CAPITAL_ALIASES = Object.freeze({
  US: ["Washington DC", "Washington D.C."],
  GB: ["London"],
  FR: ["Paris"],
  DE: ["Berlin"],
  IT: ["Rome"],
  ES: ["Madrid"],
  CA: ["Ottawa"],
  BR: ["Brasilia", "Brasília"],
  PK: ["Islamabad"],
  MX: ["Mexico City", "Ciudad de Mexico", "Ciudad de México"],
  AR: ["Buenos Aires"],
  CO: ["Bogota", "Bogotá"],
  ZA: ["Pretoria"],
  NG: ["Abuja"],
  DZ: ["Algiers", "Alger"],
  EG: ["Cairo", "Le Caire"],
  KE: ["Nairobi"],
  TR: ["Ankara"],
  UA: ["Kyiv", "Kiev"],
  RU: ["Moscow", "Moscou"],
  CN: ["Beijing", "Pekin", "Pékin"],
  BD: ["Dhaka", "Dacca"],
  NP: ["Kathmandu", "Katmandou"],
  TH: ["Bangkok"],
  VN: ["Hanoi", "Hanoï"],
  PH: ["Manila", "Manille"],
  IN: ["New Delhi", "Nouvelle Delhi"],
  JP: ["Tokyo"],
  KR: ["Seoul", "Séoul"],
  AU: ["Canberra"],
  NZ: ["Wellington"],
  ID: ["Jakarta"],
  SG: ["Singapore", "Singapour"],
  AE: ["Abu Dhabi"],
  QA: ["Doha"],
  SA: ["Riyadh", "Riyad"],
  IR: ["Tehran", "Téhéran", "Teheran"],
});

function trimText(value, max = 500) {
  if (typeof value !== "string") return "";
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function normalizeForMatch(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function aliasPattern(normalizedAlias) {
  return new RegExp(`(^|\\s)${escapeRegExp(normalizedAlias).replace(/\\\s\+/g, "\\s+")}(?=$|\\s)`);
}

function buildRegistry(rawAliases, matchType) {
  return Object.entries(rawAliases).flatMap(([iso, aliases]) => {
    const location = resolveVerifiedSourceCountry(iso, "eventCountry");
    if (!location?.code) return [];
    return aliases
      .map((alias) => ({ alias: trimText(alias, 120), normalizedAlias: normalizeForMatch(alias) }))
      .filter((entry) => entry.normalizedAlias.length >= 4)
      .map((entry) => ({
        ...entry,
        matchType,
        location,
        normalizedLength: entry.normalizedAlias.length,
      }));
  }).sort((left, right) => right.normalizedLength - left.normalizedLength || left.alias.localeCompare(right.alias, "fr"));
}

const COUNTRY_REGISTRY = Object.freeze(buildRegistry(EVENT_COUNTRY_ALIASES, "country_name"));
const CAPITAL_REGISTRY = Object.freeze(buildRegistry(EVENT_CAPITAL_ALIASES, "capital_city"));

function articleContexts(article) {
  return [
    { field: "title", text: trimText(article?.title, 500) },
    { field: "summary", text: trimText(article?.summary, 900) },
  ].filter((context) => context.text);
}

function findBestMatch(contexts, registry) {
  const matches = [];
  for (let contextIndex = 0; contextIndex < contexts.length; contextIndex += 1) {
    const context = contexts[contextIndex];
    const normalizedText = normalizeForMatch(context.text);
    if (!normalizedText) continue;
    for (const entry of registry) {
      const match = aliasPattern(entry.normalizedAlias).exec(normalizedText);
      if (!match) continue;
      matches.push({
        ...entry,
        context,
        contextIndex,
        index: match.index + (match[1] ? match[1].length : 0),
      });
    }
  }
  return matches.sort((left, right) => (
    left.contextIndex - right.contextIndex
    || left.index - right.index
    || right.normalizedLength - left.normalizedLength
    || left.location.code.localeCompare(right.location.code, "fr")
  ))[0] || null;
}

function nonLocalizedEvent() {
  return {
    eventCountry: null,
    eventCountryIso: null,
    confidence: 0,
    matchType: "none",
    evidence: null,
  };
}

function eventFromMatch(match) {
  if (!match?.location?.code) return nonLocalizedEvent();
  return {
    eventCountry: match.location.label,
    eventCountryIso: match.location.code,
    confidence: match.matchType === "country_name" ? 0.95 : 0.82,
    matchType: match.matchType,
    evidence: {
      field: match.context.field,
      matchedText: match.alias,
      registry: match.matchType === "country_name" ? "local_event_country_names" : "local_unambiguous_capitals",
      context: trimText(match.context.text, 240),
    },
  };
}

export function resolveEventCountryFromArticle(article = {}) {
  const contexts = articleContexts(article);
  if (contexts.length === 0) return nonLocalizedEvent();
  const countryMatch = findBestMatch(contexts, COUNTRY_REGISTRY);
  if (countryMatch) return eventFromMatch(countryMatch);
  const capitalMatch = findBestMatch(contexts, CAPITAL_REGISTRY);
  if (capitalMatch) return eventFromMatch(capitalMatch);
  return nonLocalizedEvent();
}

export function hasVerifiedEventCountry(article = {}) {
  return Boolean(article?.eventCountryIso && article?.eventCountry && article?.confidence > 0);
}
