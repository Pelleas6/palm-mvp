import { geoCentroid, geoContains, geoEquirectangular } from "d3-geo";
import { feature } from "topojson-client";
import worldAtlas from "world-atlas/countries-110m.json" with { type: "json" };
import administrativeBoundariesTopology from "../data/world-pulse-admin-1-3pct.topo.json" with { type: "json" };

export const WORLD_MAP_VIEWBOX = Object.freeze({
  width: 1000,
  height: 500,
  extent: [[8, 8], [992, 492]],
  projection: "geoEquirectangular.fitExtent(Sphere)",
});

export const SOURCE_COUNTRY_REGISTRY = Object.freeze([
  { code: "US", isoNumeric: "840", label: "États-Unis", aliases: ["US", "USA", "United States", "United States of America", "Etats-Unis", "États-Unis"] },
  { code: "GB", isoNumeric: "826", label: "Royaume-Uni", aliases: ["GB", "UK", "United Kingdom", "Great Britain", "Britain", "England", "Royaume-Uni"] },
  { code: "FR", isoNumeric: "250", label: "France", aliases: ["FR", "France"] },
  { code: "DE", isoNumeric: "276", label: "Allemagne", aliases: ["DE", "Germany", "Deutschland", "Allemagne"] },
  { code: "IT", isoNumeric: "380", label: "Italie", aliases: ["IT", "Italy", "Italia", "Italie"] },
  { code: "ES", isoNumeric: "724", label: "Espagne", aliases: ["ES", "Spain", "España", "Espagne"] },
  { code: "CA", isoNumeric: "124", label: "Canada", aliases: ["CA", "Canada"] },
  { code: "BR", isoNumeric: "076", label: "Brésil", aliases: ["BR", "Brazil", "Brasil", "Brésil"] },
  { code: "PK", isoNumeric: "586", label: "Pakistan", aliases: ["PK", "Pakistan"] },
  { code: "MX", isoNumeric: "484", label: "Mexique", aliases: ["MX", "Mexico", "Mexique"] },
  { code: "AR", isoNumeric: "032", label: "Argentine", aliases: ["AR", "Argentina", "Argentine"] },
  { code: "CL", isoNumeric: "152", label: "Chili", aliases: ["CL", "Chile", "Chili"] },
  { code: "CO", isoNumeric: "170", label: "Colombie", aliases: ["CO", "Colombia", "Colombie"] },
  { code: "ZA", isoNumeric: "710", label: "Afrique du Sud", aliases: ["ZA", "South Africa", "Afrique du Sud"] },
  { code: "NG", isoNumeric: "566", label: "Nigeria", aliases: ["NG", "Nigeria", "Nigéria"] },
  { code: "CG", isoNumeric: "178", label: "République du Congo", aliases: ["CG", "Congo", "Republic of Congo", "République du Congo", "Republique du Congo"] },
  { code: "DZ", isoNumeric: "012", label: "Algérie", aliases: ["DZ", "Algeria", "Algérie", "Algerie"] },
  { code: "EG", isoNumeric: "818", label: "Égypte", aliases: ["EG", "Egypt", "Égypte", "Egypte"] },
  { code: "KE", isoNumeric: "404", label: "Kenya", aliases: ["KE", "Kenya"] },
  { code: "TR", isoNumeric: "792", label: "Turquie", aliases: ["TR", "Turkey", "Türkiye", "Turquie"] },
  { code: "UA", isoNumeric: "804", label: "Ukraine", aliases: ["UA", "Ukraine"] },
  { code: "RU", isoNumeric: "643", label: "Russie", aliases: ["RU", "Russia", "Russian Federation", "Russie"] },
  { code: "CN", isoNumeric: "156", label: "Chine", aliases: ["CN", "China", "Chine"] },
  { code: "BD", isoNumeric: "050", label: "Bangladesh", aliases: ["BD", "Bangladesh"] },
  { code: "NP", isoNumeric: "524", label: "Népal", aliases: ["NP", "Nepal", "Népal"] },
  { code: "TH", isoNumeric: "764", label: "Thaïlande", aliases: ["TH", "Thailand", "Thaïlande", "Thailande"] },
  { code: "VN", isoNumeric: "704", label: "Viêt Nam", aliases: ["VN", "Vietnam", "Viet Nam", "Viêt Nam", "Viet Nam"] },
  { code: "PH", isoNumeric: "608", label: "Philippines", aliases: ["PH", "Philippines"] },
  { code: "IN", isoNumeric: "356", label: "Inde", aliases: ["IN", "India", "Inde"] },
  { code: "JP", isoNumeric: "392", label: "Japon", aliases: ["JP", "Japan", "Japon"] },
  { code: "KR", isoNumeric: "410", label: "Corée du Sud", aliases: ["KR", "South Korea", "Korea", "Corée du Sud", "Coree du Sud"] },
  { code: "AU", isoNumeric: "036", label: "Australie", aliases: ["AU", "Australia", "Australie"] },
  { code: "NZ", isoNumeric: "554", label: "Nouvelle-Zélande", aliases: ["NZ", "New Zealand", "Nouvelle-Zélande", "Nouvelle Zelande"] },
  { code: "ID", isoNumeric: "360", label: "Indonésie", aliases: ["ID", "Indonesia", "Indonésie", "Indonesie"] },
  { code: "SG", isoNumeric: "702", label: "Singapour", aliases: ["SG", "Singapore", "Singapour"] },
  { code: "AE", isoNumeric: "784", label: "Émirats arabes unis", aliases: ["AE", "United Arab Emirates", "UAE", "Émirats arabes unis", "Emirats arabes unis"] },
  { code: "QA", isoNumeric: "634", label: "Qatar", aliases: ["QA", "Qatar"] },
  { code: "SA", isoNumeric: "682", label: "Arabie saoudite", aliases: ["SA", "Saudi Arabia", "Arabie saoudite"] },
  { code: "IL", isoNumeric: "376", label: "Israël", aliases: ["IL", "Israel", "Israël"] },
  { code: "IR", isoNumeric: "364", label: "Iran", aliases: ["IR", "Iran", "Islamic Republic of Iran", "République islamique d'Iran", "Republique islamique d Iran"] },
  { code: "AT", isoNumeric: "040", label: "Autriche", aliases: ["AT", "Austria", "Österreich", "Autriche"] },
  { code: "BE", isoNumeric: "056", label: "Belgique", aliases: ["BE", "Belgium", "Belgique"] },
  { code: "NL", isoNumeric: "528", label: "Pays-Bas", aliases: ["NL", "Netherlands", "Holland", "Hollande", "Pays-Bas"] },
  { code: "PL", isoNumeric: "616", label: "Pologne", aliases: ["PL", "Poland", "Polska", "Pologne"] },
  { code: "PT", isoNumeric: "620", label: "Portugal", aliases: ["PT", "Portugal"] },
  { code: "RO", isoNumeric: "642", label: "Roumanie", aliases: ["RO", "Romania", "Roumanie"] },
  { code: "CH", isoNumeric: "756", label: "Suisse", aliases: ["CH", "Switzerland", "Suisse"] },
  { code: "SE", isoNumeric: "752", label: "Suède", aliases: ["SE", "Sweden", "Suède", "Suede"] },
  { code: "NO", isoNumeric: "578", label: "Norvège", aliases: ["NO", "Norway", "Norvège", "Norvege"] },
  { code: "DK", isoNumeric: "208", label: "Danemark", aliases: ["DK", "Denmark", "Danemark"] },
  { code: "FI", isoNumeric: "246", label: "Finlande", aliases: ["FI", "Finland", "Finlande"] },
  { code: "IE", isoNumeric: "372", label: "Irlande", aliases: ["IE", "Ireland", "Irlande"] },
  { code: "GR", isoNumeric: "300", label: "Grèce", aliases: ["GR", "Greece", "Grèce", "Grece"] },
  { code: "CZ", isoNumeric: "203", label: "Tchéquie", aliases: ["CZ", "Czechia", "Czech Republic", "Tchéquie", "Tchequie"] },
  { code: "HU", isoNumeric: "348", label: "Hongrie", aliases: ["HU", "Hungary", "Hongrie"] },
  { code: "CD", isoNumeric: "180", label: "République démocratique du Congo", aliases: ["CD", "DR Congo", "Democratic Republic of the Congo", "Democratic Republic of Congo", "République démocratique du Congo", "Republique democratique du Congo"] },
  { code: "GH", isoNumeric: "288", label: "Ghana", aliases: ["GH", "Ghana"] },
  { code: "ET", isoNumeric: "231", label: "Éthiopie", aliases: ["ET", "Ethiopia", "Éthiopie", "Ethiopie"] },
  { code: "SD", isoNumeric: "729", label: "Soudan", aliases: ["SD", "Sudan", "Soudan"] },
  { code: "MA", isoNumeric: "504", label: "Maroc", aliases: ["MA", "Morocco", "Maroc"] },
  { code: "TN", isoNumeric: "788", label: "Tunisie", aliases: ["TN", "Tunisia", "Tunisie"] },
  { code: "UG", isoNumeric: "800", label: "Ouganda", aliases: ["UG", "Uganda", "Ouganda"] },
  { code: "TZ", isoNumeric: "834", label: "Tanzanie", aliases: ["TZ", "Tanzania", "Tanzanie"] },
  { code: "RW", isoNumeric: "646", label: "Rwanda", aliases: ["RW", "Rwanda"] },
  { code: "SN", isoNumeric: "686", label: "Sénégal", aliases: ["SN", "Senegal", "Sénégal", "Senegal"] },
  { code: "CI", isoNumeric: "384", label: "Côte d’Ivoire", aliases: ["CI", "Ivory Coast", "Côte d'Ivoire", "Cote d'Ivoire"] },
  { code: "CM", isoNumeric: "120", label: "Cameroun", aliases: ["CM", "Cameroon", "Cameroun"] },
  { code: "ML", isoNumeric: "466", label: "Mali", aliases: ["ML", "Mali"] },
  { code: "MZ", isoNumeric: "508", label: "Mozambique", aliases: ["MZ", "Mozambique"] },
  { code: "LY", isoNumeric: "434", label: "Libye", aliases: ["LY", "Libya", "Libye"] },
  { code: "SO", isoNumeric: "706", label: "Somalie", aliases: ["SO", "Somalia", "Somalie"] },
  { code: "SS", isoNumeric: "728", label: "Soudan du Sud", aliases: ["SS", "South Sudan", "Soudan du Sud"] },
  { code: "IQ", isoNumeric: "368", label: "Irak", aliases: ["IQ", "Iraq", "Irak"] },
  { code: "JO", isoNumeric: "400", label: "Jordanie", aliases: ["JO", "Jordan", "Jordanie"] },
  { code: "LB", isoNumeric: "422", label: "Liban", aliases: ["LB", "Lebanon", "Liban"] },
  { code: "SY", isoNumeric: "760", label: "Syrie", aliases: ["SY", "Syria", "Syrie"] },
  { code: "YE", isoNumeric: "887", label: "Yémen", aliases: ["YE", "Yemen", "Yémen", "Yemen"] },
  { code: "OM", isoNumeric: "512", label: "Oman", aliases: ["OM", "Oman"] },
  { code: "KW", isoNumeric: "414", label: "Koweït", aliases: ["KW", "Kuwait", "Koweït", "Koweit"] },
  { code: "BH", isoNumeric: "048", label: "Bahreïn", aliases: ["BH", "Bahrain", "Bahreïn", "Bahrein"] },
  { code: "PS", isoNumeric: "275", label: "Palestine", aliases: ["PS", "Palestine", "Palestinian Territories", "Territoires palestiniens"] },
  { code: "AF", isoNumeric: "004", label: "Afghanistan", aliases: ["AF", "Afghanistan"] },
  { code: "MY", isoNumeric: "458", label: "Malaisie", aliases: ["MY", "Malaysia", "Malaisie"] },
  { code: "KH", isoNumeric: "116", label: "Cambodge", aliases: ["KH", "Cambodia", "Cambodge"] },
  { code: "MM", isoNumeric: "104", label: "Myanmar", aliases: ["MM", "Myanmar", "Burma", "Birmanie"] },
  { code: "LK", isoNumeric: "144", label: "Sri Lanka", aliases: ["LK", "Sri Lanka"] },
  { code: "KZ", isoNumeric: "398", label: "Kazakhstan", aliases: ["KZ", "Kazakhstan"] },
  { code: "UZ", isoNumeric: "860", label: "Ouzbékistan", aliases: ["UZ", "Uzbekistan", "Ouzbékistan", "Ouzbekistan"] },
  { code: "KP", isoNumeric: "408", label: "Corée du Nord", aliases: ["KP", "North Korea", "Corée du Nord", "Coree du Nord"] },
  { code: "TW", isoNumeric: "158", label: "Taïwan", aliases: ["TW", "Taiwan", "Taïwan", "Taiwan"] },
  { code: "LA", isoNumeric: "418", label: "Laos", aliases: ["LA", "Laos"] },
  { code: "MN", isoNumeric: "496", label: "Mongolie", aliases: ["MN", "Mongolia", "Mongolie"] },
  { code: "PE", isoNumeric: "604", label: "Pérou", aliases: ["PE", "Peru", "Pérou", "Perou"] },
  { code: "VE", isoNumeric: "862", label: "Venezuela", aliases: ["VE", "Venezuela"] },
  { code: "EC", isoNumeric: "218", label: "Équateur", aliases: ["EC", "Ecuador", "Équateur", "Equateur"] },
  { code: "BO", isoNumeric: "068", label: "Bolivie", aliases: ["BO", "Bolivia", "Bolivie"] },
  { code: "UY", isoNumeric: "858", label: "Uruguay", aliases: ["UY", "Uruguay"] },
  { code: "PY", isoNumeric: "600", label: "Paraguay", aliases: ["PY", "Paraguay"] },
  { code: "CR", isoNumeric: "188", label: "Costa Rica", aliases: ["CR", "Costa Rica"] },
  { code: "CU", isoNumeric: "192", label: "Cuba", aliases: ["CU", "Cuba"] },
  { code: "GT", isoNumeric: "320", label: "Guatemala", aliases: ["GT", "Guatemala"] },
  { code: "PA", isoNumeric: "591", label: "Panama", aliases: ["PA", "Panama", "Panamá"] },
  { code: "PG", isoNumeric: "598", label: "Papouasie-Nouvelle-Guinée", aliases: ["PG", "Papua New Guinea", "Papouasie-Nouvelle-Guinée"] },
  { code: "FJ", isoNumeric: "242", label: "Fidji", aliases: ["FJ", "Fiji", "Fidji"] },
  { code: "SB", isoNumeric: "090", label: "Îles Salomon", aliases: ["SB", "Solomon Islands", "Îles Salomon", "Iles Salomon"] },
  { code: "AQ", isoNumeric: "010", label: "Antarctique", aliases: ["AQ", "Antarctica", "Antarctique"] },
]);

