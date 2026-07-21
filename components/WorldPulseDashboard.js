"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { geoEquirectangular, geoGraticule10, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import worldAtlas from "world-atlas/countries-110m.json";
import { WORLD_PULSE_SIGNAL_LEGEND, colorForWorldPulseSignalLabel } from "../lib/world-pulse-signals.js";
import { SOURCE_COUNTRY_REGISTRY } from "../lib/world-pulse-geography.js";
import {
  WORLD_PULSE_FILTER_ALL,
  WORLD_PULSE_LOCALIZATION_FILTERS,
  deriveWorldPulseExploration,
} from "../lib/world-pulse-exploration.js";

// Le navigateur sonde la version du snapshot toutes les 30 s. Le serveur garde
// les flux RSS en cache, et le payload complet n'est relu que s'il a changé.
const REFRESH_MS = 30 * 1000;
const EMPTY_COUNTS = {
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
  unavailableSources: 0,
  rssArticlesFetched: 0,
  rssArticles: 0,
  rssArticlesRendered: 0,
  rssArticlesOffMap: 0,
  rssArticlesTruncated: 0,
  rssMediaSources: 0,
  rssActiveSources: 0,
  rssAuditedSources: 0,
  rssSourcesInError: 0,
  rssKnownMediaCountries: 0,
  rssCategories: 0,
  rssClassifiedArticles: 0,
  rssUnclassifiedArticles: 0,
  rssClassificationCoveragePct: 0,
  gdeltNgramsDocuments: 0,
  gdeltNgramsRawTrends: 0,
  gdeltNgramsCategories: 0,
  gdeltNgramsEmergingTrends: 0,
  gdeltNgramsUnclassifiedDocuments: 0,
  gdeltNgramsClassificationCoveragePct: 0,
};
const WORLD_FEATURE = feature(worldAtlas, worldAtlas.objects.countries);
const WORLD_VIEWBOX_WIDTH = 1000;
const WORLD_VIEWBOX_HEIGHT = 500;
const WORLD_PROJECTION = geoEquirectangular().fitExtent([[8, 8], [992, 492]], { type: "Sphere" });
const WORLD_PATH = geoPath(WORLD_PROJECTION);
const COUNTRY_CODE_BY_NUMERIC = new Map(SOURCE_COUNTRY_REGISTRY.map((country) => [country.isoNumeric, country.code]));
const WORLD_COUNTRY_PATHS = WORLD_FEATURE.features
  .map((country, index) => {
    const isoNumeric = String(country.id || "").padStart(3, "0");
    return { id: country.id || index, code: COUNTRY_CODE_BY_NUMERIC.get(isoNumeric) || null, d: WORLD_PATH(country) };
  })
  .filter((country) => country.d);
const WORLD_GRATICULE_PATH = WORLD_PATH(geoGraticule10());
const WORLD_SPHERE_PATH = WORLD_PATH({ type: "Sphere" });

