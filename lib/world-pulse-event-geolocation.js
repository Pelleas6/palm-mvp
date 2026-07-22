import {
  administrativeAreasForCountry,
  resolveVerifiedSourceCountry,
} from "./world-pulse-geography.js";

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
  AT: ["Austria", "Österreich", "Autriche"],
  BE: ["Belgium", "Belgique"],
  NL: ["Netherlands", "Holland", "Hollande", "Pays-Bas"],
  PL: ["Poland", "Polska", "Pologne"],
  PT: ["Portugal"],
  RO: ["Romania", "Roumanie"],
  CH: ["Switzerland", "Suisse"],
  SE: ["Sweden", "Suède"],
  NO: ["Norway", "Norvège"],
  DK: ["Denmark", "Danemark"],
  FI: ["Finland", "Finlande"],
  IE: ["Ireland", "Irlande"],
  GR: ["Greece", "Grèce"],
  CZ: ["Czechia", "Czech Republic", "Tchéquie"],
  HU: ["Hungary", "Hongrie"],
  CD: ["DR Congo", "Democratic Republic of the Congo", "Democratic Republic of Congo", "République démocratique du Congo", "Republique democratique du Congo"],
  GH: ["Ghana"],
  ET: ["Ethiopia", "Éthiopie"],
  SD: ["Sudan", "Soudan"],
  MA: ["Morocco", "Maroc"],
  TN: ["Tunisia", "Tunisie"],
  UG: ["Uganda", "Ouganda"],
  TZ: ["Tanzania", "Tanzanie"],
  RW: ["Rwanda"],
  SN: ["Senegal", "Sénégal"],
  CI: ["Ivory Coast", "Côte d'Ivoire", "Cote d'Ivoire"],
  CM: ["Cameroon", "Cameroun"],
  ML: ["Mali"],
  MZ: ["Mozambique"],
  LY: ["Libya", "Libye"],
  SO: ["Somalia", "Somalie"],
  SS: ["South Sudan", "Soudan du Sud"],
  IQ: ["Iraq", "Irak"],
  JO: ["Jordan", "Jordanie"],
  LB: ["Lebanon", "Liban"],
  SY: ["Syria", "Syrie"],
  YE: ["Yemen", "Yémen"],
  OM: ["Oman"],
  KW: ["Kuwait", "Koweït"],
  BH: ["Bahrain", "Bahreïn"],
  PS: ["Palestine", "Palestinian Territories", "Territoires palestiniens"],
  AF: ["Afghanistan"],
  MY: ["Malaysia", "Malaisie"],
  KH: ["Cambodia", "Cambodge"],
  MM: ["Myanmar", "Burma", "Birmanie"],
  LK: ["Sri Lanka"],
  KZ: ["Kazakhstan"],
  UZ: ["Uzbekistan", "Ouzbékistan"],
  KP: ["North Korea", "Corée du Nord"],
  TW: ["Taiwan", "Taïwan"],
  LA: ["Laos"],
  MN: ["Mongolia", "Mongolie"],
  PE: ["Peru", "Pérou"],
  VE: ["Venezuela"],
  EC: ["Ecuador", "Équateur"],
  BO: ["Bolivia", "Bolivie"],
  UY: ["Uruguay"],
  PY: ["Paraguay"],
  CR: ["Costa Rica"],
  CU: ["Cuba"],
  GT: ["Guatemala"],
  PA: ["Panama", "Panamá"],
  PG: ["Papua New Guinea", "Papouasie-Nouvelle-Guinée"],
  FJ: ["Fiji", "Fidji"],
  SB: ["Solomon Islands", "Îles Salomon"],
});