export const SOURCE_REGION_BY_CODE = Object.freeze({
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
  PK: "Asia",
  AR: "South America",
  CL: "South America",
  CO: "South America",
  ZA: "Africa",
  NG: "Africa",
  CG: "Africa",
  DZ: "Africa",
  EG: "Africa",
  KE: "Africa",
  TR: "Middle East",
  AE: "Middle East",
  QA: "Middle East",
  SA: "Middle East",
  IL: "Middle East",
  IR: "Middle East",
  CN: "Asia",
  BD: "Asia",
  NP: "Asia",
  TH: "Asia",
  VN: "Asia",
  PH: "Asia",
  IN: "Asia",
  JP: "Asia",
  KR: "Asia",
  ID: "Asia",
  SG: "Asia",
  AF: "Asia",
  MY: "Asia",
  KH: "Asia",
  MM: "Asia",
  LK: "Asia",
  KZ: "Asia",
  UZ: "Asia",
  KP: "Asia",
  TW: "Asia",
  LA: "Asia",
  MN: "Asia",
  AU: "Oceania",
  NZ: "Oceania",
  PG: "Oceania",
  FJ: "Oceania",
  SB: "Oceania",
  AT: "Europe",
  BE: "Europe",
  NL: "Europe",
  PL: "Europe",
  PT: "Europe",
  RO: "Europe",
  CH: "Europe",
  SE: "Europe",
  NO: "Europe",
  DK: "Europe",
  FI: "Europe",
  IE: "Europe",
  GR: "Europe",
  CZ: "Europe",
  HU: "Europe",
  CD: "Africa",
  GH: "Africa",
  ET: "Africa",
  SD: "Africa",
  MA: "Africa",
  TN: "Africa",
  UG: "Africa",
  TZ: "Africa",
  RW: "Africa",
  SN: "Africa",
  CI: "Africa",
  CM: "Africa",
  ML: "Africa",
  MZ: "Africa",
  LY: "Africa",
  SO: "Africa",
  SS: "Africa",
  IQ: "Middle East",
  JO: "Middle East",
  LB: "Middle East",
  SY: "Middle East",
  YE: "Middle East",
  OM: "Middle East",
  KW: "Middle East",
  BH: "Middle East",
  PS: "Middle East",
  PE: "South America",
  VE: "South America",
  EC: "South America",
  BO: "South America",
  UY: "South America",
  PY: "South America",
  CR: "North America",
  CU: "North America",
  GT: "North America",
  PA: "North America",
  AQ: "Antarctica",
});