function formatDate(value) {
  if (!value) return "horodatage non précisé";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "horodatage non précisé";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function relativeStateLabel(state) {
  if (state === "gdelt_ok") return "GDELT OK";
  if (state === "ok") return "RSS public OK";
  if (state === "rss_fallback") return "RSS public OK";
  if (state === "empty") return "GDELT OK · aucun résultat";
  if (state === "unavailable") return "Indisponible";
  if (state === "error") return "Erreur locale";
  return "Connexion aux sources";
}

function formatFreshness(seconds) {
  if (!Number.isFinite(seconds)) return "—";
  if (seconds < 60) return `${Math.max(0, seconds)} s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? `${minutes} min ${rest} s` : `${minutes} min`;
}

function formatPercent(value) {
  return Number.isFinite(value) ? `${value}%` : "—";
}

function colorForLabel(label) {
  return colorForWorldPulseSignalLabel(label);
}

function formatArticleCount(count) {
  const safeCount = Number.isFinite(count) ? count : 0;
  return `${safeCount} article${safeCount > 1 ? "s" : ""}`;
}

function escapeCsvCell(value) {
  const raw = String(value ?? "").replace(/\r?\n/g, " ");
  const text = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return /[",;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadFilteredArticles(articles) {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  const columns = ["Titre", "URL", "Média", "Domaine", "Pays événement", "Code pays", "Catégorie", "Langue", "Date RSS", "Pays média", "Région média"];
  const rows = articles.map((article) => [
    article.title,
    article.url,
    article.mediaName || article.sourceType,
    article.domain,
    article.eventCountry || "",
    article.eventCountryIso || "",
    article.label || "Non déterminé",
    article.language,
    article.seenAt,
    article.sourceLocation?.label || article.sourceCountry,
    article.sourceRegion,
  ].map(escapeCsvCell).join(";"));
  const blob = new Blob([[columns.map(escapeCsvCell).join(";"), ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "le-pouls-du-monde-signaux.csv";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
  return true;
}

async function copyText(text) {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }
  if (typeof document === "undefined") return false;
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  return copied;
}

function formatBriefForCopy(brief, generatedAt) {
  const safeBrief = brief || {};
  const topMedia = Array.isArray(safeBrief.topMedia) ? safeBrief.topMedia : [];
  const coveragePct = Number.isFinite(safeBrief.localizationCoveragePct)
    ? safeBrief.localizationCoveragePct
    : safeBrief.localizationPct || 0;
  const qualityPct = Number.isFinite(safeBrief.localizationQualityPct)
    ? safeBrief.localizationQualityPct
    : 0;
  const lines = [
    "Le Pouls du Monde — brief de situation",
    `Lecture : ${formatDate(generatedAt)}`,
    `Flux reçu : ${safeBrief.articles || 0} article(s) · ${safeBrief.localizedArticles || 0} localisé(s) dans ${safeBrief.countries || 0} pays`,
    safeBrief.headline || "Aucun point de concentration ne peut encore être établi.",
  ];
  if (safeBrief.topCategory) lines.push(`Thème le plus présent : ${safeBrief.topCategory.label} (${safeBrief.topCategory.count})`);
  if (topMedia.length > 0) lines.push(`Médias les plus présents : ${topMedia.map((item) => `${item.label} (${item.count})`).join(", ")}`);
  lines.push(`Points cartographiés vérifiés : ${qualityPct}% · ${safeBrief.localizedArticles || 0} article(s) avec preuve.`);
  lines.push(`Couverture cartographique : ${coveragePct}% du flux · ${safeBrief.unlocalizedArticles || 0} article(s) à localiser.`);
  lines.push(`Méthode : ${safeBrief.methodNote || "lecture limitée aux articles réellement reçus."}`);
  return lines.join("\n");
}

function countFromPayload(payloadCounts, key, fallback = 0) {
  const value = payloadCounts?.[key];
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

// Les coordonnées sont calculées sur le même canevas 1000 × 500 que le SVG.
// Cette marge protège les petits États insulaires sans jamais laisser une bulle
// déborder dans le cadre décoratif extérieur.
const MAP_POINT_BOUNDS = Object.freeze({ left: 2, right: 98, top: 2.5, bottom: 97.5 });

function WorldMapBackdrop({ availableCountryCodes = [], selectedCountryCodes = [], onSelectCountry = () => {} }) {
  const selectableCodes = new Set(availableCountryCodes);
  const selectedCodes = new Set(selectedCountryCodes);
  function countryInteractionProps(country) {
    if (!country.code || !selectableCodes.has(country.code)) return {};
    const selected = selectedCodes.has(country.code);
    const select = () => onSelectCountry(country.code);
    return {
      role: "button",
      tabIndex: 0,
      onClick: select,
      onKeyDown: (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          select();
        }
      },
      "aria-label": `Lire les signaux du pays événement ISO ${country.code}`,
      className: `map-land map-country-button${selected ? " selected-country" : ""}`,
    };
  }

  return (
    <svg
      className="world-map"
      viewBox={`0 0 ${WORLD_VIEWBOX_WIDTH} ${WORLD_VIEWBOX_HEIGHT}`}
      role="img"
      aria-label="Carte du monde Natural Earth projetée en SVG, monde complet visible"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id="landGlow" x1="0%" x2="100%" y1="0%" y2="100%">
          <stop offset="0%" stopColor="#25483f" />
          <stop offset="100%" stopColor="#10241f" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="1000" height="500" rx="28" className="map-ocean" />
      <path className="map-sphere" d={WORLD_SPHERE_PATH} />
      <path className="map-line" d={WORLD_GRATICULE_PATH} />
      {WORLD_COUNTRY_PATHS.map((country) => {
        const interactionProps = countryInteractionProps(country);
        return <path key={country.id} className={interactionProps.className || "map-land"} d={country.d} {...interactionProps} />;
      })}
    </svg>
  );
}

function hasUsableInitialPayload(initialPayload) {
  return Boolean(initialPayload && !["unavailable", "error"].includes(initialPayload.state));
}

function useGdeltPulse(initialPayload) {
  const [payload, setPayload] = useState(() => initialPayload || { state: "loading" });
  const [loading, setLoading] = useState(() => !hasUsableInitialPayload(initialPayload));
  const versionRef = useRef(initialPayload?.generatedAt || null);

  useEffect(() => {
    let active = true;
    let timer;
    let refreshing = false;
    let hasPayload = hasUsableInitialPayload(initialPayload);
    versionRef.current = initialPayload?.generatedAt || null;

    function applyClientError(errorPayload) {
      if (!hasPayload) {
        setPayload(errorPayload);
      }
    }

    async function loadFullPayload({ showLoading = false } = {}) {
      if (showLoading) setLoading(true);
      try {
        const response = await fetch("/api/gdelt", { cache: "no-store" });
        const data = await response.json().catch(() => null);
        if (!active) return;
        if (!data || typeof data !== "object") {
          applyClientError({
            state: "error",
            error: { reason: `Réponse locale illisible (${response.status})` },
            articles: [],
            counts: EMPTY_COUNTS,
            groupings: { domains: [], countries: [], languages: [], labels: [] },
          });
          return;
        }
        if (!response.ok || ["error", "unavailable", "rate_limited"].includes(data.state)) {
          applyClientError({
            state: "error",
            error: { reason: data?.error?.reason || `Rafraîchissement non disponible (${response.status})` },
            articles: [],
            counts: EMPTY_COUNTS,
            groupings: { domains: [], countries: [], languages: [], labels: [] },
          });
          return;
        }
        setPayload(data);
        hasPayload = true;
        versionRef.current = response.headers.get("x-world-pulse-version") || data.generatedAt || null;
      } catch (error) {
        if (!active) return;
        applyClientError({
          state: "error",
          error: { reason: "Impossible de joindre l'endpoint local /api/gdelt", detail: String(error?.message || error) },
          articles: [],
          counts: EMPTY_COUNTS,
          groupings: { domains: [], countries: [], languages: [], labels: [] },
        });
      } finally {
        if (active) setLoading(false);
      }
    }

    async function refreshIfChanged({ showLoading = false } = {}) {
      if (refreshing) return;
      refreshing = true;
      try {
        if (!hasPayload) {
          await loadFullPayload({ showLoading });
          return;
        }
        const knownVersion = versionRef.current;
        const response = await fetch("/api/gdelt", {
          method: "HEAD",
          cache: "no-store",
          headers: knownVersion ? { "If-None-Match": `W/"${knownVersion}"` } : undefined,
        });
        if (!active || response.status === 304 || !response.ok) return;
        const nextVersion = response.headers.get("x-world-pulse-version");
        if (!nextVersion || nextVersion !== knownVersion) await loadFullPayload();
      } catch (error) {
        if (!active) return;
        applyClientError({
          state: "error",
          error: { reason: "Impossible de vérifier la version locale /api/gdelt", detail: String(error?.message || error) },
          articles: [],
          counts: EMPTY_COUNTS,
          groupings: { domains: [], countries: [], languages: [], labels: [] },
        });
      } finally {
        refreshing = false;
      }
    }

    // Une réponse serveur exploitable est déjà affichée : la relire aussitôt
    // provoquait un changement de contenu visible à chaque rechargement.
    // On ne relance immédiatement que lorsqu'aucune donnée réelle n'a pu être
    // servie par le serveur ; sinon la cadence normale prend le relais.
    if (!hasUsableInitialPayload(initialPayload)) refreshIfChanged({ showLoading: true });
    timer = window.setInterval(refreshIfChanged, REFRESH_MS);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [initialPayload]);

  return { payload, loading };
}

function Metric({ label, value, hint }) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      {hint ? <small>{hint}</small> : null}
    </div>
  );
}

function SignalLegend({ activeCategory, onSelectCategory }) {
  return (
    <div className="signal-legend" aria-label="Légende des signaux">
      <div className="signal-legend-heading">
        <span className="signal-legend-title">Couleurs des bulles</span>
        <small>Choisir un thème pour filtrer</small>
      </div>
      <ul>
        {WORLD_PULSE_SIGNAL_LEGEND.map((item) => (
          <li key={item.label}>
            <button
              type="button"
              className={activeCategory === item.label ? "active-legend-item" : ""}
              style={{ "--legend-color": item.color }}
              onClick={() => onSelectCategory(item.label)}
              aria-pressed={activeCategory === item.label}
              title={`Filtrer : ${item.thematic === false ? "À qualifier" : item.label}`}
            >
              <i aria-hidden="true" />
              <span>{item.thematic === false ? "À qualifier" : item.label}</span>
            </button>
          </li>
        ))}
      </ul>
      <p>Point = un article · bulle = plusieurs articles proches du même thème</p>
    </div>
  );
}

function SignalField({ articleParticles, articleClusters, unlocalized, state, loading, availableCountryCodes, selectedPoint, onSelectPoint, onSelectCountry }) {
  const particles = useMemo(() => (
    articleParticles.filter((point) => !point.clusterId).map((point, index) => ({
      ...point,
      kind: "article",
      left: clamp(point.x, MAP_POINT_BOUNDS.left, MAP_POINT_BOUNDS.right),
      top: clamp(point.y, MAP_POINT_BOUNDS.top, MAP_POINT_BOUNDS.bottom),
      size: point.size || 4,
      color: colorForLabel(point.label),
      delay: `${((index + 4) % 18) * 0.06}s`,
    }))
  ), [articleParticles]);
  const clusters = useMemo(() => (
    articleClusters.map((point, index) => ({
      ...point,
      kind: "article-cluster",
      mediaName: point.mediaNames?.join(", ") || point.location?.label || "Cluster articles",
      left: clamp(point.x, MAP_POINT_BOUNDS.left, MAP_POINT_BOUNDS.right),
      top: clamp(point.y, MAP_POINT_BOUNDS.top, MAP_POINT_BOUNDS.bottom),
      size: point.size || 14,
      color: colorForLabel(point.label),
      delay: `${((index + 8) % 18) * 0.06}s`,
    }))
  ), [articleClusters]);
  const hasVisiblePoints = particles.length > 0 || clusters.length > 0;

  function renderPoint(point, className) {
    const safeOffset = Math.ceil((point.size || 8) / 2 + 10);
    const sourceCountry = point.sourceCountry || point.location?.label || "Non précisé";
    const eventCountry = point.eventCountry || point.location?.label || "Non localisé";
    const countLabel = point.kind === "media" ? formatArticleCount(point.articleCount) : point.kind === "article-cluster" ? formatArticleCount(point.count) : "1 article";
    const geographyLabel = point.kind === "media" ? `Média situé en ${sourceCountry}` : `Événement : ${eventCountry}`;
    const categoryLabel = point.label === "Non déterminé" ? "À qualifier" : point.label;
    const tooltip = `${geographyLabel} — ${categoryLabel} — ${countLabel}`;
    const tooltipNearLeft = point.left < 24;
    const tooltipNearRight = point.left > 76;
    const tooltipNearTop = point.top < 28;
    const style = {
      left: `clamp(${safeOffset}px, ${point.left}%, calc(100% - ${safeOffset}px))`,
      top: `clamp(${safeOffset}px, ${point.top}%, calc(100% - ${safeOffset}px))`,
      width: `${point.size}px`,
      height: `${point.size}px`,
      "--particle-color": point.color,
      "--particle-delay": point.delay,
      "--cluster-font-size": `${clamp(Math.round((point.size || 14) * 0.46), 10, 16)}px`,
      "--cluster-mobile-font-size": `${clamp(Math.round((point.size || 14) * 0.26), 8, 12)}px`,
      "--particle-mobile-scale": point.kind === "article-cluster" ? 0.42 : point.kind === "media" ? 0.52 : 0.62,
      "--particle-mobile-active-scale": point.kind === "article-cluster" ? 0.52 : point.kind === "media" ? 0.62 : 0.74,
      "--particle-tooltip-left": tooltipNearLeft ? "0%" : tooltipNearRight ? "100%" : "50%",
      "--particle-tooltip-x": tooltipNearLeft ? "0%" : tooltipNearRight ? "-100%" : "-50%",
      "--particle-tooltip-top": tooltipNearTop ? "calc(100% + 10px)" : "auto",
      "--particle-tooltip-bottom": tooltipNearTop ? "auto" : "calc(100% + 10px)",
    };
    const selectionType = point.kind === "media" ? "marker" : point.kind === "article-cluster" ? "cluster" : "article";
    const isSelected = selectedPoint?.type === selectionType && selectedPoint?.id === point.id;
    return (
      <button
        key={`${point.kind}-${point.id}`}
        type="button"
        className={`particle ${className}${isSelected ? " selected-particle" : ""}`}
        style={style}
        title={tooltip}
        aria-label={tooltip}
        aria-pressed={isSelected}
        onClick={() => onSelectPoint({ type: selectionType, id: point.id })}
      >
        {point.kind === "article-cluster" ? <span className="cluster-count" aria-hidden="true">{point.count}</span> : null}
        <span className="particle-tooltip" role="tooltip">
          <span>{geographyLabel}</span>
          <span>Thème : {categoryLabel}</span>
          <span>{countLabel}</span>
        </span>
      </button>
    );
  }

  return (
    <div className="signal-field" aria-label="Carte du monde des événements localisés : points et bulles par proximité et thème">
      <div className="map-viewport">
        <WorldMapBackdrop
          availableCountryCodes={availableCountryCodes}
          selectedCountryCodes={selectedPoint?.type === "country" ? [selectedPoint.code] : []}
          onSelectCountry={(code) => onSelectCountry({ type: "country", code })}
        />
        <div className="field-grid" aria-hidden="true" />
        {loading && !hasVisiblePoints ? (
          <div className="state-copy">
            <div className="loader" aria-hidden="true" />
            <strong>Interrogation RSS public puis tendances GDELT Web N-Grams</strong>
            <span>Aucun point n'est dessiné avant retour d'une source réelle.</span>
          </div>
        ) : null}
        {!loading && !hasVisiblePoints && unlocalized > 0 ? (
          <div className="state-copy compact-state">
            <strong>Aucun événement localisable sur la carte</strong>
            <span>Les articles réels restent comptés non localisés pour ne pas inventer de pays d'événement.</span>
          </div>
        ) : null}
        {!loading && !hasVisiblePoints && unlocalized === 0 ? (
          <div className="state-copy">
            <strong>{state === "unavailable" ? "Sources indisponibles" : "Aucun signal exploitable"}</strong>
            <span>La visualisation reste vide tant qu'aucun article réel n'est reçu.</span>
          </div>
        ) : null}
        <div className="particle-layer">
          {particles.map((particle) => renderPoint(particle, "article-particle"))}
          {clusters.map((cluster) => renderPoint(cluster, "article-cluster"))}
        </div>
      </div>
    </div>
  );
}

function CountList({ title, items, emptyLabel, colorize = false }) {
  const max = Math.max(1, ...items.map((item) => item.count));
  return (
    <section className="panel mini-panel">
      <h2>{title}</h2>
      {items.length === 0 ? <p className="muted">{emptyLabel}</p> : null}
      <div className="count-list">
        {items.map((item) => {
          const color = colorize ? colorForLabel(item.label) : null;
          return (
            <div key={item.label} className={`count-row${colorize ? " count-row-colored" : ""}`} style={color ? { "--count-row-color": color } : undefined}>
              <div>
                <span className="count-label">
                  {colorize ? <b className="count-dot" aria-hidden="true" /> : null}
                  <span>{item.label}</span>
                </span>
                <strong>{item.count}</strong>
              </div>
              <i style={{ width: `${Math.max(10, (item.count / max) * 100)}%` }} />
            </div>
          );
        })}
      </div>
    </section>
  );
}

function FilterSelect({ label, value, items, onChange }) {
  return (
    <label className="filter-select">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value={WORLD_PULSE_FILTER_ALL}>Tous</option>
        {items.map((item) => (
          <option key={`${label}-${item.value}`} value={item.value}>
            {item.code ? `${item.label} (${item.code})` : item.label} · {item.count}
          </option>
        ))}
      </select>
    </label>
  );
}

function hasActiveFilters(filters) {
  return Object.values(filters || {}).some((value) => value && value !== WORLD_PULSE_FILTER_ALL);
}

function FilterControls({ filters, options, resultCount, totalCount, localizedCount, unlocalizedCount, onChange, onReset, compact = false }) {
  const active = hasActiveFilters(filters);
  return (
    <section className={`panel filter-panel${compact ? " compact-filter-panel" : ""}`} aria-label="Filtres RSS réinitialisables">
      <div className="panel-heading">
        <div>
          <p>{compact ? "Explorer la carte" : "Exploration RSS"}</p>
          <h2>{compact ? "Affiner les signaux" : "Filtres cohérents carte · liste · compteurs"}</h2>
        </div>
        <span>{resultCount}/{totalCount} article(s) affichés</span>
      </div>
      <div className="location-filter" role="group" aria-label="Filtrer selon la qualité de localisation de l'événement">
        <span>Localisation</span>
        <div>
          <button
            type="button"
            className={filters.location === WORLD_PULSE_LOCALIZATION_FILTERS.ALL ? "active-location-filter" : ""}
            aria-pressed={filters.location === WORLD_PULSE_LOCALIZATION_FILTERS.ALL}
            onClick={() => onChange("location", WORLD_PULSE_LOCALIZATION_FILTERS.ALL)}
          >
            Tous · {totalCount}
          </button>
          <button
            type="button"
            className={filters.location === WORLD_PULSE_LOCALIZATION_FILTERS.LOCALIZED ? "active-location-filter" : ""}
            aria-pressed={filters.location === WORLD_PULSE_LOCALIZATION_FILTERS.LOCALIZED}
            onClick={() => onChange("location", WORLD_PULSE_LOCALIZATION_FILTERS.LOCALIZED)}
          >
            Sur la carte · {localizedCount}
          </button>
          <button
            type="button"
            className={filters.location === WORLD_PULSE_LOCALIZATION_FILTERS.UNLOCALIZED ? "active-location-filter" : ""}
            aria-pressed={filters.location === WORLD_PULSE_LOCALIZATION_FILTERS.UNLOCALIZED}
            onClick={() => onChange("location", WORLD_PULSE_LOCALIZATION_FILTERS.UNLOCALIZED)}
          >
            À localiser · {unlocalizedCount}
          </button>
        </div>
      </div>
      <div className="filter-grid">
        <FilterSelect label="Région" value={filters.region} items={options.regions || []} onChange={(value) => onChange("region", value)} />
        <FilterSelect label="Pays événement" value={filters.country} items={options.countries || []} onChange={(value) => onChange("country", value)} />
        <FilterSelect label="Source" value={filters.source} items={options.sources || []} onChange={(value) => onChange("source", value)} />
        <FilterSelect label="Catégorie" value={filters.category} items={options.categories || []} onChange={(value) => onChange("category", value)} />
        <button type="button" className="reset-filters" onClick={onReset} disabled={!active}>
          Réinitialiser
        </button>
      </div>
      <p className="map-note">Les filtres s'appliquent aux articles RSS déjà reçus. « À localiser » conserve les articles sans pays d'événement prouvé, sans leur attribuer artificiellement le pays du média.</p>
    </section>
  );
}

function TimeWindowCard({ title, window }) {
  return (
    <div className={`time-card ${window.complete ? "complete" : "incomplete"}`}>
      <span>{title}</span>
      <strong>{window.count}</strong>
      <small>{window.message}</small>
    </div>
  );
}

function TemporalPanel({ timeWindows, nonDetermined, categories }) {
  return (
    <section className="panel temporal-panel" aria-label="Lecture temporelle RSS et couverture de classification">
      <div className="panel-heading">
        <div>
          <p>Dates RSS réelles</p>
          <h2>Lecture temporelle et taxonomie</h2>
        </div>
        <span>{timeWindows.validDateCount} date(s) · {timeWindows.missingDateCount} sans date</span>
      </div>
      <div className="time-grid">
        <TimeWindowCard title="Dernières 6 h" window={timeWindows.last6h} />
        <TimeWindowCard title="Dernières 24 h" window={timeWindows.last24h} />
        <div className="time-card coverage-card">
          <span>Couverture catégories</span>
          <strong>{nonDetermined.coveragePct}%</strong>
          <small>{nonDetermined.notice}</small>
        </div>
      </div>
      <p className="map-note">Référence : dernier article daté {formatDate(timeWindows.referenceSeenAt)} · {timeWindows.notice}</p>
      {nonDetermined.examples.length > 0 ? (
        <p className="map-note">Exemples {nonDetermined.label} : {nonDetermined.examples.map((item) => item.title).join(" · ")}</p>
      ) : null}
      <div className="category-chips" aria-label="Répartition des catégories filtrées">
        {categories.length === 0 ? <span>Aucune catégorie RSS dans le filtre actif.</span> : categories.map((item) => (
          <span key={item.label} className={item.thematic ? "" : "non-thematic"}>{item.label} · {item.count}{item.thematic ? "" : " · hors taxonomie"}</span>
        ))}
      </div>
    </section>
  );
}

function ReadingPanel({ selection }) {
  return (
    <section className="panel reading-panel" id="lecture-detail" aria-label="Panneau de lecture des repères carte">
      <div className="panel-heading">
        <div>
          <p>Lecture du repère</p>
          <h2>{selection?.label || "Choisissez un point sur la carte"}</h2>
        </div>
        <span>{selection ? `${selection.articleCount} article(s)` : "en attente"}</span>
      </div>
      {!selection ? (
        <div className="stream-empty">
          <strong>Aucune sélection active</strong>
          <span>Les détails du point choisi apparaîtront ici.</span>
        </div>
      ) : (
        <div className="reading-content">
          <p className="map-note">{selection.basis}</p>
          <dl>
            <div>
              <dt>{selection.kind === "marker" ? "Pays du média source" : "Pays de l'événement détecté dans le contenu"}</dt>
              <dd>{(selection.kind === "marker" ? selection.sourceCountries : selection.eventCountries).map((country) => `${country.label}${country.code ? ` (${country.code})` : ""}`).join(", ") || "—"}</dd>
            </div>
            <div>
              <dt>Provenance média source</dt>
              <dd>{selection.sourceCountries.map((country) => `${country.label}${country.code ? ` (${country.code})` : ""}`).join(", ") || "—"}</dd>
            </div>
            <div>
              <dt>Médias concernés</dt>
              <dd>{selection.mediaNames.join(", ") || "—"}</dd>
            </div>
            <div>
              <dt>Dernière heure reçue</dt>
              <dd>{formatDate(selection.latestSeenAt)}</dd>
            </div>
          </dl>
          <div className="reading-sublist">
            <strong>Catégories</strong>
            {selection.categories.map((item) => (
              <span key={item.label}>{item.label} · {item.count}{item.thematic ? "" : " · hors taxonomie"}</span>
            ))}
          </div>
          <div className="reading-sublist">
            <strong>Derniers titres</strong>
            {selection.latestTitles.map((item) => (
              <a key={`${item.id}-${item.title}`} href={item.url || "#"} target="_blank" rel="noreferrer">
                {formatDate(item.seenAt)} · {item.mediaName} · {item.title}
              </a>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function SituationBrief({ brief, generatedAt, articles, activeSources, auditedSources, loading = false }) {
  const [feedback, setFeedback] = useState("");
  const safeBrief = brief || {};
  const topCountry = safeBrief.topCountry || null;
  const topCategory = safeBrief.topCategory || null;
  const topCategoryLabel = topCategory?.label || "Aucun thème classé";
  const coveragePct = Number.isFinite(safeBrief.localizationCoveragePct)
    ? safeBrief.localizationCoveragePct
    : safeBrief.localizationPct || 0;
  const qualityPct = Number.isFinite(safeBrief.localizationQualityPct)
    ? safeBrief.localizationQualityPct
    : 0;
  const topMedia = Array.isArray(safeBrief.topMedia) ? safeBrief.topMedia : [];
  const safeArticles = Array.isArray(articles) ? articles : [];

  async function handleCopy() {
    try {
      const copied = await copyText(formatBriefForCopy(safeBrief, generatedAt));
      setFeedback(copied ? "Brief copié." : "Copie indisponible sur cet appareil.");
    } catch {
      setFeedback("Copie indisponible sur cet appareil.");
    }
  }

  function handleDownload() {
    const downloaded = downloadFilteredArticles(safeArticles);
    setFeedback(downloaded ? `Export CSV prêt : ${safeArticles.length} article(s).` : "Export indisponible sur cet appareil.");
  }

  return (
    <section className="panel situation-brief" aria-label="Analyse vérifiable et export des données filtrées">
      <div className="panel-heading brief-heading">
        <div>
          <p>Analyse vérifiable</p>
          <h2>Brief du flux</h2>
        </div>
        <span>{loading ? "mise à jour" : `${safeBrief.articles || 0} articles`}</span>
      </div>
      <p className="brief-headline">{safeBrief.headline || "Le flux est en attente d’articles exploitables."}</p>
      <div className="brief-grid">
        <div>
          <span>Point le plus couvert</span>
          <strong>{topCountry?.label || "Aucun pays confirmé"}</strong>
          <small>{topCountry ? `${topCountry.articleCount} signal${topCountry.articleCount > 1 ? "aux" : ""} · ${safeBrief.concentrationPct || 0}% de la carte` : "Le texte ne nomme pas encore de pays avec assez de certitude."}</small>
        </div>
        <div>
          <span>Thème dominant</span>
          <strong>{topCategoryLabel}</strong>
          <small>{topCategory ? `${topCategory.count} article${topCategory.count > 1 ? "s" : ""} dans le filtre actif` : "Les articles à qualifier sont exclus de ce classement."}</small>
        </div>
        <div>
          <span>Points vérifiés</span>
          <strong>{loading ? "—" : `${qualityPct}%`}</strong>
          <small>{safeBrief.localizedArticles || 0} vérifiés · couverture {coveragePct}% du flux</small>
        </div>
        <div>
          <span>Sources actives</span>
          <strong>{loading ? "—" : `${activeSources}/${auditedSources}`}</strong>
          <small>Contrôlées côté serveur et servies depuis le cache vérifié.</small>
        </div>
      </div>
      <div className="brief-source-line">
        <span>Médias les plus présents</span>
        <p>{topMedia.length > 0 ? topMedia.map((item) => `${item.label} · ${item.count}`).join(" / ") : "Aucune répartition média exploitable sur le filtre actif."}</p>
      </div>
      <div className="brief-actions">
        <button type="button" onClick={handleCopy} disabled={loading}>Copier le brief</button>
        <button type="button" onClick={handleDownload} disabled={loading || safeArticles.length === 0}>Exporter les données CSV</button>
      </div>
      <p className="brief-feedback" role="status" aria-live="polite">{feedback}</p>
      <p className="brief-method">{safeBrief.methodNote || "Cette analyse utilise uniquement les articles RSS réellement reçus et le filtre actuellement affiché."}</p>
    </section>
  );
}

function healthStateLabel(state) {
  const labels = {
    OK: "OK",
    RATE_LIMITED: "Limité",
    TIMEOUT: "Timeout",
    HTTP_ERROR: "HTTP KO",
    INVALID_RESPONSE: "Réponse KO",
    CACHE_STALE: "Cache stale",
    STALE: "Dégradé/stale",
    DEGRADE: "Dégradé",
    UNAVAILABLE: "Indisponible",
    NOT_CHECKED: "Non testé",
    ok: "OK",
    empty: "Vide",
    timeout: "Timeout",
    http_error: "HTTP KO",
    bad_json: "JSON KO",
    bad_xml: "XML KO",
    network_error: "Réseau KO",
  };
  return labels[state] || state || "—";
}

function SourceHealth({ items }) {
  return (
    <section className="panel source-health-panel" aria-label="Santé des sources">
      <div className="panel-heading">
        <div>
          <p>Contrôle des flux</p>
          <h2>Santé des sources</h2>
        </div>
        <span>{items.length} source(s) auditées</span>
      </div>
      <p className="map-note">
        Matrice source | région | URL | HTTP | XML/JSON | articles | récent | état. Cette section lit la mémoire serveur du dernier contrôle : elle ne déclenche aucune requête externe dédiée.
      </p>
      <div className="source-health-table" role="table">
        <div className="source-health-row source-health-head" role="row">
          <span>Source</span><span>Région</span><span>URL</span><span>HTTP</span><span>XML/JSON</span><span>Articles</span><span>Récent</span><span>État</span>
        </div>
        {items.length === 0 ? (
          <p className="muted">Aucun audit source encore disponible.</p>
        ) : items.map((item) => (
          <div key={`${item.source}-${item.url}`} className={`source-health-row state-${item.state}`} role="row">
            <span>{item.source}</span>
            <span>{item.region || "—"}</span>
            <a href={item.url} target="_blank" rel="noreferrer">{item.url}</a>
            <span>{item.http ?? "—"}</span>
            <span>{item.xml ? "OK" : "—"}</span>
            <span>{item.articles ?? 0}</span>
            <span>{item.recent ? "oui" : "non"}</span>
            <span className="health-state-cell">
              <strong>{healthStateLabel(item.state)}</strong>
              {item.nextAttemptAt ? <small>Prochaine tentative : {formatDate(item.nextAttemptAt)}</small> : null}
              {item.detail ? <small>{item.detail}</small> : null}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function trendExamplesLabel(examples) {
  const titles = Array.isArray(examples) ? examples.map((item) => item.title).filter(Boolean).slice(0, 2) : [];
  return titles.length > 0 ? titles.join(" · ") : "contexte source indisponible";
}

function hasTrendContext(item) {
  return Array.isArray(item?.examples) && item.examples.some((example) => String(example?.title || "").trim().length > 12);
}

const GENERIC_TREND_CHIP_TERMS = new Set([
  "after",
  "and",
  "avec",
  "dans",
  "from",
  "man",
  "new",
  "pour",
  "said",
  "says",
  "the",
  "une",
  "with",
  "world",
]);

function isDisplayableTrendChip(item) {
  const term = String(item?.term || "").trim().toLocaleLowerCase("fr-FR");
  return Boolean(term)
    && term.length >= 4
    && /\p{L}/u.test(term)
    && !GENERIC_TREND_CHIP_TERMS.has(term)
    && !/^\d+$/.test(term)
    && hasTrendContext(item);
}

function MomentTrendsPanel({ trends, loading = false }) {
  const rawTrends = Array.isArray(trends?.rawTrends) ? trends.rawTrends : [];
  const fallbackTrends = Array.isArray(trends?.emergingTrends) ? trends.emergingTrends : [];
  const sourceTrends = rawTrends.length > 0 ? rawTrends : fallbackTrends;
  const momentTrends = sourceTrends.filter(isDisplayableTrendChip).slice(0, 3);
  const discardedTrendCount = Math.max(0, sourceTrends.length - momentTrends.length);
  return (
    <section className="panel moment-trends-panel" aria-label="Tendances du moment contextualisées au-dessus des filtres">
      <div className="panel-heading">
        <div>
          <p>Lecture contextuelle</p>
          <h2>Tendances du moment</h2>
        </div>
        <span>Top {momentTrends.length}{discardedTrendCount > 0 ? ` · ${discardedTrendCount} écarté(s)` : ""}</span>
      </div>
      {loading ? <p className="muted">Les tendances se préparent avec les sources en cours de lecture.</p> : null}
      {!loading && sourceTrends.length === 0 ? <p className="muted">Aucun terme contextuel disponible sur ce cycle.</p> : null}
      {!loading && sourceTrends.length > 0 && momentTrends.length === 0 ? <p className="muted">Les termes reçus sont trop génériques ou sans contexte source fiable pour être affichés.</p> : null}
      {!loading && momentTrends.length > 0 ? (
        <div className="moment-trend-chips">
          {momentTrends.map((item) => (
            <span key={item.term}>
              <strong>{item.classified ? `${item.term} · ${item.label}` : item.term}</strong>
              <small>Volume {item.volume} · contexte : {trendExamplesLabel(item.examples)}</small>
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function GlobalTrends({ trends }) {
  const titles = Array.isArray(trends?.topTitles) ? trends.topTitles : [];
  const rawTrends = Array.isArray(trends?.rawTrends) ? trends.rawTrends : [];
  const emergingTrends = Array.isArray(trends?.emergingTrends) ? trends.emergingTrends : [];
  const coverage = Number(trends?.classification?.coveragePct || 0);
  const state = trends?.state || (Number(trends?.documents || 0) > 0 ? "OK" : "UNAVAILABLE");
  const toc = trends?.toc || {};
  const validatedTimestamp = toc.validatedTimestamp || trends?.timestamp || null;
  const validatedAt = toc.validatedAt || toc.fetchedAt || trends?.checkedAt || null;
  const statusLabel = trends?.stale ? "DÉGRADÉ/STALE" : healthStateLabel(state);
  return (
    <section className="panel mini-panel trace-panel" aria-label="Traçabilité GDELT Web N-Grams">
      <h2>Traçabilité GDELT Web N-Grams</h2>
      <p className="muted">
        État {statusLabel} · TOC {validatedTimestamp || "indisponible"} · cycle {trends?.cycleMinutes || 15} min · retard ~{trends?.delayMinutes || 5} min · {trends?.documents || 0} entrée(s) TOC · {rawTrends.length} terme(s) suivi(s) · {emergingTrends.length} signal(aux) contextuel(s) · couverture {formatPercent(coverage)}.
      </p>
      {trends?.stale ? (
        <p className="muted">
          Secours sur dernier TOC réel validé le {formatDate(validatedAt)} ({toc.validatedDocuments || trends?.documents || 0} documents). Dernière tentative : {toc.lastAttemptStatus || trends?.error?.status || "ERR"} · {trends?.error?.reason || "incident non précisé"}.
        </p>
      ) : null}
      {!trends?.stale && state !== "OK" ? (
        <p className="muted">
          TOC indisponible : {trends?.error?.reason || "aucun TOC validé en mémoire"}. Aucune tendance n'est simulée.
        </p>
      ) : null}
      {rawTrends.length === 0 ? <p className="muted">Aucun terme GDELT Web N-Grams exploitable en mémoire.</p> : null}
      {titles.length > 0 ? (
        <p className="muted">Exemple TOC source : {titles[0].title}</p>
      ) : null}
    </section>
  );
}

function ArticleStream({ articles, state, sourceName, loading = false }) {
  return (
    <aside className="panel stream-panel">
      <div className="panel-heading">
        <p>Flux brut normalisé</p>
        <h2>Articles reçus</h2>
      </div>
      {articles.length === 0 ? (
        <div className="stream-empty">
          <strong>{loading ? "Lecture des sources…" : state === "unavailable" ? "Sources non disponibles" : "Aucun article à afficher"}</strong>
          <span>{loading ? "Les articles réels apparaîtront dès que la lecture est terminée." : "Cette zone n'utilise pas de contenu de démonstration."}</span>
        </div>
      ) : null}
      <div className="article-list">
        {articles.slice(0, 12).map((article) => (
          <a key={article.id} className="article-row" href={article.url} target="_blank" rel="noreferrer">
            <span className="article-meta">
              {formatDate(article.seenAt)} · {article.domain} · {article.sourceType || sourceName}
            </span>
            <strong>{article.title}</strong>
            <span className="article-foot">
              {article.label || "Non déterminé"} · {article.labelType || "non déterminé"} · {article.eventCountryIso ? `Pays de l'événement détecté dans le contenu : ${article.eventCountry} (${article.eventCountryIso})` : "À localiser : aucun pays d'événement suffisamment explicite dans le titre/résumé"} · média source : {article.sourceLocation?.label || `${article.sourceCountry} non localisé`} · {article.language}
            </span>
          </a>
        ))}
      </div>
    </aside>
  );
}