// Les flux retenus sont aussi lus en espagnol, portugais et indonésien. Ces
// formes restent des noms explicites de pays (jamais une déduction du média),
// ce qui améliore la couverture sans dégrader la prudence de la carte.
const EVENT_COUNTRY_LOCAL_ALIASES = Object.freeze({
  US: ["Estados Unidos", "Amerika Serikat"],
  GB: ["Reino Unido"],
  DE: ["Alemania", "Alemanha", "Jerman"],
  ES: ["Espanha", "Spanyol"],
  MX: ["Meksiko"],
  ZA: ["Sudáfrica", "Africa do Sul", "Afrika Selatan"],
  CG: ["República del Congo", "Republik Kongo"],
  DZ: ["Argelia", "Argélia", "Aljazair"],
  EG: ["Egipto", "Egito", "Mesir"],
  KE: ["Kenia", "Quênia"],
  TR: ["Turquía", "Turki"],
  UA: ["Ucrania", "Ucrânia"],
  RU: ["Rusia", "Rússia"],
  CN: ["Tiongkok"],
  TH: ["Tailandia", "Tailândia"],
  VN: ["Vietnã"],
  PH: ["Filipinas", "Filipina"],
  JP: ["Japón", "Japão", "Jepang"],
  KR: ["Corea del Sur", "Coreia do Sul", "Korea Selatan"],
  AU: ["Austrália"],
  NZ: ["Nueva Zelanda", "Nova Zelândia", "Selandia Baru"],
  SG: ["Singapur", "Singapura"],
  AE: ["Emiratos Árabes Unidos", "Emirados Árabes Unidos", "Emirat Arab"],
  QA: ["Catar", "Katar"],
  SA: ["Arabia Saudita", "Arábia Saudita", "Arab Saudi"],
  IR: ["Irán"],
  AT: ["Áustria"],
  BE: ["Bélgica", "Belgia"],
  NL: ["Países Bajos", "Paises Bajos", "Belanda"],
  PL: ["Polonia", "Polônia", "Polandia"],
  RO: ["Rumania", "Romênia"],
  CH: ["Suiza", "Suíça"],
  SE: ["Suecia", "Suécia", "Swedia"],
  NO: ["Noruega", "Norwegia"],
  DK: ["Dinamarca"],
  FI: ["Finlandia", "Finlândia"],
  GR: ["Grecia", "Grécia", "Yunani"],
  CZ: ["República Checa", "República Tcheca", "Ceko"],
  HU: ["Hungría", "Hungria", "Hungaria"],
  ET: ["Etiopía", "Etiópia", "Ethiopia"],
  SD: ["Sudán", "Sudao"],
  MA: ["Marruecos", "Marrocos"],
  TN: ["Túnez", "Tunísia"],
  CI: ["Costa de Marfil", "Pantai Gading"],
  CM: ["Camerún", "Kamerun"],
  MZ: ["Moçambique", "Mozambik"],
  SO: ["Somalia"],
  SS: ["Sudán del Sur", "Sudão do Sul", "Sudan Selatan"],
  IQ: ["Irak"],
  JO: ["Jordania", "Yordania"],
  LB: ["Líbano", "Lebanon"],
  SY: ["Siria", "Suriah"],
  YE: ["Yemen", "Yaman"],
  KW: ["Kuwait"],
  BH: ["Baréin", "Bahrein"],
  PS: ["Palestina"],
  AF: ["Afganistán", "Afeganistão"],
  KH: ["Camboya", "Kamboja"],
  MM: ["Myanmar", "Birmania"],
  LK: ["Sri Lanka"],
  KZ: ["Kazajistán", "Cazaquistão"],
  UZ: ["Uzbekistán", "Uzbequistão"],
  KP: ["Corea del Norte", "Coreia do Norte", "Korea Utara"],
  TW: ["Taiwán", "Taiwan"],
  LA: ["Laos"],
  MN: ["Mongolia"],
  PE: ["Perú"],
  VE: ["Venezuela"],
  EC: ["Ecuador", "Ecuateur"],
  BO: ["Bolivia", "Bolívia"],
  UY: ["Uruguay"],
  PY: ["Paraguay"],
  CR: ["Costa Rica"],
  CU: ["Cuba"],
  GT: ["Guatemala"],
  PA: ["Panamá"],
  PG: ["Papúa Nueva Guinea", "Papua Nugini"],
  FJ: ["Fiji"],
  SB: ["Islas Salomón", "Kepulauan Solomon"],
});

