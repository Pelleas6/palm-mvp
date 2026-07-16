import { geoCentroid, geoContains, geoEquirectangular } from "d3-geo";
import { feature } from "topojson-client";
import worldAtlas from "world-atlas/countries-110m.json" with { type: "json" };

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
  { code: "MX", isoNumeric: "484", label: "Mexique", aliases: ["MX", "Mexico", "Mexique"] },
  { code: "AR", isoNumeric: "032", label: "Argentine", aliases: ["AR", "Argentina", "Argentine"] },
  { code: "CL", isoNumeric: "152", label: "Chili", aliases: ["CL", "Chile", "Chili"] },
  { code: "CO", isoNumeric: "170", label: "Colombie", aliases: ["CO", "Colombia", "Colombie"] },
  { code: "ZA", isoNumeric: "710", label: "Afrique du Sud", aliases: ["ZA", "South Africa", "Afrique du Sud"] },
  { code: "NG", isoNumeric: "566", label: "Nigeria", aliases: ["NG", "Nigeria", "Nigéria"] },
  { code: "CG", isoNumeric: "178", label: "République du Congo", aliases: ["CG", "Congo", "Republic of Congo", "République du Congo", "Republique du Congo"] },
  { code: "EG", isoNumeric: "818", label: "Égypte", aliases: ["EG", "Egypt", "Égypte", "Egypte"] },
  { code: "KE", isoNumeric: "404", label: "Kenya", aliases: ["KE", "Kenya"] },
  { code: "TR", isoNumeric: "792", label: "Turquie", aliases: ["TR", "Turkey", "Türkiye", "Turquie"] },
  { code: "UA", isoNumeric: "804", label: "Ukraine", aliases: ["UA", "Ukraine"] },
  { code: "RU", isoNumeric: "643", label: "Russie", aliases: ["RU", "Russia", "Russian Federation", "Russie"] },
  { code: "CN", isoNumeric: "156", label: "Chine", aliases: ["CN", "China", "Chine"] },
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
  NZ: "Oceania",
  AQ: "Antarctica",
});

const WORLD_FEATURE_COLLECTION = feature(worldAtlas, worldAtlas.objects.countries);
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

export function isCoordinateInsideCountry(isoAlpha2, longitude, latitude) {
  const featureForCountry = countryFeatureForIso2(isoAlpha2);
  if (!featureForCountry) return false;
  const lon = Number(longitude);
  const lat = Number(latitude);
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return false;
  return geoContains(featureForCountry, [lon, lat]);
}

export function placePointInsideCountry(isoAlpha2, seed) {
  const code = String(isoAlpha2 || "").toUpperCase();
  const country = VERIFIED_COUNTRIES_BY_CODE.get(code);
  const countryFeature = country?.feature;
  if (!countryFeature) return null;
  const rings = candidateRings(countryFeature);
  for (let attempt = 0; attempt < 256; attempt += 1) {
    const ring = chooseRing(rings, seed, attempt);
    if (!ring) break;
    const { minLongitude, maxLongitude, minLatitude, maxLatitude } = ring.bounds;
    const longitude = minLongitude + (maxLongitude - minLongitude) * hashUnit(seed, `lon:${attempt}`);
    const latitude = minLatitude + (maxLatitude - minLatitude) * hashUnit(seed, `lat:${attempt}`);
    if (!geoContains(countryFeature, [longitude, latitude])) continue;
    const projected = projectedPercent(longitude, latitude);
    if (!projected) continue;
    return {
      ...projected,
      coordinates: {
        longitude: Number(longitude.toFixed(5)),
        latitude: Number(latitude.toFixed(5)),
      },
      positioning: {
        basis: "verified_media_country_geometry",
        sourceCountryIso2: country.code,
        sourceCountryIsoNumeric: country.isoNumeric,
        sourceCountryLabel: country.label,
        geometry: "world-atlas/countries-110m",
        projection: WORLD_MAP_VIEWBOX.projection,
        stableSeed: stableHash(seed).toString(36),
        attempts: attempt + 1,
        insideCountry: true,
      },
    };
  }

  const [longitude, latitude] = geoCentroid(countryFeature);
  if (geoContains(countryFeature, [longitude, latitude])) {
    const projected = projectedPercent(longitude, latitude);
    if (projected) {
      return {
        ...projected,
        coordinates: {
          longitude: Number(longitude.toFixed(5)),
          latitude: Number(latitude.toFixed(5)),
        },
        positioning: {
          basis: "verified_media_country_geometry",
          sourceCountryIso2: country.code,
          sourceCountryIsoNumeric: country.isoNumeric,
          sourceCountryLabel: country.label,
          geometry: "world-atlas/countries-110m",
          projection: WORLD_MAP_VIEWBOX.projection,
          stableSeed: stableHash(seed).toString(36),
          attempts: "centroid-fallback",
          insideCountry: true,
        },
      };
    }
  }
  return null;
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