const WORLD_FEATURE_COLLECTION = feature(worldAtlas, worldAtlas.objects.countries);
const ADMIN1_TOPOLOGY_OBJECT = Object.keys(administrativeBoundariesTopology.objects || {})[0];
const ADMIN1_FEATURE_COLLECTION = feature(
  administrativeBoundariesTopology,
  administrativeBoundariesTopology.objects[ADMIN1_TOPOLOGY_OBJECT],
);
const WORLD_COUNTRIES_BY_NUMERIC = new Map(
  WORLD_FEATURE_COLLECTION.features.map((country) => [String(country.id).padStart(3, "0"), country])
);
const WORLD_PROJECTION = geoEquirectangular().fitExtent(WORLD_MAP_VIEWBOX.extent, { type: "Sphere" });

function normalizeCountryKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const SOURCE_COUNTRIES_BY_KEY = new Map(
  SOURCE_COUNTRY_REGISTRY.flatMap((entry) => [entry.code, entry.label, ...entry.aliases]
    .map((alias) => [normalizeCountryKey(alias), entry]))
);

const VERIFIED_COUNTRIES_BY_CODE = new Map(
  SOURCE_COUNTRY_REGISTRY
    .map((entry) => [entry.code, { ...entry, feature: WORLD_COUNTRIES_BY_NUMERIC.get(entry.isoNumeric) || null }])
    .filter(([, entry]) => entry.feature)
);