const EVENT_COUNTRY_REGISTRY_ALIASES = Object.freeze(Object.fromEntries(
  Object.entries(EVENT_COUNTRY_ALIASES).map(([code, aliases]) => [
    code,
    [...aliases, ...(EVENT_COUNTRY_LOCAL_ALIASES[code] || [])],
  ])
));

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
  AT: ["Vienna", "Vienne"],
  BE: ["Brussels", "Bruxelles"],
  NL: ["Amsterdam"],
  PL: ["Warsaw", "Varsovie"],
  PT: ["Lisbon", "Lisbonne"],
  RO: ["Bucharest", "Bucarest"],
  CH: ["Bern", "Berne"],
  SE: ["Stockholm"],
  NO: ["Oslo"],
  DK: ["Copenhagen", "Copenhague"],
  FI: ["Helsinki", "Helsinki"],
  IE: ["Dublin"],
  GR: ["Athens", "Athènes"],
  CZ: ["Prague", "Praga"],
  HU: ["Budapest"],
  CD: ["Kinshasa"],
  GH: ["Accra"],
  ET: ["Addis Ababa", "Addis-Abeba"],
  SD: ["Khartoum", "Khartum"],
  MA: ["Rabat"],
  TN: ["Tunis"],
  UG: ["Kampala"],
  TZ: ["Dar es Salaam"],
  RW: ["Kigali"],
  SN: ["Dakar"],
  CI: ["Yamoussoukro"],
  CM: ["Yaounde", "Yaoundé"],
  ML: ["Bamako"],
  MZ: ["Maputo"],
  LY: ["Tripoli", "Tripoli"],
  SO: ["Mogadishu", "Mogadiscio"],
  SS: ["Juba"],
  IQ: ["Baghdad", "Bagdad"],
  JO: ["Amman"],
  LB: ["Beirut", "Beyrouth"],
  SY: ["Damascus", "Damas"],
  YE: ["Sanaa", "Sana'a", "Sanaa"],
  OM: ["Muscat", "Mascate"],
  KW: ["Kuwait City", "Koweït City"],
  BH: ["Manama"],
  PS: ["Ramallah", "Ramallah"],
  AF: ["Kabul", "Kaboul"],
  MY: ["Kuala Lumpur"],
  KH: ["Phnom Penh"],
  MM: ["Naypyidaw", "Nay Pyi Taw"],
  LK: ["Colombo"],
  KZ: ["Astana"],
  UZ: ["Tashkent", "Tachkent"],
  KP: ["Pyongyang"],
  TW: ["Taipei", "Taipei"],
  LA: ["Vientiane"],
  MN: ["Ulaanbaatar", "Oulan-Bator"],
  PE: ["Lima"],
  VE: ["Caracas"],
  EC: ["Quito"],
  BO: ["La Paz"],
  UY: ["Montevideo", "Montevideo"],
  PY: ["Asuncion", "Asunción"],
  CU: ["Havana", "La Havane"],
  GT: ["Guatemala City", "Guatemala City"],
  PA: ["Panama City", "Panama City"],
  PG: ["Port Moresby"],
  FJ: ["Suva"],
  SB: ["Honiara"],
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

const COUNTRY_REGISTRY = Object.freeze(buildRegistry(EVENT_COUNTRY_REGISTRY_ALIASES, "country_name"));
const CAPITAL_REGISTRY = Object.freeze(buildRegistry(EVENT_CAPITAL_ALIASES, "capital_city"));

const AMBIGUOUS_STANDALONE_ADMINISTRATIVE_ALIASES = new Set([
  "central", "east", "eastern", "georgia", "north", "northern", "south", "southern", "washington", "west", "western",
]);
const STANDALONE_ADMINISTRATIVE_COUNTRIES = ["US", "CA", "AU", "BR", "CN", "DE", "IN", "MX", "ZA"];
const administrativeRegistryCache = new Map();