export default function WorldPulseDashboard({ initialPayload = null }) {
  const { payload, loading } = useGdeltPulse(initialPayload);
  const [filters, setFilters] = useState({
    region: WORLD_PULSE_FILTER_ALL,
    country: WORLD_PULSE_FILTER_ALL,
    source: WORLD_PULSE_FILTER_ALL,
    category: WORLD_PULSE_FILTER_ALL,
    location: WORLD_PULSE_LOCALIZATION_FILTERS.ALL,
  });
  const [selectedPoint, setSelectedPoint] = useState(null);
  const rawArticles = Array.isArray(payload.articles) ? payload.articles : [];
  const exploration = useMemo(() => deriveWorldPulseExploration(payload, filters, selectedPoint), [payload, filters, selectedPoint]);
  const articles = exploration.articles;
  const mediaMarkers = exploration.mediaMarkers;
  const articleParticles = exploration.articleParticles;
  const articleClusters = exploration.articleClusters;
  const offMapArticles = exploration.offMapArticles;
  const sourceHealth = Array.isArray(payload.sourceHealth) ? payload.sourceHealth : [];
  const globalTrends = payload.globalTrends || { documents: 0, labels: [], categories: [], thematicCategories: [], rawTrends: [], classifiedTrends: [], emergingTrends: [], classification: { coveragePct: 0, unclassified: 0 }, topTitles: [], cycleMinutes: 15, delayMinutes: 5 };
  const payloadCounts = payload.counts || {};
  const counts = {
    ...EMPTY_COUNTS,
    ...payloadCounts,
    articles: exploration.counts.articles,
    rssArticles: exploration.counts.articles,
    rssMediaSources: exploration.counts.mediaSources,
    rssKnownMediaCountries: exploration.counts.sourceCountries,
    eventCountries: exploration.counts.eventCountries,
    rssCategories: exploration.categories.filter((item) => item.thematic).length,
    rssClassifiedArticles: exploration.counts.rssClassifiedArticles,
    rssUnclassifiedArticles: exploration.counts.rssUnclassifiedArticles,
    rssClassificationCoveragePct: exploration.nonDetermined.coveragePct,
    localized: exploration.counts.eventLocalizedArticles,
    unlocalized: exploration.counts.eventUnlocalizedArticles,
    eventLocalizedArticles: exploration.counts.eventLocalizedArticles,
    eventUnlocalizedArticles: exploration.counts.eventUnlocalizedArticles,
    mediaMarkers: mediaMarkers.length,
    articleParticles: articleParticles.length,
    articleClusters: articleClusters.length,
    articleVisiblePoints: articleParticles.filter((particle) => !particle.clusterId).length + articleClusters.length,
    offMapArticles: offMapArticles.length,
  };
  const groupings = {
    domains: [],
    mediaSources: [],
    countries: [],
    eventCountries: [],
    sourceCountries: [],
    sourceRegions: [],
    locations: [],
    sourceLocations: [],
    languages: [],
    labels: [],
    rssCategories: [],
    gdeltNgramsCategories: [],
    offMapReasons: [],
    ...(payload.groupings || {}),
    ...exploration.groupings,
    gdeltNgramsCategories: payload.groupings?.gdeltNgramsCategories || [],
  };
  const dataScopes = payload.dataScopes || {};
  const rssScope = dataScopes.rss || { period: "RSS public · cache ≥15 min", classificationCoveragePct: counts.rssClassificationCoveragePct };
  const localizedCount = counts.localized;
  const unlocalizedCount = counts.unlocalized;
  const visibleArticlePointCount = counts.articleVisiblePoints;
  const rssCoverage = countFromPayload(counts, "rssClassificationCoveragePct", Number(rssScope.classificationCoveragePct || 0));
  const rssHealthItems = sourceHealth.filter((item) => item?.source && !["GDELT Web N-Grams TOC", "GDELT 2.0 DOC API canary", "Cache serveur"].includes(item.source));
  const rssActiveSourceCount = countFromPayload(payloadCounts, "rssActiveSources", rssHealthItems.filter((item) => item.state === "OK").length);
  const rssAuditedSourceCount = countFromPayload(payloadCounts, "rssAuditedSources", rssHealthItems.length || rssActiveSourceCount);
  const rssSourceErrorCount = countFromPayload(payloadCounts, "rssSourcesInError", rssHealthItems.filter((item) => item.state !== "OK").length);
  const rssMediaCountryCount = countFromPayload(payloadCounts, "rssKnownMediaCountries", counts.rssKnownMediaCountries);
  const rssRegionCount = countFromPayload(payloadCounts, "sourceRegions", groupings.sourceRegions.length || counts.sourceRegions);
  const stateLabel = payload.stateLabel || relativeStateLabel(payload.state);
  const sourceName = payload.source?.name || "Source en attente";
  const activeSource = loading ? "Interrogation" : sourceName;
  const sourceMetric = payload.source?.active === "GDELT" ? "GDELT" : payload.source?.active === "RSS_PUBLIC" || payload.source?.active === "RSS_FALLBACK" ? "RSS" : payload.source?.active === "none" ? "Aucune" : "—";
  const freshness = formatFreshness(payload.freshnessSeconds);
  function updateFilter(name, value) {
    setFilters((current) => ({ ...current, [name]: value || WORLD_PULSE_FILTER_ALL }));
    setSelectedPoint(null);
  }

  function resetFilters() {
    setFilters({
      region: WORLD_PULSE_FILTER_ALL,
      country: WORLD_PULSE_FILTER_ALL,
      source: WORLD_PULSE_FILTER_ALL,
      category: WORLD_PULSE_FILTER_ALL,
      location: WORLD_PULSE_LOCALIZATION_FILTERS.ALL,
    });
    setSelectedPoint(null);
  }

  return (
    <main className="pulse-shell">
      <section className="top-strip" aria-label="Introduction de l'observatoire">
        <div className="title-block">
          <p className="eyebrow">Atlas vivant de l'actualité mondiale</p>
          <div className="title-heading">
            <h1>Le Pouls <span>du Monde</span></h1>
          </div>
          <p>
            Voyez les événements cités dans l'actualité prendre forme sur une carte. Chaque signal est relié à une source publique et localisé seulement lorsque le texte le permet vraiment.
          </p>
          <div className="hero-proof" aria-label="Principes de lecture">
            <span>Sources publiques</span>
            <span>Localisation prudente</span>
            <span>Méthode visible</span>
          </div>
        </div>
        <div className={`status-panel state-${loading ? "loading" : payload.state || "loading"}`}>
          <span className="status-dot" aria-hidden="true" />
          <div>
            <p>Lecture des sources</p>
            <strong>{loading ? "Actualisation en cours" : stateLabel}</strong>
            <span>
              Dernière lecture : {formatDate(payload.generatedAt)}<br />
              {payload.source?.cached ? "Données vérifiées en cache" : `Source active : ${activeSource}`}
            </span>
          </div>
          <a href="#carte">Voir la carte <span aria-hidden="true">→</span></a>
        </div>
      </section>

      <section className="map-experience" id="carte">
        <article className="panel map-panel map-panel-wide">
            <div className="panel-heading map-heading">
              <div>
                <p>Carte vivante</p>
                <h2>Les signaux maintenant</h2>
              </div>
              <div className="map-heading-actions">
                <span className="map-status-chip">{loading ? "Lecture des sources…" : `${localizedCount} signaux · ${counts.eventCountries} pays`}</span>
                {unlocalizedCount > 0 ? (
                  <button
                    type="button"
                    className={`off-map-chip${filters.location === WORLD_PULSE_LOCALIZATION_FILTERS.UNLOCALIZED ? " active-off-map-chip" : ""}`}
                    aria-label={`Afficher les ${unlocalizedCount} articles sans localisation fiable`}
                    aria-pressed={filters.location === WORLD_PULSE_LOCALIZATION_FILTERS.UNLOCALIZED}
                    onClick={() => updateFilter("location", WORLD_PULSE_LOCALIZATION_FILTERS.UNLOCALIZED)}
                  >
                    <span>À localiser</span>
                    <strong>{unlocalizedCount}</strong>
                    <span>à traiter</span>
                  </button>
                ) : null}
              </div>
            </div>
            <SignalLegend
              activeCategory={exploration.filters.category}
              onSelectCategory={(category) => updateFilter(
                "category",
                exploration.filters.category === category ? WORLD_PULSE_FILTER_ALL : category,
              )}
            />
            <SignalField
              articleParticles={articleParticles}
              articleClusters={articleClusters}
              unlocalized={unlocalizedCount}
              state={payload.state}
              loading={loading}
              availableCountryCodes={exploration.availableCountryCodes}
              selectedPoint={selectedPoint}
              onSelectPoint={setSelectedPoint}
              onSelectCountry={setSelectedPoint}
            />
            <p className="map-note">
              Survolez un repère sur ordinateur ou touchez-le sur mobile pour lire son détail. Les bulles regroupent seulement les articles proches du même thème.
            </p>
        </article>
        <FilterControls
          compact
          filters={exploration.filters}
          options={exploration.filterOptions}
          resultCount={articles.length}
          totalCount={rawArticles.length}
          localizedCount={localizedCount}
          unlocalizedCount={unlocalizedCount}
          onChange={updateFilter}
          onReset={resetFilters}
        />
      </section>

      <section className="metric-grid metric-grid-primary" aria-label="Repères du moment">
        <Metric label="Signaux cartographiés" value={loading ? "—" : counts.eventLocalizedArticles} hint={`${visibleArticlePointCount} point(s) ou bulle(s) visible(s)`} />
        <Metric label="Pays concernés" value={loading ? "—" : counts.eventCountries} hint="Pays cités clairement dans les articles" />
        <Metric label="Sources en ligne" value={loading ? "—" : `${rssActiveSourceCount}/${rssAuditedSourceCount}`} hint={`${rssMediaCountryCount} pays médias · ${rssSourceErrorCount} incident(s)`} />
        <Metric label="Fraîcheur" value={loading ? "—" : freshness} hint={payload.source?.cached ? "lecture servie depuis le cache vérifié" : `${sourceMetric} actualisé maintenant`} />
      </section>

      <section className={`analysis-grid${exploration.selection ? "" : " analysis-grid-single"}`} aria-label="Analyse vérifiable des articles actuellement filtrés">
        <SituationBrief
          brief={exploration.brief}
          generatedAt={payload.generatedAt}
          articles={articles}
          activeSources={rssActiveSourceCount}
          auditedSources={rssAuditedSourceCount}
          loading={loading}
        />
        {exploration.selection ? <ReadingPanel selection={exploration.selection} /> : null}
      </section>

      <section className="insight-grid" aria-label="Tendances et articles reçus">
        <MomentTrendsPanel trends={globalTrends} loading={loading} />
        <ArticleStream articles={articles} state={payload.state} sourceName={sourceName} loading={loading} />
      </section>

      <details className="details-panel" id="methodologie">
        <summary>
          <span>
            <small>Pour aller plus loin</small>
            <strong>Transparence des données et lecture détaillée</strong>
          </span>
          <b aria-hidden="true">+</b>
        </summary>
        <div className="details-body">
          <p className="details-intro">Les données détaillées restent accessibles ici : couverture des sources, catégories, fraîcheur et méthode de classement. Rien n'est simulé.</p>
          <TemporalPanel
            timeWindows={exploration.timeWindows}
            nonDetermined={exploration.nonDetermined}
            categories={exploration.categories}
          />
          <section className="bottom-grid" aria-label="Détails des signaux et des sources">
            <CountList title="Thèmes dans le flux" items={groupings.rssCategories || groupings.labels || []} emptyLabel="Aucune catégorie RSS calculée." colorize />
            <CountList title="Pays événementiels" items={groupings.eventCountries || groupings.countries || []} emptyLabel="Aucun pays événementiel détecté." />
            <CountList title="Médias RSS" items={groupings.mediaSources || []} emptyLabel="Aucun média RSS reçu." />
            <CountList title="Régions des médias RSS" items={groupings.sourceRegions || []} emptyLabel="Aucune région RSS reçue." />
            <GlobalTrends trends={globalTrends} />
            <section className="panel mini-panel trace-panel">
              <h2>Traçabilité</h2>
              <dl>
                <div><dt>État</dt><dd>{stateLabel}</dd></div>
                <div><dt>Source active</dt><dd>{activeSource}</dd></div>
                <div><dt>Généré</dt><dd>{formatDate(payload.generatedAt)}</dd></div>
                <div><dt>Fraîcheur</dt><dd>{freshness}</dd></div>
                <div><dt>Articles reçus</dt><dd>{loading ? "—" : `${counts.rssArticles} · ${counts.eventLocalizedArticles} localisés`}</dd></div>
                <div><dt>Couverture RSS</dt><dd>{loading ? "—" : `${rssActiveSourceCount}/${rssAuditedSourceCount} sources · ${formatPercent(rssCoverage)}`}</dd></div>
              </dl>
              {payload.error?.detail ? <p className="raw-error">{payload.error.detail}</p> : null}
              <p className="muted">{payload.notice || "Aucune donnée décorative n'est ajoutée."}</p>
            </section>
          </section>
          <SourceHealth items={sourceHealth} />
        </div>
      </details>

      <style jsx global>{`
        :root {
          color-scheme: dark;
          --bg: #051117;
          --bg-soft: #0a1d25;
          --panel: rgba(11, 31, 39, 0.88);
          --panel-strong: rgba(13, 40, 50, 0.96);
          --line: rgba(173, 213, 213, 0.17);
          --line-strong: rgba(140, 211, 208, 0.38);
          --ink: #effafa;
          --muted: #abc4c5;
          --subtle: #71999a;
          --accent: #5fdac9;
          --accent-blue: #7f9bd0;
          --gold: #c59a59;
          --warn: #c59a59;
          --danger: #d77a72;
          --ok: #76aa7d;
          --shadow: 0 24px 90px rgba(0, 0, 0, 0.38);
        }

        * { box-sizing: border-box; }
        html { min-height: 100%; background: var(--bg); }
        body {
          margin: 0;
          min-height: 100%;
          background:
            radial-gradient(circle at 13% 7%, rgba(95, 218, 201, 0.15), transparent 30rem),
            radial-gradient(circle at 88% 0%, rgba(120, 173, 255, 0.13), transparent 28rem),
            radial-gradient(circle at 54% 72%, rgba(233, 191, 109, 0.05), transparent 32rem),
            linear-gradient(180deg, #051117 0%, #071820 48%, #051117 100%);
          color: var(--ink);
          font-family: var(--font-sans);
        }

        a { color: inherit; }
        a:focus-visible, button:focus-visible {
          outline: 2px solid var(--accent);
          outline-offset: 4px;
        }

        .pulse-shell {
          width: min(1320px, calc(100% - 32px));
          margin: 0 auto;
          padding: 28px 0 40px;
        }

        .top-strip {
          display: grid;
          grid-template-columns: minmax(0, 1.45fr) minmax(280px, 0.55fr);
          gap: 12px;
          align-items: start;
          margin-bottom: 12px;
        }

        .title-block, .status-panel, .panel, .metric-card {
          border: 1px solid var(--line);
          background: var(--panel);
          box-shadow: var(--shadow);
          backdrop-filter: blur(18px);
        }

        .title-block {
          min-height: 0;
          padding: clamp(22px, 2.6vw, 32px);
          display: flex;
          flex-direction: column;
          justify-content: center;
          background:
            linear-gradient(118deg, rgba(95, 218, 201, 0.1), transparent 44%),
            var(--panel);
        }

        .eyebrow, .panel-heading p {
          margin: 0 0 10px;
          color: var(--accent);
          font-size: 0.67rem;
          font-weight: 700;
          letter-spacing: 0.11em;
          text-transform: uppercase;
        }

        h1, h2 { margin: 0; text-wrap: pretty; }
        .title-heading {
          min-width: 0;
        }
        h1 {
          font-size: clamp(2.7rem, 4.4vw, 4.8rem);
          line-height: 0.94;
          letter-spacing: -0.06em;
          max-width: 12ch;
        }
        h1 span {
          display: block;
          color: var(--accent);
        }

        .title-block > p:last-child {
          max-width: 760px;
          margin: 13px 0 0;
          color: var(--muted);
          font-size: clamp(0.9rem, 1.17vw, 1.06rem);
          line-height: 1.55;
        }
        .hero-proof {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 12px;
        }
        .hero-proof span {
          padding: 6px 8px;
          border: 1px solid rgba(95, 218, 201, 0.22);
          border-radius: 999px;
          color: #bfe6e1;
          background: rgba(95, 218, 201, 0.06);
          font-size: 0.66rem;
          font-weight: 650;
          letter-spacing: 0.01em;
        }

        .status-panel {
          width: 100%;
          align-self: start;
          padding: 14px 18px;
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto;
          gap: 12px;
          align-items: center;
          background:
            radial-gradient(circle at 90% 0%, rgba(120, 173, 255, 0.16), transparent 38%),
            var(--panel-strong);
        }

        .status-panel p {
          margin: 0 0 5px;
          color: var(--accent-blue);
          font-size: 0.61rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }
        .status-panel strong { display: block; font-size: 1.02rem; margin-bottom: 4px; letter-spacing: -0.02em; }
        .status-panel span:not(.status-dot) { color: var(--muted); font-size: 0.75rem; line-height: 1.45; }
        .status-panel > a {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          width: auto;
          margin: 0;
          padding: 7px 0;
          border: 0;
          color: var(--accent);
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.01em;
          white-space: nowrap;
          text-decoration: none;
        }
        .status-panel > a span { color: var(--accent); }
        .status-dot {
          flex: 0 0 auto;
          width: 11px;
          height: 11px;
          border-radius: 999px;
          background: var(--warn);
          box-shadow: 0 0 0 6px rgba(197, 154, 89, 0.12);
        }
        .state-ok .status-dot { background: var(--ok); box-shadow: 0 0 0 6px rgba(118, 170, 125, 0.12); }
        .state-partial .status-dot { background: var(--warn); box-shadow: 0 0 0 6px rgba(197, 154, 89, 0.16); }
        .state-unavailable .status-dot, .state-error .status-dot { background: var(--danger); box-shadow: 0 0 0 6px rgba(215, 122, 114, 0.12); }

        .metric-grid, .bottom-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 18px;
        }

        .metric-card {
          padding: 18px;
          min-height: 132px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }
        .metric-card span, .metric-card small { color: var(--muted); }
        .metric-card span {
          font-size: 0.66rem;
          font-weight: 800;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }
        .metric-card strong {
          font-size: clamp(2rem, 3.3vw, 3.3rem);
          line-height: 0.9;
          letter-spacing: -0.08em;
          font-variant-numeric: tabular-nums;
        }
        .metric-card small { font-size: 0.7rem; }

        .top-categories-row,
        .filter-panel,
        .temporal-panel,
        .moment-trends-panel {
          margin-bottom: 18px;
        }
        .top-categories-row .mini-panel { min-height: auto; }
        .top-categories-row .count-list {
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }
        .filter-panel .panel-heading > span,
        .temporal-panel .panel-heading > span,
        .reading-panel .panel-heading > span {
          color: var(--muted);
          font-size: 0.72rem;
          border: 1px solid var(--line);
          padding: 8px 10px;
          white-space: nowrap;
        }
        .filter-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(150px, 1fr)) auto;
          gap: 12px;
          align-items: end;
        }
        .filter-select {
          display: grid;
          gap: 7px;
        }
        .filter-select span {
          color: var(--subtle);
          font-size: 0.65rem;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          font-weight: 800;
        }
        .filter-select select,
        .reset-filters {
          min-height: 42px;
          border: 1px solid var(--line);
          background: rgba(255, 255, 255, 0.04);
          color: var(--ink);
          padding: 0 12px;
          font: inherit;
        }
        .filter-select option { color: #07110f; }
        .reset-filters {
          cursor: pointer;
          color: var(--accent);
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        .reset-filters:disabled {
          cursor: not-allowed;
          color: var(--subtle);
          opacity: 0.58;
        }
        .location-filter {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 9px 12px;
          margin: 0 0 12px;
        }
        .location-filter > span {
          color: var(--subtle);
          font-size: 0.65rem;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }
        .location-filter > div {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .location-filter button {
          min-height: 30px;
          border: 1px solid var(--line);
          background: rgba(255, 255, 255, 0.025);
          color: var(--muted);
          padding: 0 9px;
          font: inherit;
          font-size: 0.64rem;
          font-weight: 800;
          cursor: pointer;
        }
        .location-filter button:hover,
        .location-filter button:focus-visible,
        .location-filter .active-location-filter {
          color: var(--accent);
          border-color: color-mix(in srgb, var(--accent) 54%, var(--line));
          background: color-mix(in srgb, var(--accent) 10%, transparent);
          outline: none;
        }
        .compact-filter-panel {
          margin-bottom: 0;
          padding: 14px 16px;
          background: rgba(10, 30, 36, 0.82);
        }
        .compact-filter-panel .panel-heading { margin-bottom: 10px; }
        .compact-filter-panel .panel-heading h2 { font-size: 1rem; }
        .compact-filter-panel .panel-heading > span { padding: 6px 8px; font-size: 0.66rem; }
        .compact-filter-panel .filter-grid {
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 9px;
        }
        .compact-filter-panel .filter-select { gap: 5px; }
        .compact-filter-panel .filter-select select,
        .compact-filter-panel .reset-filters { min-height: 34px; padding: 0 9px; font-size: 0.72rem; }
        .compact-filter-panel .reset-filters { grid-column: 4; font-size: 0.59rem; }
        .compact-filter-panel .map-note { margin: 10px 0 0; font-size: 0.67rem; }
        .time-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }
        .time-card {
          display: grid;
          gap: 8px;
          min-height: 132px;
          padding: 14px;
          border: 1px solid var(--line);
          background: rgba(255, 255, 255, 0.035);
        }
        .time-card span,
        .time-card small {
          color: var(--muted);
          line-height: 1.45;
        }
        .time-card span {
          font-size: 0.65rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.12em;
        }
        .time-card strong {
          color: var(--ink);
          font-size: clamp(1.8rem, 3.6vw, 2.9rem);
          line-height: 0.95;
          font-variant-numeric: tabular-nums;
        }
        .time-card.incomplete { border-color: rgba(245, 189, 79, 0.34); }
        .time-card.complete { border-color: rgba(142, 227, 125, 0.28); }
        .category-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 14px;
        }
        .category-chips span {
          padding: 7px 10px;
          border: 1px solid var(--line);
          border-radius: 999px;
          color: var(--muted);
          background: rgba(255, 255, 255, 0.03);
          font-size: 0.7rem;
          line-height: 1.2;
        }
        .category-chips .non-thematic { border-color: rgba(245, 189, 79, 0.28); color: var(--warn); }

        .details-panel {
          margin-top: 18px;
          border: 1px solid var(--line);
          background: rgba(10, 29, 37, 0.72);
          box-shadow: 0 20px 70px rgba(0, 0, 0, 0.18);
        }
        .details-panel summary {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 20px;
          cursor: pointer;
          list-style: none;
        }
        .details-panel summary::-webkit-details-marker { display: none; }
        .details-panel summary small,
        .details-panel summary strong { display: block; }
        .details-panel summary small {
          margin-bottom: 5px;
          color: var(--accent);
          font-size: 0.61rem;
          font-weight: 800;
          letter-spacing: 0.13em;
          text-transform: uppercase;
        }
        .details-panel summary strong { color: var(--ink); font-size: 1rem; letter-spacing: -0.02em; }
        .details-panel summary b {
          width: 31px;
          height: 31px;
          display: grid;
          flex: 0 0 auto;
          place-items: center;
          border: 1px solid var(--line-strong);
          border-radius: 50%;
          color: var(--accent);
          font-size: 1.1rem;
          transition: transform 0.18s ease;
        }
        .details-panel[open] summary b { transform: rotate(45deg); }
        .details-body { padding: 0 20px 20px; }
        .details-intro {
          max-width: 700px;
          margin: 0 0 18px;
          color: var(--muted);
          font-size: 0.82rem;
          line-height: 1.6;
        }

        .map-experience {
          display: grid;
          gap: 12px;
          margin-bottom: 12px;
          scroll-margin-top: 84px;
        }
        .analysis-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.36fr) minmax(300px, 0.64fr);
          gap: 18px;
          align-items: start;
          margin-bottom: 18px;
        }
        .analysis-grid-single {
          grid-template-columns: minmax(0, 1fr);
        }
        .insight-grid {
          display: grid;
          grid-template-columns: minmax(0, 0.82fr) minmax(0, 1.18fr);
          gap: 18px;
          align-items: start;
          margin-bottom: 18px;
        }
        .map-experience > *, .analysis-grid > *, .insight-grid > *, .map-panel, .reading-panel, .stream-panel {
          min-width: 0;
        }
        .map-panel {
          overflow: hidden;
        }
        .map-panel-wide {
          padding: 18px;
        }

        .panel { padding: 20px; min-width: 0; }
        .panel-heading {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: flex-start;
          margin-bottom: 18px;
        }
        .panel-heading h2, .mini-panel h2 { font-size: clamp(1.04rem, 1.8vw, 1.4rem); letter-spacing: -0.04em; }
        .map-heading-actions {
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          align-items: center;
          gap: 7px;
          max-width: min(100%, 700px);
        }
        .map-status-chip,
        .off-map-chip {
          color: var(--muted);
          display: inline-flex;
          align-items: center;
          min-height: 32px;
          font-size: 0.71rem;
          border: 1px solid var(--line);
          padding: 6px 10px;
          border-radius: 999px;
          max-width: 100%;
          text-align: left;
          white-space: nowrap;
          overflow-wrap: anywhere;
        }
        .off-map-chip {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          width: fit-content;
          background: rgba(255, 255, 255, 0.025);
          color: var(--subtle);
          font-size: 0.68rem;
          font-weight: 700;
          letter-spacing: 0.01em;
          font: inherit;
          cursor: pointer;
        }
        .off-map-chip:hover,
        .off-map-chip:focus-visible,
        .active-off-map-chip {
          color: var(--accent);
          border-color: color-mix(in srgb, var(--accent) 56%, var(--line));
          background: color-mix(in srgb, var(--accent) 10%, transparent);
          outline: none;
        }
        .off-map-chip strong {
          color: var(--ink);
          font-size: 0.75rem;
          line-height: 1;
          font-variant-numeric: tabular-nums;
        }
        .layer-toggle {
          min-height: 32px;
          border: 1px solid var(--line);
          border-radius: 999px;
          background: transparent;
          color: var(--accent);
          padding: 0 12px;
          font: inherit;
          font-size: 0.68rem;
          font-weight: 700;
          letter-spacing: 0.01em;
          cursor: pointer;
        }
        .map-country-picker {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          min-height: 32px;
          max-width: 210px;
          padding: 0 8px;
          border: 1px solid var(--line);
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.025);
          color: var(--muted);
        }
        .map-country-picker > span {
          color: var(--subtle);
          font-size: 0.58rem;
          font-weight: 760;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          white-space: nowrap;
        }
        .map-country-picker select {
          min-width: 0;
          max-width: 126px;
          border: 0;
          background: transparent;
          color: var(--ink);
          font: inherit;
          font-size: 0.69rem;
          outline: none;
          cursor: pointer;
        }
        .map-country-picker option { color: #07110f; }

        .signal-field {
          position: relative;
          width: 100%;
          min-width: 0;
          padding: 8px;
          overflow: hidden;
          border: 1px solid var(--line-strong);
          background:
            radial-gradient(circle at 48% 45%, rgba(62, 214, 195, 0.13), transparent 35%),
            radial-gradient(circle at 70% 55%, rgba(131, 168, 255, 0.09), transparent 30%),
            linear-gradient(135deg, rgba(255, 255, 255, 0.035), transparent 45%),
            #07110f;
        }
        .map-viewport {
          position: relative;
          width: 100%;
          aspect-ratio: 2 / 1;
          overflow: hidden;
          isolation: isolate;
          border-radius: 18px;
          box-shadow: inset 0 0 0 1px rgba(140, 211, 208, 0.22);
        }
        .world-map {
          position: absolute;
          z-index: 1;
          inset: 0;
          width: 100%;
          height: 100%;
          opacity: 0.92;
          filter: drop-shadow(0 0 36px rgba(62, 214, 195, 0.08));
        }
        .map-ocean {
          fill: rgba(3, 12, 11, 0.48);
          stroke: rgba(157, 191, 179, 0.16);
          stroke-width: 1.2;
        }
        .map-sphere {
          fill: rgba(3, 12, 11, 0.52);
          stroke: rgba(157, 191, 179, 0.22);
          stroke-width: 1.1;
          vector-effect: non-scaling-stroke;
        }
        .map-land {
          fill: url(#landGlow);
          stroke: rgba(157, 191, 179, 0.35);
          stroke-width: 0.62;
          vector-effect: non-scaling-stroke;
        }
        .map-country-button {
          cursor: pointer;
          fill: color-mix(in srgb, var(--accent) 18%, #25483f);
          stroke: rgba(62, 214, 195, 0.58);
        }
        .map-country-button:hover,
        .map-country-button:focus-visible,
        .selected-country {
          fill: color-mix(in srgb, var(--accent) 34%, #25483f);
          stroke: var(--accent);
          outline: none;
        }
        .muted-land { opacity: 0.54; }
        .map-line {
          fill: none;
          stroke: rgba(157, 191, 179, 0.08);
          stroke-width: 1;
          vector-effect: non-scaling-stroke;
        }
        .field-grid {
          position: absolute;
          z-index: 2;
          inset: 0;
          pointer-events: none;
          opacity: 0.38;
          background-image:
            linear-gradient(rgba(157, 191, 179, 0.11) 1px, transparent 1px),
            linear-gradient(90deg, rgba(157, 191, 179, 0.11) 1px, transparent 1px);
          background-size: 52px 52px;
          mask-image: radial-gradient(circle at center, black 0 50%, transparent 86%);
        }
        .particle-layer {
          position: absolute;
          z-index: 3;
          inset: 0;
          pointer-events: none;
        }
        .provenance-speck {
          position: absolute;
          z-index: 3;
          width: 5px;
          height: 5px;
          border-radius: 2px;
          pointer-events: none;
          transform: translate(-50%, -50%);
          background: color-mix(in srgb, var(--source-color) 62%, #102a27);
          box-shadow: 0 0 8px color-mix(in srgb, var(--source-color) 28%, transparent);
          opacity: 0.7;
        }
        .country-beacon {
          position: absolute;
          z-index: 4;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          min-width: var(--beacon-width);
          height: var(--beacon-height);
          padding: 0 10px 0 8px;
          border: 1px solid color-mix(in srgb, var(--beacon-color) 52%, rgba(157, 191, 179, 0.28));
          border-radius: 11px;
          appearance: none;
          background:
            linear-gradient(100deg, color-mix(in srgb, var(--beacon-color) 20%, #0b1917), rgba(7, 18, 16, 0.94)),
            #07110f;
          color: var(--ink);
          cursor: pointer;
          pointer-events: auto;
          transform: translate(-50%, -50%);
          box-shadow: 0 8px 18px rgba(0, 0, 0, 0.3);
          transition: transform 0.16s ease, border-color 0.16s ease, background 0.16s ease, box-shadow 0.16s ease;
        }
        .country-beacon::after {
          content: "";
          position: absolute;
          inset: -7px;
        }
        .country-beacon:hover,
        .country-beacon:focus-visible {
          z-index: 7;
          border-color: color-mix(in srgb, var(--beacon-color) 82%, var(--accent));
          background: linear-gradient(100deg, color-mix(in srgb, var(--beacon-color) 30%, #0b1917), rgba(7, 18, 16, 0.98));
          box-shadow: 0 12px 24px rgba(0, 0, 0, 0.36);
          outline: none;
          transform: translate(-50%, calc(-50% - 2px));
        }
        .selected-beacon {
          z-index: 8;
          border-color: var(--accent);
          box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 34%, transparent), 0 12px 24px rgba(0, 0, 0, 0.36);
        }
        .beacon-rail {
          width: 3px;
          height: calc(var(--beacon-height) * 0.52);
          border-radius: 2px;
          background: var(--beacon-color);
          box-shadow: 0 0 8px color-mix(in srgb, var(--beacon-color) 44%, transparent);
        }
        .country-beacon > strong {
          color: #e4f2ee;
          font-size: clamp(0.78rem, 1.8vw, 1rem);
          font-weight: 760;
          line-height: 1;
          letter-spacing: -0.03em;
          font-variant-numeric: tabular-nums;
        }
        .beacon-code {
          color: var(--muted);
          font-size: 0.59rem;
          font-weight: 760;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          white-space: nowrap;
        }
        .single-country-beacon .beacon-code { color: color-mix(in srgb, var(--beacon-color) 78%, var(--ink)); }
        .beacon-tooltip {
          position: absolute;
          z-index: 9;
          left: var(--beacon-tooltip-left, 50%);
          top: var(--beacon-tooltip-top, auto);
          bottom: var(--beacon-tooltip-bottom, calc(100% + 10px));
          width: max-content;
          max-width: min(230px, calc(100vw - 28px));
          display: grid;
          gap: 4px;
          padding: 9px 10px;
          border: 1px solid color-mix(in srgb, var(--beacon-color) 46%, var(--line));
          background: rgba(5, 14, 12, 0.97);
          color: var(--muted);
          font-size: 0.66rem;
          font-weight: 500;
          line-height: 1.35;
          text-align: left;
          text-transform: none;
          letter-spacing: 0;
          white-space: normal;
          overflow-wrap: anywhere;
          box-shadow: 0 16px 42px rgba(0, 0, 0, 0.4);
          opacity: 0;
          pointer-events: none;
          transform: translate(var(--beacon-tooltip-x, -50%), 6px) scale(0.97);
          transition: opacity 0.16s ease, transform 0.16s ease;
        }
        .beacon-tooltip strong { color: var(--ink); font-size: 0.74rem; }
        .country-beacon:hover .beacon-tooltip,
        .country-beacon:focus-visible .beacon-tooltip {
          opacity: 1;
          transform: translate(var(--beacon-tooltip-x, -50%), 0) scale(1);
        }
        .map-focus-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          margin-top: 12px;
          padding: 11px 12px;
          border: 1px solid color-mix(in srgb, var(--accent) 28%, var(--line));
          border-left: 3px solid var(--accent);
          background: linear-gradient(100deg, rgba(95, 218, 201, 0.08), rgba(255, 255, 255, 0.02));
        }
        .map-focus-card > div:first-child { min-width: 0; }
        .map-focus-card > div:first-child > span {
          display: block;
          margin-bottom: 3px;
          color: var(--accent);
          font-size: 0.59rem;
          font-weight: 760;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }
        .map-focus-card strong { display: block; color: var(--ink); font-size: 0.86rem; line-height: 1.3; }
        .map-focus-card p { margin: 4px 0 0; color: var(--muted); font-size: 0.69rem; line-height: 1.45; }
        .map-focus-guidance { border-left-color: color-mix(in srgb, var(--accent) 46%, var(--line)); background: rgba(255, 255, 255, 0.018); }
        .map-focus-actions {
          display: flex;
          flex: 0 0 auto;
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: 6px;
        }
        .map-focus-actions a,
        .map-focus-actions button {
          min-height: 28px;
          border: 1px solid var(--line);
          background: transparent;
          color: var(--accent);
          padding: 0 8px;
          font: inherit;
          font-size: 0.65rem;
          font-weight: 700;
          text-decoration: none;
          cursor: pointer;
        }
        .map-focus-actions button { color: var(--muted); }

        /* Les points sont l'interface principale : aucune pastille blanche,
           seulement une lumière colorée et une zone tactile volontairement large. */
        .particle {
          --particle-visual-scale: 1;
          position: absolute;
          z-index: 3;
          display: block;
          padding: 0;
          border: 0;
          border-radius: 999px;
          cursor: pointer;
          pointer-events: auto;
          touch-action: manipulation;
          transform: translate(-50%, -50%) scale(var(--particle-visual-scale));
          background: color-mix(in srgb, var(--particle-color) 74%, #0d1e1d);
          transition: transform 0.16s ease, box-shadow 0.16s ease, filter 0.16s ease, opacity 0.16s ease;
        }
        button.particle { appearance: none; }
        .particle::after {
          content: "";
          position: absolute;
          inset: -11px;
          border-radius: inherit;
        }
        .article-particle {
          z-index: 3;
          opacity: 0.96;
          background: radial-gradient(circle at 35% 28%, color-mix(in srgb, var(--particle-color) 92%, #f1fffb), color-mix(in srgb, var(--particle-color) 70%, #09201c) 58%, rgba(7, 18, 16, 0.1));
          box-shadow: 0 0 9px color-mix(in srgb, var(--particle-color) 82%, transparent), 0 0 22px color-mix(in srgb, var(--particle-color) 40%, transparent);
          animation: none;
        }
        /* Une poignée de points reste vivante sur ordinateur, sans imposer des
           centaines de recalculs de filtre/opacity au navigateur. */
        @media (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference) {
          .particle-layer > .article-particle:nth-child(-n + 64) {
            animation: pulseFloat 4.8s ease-in-out infinite;
            animation-delay: var(--particle-delay);
          }
        }
        .article-cluster {
          z-index: 4;
          display: grid;
          place-items: center;
          border: 1px solid color-mix(in srgb, var(--particle-color) 94%, transparent);
          background: radial-gradient(circle at 34% 30%, color-mix(in srgb, var(--particle-color) 88%, rgba(244, 255, 251, 0.44)), color-mix(in srgb, var(--particle-color) 66%, #0a211d) 62%, rgba(7, 18, 16, 0.2));
          box-shadow: 0 0 0 2px color-mix(in srgb, var(--particle-color) 32%, transparent), 0 0 28px color-mix(in srgb, var(--particle-color) 74%, transparent), 0 8px 18px rgba(0, 0, 0, 0.22);
        }
        .media-marker {
          z-index: 4;
          border: 1px solid color-mix(in srgb, var(--particle-color) 62%, transparent);
          background: color-mix(in srgb, var(--particle-color) 36%, #0b211d);
          box-shadow: 0 0 0 2px color-mix(in srgb, var(--particle-color) 13%, transparent), 0 0 13px color-mix(in srgb, var(--particle-color) 34%, transparent);
        }
        .cluster-count {
          color: #effcf8;
          font-size: var(--cluster-font-size, 0.7rem);
          font-weight: 760;
          line-height: 1;
          letter-spacing: -0.04em;
          font-variant-numeric: tabular-nums;
          text-shadow: 0 1px 5px rgba(0, 0, 0, 0.86);
        }
        .particle:hover,
        .particle:focus-visible {
          z-index: 8;
          outline: none;
          filter: brightness(1.18) saturate(1.08);
          transform: translate(-50%, -50%) scale(1.18);
        }
        .selected-particle {
          z-index: 9;
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--particle-color) 18%, transparent), 0 0 28px color-mix(in srgb, var(--particle-color) 72%, transparent), 0 8px 18px rgba(0, 0, 0, 0.24);
        }
        .particle-tooltip {
          position: absolute;
          z-index: 10;
          left: var(--particle-tooltip-left, 50%);
          top: var(--particle-tooltip-top, auto);
          bottom: var(--particle-tooltip-bottom, calc(100% + 10px));
          width: max-content;
          max-width: min(210px, calc(100vw - 24px));
          display: grid;
          gap: 3px;
          padding: 8px 9px;
          border: 1px solid color-mix(in srgb, var(--particle-color) 50%, var(--line));
          background: rgba(5, 15, 13, 0.96);
          color: var(--muted);
          font-size: 0.64rem;
          line-height: 1.35;
          text-align: left;
          white-space: normal;
          overflow-wrap: anywhere;
          box-shadow: 0 16px 42px rgba(0, 0, 0, 0.4);
          opacity: 0;
          pointer-events: none;
          transform: translate(var(--particle-tooltip-x, -50%), 6px) scale(0.96);
          transition: opacity 0.16s ease, transform 0.16s ease;
        }
        .particle:hover .particle-tooltip,
        .particle:focus-visible .particle-tooltip {
          opacity: 1;
          transform: translate(var(--particle-tooltip-x, -50%), 0) scale(1);
        }

        .state-copy {
          position: absolute;
          z-index: 4;
          inset: 0;
          display: grid;
          place-content: center;
          gap: 12px;
          text-align: center;
          color: var(--muted);
          padding: 24px;
          background: radial-gradient(circle at center, rgba(7, 17, 15, 0.72), transparent 48%);
        }
        .compact-state { inset: auto 18px 18px auto; max-width: 360px; place-content: start; text-align: left; background: rgba(7, 17, 15, 0.72); border: 1px solid var(--line); }
        .state-copy strong { color: var(--ink); font-size: 1.17rem; }
        .loader {
          width: 42px;
          height: 42px;
          margin: 0 auto 6px;
          border: 2px solid rgba(157, 191, 179, 0.25);
          border-top-color: var(--accent);
          border-radius: 999px;
          animation: spin 0.9s linear infinite;
        }
        .stream-panel { max-height: 780px; overflow: hidden; }
        .article-list {
          display: grid;
          gap: 10px;
          max-height: 680px;
          overflow: auto;
          padding-right: 4px;
        }
        .article-row {
          display: grid;
          gap: 8px;
          padding: 14px;
          min-height: 86px;
          text-decoration: none;
          border: 1px solid var(--line);
          background: rgba(255, 255, 255, 0.035);
          transition: border-color 0.16s ease, background 0.16s ease, transform 0.16s ease;
        }
        .article-row:hover { border-color: var(--line-strong); background: rgba(255, 255, 255, 0.06); transform: translateY(-1px); }
        .article-row strong { line-height: 1.3; text-wrap: pretty; }
        .article-meta, .article-foot { color: var(--muted); font-size: 0.7rem; line-height: 1.35; }
        .stream-empty {
          border: 1px dashed var(--line-strong);
          padding: 18px;
          color: var(--muted);
          display: grid;
          gap: 8px;
        }
        .stream-empty strong { color: var(--ink); }

        .reading-panel {
          overflow: hidden;
        }
        .reading-content {
          display: grid;
          gap: 14px;
        }
        .reading-content dl {
          display: grid;
          gap: 10px;
          margin: 0;
        }
        .reading-content dl div {
          display: grid;
          gap: 4px;
          padding-bottom: 10px;
          border-bottom: 1px solid var(--line);
        }
        .reading-content dt {
          color: var(--subtle);
          font-size: 0.65rem;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          font-weight: 800;
        }
        .reading-content dd {
          margin: 0;
          color: var(--ink);
          line-height: 1.35;
          overflow-wrap: anywhere;
        }
        .reading-sublist {
          display: grid;
          gap: 8px;
          padding: 12px;
          border: 1px solid var(--line);
          background: rgba(255, 255, 255, 0.03);
        }
        .reading-sublist strong { color: var(--ink); }
        .reading-sublist span,
        .reading-sublist a {
          color: var(--muted);
          font-size: 0.74rem;
          line-height: 1.35;
          overflow-wrap: anywhere;
          text-decoration: none;
        }
        .reading-sublist a:hover { color: var(--ink); }

        .situation-brief {
          border-color: color-mix(in srgb, var(--accent) 34%, var(--line));
          background:
            linear-gradient(135deg, rgba(95, 218, 201, 0.1), rgba(127, 155, 208, 0.05) 58%, rgba(255, 255, 255, 0.02)),
            var(--panel);
        }
        .brief-heading { margin-bottom: 12px; }
        .brief-heading > span {
          color: var(--accent);
          border: 1px solid color-mix(in srgb, var(--accent) 36%, var(--line));
          padding: 7px 9px;
          border-radius: 999px;
          font-size: 0.66rem;
          white-space: nowrap;
        }
        .brief-headline {
          margin: 0;
          color: var(--ink);
          font-size: 0.94rem;
          font-weight: 650;
          line-height: 1.45;
          text-wrap: pretty;
        }
        .brief-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 7px;
          margin-top: 13px;
        }
        .brief-grid > div {
          display: grid;
          align-content: start;
          gap: 5px;
          min-height: 108px;
          padding: 10px;
          border: 1px solid rgba(157, 191, 179, 0.18);
          background: rgba(4, 16, 14, 0.22);
        }
        .brief-grid span,
        .brief-source-line > span {
          color: var(--subtle);
          font-size: 0.57rem;
          font-weight: 760;
          letter-spacing: 0.09em;
          line-height: 1.3;
          text-transform: uppercase;
        }
        .brief-grid strong { color: var(--ink); font-size: 0.88rem; line-height: 1.2; overflow-wrap: anywhere; }
        .brief-grid small { color: var(--muted); font-size: 0.63rem; line-height: 1.4; }
        .brief-source-line {
          display: grid;
          gap: 4px;
          margin-top: 12px;
          padding-top: 11px;
          border-top: 1px solid var(--line);
        }
        .brief-source-line p { margin: 0; color: var(--muted); font-size: 0.7rem; line-height: 1.45; }
        .brief-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          margin-top: 13px;
        }
        .brief-actions button {
          min-height: 32px;
          border: 1px solid color-mix(in srgb, var(--accent) 36%, var(--line));
          border-radius: 8px;
          background: rgba(95, 218, 201, 0.08);
          color: var(--accent);
          padding: 0 10px;
          font: inherit;
          font-size: 0.66rem;
          font-weight: 720;
          cursor: pointer;
        }
        .brief-actions button:last-child { color: var(--muted); background: rgba(255, 255, 255, 0.025); border-color: var(--line); }
        .brief-actions button:hover,
        .brief-actions button:focus-visible { border-color: var(--accent); outline: none; }
        .brief-actions button:disabled { cursor: not-allowed; opacity: 0.52; }
        .brief-feedback { min-height: 1.25em; margin: 9px 0 0; color: var(--accent); font-size: 0.66rem; line-height: 1.35; }
        .brief-method { margin: 0; color: var(--subtle); font-size: 0.67rem; line-height: 1.45; }

        .mini-panel { min-height: 250px; box-shadow: none; }
        .muted { color: var(--muted); line-height: 1.55; }
        .count-list { display: grid; gap: 14px; margin-top: 18px; }
        .count-row { display: grid; gap: 8px; }
        .count-row div { display: flex; justify-content: space-between; gap: 12px; color: var(--muted); font-size: 0.81rem; }
        .count-label { display: inline-flex; align-items: center; gap: 7px; min-width: 0; }
        .count-label span { overflow-wrap: anywhere; }
        .count-dot {
          width: 10px;
          height: 10px;
          flex: 0 0 auto;
          border-radius: 999px;
          background: var(--count-row-color);
          box-shadow: 0 0 16px var(--count-row-color);
        }
        .count-row-colored .count-label {
          color: var(--count-row-color);
        }
        .count-row strong { color: var(--ink); font-variant-numeric: tabular-nums; }
        .count-row i {
          display: block;
          height: 4px;
          min-width: 10px;
          background: var(--count-row-color, var(--accent));
          box-shadow: 0 0 20px color-mix(in srgb, var(--count-row-color, var(--accent)) 45%, transparent);
        }

        .moment-trends-panel {
          margin: -4px 0 18px;
          border-color: color-mix(in srgb, var(--accent) 32%, var(--line));
          background:
            linear-gradient(135deg, rgba(62, 214, 195, 0.09), rgba(255, 255, 255, 0.025)),
            var(--panel);
          box-shadow: 0 18px 58px rgba(0, 0, 0, 0.22);
        }
        .moment-trends-panel .panel-heading { margin-bottom: 12px; }
        .moment-trends-panel .panel-heading > span {
          color: var(--accent);
          font-size: 0.68rem;
          border: 1px solid color-mix(in srgb, var(--accent) 34%, var(--line));
          padding: 7px 10px;
          border-radius: 999px;
          white-space: nowrap;
        }
        .moment-trend-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .moment-trend-chips > span {
          display: grid;
          gap: 3px;
          max-width: 260px;
          padding: 9px 11px;
          border: 1px solid var(--line);
          border-radius: 18px;
          background: rgba(255, 255, 255, 0.035);
        }
        .moment-trend-chips strong { color: var(--ink); font-size: 0.83rem; line-height: 1.25; overflow-wrap: anywhere; }
        .moment-trend-chips small { color: var(--muted); font-size: 0.65rem; line-height: 1.35; overflow-wrap: anywhere; }

        .trace-panel dl { display: grid; gap: 10px; margin: 18px 0; }
        .trace-panel dl div { display: grid; gap: 4px; padding-bottom: 10px; border-bottom: 1px solid var(--line); }
        .trace-panel dt { color: var(--subtle); font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.12em; font-weight: 800; }
        .trace-panel dd { margin: 0; color: var(--ink); overflow-wrap: anywhere; line-height: 1.35; }
        .map-note {
          margin: 14px 0 0;
          color: var(--muted);
          font-size: 0.77rem;
          line-height: 1.55;
        }
        .signal-legend {
          display: flex;
          flex-wrap: wrap;
          gap: 10px 14px;
          align-items: flex-start;
          margin: 0 0 12px;
          padding: 12px;
          border: 1px solid color-mix(in srgb, var(--accent) 38%, var(--line));
          border-radius: 14px;
          background: linear-gradient(105deg, rgba(95, 218, 201, 0.12), rgba(255, 255, 255, 0.035));
        }
        .signal-legend-heading {
          display: grid;
          gap: 4px;
          min-width: 126px;
        }
        .signal-legend-title {
          color: var(--accent);
          font-size: 0.62rem;
          font-weight: 780;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }
        .signal-legend-heading small {
          color: var(--subtle);
          font-size: 0.62rem;
          line-height: 1.25;
        }
        .signal-legend ul {
          list-style: none;
          display: flex;
          flex: 1 1 640px;
          flex-wrap: wrap;
          gap: 6px 14px;
          align-items: start;
          margin: 0;
          padding: 0;
        }
        .signal-legend li {
          min-width: 0;
        }
        .signal-legend button {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          min-height: 23px;
          border: 1px solid color-mix(in srgb, var(--legend-color) 25%, transparent);
          border-radius: 999px;
          background: color-mix(in srgb, var(--legend-color) 7%, transparent);
          color: color-mix(in srgb, var(--legend-color) 34%, var(--ink));
          padding: 3px 7px;
          font: inherit;
          font-size: 0.67rem;
          line-height: 1.2;
          cursor: pointer;
        }
        .signal-legend button:hover,
        .signal-legend button:focus-visible,
        .signal-legend .active-legend-item {
          border-color: color-mix(in srgb, var(--legend-color) 66%, var(--line));
          background: color-mix(in srgb, var(--legend-color) 15%, transparent);
          color: var(--ink);
          outline: none;
        }
        .signal-legend i {
          width: 10px;
          height: 10px;
          flex: 0 0 auto;
          border-radius: 999px;
          background: var(--legend-color);
          box-shadow: 0 0 12px color-mix(in srgb, var(--legend-color) 82%, transparent);
        }
        .signal-legend > p {
          flex: 1 0 100%;
          margin: 0;
          color: var(--subtle);
          font-size: 0.67rem;
          line-height: 1.35;
        }
        .source-health-panel { margin-bottom: 22px; overflow: hidden; }
        .source-health-panel .panel-heading > span {
          color: var(--muted);
          font-size: 0.72rem;
          border: 1px solid var(--line);
          padding: 8px 10px;
          white-space: nowrap;
        }
        .source-health-table {
          display: grid;
          gap: 6px;
          margin-top: 16px;
          overflow-x: auto;
          padding-bottom: 4px;
        }
        .source-health-row {
          display: grid;
          grid-template-columns: minmax(150px, 1.2fr) minmax(110px, 0.75fr) minmax(260px, 1.8fr) 70px 86px 80px 78px minmax(160px, 1fr);
          gap: 10px;
          align-items: center;
          min-width: 980px;
          padding: 10px 12px;
          border: 1px solid var(--line);
          background: rgba(255, 255, 255, 0.03);
          color: var(--muted);
          font-size: 0.7rem;
        }
        .source-health-row a { color: var(--ink); overflow-wrap: anywhere; text-decoration: none; }
        .health-state-cell { display: flex; flex-direction: column; gap: 4px; }
        .health-state-cell strong { font-size: 0.74rem; }
        .health-state-cell small { color: var(--muted); line-height: 1.35; }
        .source-health-head {
          color: var(--subtle);
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          background: rgba(255, 255, 255, 0.045);
        }
        .source-health-row.state-ok span:last-child { color: var(--ok); }
        .source-health-row.state-timeout span:last-child,
        .source-health-row.state-http_error span:last-child,
        .source-health-row.state-bad_xml span:last-child,
        .source-health-row.state-bad_json span:last-child,
        .source-health-row.state-network_error span:last-child { color: var(--warn); }
        .raw-error {
          max-height: 110px;
          overflow: auto;
          padding: 10px;
          color: #ffd7d2;
          background: rgba(255, 111, 97, 0.1);
          border: 1px solid rgba(255, 111, 97, 0.24);
          font-size: 0.7rem;
          line-height: 1.45;
        }

        @keyframes pulseFloat {
          0%, 100% { opacity: 0.78; filter: saturate(0.95); }
          50% { opacity: 1; filter: saturate(1.25); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        @media (max-width: 1080px) {
          .top-strip, .analysis-grid, .insight-grid { grid-template-columns: 1fr; }
          .metric-grid, .bottom-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .top-categories-row .count-list { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .filter-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .time-grid { grid-template-columns: 1fr; }
          .stream-panel { max-height: none; }
          .article-list { max-height: none; }
          .brief-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }

        @media (hover: none), (pointer: coarse) {
          .particle::after { inset: -34px; }
          .particle-tooltip { display: none; }
          .particle:hover { transform: translate(-50%, -50%) scale(var(--particle-visual-scale)); }
        }

        @media (max-width: 680px) {
          .pulse-shell { width: min(1320px, calc(100% - 20px)); padding-top: 10px; }
          .title-block, .status-panel, .panel, .metric-card, .details-panel { border-radius: 0; }
          .metric-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .bottom-grid, .filter-grid { grid-template-columns: 1fr; }
          .metric-card { min-height: 118px; padding: 14px 12px; }
          .metric-card span { font-size: 0.56rem; letter-spacing: 0.1em; }
          .metric-card strong { font-size: clamp(1.95rem, 10vw, 2.65rem); }
          .metric-card small { font-size: 0.62rem; line-height: 1.35; }
          .compact-filter-panel .filter-grid { grid-template-columns: 1fr; }
          .compact-filter-panel .reset-filters { grid-column: auto; }
          .location-filter { align-items: flex-start; flex-direction: column; gap: 7px; }
          .location-filter > div { width: 100%; }
          .location-filter button { flex: 1 1 30%; padding-inline: 6px; }
          .top-strip, .metric-grid, .bottom-grid, .map-experience, .analysis-grid, .insight-grid { gap: 10px; margin-bottom: 10px; }
          .title-block { min-height: 0; padding: 18px; }
          .status-panel { grid-template-columns: auto minmax(0, 1fr); align-items: start; }
          .status-panel > a { grid-column: 2; justify-self: start; }
          h1 { font-size: clamp(2.55rem, 12vw, 3.7rem); }
          .title-block > p:last-child { margin-top: 10px; font-size: 0.84rem; line-height: 1.48; }
          .hero-proof { margin-top: 10px; }
          .top-categories-row .count-list { grid-template-columns: 1fr; }
          .map-heading-actions { justify-content: flex-start; width: 100%; }
          .map-status-chip, .off-map-chip { max-width: none; text-align: left; border-radius: 14px; width: 100%; }
          .panel { padding: 16px; }
          .signal-field { padding: 5px; }
          .map-viewport { border-radius: 11px; }
          .particle { --particle-visual-scale: var(--particle-mobile-scale, 0.58); }
          .particle::after { inset: -34px; }
          .particle:hover,
          .particle:focus-visible { transform: translate(-50%, -50%) scale(var(--particle-mobile-active-scale, 0.7)); }
          .cluster-count { font-size: var(--cluster-mobile-font-size, var(--cluster-font-size, 0.7rem)); }
          .brief-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .signal-legend { display: flex; gap: 9px 12px; padding: 11px; }
          .signal-legend-heading { min-width: 0; }
          .signal-legend ul { display: flex; flex: 1 0 100%; gap: 7px 12px; }
          .signal-legend li { min-width: 0; }
          .panel-heading { flex-direction: column; }
          .details-panel { margin-top: 10px; }
          .details-panel summary, .details-body { padding-left: 16px; padding-right: 16px; }
          .hero-proof span { font-size: 0.56rem; }
        }

        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            scroll-behavior: auto !important;
            animation-duration: 0.001ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.001ms !important;
          }
        }
      `}</style>
    </main>
  );
}