function readableAdministrativeName(properties = {}) {
  return [properties.name_fr, properties.name_en, properties.name]
    .map((value) => String(value || "").trim())
    .find(Boolean) || "";
}

function administrativeAliases(properties = {}) {
  return [...new Set([properties.name, properties.name_fr, properties.name_en]
    .map((value) => String(value || "").trim())
    .filter((value) => value.length >= 3))];
}

const ADMINISTRATIVE_AREAS_BY_COUNTRY = new Map();
const ADMINISTRATIVE_AREAS_BY_CODE = new Map();

for (const rawFeature of ADMIN1_FEATURE_COLLECTION.features) {
  const properties = rawFeature?.properties || {};
  const countryCode = String(properties.iso_a2 || "").toUpperCase();
  const code = String(properties.iso_3166_2 || "").toUpperCase();
  const label = readableAdministrativeName(properties);
  if (!countryCode || !code || !label) continue;

  const area = Object.freeze({
    code,
    countryCode,
    label,
    aliases: administrativeAliases(properties),
    feature: rawFeature,
  });
  ADMINISTRATIVE_AREAS_BY_CODE.set(`${countryCode}:${code}`, area);
  const current = ADMINISTRATIVE_AREAS_BY_COUNTRY.get(countryCode) || [];
  current.push(area);
  ADMINISTRATIVE_AREAS_BY_COUNTRY.set(countryCode, current);
}