function administrativeRegistryForCountry(countryCode) {
  const code = String(countryCode || "").toUpperCase();
  if (!code) return [];
  const cached = administrativeRegistryCache.get(code);
  if (cached) return cached;

  const country = resolveVerifiedSourceCountry(code, "eventCountry");
  const registry = administrativeAreasForCountry(code)
    .flatMap((area) => area.aliases.map((alias) => ({
      alias: trimText(alias, 120),
      normalizedAlias: normalizeForMatch(alias),
      location: country,
      area,
      matchType: "administrative_area",
    })))
    .filter((entry) => entry.location?.code && entry.normalizedAlias.length >= 4)
    .filter((entry) => !AMBIGUOUS_STANDALONE_ADMINISTRATIVE_ALIASES.has(entry.normalizedAlias))
    .sort((left, right) => right.normalizedAlias.length - left.normalizedAlias.length || left.alias.localeCompare(right.alias, "fr"));

  const frozen = Object.freeze(registry);
  administrativeRegistryCache.set(code, frozen);
  return frozen;
}

const STANDALONE_ADMINISTRATIVE_REGISTRY = Object.freeze(
  STANDALONE_ADMINISTRATIVE_COUNTRIES.flatMap((countryCode) => administrativeRegistryForCountry(countryCode)),
);

function articleContexts(article) {
  return [
    { field: "title", text: trimText(article?.title, 500) },
    { field: "summary", text: trimText(article?.summary, 900) },
    { field: "content", text: trimText(article?.content, 900) },
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
    eventAdministrativeArea: null,
    eventAdministrativeAreaCode: null,
    administrativeEvidence: null,
    confidence: 0,
    matchType: "none",
    evidence: null,
  };
}

function administrativeEvidenceFromMatch(match) {
  if (!match?.area?.code) return null;
  return {
    field: match.context.field,
    matchedText: match.alias,
    registry: match.context.field === "content"
      ? "natural_earth_admin_1_rss_content"
      : "natural_earth_admin_1",
    context: trimText(match.context.text, 240),
  };
}

function eventFromMatch(match, contexts) {
  if (!match?.location?.code) return nonLocalizedEvent();
  const administrativeMatch = findBestMatch(contexts, administrativeRegistryForCountry(match.location.code));
  return {
    eventCountry: match.location.label,
    eventCountryIso: match.location.code,
    eventAdministrativeArea: administrativeMatch?.area?.label || null,
    eventAdministrativeAreaCode: administrativeMatch?.area?.code || null,
    administrativeEvidence: administrativeEvidenceFromMatch(administrativeMatch),
    confidence: match.matchType === "country_name"
      ? (match.context.field === "content" ? 0.86 : 0.95)
      : (match.context.field === "content" ? 0.8 : 0.82),
    matchType: match.matchType,
    evidence: {
      field: match.context.field,
      matchedText: match.alias,
      registry: match.matchType === "country_name"
        ? (match.context.field === "content" ? "local_event_country_names_rss_content" : "local_event_country_names")
        : (match.context.field === "content" ? "local_unambiguous_capitals_rss_content" : "local_unambiguous_capitals"),
      context: trimText(match.context.text, 240),
    },
  };
}

function eventFromAdministrativeMatch(match) {
  if (!match?.location?.code || !match?.area?.code) return nonLocalizedEvent();
  return {
    eventCountry: match.location.label,
    eventCountryIso: match.location.code,
    eventAdministrativeArea: match.area.label,
    eventAdministrativeAreaCode: match.area.code,
    administrativeEvidence: administrativeEvidenceFromMatch(match),
    confidence: match.context.field === "content" ? 0.78 : 0.9,
    matchType: "administrative_area",
    evidence: administrativeEvidenceFromMatch(match),
  };
}

export function resolveEventCountryFromArticle(article = {}) {
  const contexts = articleContexts(article);
  if (contexts.length === 0) return nonLocalizedEvent();
  const countryMatch = findBestMatch(contexts, COUNTRY_REGISTRY);
  if (countryMatch) return eventFromMatch(countryMatch, contexts);
  const capitalMatch = findBestMatch(contexts, CAPITAL_REGISTRY);
  if (capitalMatch) return eventFromMatch(capitalMatch, contexts);
  const administrativeMatch = findBestMatch(contexts, STANDALONE_ADMINISTRATIVE_REGISTRY);
  if (administrativeMatch) return eventFromAdministrativeMatch(administrativeMatch);
  return nonLocalizedEvent();
}

export function hasVerifiedEventCountry(article = {}) {
  return Boolean(article?.eventCountryIso && article?.eventCountry && article?.confidence > 0);
}