for (const [countryCode, areas] of ADMINISTRATIVE_AREAS_BY_COUNTRY) {
  ADMINISTRATIVE_AREAS_BY_COUNTRY.set(countryCode, Object.freeze(areas));
}

// Natural Earth 10m Admin-1 data, simplified once at build time (3%).
// This is an embedded vector layer: no map tile or boundary request is made at runtime.
export const WORLD_ADMIN1_BOUNDARY_COLLECTION = Object.freeze(ADMIN1_FEATURE_COLLECTION);

function stableHash(value) {
  const input = String(value || "world-pulse");
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function hashUnit(seed, salt) {
  return stableHash(`${seed}|${salt}`) / 0x100000000;
}

function polygonOuterRings(featureGeometry) {
  if (!featureGeometry) return [];
  if (featureGeometry.type === "Polygon") {
    return featureGeometry.coordinates?.[0] ? [featureGeometry.coordinates[0]] : [];
  }
  if (featureGeometry.type === "MultiPolygon") {
    return featureGeometry.coordinates
      .map((polygon) => polygon?.[0])
      .filter(Boolean);
  }
  return [];
}

function ringArea(ring) {
  let area = 0;
  for (let index = 0; index < ring.length - 1; index += 1) {
    const [x1, y1] = ring[index];
    const [x2, y2] = ring[index + 1];
    area += (x1 * y2) - (x2 * y1);
  }
  return Math.abs(area / 2);
}

function ringBounds(ring) {
  let minLongitude = Number.POSITIVE_INFINITY;
  let maxLongitude = Number.NEGATIVE_INFINITY;
  let minLatitude = Number.POSITIVE_INFINITY;
  let maxLatitude = Number.NEGATIVE_INFINITY;
  for (const [longitude, latitude] of ring) {
    minLongitude = Math.min(minLongitude, longitude);
    maxLongitude = Math.max(maxLongitude, longitude);
    minLatitude = Math.min(minLatitude, latitude);
    maxLatitude = Math.max(maxLatitude, latitude);
  }
  if (![minLongitude, maxLongitude, minLatitude, maxLatitude].every(Number.isFinite)) return null;
  return { minLongitude, maxLongitude, minLatitude, maxLatitude };
}

function candidateRings(countryFeature) {
  return polygonOuterRings(countryFeature?.geometry)
    .map((ring) => ({ ring, area: ringArea(ring), bounds: ringBounds(ring) }))
    .filter((entry) => entry.area > 0 && entry.bounds)
    .sort((left, right) => right.area - left.area);
}

function chooseRing(rings, seed, attempt) {
  if (rings.length === 0) return null;
  if (attempt < 96) return rings[0];
  const totalArea = rings.reduce((sum, ring) => sum + ring.area, 0);
  const target = hashUnit(seed, `ring:${attempt}`) * totalArea;
  let cursor = 0;
  for (const ring of rings) {
    cursor += ring.area;
    if (target <= cursor) return ring;
  }
  return rings[0];
}

function projectedPercent(longitude, latitude) {
  const projected = WORLD_PROJECTION([longitude, latitude]);
  if (!projected) return null;
  const [projectedX, projectedY] = projected;
  if (!Number.isFinite(projectedX) || !Number.isFinite(projectedY)) return null;
  return {
    x: Number(((projectedX / WORLD_MAP_VIEWBOX.width) * 100).toFixed(2)),
    y: Number(((projectedY / WORLD_MAP_VIEWBOX.height) * 100).toFixed(2)),
  };
}

export function resolveVerifiedSourceCountry(value, basis = "sourceCountry") {
  const key = normalizeCountryKey(value);
  if (!key || key === "non precise" || key === "rss public" || key === "unknown") return null;
  const registryEntry = SOURCE_COUNTRIES_BY_KEY.get(key);
  if (!registryEntry) return null;
  const verifiedEntry = VERIFIED_COUNTRIES_BY_CODE.get(registryEntry.code);
  if (!verifiedEntry?.feature) return null;
  return {
    label: verifiedEntry.label,
    code: verifiedEntry.code,
    isoAlpha2: verifiedEntry.code,
    isoNumeric: verifiedEntry.isoNumeric,
    basis,
    verified: true,
    geometry: "world-atlas/countries-110m",
  };
}

export function sourceRegionForVerifiedCountry(value, fallback = "Non précisée") {
  const country = resolveVerifiedSourceCountry(value);
  return (country && SOURCE_REGION_BY_CODE[country.code]) || String(fallback || "").trim() || "Non précisée";
}

export function countryFeatureForIso2(isoAlpha2) {
  return VERIFIED_COUNTRIES_BY_CODE.get(String(isoAlpha2 || "").toUpperCase())?.feature || null;
}

export function administrativeAreasForCountry(isoAlpha2) {
  return ADMINISTRATIVE_AREAS_BY_COUNTRY.get(String(isoAlpha2 || "").toUpperCase()) || [];
}

export function resolveVerifiedAdministrativeArea(isoAlpha2, administrativeCode) {
  const countryCode = String(isoAlpha2 || "").toUpperCase();
  const code = String(administrativeCode || "").toUpperCase();
  if (!countryCode || !code) return null;
  return ADMINISTRATIVE_AREAS_BY_CODE.get(`${countryCode}:${code}`) || null;
}

export function isCoordinateInsideCountry(isoAlpha2, longitude, latitude) {
  const featureForCountry = countryFeatureForIso2(isoAlpha2);
  if (!featureForCountry) return false;
  const lon = Number(longitude);
  const lat = Number(latitude);
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return false;
  return geoContains(featureForCountry, [lon, lat]);
}

export function isCoordinateInsideAdministrativeArea(isoAlpha2, administrativeCode, longitude, latitude) {
  const area = resolveVerifiedAdministrativeArea(isoAlpha2, administrativeCode);
  const lon = Number(longitude);
  const lat = Number(latitude);
  if (!area?.feature || !Number.isFinite(lon) || !Number.isFinite(lat)) return false;
  return geoContains(area.feature, [lon, lat]);
}

function placePointInsideFeature(targetFeature, seed) {
  const rings = candidateRings(targetFeature);
  for (let attempt = 0; attempt < 256; attempt += 1) {
    const ring = chooseRing(rings, seed, attempt);
    if (!ring) break;
    const { minLongitude, maxLongitude, minLatitude, maxLatitude } = ring.bounds;
    const longitude = minLongitude + (maxLongitude - minLongitude) * hashUnit(seed, `lon:${attempt}`);
    const latitude = minLatitude + (maxLatitude - minLatitude) * hashUnit(seed, `lat:${attempt}`);
    if (!geoContains(targetFeature, [longitude, latitude])) continue;
    const projected = projectedPercent(longitude, latitude);
    if (!projected) continue;
    return {
      ...projected,
      coordinates: {
        longitude: Number(longitude.toFixed(5)),
        latitude: Number(latitude.toFixed(5)),
      },
      attempts: attempt + 1,
    };
  }

  const [longitude, latitude] = geoCentroid(targetFeature);
  if (!geoContains(targetFeature, [longitude, latitude])) return null;
  const projected = projectedPercent(longitude, latitude);
  if (!projected) return null;
  return {
    ...projected,
    coordinates: {
      longitude: Number(longitude.toFixed(5)),
      latitude: Number(latitude.toFixed(5)),
    },
    attempts: "centroid-fallback",
  };
}

export function placePointInsideCountry(isoAlpha2, seed) {
  const code = String(isoAlpha2 || "").toUpperCase();
  const country = VERIFIED_COUNTRIES_BY_CODE.get(code);
  const countryFeature = country?.feature;
  if (!countryFeature) return null;
  const placement = placePointInsideFeature(countryFeature, seed);
  if (!placement) return null;
  return {
    ...placement,
    positioning: {
      basis: "verified_media_country_geometry",
      sourceCountryIso2: country.code,
      sourceCountryIsoNumeric: country.isoNumeric,
      sourceCountryLabel: country.label,
      geometry: "world-atlas/countries-110m",
      projection: WORLD_MAP_VIEWBOX.projection,
      stableSeed: stableHash(seed).toString(36),
      attempts: placement.attempts,
      insideCountry: true,
    },
  };
}

export function placePointInsideAdministrativeArea(isoAlpha2, administrativeCode, seed) {
  const country = VERIFIED_COUNTRIES_BY_CODE.get(String(isoAlpha2 || "").toUpperCase());
  const area = resolveVerifiedAdministrativeArea(isoAlpha2, administrativeCode);
  if (!country?.feature || !area?.feature) return null;
  const placement = placePointInsideFeature(area.feature, seed);
  if (!placement || !geoContains(country.feature, [placement.coordinates.longitude, placement.coordinates.latitude])) return null;
  return {
    ...placement,
    positioning: {
      basis: "verified_event_administrative_area_geometry",
      sourceCountryIso2: country.code,
      sourceCountryIsoNumeric: country.isoNumeric,
      sourceCountryLabel: country.label,
      administrativeAreaCode: area.code,
      administrativeAreaLabel: area.label,
      geometry: "natural-earth/admin-1-10m-simplified-3pct",
      projection: WORLD_MAP_VIEWBOX.projection,
      stableSeed: stableHash(seed).toString(36),
      attempts: placement.attempts,
      insideCountry: true,
      insideAdministrativeArea: true,
    },
  };
}

export function verifyArticleParticlePlacements(particles) {
  const failures = [];
  for (const particle of Array.isArray(particles) ? particles : []) {
    const code = particle?.location?.code || particle?.positioning?.sourceCountryIso2;
    const longitude = particle?.coordinates?.longitude;
    const latitude = particle?.coordinates?.latitude;
    if (!code || !isCoordinateInsideCountry(code, longitude, latitude)) {
      failures.push({
        id: particle?.id || null,
        title: particle?.title || null,
        code: code || null,
        longitude,
        latitude,
        reason: "particle_outside_verified_country_geometry",
      });
    }
  }
  return {
    ok: failures.length === 0,
    checked: Array.isArray(particles) ? particles.length : 0,
    failures,
  };
}
