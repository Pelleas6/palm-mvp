"use client";

import { useEffect, useMemo, useState } from "react";
import { geoEquirectangular, geoGraticule10, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import worldAtlas from "world-atlas/countries-110m.json";
import { WORLD_PULSE_SIGNAL_LEGEND, colorForWorldPulseSignalLabel } from "../lib/world-pulse-signals.js";
import { SOURCE_COUNTRY_REGISTRY } from "../lib/world-pulse-geography.js";
import { WORLD_PULSE_FILTER_ALL, deriveWorldPulseExploration } from "../lib/world-pulse-exploration.js";

const REFRESH_MS = 10 * 60 * 1000;
const EMPTY_COUNTS = {
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
  rssKnownMediaCountries: 0,
  rssCategories: 0,
  rssClassifiedArticles: 0,
  rssUnclassifiedArticles: 0,
  rssClassificationCoveragePct: 0,
  gdeltNgramsDocuments: 0,
  gdeltNgramsCategories: 0,
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

function countFromPayload(payloadCounts, key, fallback = 0) {
  const value = payloadCounts?.[key];
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function WorldMapBackdrop({ availableCountryCodes = [], selectedCountryCode = null, onSelectCountry = () => {} }) {
  const selectableCodes = new Set(availableCountryCodes);
  function countryInteractionProps(country) {
    if (!country.code || !selectableCodes.has(country.code)) return {};
    const selected = selectedCountryCode === country.code;
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
      "aria-label": `Lire les signaux du pays média ISO ${country.code}`,
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

function useGdeltPulse(initialPayload) {
  const [payload, setPayload] = useState(() => initialPayload || { state: "loading" });
  const [loading, setLoading] = useState(() => !initialPayload);

  useEffect(() => {
    let active = true;
    let timer;
    let hasPayload = Boolean(initialPayload);

    function applyClientError(errorPayload) {
      if (!hasPayload) {
        setPayload(errorPayload);
        return;
      }
      setPayload((current) => ({
        ...current,
        clientError: errorPayload.error,
        notice: `${current.notice || ""} Dernier rafraîchissement client non appliqué : ${errorPayload.error.reason}.`.trim(),
      }));
    }

    async function load() {
      if (!hasPayload) setLoading(true);
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
        setPayload(data);
        hasPayload = true;
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

    load();
    timer = window.setInterval(load, REFRESH_MS);
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

function SignalLegend({ visibleLabel }) {
  return (
    <div className="signal-legend" aria-label="Registre déterministe des catégories de signaux RSS et GDELT">
      <div className="signal-legend-head">
        <span>Registre déterministe</span>
        <strong>{visibleLabel}</strong>
        <small>12 catégories thématiques · « Non déterminé » reste hors taxonomie utile</small>
      </div>
      <ul>
        {WORLD_PULSE_SIGNAL_LEGEND.map((item) => (
          <li key={item.label}>
            <i aria-hidden="true" style={{ "--legend-color": item.color }} />
            <span>{item.label}{item.thematic === false ? " · hors taxonomie" : ""}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SignalField({ mediaMarkers, articleParticles, articleClusters, unlocalized, state, loading, availableCountryCodes, selectedPoint, onSelectPoint, onSelectCountry }) {
  const markers = useMemo(() => (
    mediaMarkers.map((point, index) => ({
      ...point,
      kind: "media",
      left: clamp(point.x, 4, 96),
      top: clamp(point.y, 8, 88),
      size: point.size || 8,
      color: colorForLabel(point.label),
      delay: `${(index % 12) * 0.08}s`,
    }))
  ), [mediaMarkers]);
  const particles = useMemo(() => (
    articleParticles.filter((point) => !point.clusterId).map((point, index) => ({
      ...point,
      kind: "article",
      left: clamp(point.x, 4, 96),
      top: clamp(point.y, 8, 88),
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
      left: clamp(point.x, 4, 96),
      top: clamp(point.y, 8, 88),
      size: point.size || 14,
      color: colorForLabel(point.label),
      delay: `${((index + 8) % 18) * 0.06}s`,
    }))
  ), [articleClusters]);
  const hasVisiblePoints = markers.length > 0 || particles.length > 0 || clusters.length > 0;

  function renderPoint(point, className) {
    const safeOffset = Math.ceil((point.size || 8) / 2 + 10);
    const sourceCountry = point.sourceCountry || point.location?.label || "Non précisé";
    const countLabel = point.kind === "media" ? formatArticleCount(point.articleCount) : point.kind === "article-cluster" ? formatArticleCount(point.count) : "1 article";
    const typeLabel = point.kind === "media" ? "Repère média" : point.kind === "article-cluster" ? "Cluster articles" : "Particule article";
    const titlePart = point.kind === "article" && point.title ? ` — ${point.title}` : "";
    const clusterTitles = point.kind === "article-cluster" && point.sampleTitles?.length ? ` — ${point.sampleTitles.join(" · ")}` : "";
    const tooltip = `${typeLabel} — ${point.mediaName}${titlePart}${clusterTitles} — pays du média source : ${sourceCountry} — ${countLabel} — catégorie : ${point.label}`;
    const style = {
      left: `clamp(${safeOffset}px, ${point.left}%, calc(100% - ${safeOffset}px))`,
      top: `clamp(${safeOffset}px, ${point.top}%, calc(100% - ${safeOffset}px))`,
      width: `${point.size}px`,
      height: `${point.size}px`,
      "--particle-color": point.color,
      "--particle-delay": point.delay,
      "--particle-safe-offset": `${safeOffset}px`,
    };
    const selectionType = point.kind === "media" ? "marker" : point.kind === "article-cluster" ? "cluster" : "article";
    const isPanelPoint = point.kind === "media" || point.kind === "article-cluster";
    const isSelected = selectedPoint?.type === selectionType && selectedPoint?.id === point.id;
    const Tag = isPanelPoint ? "button" : point.url ? "a" : "button";
    const linkProps = isPanelPoint
      ? { type: "button", onClick: () => onSelectPoint({ type: selectionType, id: point.id }), "aria-pressed": isSelected }
      : point.url
        ? { href: point.url, target: "_blank", rel: "noreferrer" }
        : { type: "button", onClick: () => onSelectPoint({ type: selectionType, id: point.id }), "aria-pressed": isSelected };
    return (
      <Tag
        key={`${point.kind}-${point.id}`}
        className={`particle ${className}${isSelected ? " selected-particle" : ""}`}
        {...linkProps}
        style={style}
        title={tooltip}
        aria-label={`${typeLabel}, ${point.mediaName}, pays du média source : ${sourceCountry}, ${countLabel}, catégorie : ${point.label}`}
      >
        {point.kind === "article-cluster" ? <span className="cluster-count" aria-hidden="true">{point.count}</span> : null}
        <span className="particle-tooltip" role="tooltip">
          <strong>{point.mediaName}</strong>
          <span>{typeLabel}</span>
          {point.title ? <span>{point.title}</span> : null}
          {point.sampleTitles?.length ? <span>{point.sampleTitles.join(" · ")}</span> : null}
          <span>Pays du média source : {sourceCountry}</span>
          <span>{countLabel}</span>
          <span>Catégorie : {point.label}</span>
        </span>
      </Tag>
    );
  }

  return (
    <div className="signal-field" aria-label="Carte du monde des sources médias localisées : repères médias et particules articles">
      <WorldMapBackdrop
        availableCountryCodes={availableCountryCodes}
        selectedCountryCode={selectedPoint?.type === "country" ? selectedPoint.code : null}
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
          <strong>Aucune source localisable sur la carte</strong>
          <span>Les articles réels restent comptés hors carte pour ne pas inventer de position.</span>
        </div>
      ) : null}
      {!loading && !hasVisiblePoints && unlocalized === 0 ? (
        <div className="state-copy">
          <strong>{state === "unavailable" ? "Sources indisponibles" : "Aucun signal exploitable"}</strong>
          <span>La visualisation reste vide tant qu'aucun article réel n'est reçu.</span>
        </div>
      ) : null}
      {particles.map((particle) => renderPoint(particle, "article-particle"))}
      {clusters.map((cluster) => renderPoint(cluster, "article-cluster"))}
      {markers.map((marker) => renderPoint(marker, "media-marker"))}
      {unlocalized > 0 ? (
        <div className="unlocalized-badge" aria-label={`${unlocalized} articles sans localisation fiable`}>
          <span>Hors carte</span>
          <strong>{unlocalized}</strong>
          <small>pays média non vérifié</small>
        </div>
      ) : null}
    </div>
  );
}

function CountList({ title, items, emptyLabel }) {
  const max = Math.max(1, ...items.map((item) => item.count));
  return (
    <section className="panel mini-panel">
      <h2>{title}</h2>
      {items.length === 0 ? <p className="muted">{emptyLabel}</p> : null}
      <div className="count-list">
        {items.map((item) => (
          <div key={item.label} className="count-row">
            <div>
              <span>{item.label}</span>
              <strong>{item.count}</strong>
            </div>
            <i style={{ width: `${Math.max(10, (item.count / max) * 100)}%` }} />
          </div>
        ))}
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

function FilterControls({ filters, options, resultCount, totalCount, onChange, onReset }) {
  const active = hasActiveFilters(filters);
  return (
    <section className="panel filter-panel" aria-label="Filtres RSS réinitialisables">
      <div className="panel-heading">
        <div>
          <p>Exploration RSS</p>
          <h2>Filtres cohérents carte · liste · compteurs</h2>
        </div>
        <span>{resultCount}/{totalCount} article(s) affichés</span>
      </div>
      <div className="filter-grid">
        <FilterSelect label="Région" value={filters.region} items={options.regions || []} onChange={(value) => onChange("region", value)} />
        <FilterSelect label="Pays média ISO" value={filters.country} items={options.countries || []} onChange={(value) => onChange("country", value)} />
        <FilterSelect label="Source" value={filters.source} items={options.sources || []} onChange={(value) => onChange("source", value)} />
        <FilterSelect label="Catégorie" value={filters.category} items={options.categories || []} onChange={(value) => onChange("category", value)} />
        <button type="button" className="reset-filters" onClick={onReset} disabled={!active}>
          Réinitialiser
        </button>
      </div>
      <p className="map-note">
        Les filtres s'appliquent uniquement aux articles RSS déjà reçus : aucune requête externe navigateur, aucune donnée de démonstration.
      </p>
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
    <section className="panel reading-panel" aria-label="Panneau de lecture des repères carte">
      <div className="panel-heading">
        <div>
          <p>Lecture au clic ou clavier</p>
          <h2>{selection?.label || "Sélectionnez un repère, un pays ou un cluster"}</h2>
        </div>
        <span>{selection ? `${selection.articleCount} article(s)` : "en attente"}</span>
      </div>
      {!selection ? (
        <div className="stream-empty">
          <strong>Aucune sélection active</strong>
          <span>Les pays média colorés, les repères média et les clusters sont focusables au clavier. La lecture reste fondée sur le pays média ISO vérifié.</span>
        </div>
      ) : (
        <div className="reading-content">
          <p className="map-note">{selection.basis}</p>
          <dl>
            <div>
              <dt>Pays média ISO vérifié</dt>
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

function GlobalTrends({ trends }) {
  const labels = Array.isArray(trends?.categories) ? trends.categories : (Array.isArray(trends?.labels) ? trends.labels : []);
  const titles = Array.isArray(trends?.topTitles) ? trends.topTitles : [];
  const coverage = Number(trends?.classification?.coveragePct || 0);
  const state = trends?.state || (Number(trends?.documents || 0) > 0 ? "OK" : "UNAVAILABLE");
  const toc = trends?.toc || {};
  const validatedTimestamp = toc.validatedTimestamp || trends?.timestamp || null;
  const validatedAt = toc.validatedAt || toc.fetchedAt || trends?.checkedAt || null;
  const statusLabel = trends?.stale ? "DÉGRADÉ/STALE" : healthStateLabel(state);
  return (
    <section className="panel mini-panel trace-panel" aria-label="Tendances globales GDELT Web N-Grams">
      <h2>Tendances GDELT Web N-Grams</h2>
      <p className="muted">
        État {statusLabel} · TOC {validatedTimestamp || "indisponible"} · cycle {trends?.cycleMinutes || 15} min · retard ~{trends?.delayMinutes || 5} min · {trends?.documents || 0} document(s) · couverture {formatPercent(coverage)}.
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
      {labels.length > 0 ? (
        <div className="count-list">
          {labels.slice(0, 5).map((item) => (
            <div className="count-row" key={item.label}>
              <div><span>{item.label}</span><strong>{item.count}</strong></div>
              <i style={{ "--width": `${Math.min(100, Math.max(8, item.count * 12))}%` }} />
            </div>
          ))}
        </div>
      ) : <p className="muted">Aucune tendance GDELT Web N-Grams exploitable en mémoire.</p>}
      {titles.length > 0 ? (
        <p className="muted">Exemple : {titles[0].title}</p>
      ) : null}
    </section>
  );
}

function ArticleStream({ articles, state, sourceName }) {
  return (
    <aside className="panel stream-panel">
      <div className="panel-heading">
        <p>Flux brut normalisé</p>
        <h2>Articles reçus</h2>
      </div>
      {articles.length === 0 ? (
        <div className="stream-empty">
          <strong>{state === "unavailable" ? "Sources non disponibles" : "Aucun article à afficher"}</strong>
          <span>Cette zone n'utilise pas de contenu de démonstration.</span>
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
              {article.label || "Non déterminé"} · {article.labelType || "non déterminé"} · média source : {article.sourceLocation?.label || `${article.sourceCountry} non localisé`} · événement non géolocalisé par ce tableau · {article.language}
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
  const globalTrends = payload.globalTrends || { documents: 0, labels: [], categories: [], thematicCategories: [], classification: { coveragePct: 0, unclassified: 0 }, topTitles: [], cycleMinutes: 15, delayMinutes: 5 };
  const payloadCounts = payload.counts || {};
  const counts = {
    ...EMPTY_COUNTS,
    ...payloadCounts,
    articles: exploration.counts.articles,
    rssArticles: exploration.counts.articles,
    rssMediaSources: exploration.counts.mediaSources,
    rssKnownMediaCountries: exploration.counts.countries,
    rssCategories: exploration.categories.filter((item) => item.thematic).length,
    rssClassifiedArticles: exploration.counts.rssClassifiedArticles,
    rssUnclassifiedArticles: exploration.counts.rssUnclassifiedArticles,
    rssClassificationCoveragePct: exploration.nonDetermined.coveragePct,
    localized: articleParticles.length,
    unlocalized: offMapArticles.length,
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
    sourceRegions: [],
    locations: [],
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
  const gdeltScope = dataScopes.gdeltNgrams || { period: `cycle ${globalTrends.cycleMinutes || 15} min`, classificationCoveragePct: counts.gdeltNgramsClassificationCoveragePct };
  const localizedCount = counts.localized;
  const unlocalizedCount = counts.unlocalized;
  const visibleMediaCount = mediaMarkers.length;
  const visibleArticleParticleCount = articleParticles.length;
  const visibleArticleClusterCount = articleClusters.length;
  const visibleArticlePointCount = articleParticles.filter((particle) => !particle.clusterId).length + articleClusters.length;
  const totalMediaCount = Math.max(counts.rssMediaSources, visibleMediaCount);
  const rssCoverage = countFromPayload(counts, "rssClassificationCoveragePct", Number(rssScope.classificationCoveragePct || 0));
  const gdeltCoverage = countFromPayload(payloadCounts, "gdeltNgramsClassificationCoveragePct", Number(gdeltScope.classificationCoveragePct || 0));
  const visibleMediaLabel = loading ? "— repères médias RSS" : `${visibleMediaCount}/${totalMediaCount} repères médias RSS · ${visibleArticleParticleCount} particules RSS · ${visibleArticleClusterCount} clusters · ${unlocalizedCount} hors carte`;
  const hasRealData = payload.state === "ok" || payload.state === "partial" || payload.state === "empty";
  const stateLabel = payload.stateLabel || relativeStateLabel(payload.state);
  const sourceName = payload.source?.name || "Source en attente";
  const activeSource = loading ? "Interrogation" : sourceName;
  const sourceMetric = payload.source?.active === "GDELT" ? "GDELT" : payload.source?.active === "RSS_PUBLIC" || payload.source?.active === "RSS_FALLBACK" ? "RSS" : payload.source?.active === "none" ? "Aucune" : "—";
  const freshness = formatFreshness(payload.freshnessSeconds);
  const latestSeenAt = articles
    .map((article) => article.seenAt)
    .filter(Boolean)
    .sort()
    .at(-1);

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
    });
    setSelectedPoint(null);
  }

  return (
    <main className="pulse-shell">
      <section className="top-strip" aria-label="Synthèse du tableau de bord">
        <div className="title-block">
          <p className="eyebrow">Monitor mondial · RSS public temps réel · GDELT Web N-Grams · canari DOC · cache serveur ≥15 min</p>
          <h1>Le Pouls du Monde</h1>
          <p>
            Tableau de bord expérimental des signaux médiatiques mondiaux. Les points, listes, compteurs et labels sont
            calculés depuis des articles réels RSS publics. Les tendances globales utilisent le TOC GDELT Web N-Grams ; GDELT DOC reste un canari technique limité.
          </p>
        </div>
        <div className={`status-panel state-${payload.state || "loading"}`}>
          <span className="status-dot" aria-hidden="true" />
          <div>
            <strong>{loading ? "Actualisation" : stateLabel}</strong>
            <span>
              Source active : {activeSource} · Généré : {formatDate(payload.generatedAt)} · Fraîcheur : {freshness}
            </span>
          </div>
        </div>
      </section>

      <section className="metric-grid" aria-label="Synthèse source et cache">
        <Metric label="Articles RSS" value={loading ? "—" : counts.rssArticles} hint={`Collectés ${counts.rssArticlesFetched} · rendus carte ${counts.rssArticlesRendered} · tronqués ${counts.rssArticlesTruncated}`} />
        <Metric label="Médias RSS uniques" value={loading ? "—" : counts.rssMediaSources} hint="RSS public · sources agrégées par média" />
        <Metric label="Pays médias connus" value={loading ? "—" : counts.rssKnownMediaCountries} hint="RSS public · sourceCountry déclaré, sans invention" />
        <Metric label="Particules carte" value={loading ? "—" : counts.articleParticles} hint={`${visibleArticlePointCount} point(s) visuels · pays média source vérifié`} />
        <Metric label="Clusters articles" value={loading ? "—" : counts.articleClusters} hint="Même pays média + même catégorie + proximité" />
        <Metric label="Hors carte" value={loading ? "—" : unlocalizedCount} hint="Pays média source non vérifié ou placement impossible" />
        <Metric label="Catégories RSS" value={loading ? "—" : counts.rssCategories} hint={`RSS public · registre 12 thèmes · couverture ${formatPercent(rssCoverage)}`} />
        <Metric label="Non déterminé RSS" value={loading ? "—" : counts.rssUnclassifiedArticles} hint="Hors taxonomie utile · aucun mot-clé déterministe" />
        <Metric label="Docs GDELT N-Grams" value={loading ? "—" : counts.gdeltNgramsDocuments} hint={`GDELT Web N-Grams TOC · ${gdeltScope.period || "cycle 15 min"}`} />
        <Metric label="Catégories GDELT" value={loading ? "—" : counts.gdeltNgramsCategories} hint={`GDELT N-Grams · documents TOC · couverture ${formatPercent(gdeltCoverage)}`} />
        <Metric label="Fraîcheur" value={loading ? "—" : freshness} hint={payload.source?.cached ? "cache serveur" : `${sourceMetric} généré maintenant`} />
      </section>

      <FilterControls
        filters={exploration.filters}
        options={exploration.filterOptions}
        resultCount={articles.length}
        totalCount={rawArticles.length}
        onChange={updateFilter}
        onReset={resetFilters}
      />

      <TemporalPanel
        timeWindows={exploration.timeWindows}
        nonDetermined={exploration.nonDetermined}
        categories={exploration.categories}
      />

      <section className="main-grid">
        <article className="panel map-panel">
          <div className="panel-heading map-heading">
            <div>
              <p>Carte géographique</p>
              <h2>Sources média localisées</h2>
            </div>
            <span>{hasRealData ? `${visibleMediaLabel} · ${localizedCount} articles RSS avec pays média vérifié` : "visualisation suspendue"}</span>
          </div>
          <SignalField
            mediaMarkers={mediaMarkers}
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
          <SignalLegend visibleLabel={visibleMediaLabel} />
          <p className="map-note">
            Les grands repères représentent les médias RSS localisés (6-8px), les petites particules représentent les articles RSS avec pays média source vérifié (3-5px), et les bulles regroupent seulement des particules proches de même pays et même catégorie. Ils ne prétendent jamais localiser l'événement raconté par l'article.
          </p>
        </article>
        <aside className="side-stack">
          <ReadingPanel selection={exploration.selection} />
          <ArticleStream articles={articles} state={payload.state} sourceName={sourceName} />
        </aside>
      </section>

      <section className="bottom-grid" aria-label="Regroupements RSS et GDELT séparés">
        <CountList title="Médias RSS" items={groupings.mediaSources || []} emptyLabel="Aucun média RSS reçu." />
        <CountList title="Régions RSS" items={groupings.sourceRegions || []} emptyLabel="Aucune région RSS reçue." />
        <CountList title="Pays médias RSS" items={groupings.countries || []} emptyLabel="Aucun pays média RSS reçu." />
        <CountList title="Localisations carte RSS" items={groupings.locations || []} emptyLabel="Aucune source RSS localisable." />
        <CountList title="Hors carte RSS" items={groupings.offMapReasons || []} emptyLabel="Aucun article hors carte." />
        <CountList title="Domaines articles RSS" items={groupings.domains || []} emptyLabel="Aucun domaine RSS reçu." />
        <CountList title="Catégories RSS" items={groupings.rssCategories || groupings.labels || []} emptyLabel="Aucune catégorie RSS calculée." />
        <CountList title="Catégories GDELT N-Grams" items={groupings.gdeltNgramsCategories || []} emptyLabel="Aucune catégorie GDELT N-Grams calculée." />
        <GlobalTrends trends={globalTrends} />
        <section className="panel mini-panel trace-panel">
          <h2>Traçabilité</h2>
          <dl>
            <div>
              <dt>État</dt>
              <dd>{stateLabel}</dd>
            </div>
            <div>
              <dt>Source active</dt>
              <dd>{activeSource}</dd>
            </div>
            <div>
              <dt>Généré</dt>
              <dd>{formatDate(payload.generatedAt)}</dd>
            </div>
            <div>
              <dt>Fraîcheur</dt>
              <dd>{freshness}</dd>
            </div>
            <div>
              <dt>Articles RSS</dt>
              <dd>{loading ? "—" : `${counts.rssArticles} · collectés ${counts.rssArticlesFetched} · tronqués ${counts.rssArticlesTruncated}`}</dd>
            </div>
            <div>
              <dt>Médias RSS uniques</dt>
              <dd>{loading ? "—" : counts.rssMediaSources}</dd>
            </div>
            <div>
              <dt>Pays médias connus</dt>
              <dd>{loading ? "—" : counts.rssKnownMediaCountries}</dd>
            </div>
            <div>
              <dt>Catégories RSS</dt>
              <dd>{loading ? "—" : counts.rssCategories}</dd>
            </div>
            <div>
              <dt>Non déterminé RSS</dt>
              <dd>{loading ? "—" : `${counts.rssUnclassifiedArticles} · couverture ${formatPercent(rssCoverage)}`}</dd>
            </div>
            <div>
              <dt>Docs GDELT N-Grams</dt>
              <dd>{loading ? "—" : counts.gdeltNgramsDocuments}</dd>
            </div>
            <div>
              <dt>Catégories GDELT</dt>
              <dd>{loading ? "—" : `${counts.gdeltNgramsCategories} · couverture ${formatPercent(gdeltCoverage)}`}</dd>
            </div>
            <div>
              <dt>Localisés carte</dt>
              <dd>{loading ? "—" : `${localizedCount} particules · ${counts.articleClusters} clusters · ${visibleArticlePointCount} points visuels`}</dd>
            </div>
            <div>
              <dt>Hors carte</dt>
              <dd>{loading ? "—" : unlocalizedCount}</dd>
            </div>
            <div>
              <dt>Dernier article</dt>
              <dd>{formatDate(latestSeenAt)}</dd>
            </div>
            <div>
              <dt>Cache</dt>
              <dd>{payload.cache?.status || "—"}</dd>
            </div>
            <div>
              <dt>Requête</dt>
              <dd>{payload.query ? `${payload.query} · canari GDELT DOC uniquement` : "—"}</dd>
            </div>
          </dl>
          {payload.error?.detail ? <p className="raw-error">{payload.error.detail}</p> : null}
          <p className="muted">{payload.notice || "Aucune donnée décorative n'est ajoutée."}</p>
        </section>
      </section>

      <SourceHealth items={sourceHealth} />

      <style jsx global>{`
        :root {
          color-scheme: dark;
          --bg: #07110f;
          --bg-soft: #0d1d1a;
          --panel: rgba(12, 29, 26, 0.88);
          --panel-strong: rgba(18, 43, 38, 0.94);
          --line: rgba(157, 191, 179, 0.19);
          --line-strong: rgba(157, 191, 179, 0.34);
          --ink: #eff8f3;
          --muted: #9dbfb3;
          --subtle: #6f9187;
          --accent: #3ed6c3;
          --warn: #f5bd4f;
          --danger: #ff6f61;
          --ok: #8ee37d;
          --shadow: 0 24px 90px rgba(0, 0, 0, 0.38);
        }

        * { box-sizing: border-box; }
        html { min-height: 100%; background: var(--bg); }
        body {
          margin: 0;
          min-height: 100%;
          background:
            radial-gradient(circle at 15% 10%, rgba(62, 214, 195, 0.16), transparent 28rem),
            radial-gradient(circle at 85% 0%, rgba(245, 189, 79, 0.12), transparent 26rem),
            linear-gradient(180deg, #07110f 0%, #0a1715 48%, #07110f 100%);
          color: var(--ink);
          font-family: "Aptos", "Segoe UI", "Helvetica Neue", Arial, sans-serif;
        }

        a { color: inherit; }
        a:focus-visible, button:focus-visible {
          outline: 2px solid var(--accent);
          outline-offset: 4px;
        }

        .pulse-shell {
          width: min(1480px, calc(100% - 32px));
          margin: 0 auto;
          padding: 28px 0 40px;
        }

        .top-strip {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(280px, 390px);
          gap: 18px;
          align-items: stretch;
          margin-bottom: 18px;
        }

        .title-block, .status-panel, .panel, .metric-card {
          border: 1px solid var(--line);
          background: var(--panel);
          box-shadow: var(--shadow);
          backdrop-filter: blur(18px);
        }

        .title-block {
          min-height: 190px;
          padding: clamp(24px, 4vw, 44px);
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
        }

        .eyebrow, .panel-heading p {
          margin: 0 0 10px;
          color: var(--accent);
          font-size: 0.74rem;
          font-weight: 800;
          letter-spacing: 0.16em;
          text-transform: uppercase;
        }

        h1, h2 { margin: 0; text-wrap: pretty; }
        h1 {
          font-size: clamp(2.9rem, 7vw, 7.2rem);
          line-height: 0.88;
          letter-spacing: -0.08em;
          max-width: 9ch;
        }

        .title-block > p:last-child {
          max-width: 760px;
          margin: 22px 0 0;
          color: var(--muted);
          font-size: clamp(1rem, 1.3vw, 1.18rem);
          line-height: 1.65;
        }

        .status-panel {
          padding: 24px;
          display: flex;
          gap: 16px;
          align-items: flex-start;
          justify-content: space-between;
          background: var(--panel-strong);
        }

        .status-panel strong { display: block; font-size: 1.3rem; margin-bottom: 8px; }
        .status-panel span:not(.status-dot) { color: var(--muted); line-height: 1.45; }
        .status-dot {
          flex: 0 0 auto;
          width: 15px;
          height: 15px;
          margin-top: 4px;
          border-radius: 999px;
          background: var(--warn);
          box-shadow: 0 0 0 8px rgba(245, 189, 79, 0.12);
        }
        .state-ok .status-dot { background: var(--ok); box-shadow: 0 0 0 8px rgba(142, 227, 125, 0.12); }
        .state-partial .status-dot { background: var(--warn); box-shadow: 0 0 0 8px rgba(245, 189, 79, 0.16); }
        .state-unavailable .status-dot, .state-error .status-dot { background: var(--danger); box-shadow: 0 0 0 8px rgba(255, 111, 97, 0.12); }

        .metric-grid, .bottom-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 18px;
        }

        .metric-card {
          padding: 18px;
          min-height: 118px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }
        .metric-card span, .metric-card small { color: var(--muted); }
        .metric-card span {
          font-size: 0.73rem;
          font-weight: 800;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }
        .metric-card strong {
          font-size: clamp(2rem, 4vw, 4.2rem);
          line-height: 0.9;
          letter-spacing: -0.08em;
          font-variant-numeric: tabular-nums;
        }
        .metric-card small { font-size: 0.78rem; }

        .filter-panel, .temporal-panel {
          margin-bottom: 18px;
        }
        .filter-panel .panel-heading > span,
        .temporal-panel .panel-heading > span,
        .reading-panel .panel-heading > span {
          color: var(--muted);
          font-size: 0.8rem;
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
          font-size: 0.72rem;
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
          font-size: 0.72rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.12em;
        }
        .time-card strong {
          color: var(--ink);
          font-size: clamp(2rem, 4vw, 3.2rem);
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
          color: var(--muted);
          background: rgba(255, 255, 255, 0.03);
          font-size: 0.78rem;
        }
        .category-chips .non-thematic { border-color: rgba(245, 189, 79, 0.28); color: var(--warn); }

        .main-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.55fr) minmax(340px, 0.75fr);
          gap: 18px;
          margin-bottom: 18px;
        }
        .side-stack {
          display: grid;
          gap: 18px;
          align-content: start;
        }

        .panel { padding: 20px; }
        .panel-heading {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: flex-start;
          margin-bottom: 18px;
        }
        .panel-heading h2, .mini-panel h2 { font-size: clamp(1.15rem, 2vw, 1.55rem); letter-spacing: -0.04em; }
        .map-heading > span {
          color: var(--muted);
          font-size: 0.8rem;
          border: 1px solid var(--line);
          padding: 8px 10px;
          border-radius: 999px;
          max-width: min(100%, 620px);
          text-align: right;
          white-space: normal;
          overflow-wrap: anywhere;
        }

        .signal-field {
          position: relative;
          aspect-ratio: 2 / 1;
          min-height: clamp(360px, 40vw, 620px);
          overflow: hidden;
          border: 1px solid var(--line-strong);
          background:
            radial-gradient(circle at 48% 45%, rgba(62, 214, 195, 0.13), transparent 35%),
            radial-gradient(circle at 70% 55%, rgba(131, 168, 255, 0.09), transparent 30%),
            linear-gradient(135deg, rgba(255, 255, 255, 0.035), transparent 45%),
            #07110f;
        }
        .world-map {
          position: absolute;
          inset: clamp(8px, 2vw, 18px);
          width: calc(100% - clamp(16px, 4vw, 36px));
          height: calc(100% - clamp(16px, 4vw, 36px));
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
          inset: 0;
          opacity: 0.38;
          background-image:
            linear-gradient(rgba(157, 191, 179, 0.11) 1px, transparent 1px),
            linear-gradient(90deg, rgba(157, 191, 179, 0.11) 1px, transparent 1px);
          background-size: 52px 52px;
          mask-image: radial-gradient(circle at center, black 0 50%, transparent 86%);
        }
        .signal-field::before, .signal-field::after {
          content: "";
          position: absolute;
          pointer-events: none;
          border: 1px solid rgba(157, 191, 179, 0.16);
          border-radius: 999px;
          inset: 18%;
        }
        .signal-field::after { inset: 34%; border-style: dashed; }

        .particle {
          position: absolute;
          z-index: 3;
          display: block;
          padding: 0;
          border: 0;
          cursor: pointer;
          transform: translate(-50%, -50%);
          border-radius: 999px;
          background: var(--particle-color);
          animation: pulseFloat 3.6s ease-in-out infinite;
          animation-delay: var(--particle-delay);
        }
        button.particle { appearance: none; }
        .media-marker {
          z-index: 4;
          border: 1px solid color-mix(in srgb, var(--particle-color) 78%, var(--ink));
          box-shadow: 0 0 0 5px color-mix(in srgb, var(--particle-color) 18%, transparent), 0 0 22px var(--particle-color);
        }
        .article-particle {
          z-index: 3;
          border: none;
          opacity: 0.92;
          box-shadow: 0 0 0 2px color-mix(in srgb, var(--particle-color) 24%, transparent), 0 0 11px var(--particle-color);
        }
        .article-cluster {
          z-index: 4;
          display: grid;
          place-items: center;
          border: 1px solid color-mix(in srgb, var(--particle-color) 84%, var(--ink));
          box-shadow: 0 0 0 5px color-mix(in srgb, var(--particle-color) 18%, transparent), 0 0 24px var(--particle-color);
        }
        .cluster-count {
          color: #07110f;
          font-size: 0.62rem;
          font-weight: 900;
          line-height: 1;
          font-variant-numeric: tabular-nums;
        }
        .particle::after {
          content: "";
          position: absolute;
          inset: -7px;
          border-radius: inherit;
        }
        .media-marker::after {
          inset: -10px;
          border: 1px solid color-mix(in srgb, var(--particle-color) 30%, transparent);
        }
        .particle:hover { z-index: 5; transform: translate(-50%, -50%) scale(1.45); }
        .selected-particle {
          z-index: 6;
          outline: 2px solid var(--ink);
          outline-offset: 5px;
        }
        .particle-tooltip {
          position: absolute;
          z-index: 6;
          left: 50%;
          bottom: calc(100% + 14px);
          width: max-content;
          max-width: min(260px, calc(100vw - 40px));
          display: grid;
          gap: 4px;
          padding: 10px 12px;
          border: 1px solid color-mix(in srgb, var(--particle-color) 45%, var(--line));
          background: rgba(5, 14, 12, 0.96);
          color: var(--muted);
          font-size: 0.74rem;
          line-height: 1.35;
          box-shadow: 0 16px 42px rgba(0, 0, 0, 0.34);
          opacity: 0;
          pointer-events: none;
          transform: translate(-50%, 6px) scale(0.92);
          transition: opacity 0.16s ease, transform 0.16s ease;
        }
        .particle-tooltip strong { color: var(--ink); font-size: 0.82rem; }
        .particle:hover .particle-tooltip,
        .particle:focus-visible .particle-tooltip {
          opacity: 1;
          transform: translate(-50%, 0) scale(1);
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
        .state-copy strong { color: var(--ink); font-size: 1.3rem; }
        .loader {
          width: 42px;
          height: 42px;
          margin: 0 auto 6px;
          border: 2px solid rgba(157, 191, 179, 0.25);
          border-top-color: var(--accent);
          border-radius: 999px;
          animation: spin 0.9s linear infinite;
        }
        .unlocalized-badge {
          position: absolute;
          z-index: 4;
          right: 16px;
          top: 16px;
          display: grid;
          gap: 2px;
          min-width: 128px;
          padding: 12px 14px;
          border: 1px solid rgba(245, 189, 79, 0.32);
          background: rgba(20, 24, 18, 0.82);
          color: var(--warn);
          box-shadow: 0 18px 48px rgba(0, 0, 0, 0.24);
        }
        .unlocalized-badge span, .unlocalized-badge small { color: var(--muted); font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.12em; }
        .unlocalized-badge strong { color: var(--warn); font-size: 2rem; line-height: 1; font-variant-numeric: tabular-nums; }

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
        .article-meta, .article-foot { color: var(--muted); font-size: 0.78rem; line-height: 1.35; }
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
          font-size: 0.72rem;
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
          font-size: 0.82rem;
          line-height: 1.35;
          overflow-wrap: anywhere;
          text-decoration: none;
        }
        .reading-sublist a:hover { color: var(--ink); }

        .mini-panel { min-height: 250px; box-shadow: none; }
        .muted { color: var(--muted); line-height: 1.55; }
        .count-list { display: grid; gap: 14px; margin-top: 18px; }
        .count-row { display: grid; gap: 8px; }
        .count-row div { display: flex; justify-content: space-between; gap: 12px; color: var(--muted); font-size: 0.9rem; }
        .count-row strong { color: var(--ink); font-variant-numeric: tabular-nums; }
        .count-row i {
          display: block;
          height: 4px;
          min-width: 10px;
          background: var(--accent);
          box-shadow: 0 0 20px rgba(62, 214, 195, 0.35);
        }

        .trace-panel dl { display: grid; gap: 10px; margin: 18px 0; }
        .trace-panel dl div { display: grid; gap: 4px; padding-bottom: 10px; border-bottom: 1px solid var(--line); }
        .trace-panel dt { color: var(--subtle); font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.12em; font-weight: 800; }
        .trace-panel dd { margin: 0; color: var(--ink); overflow-wrap: anywhere; line-height: 1.35; }
        .map-note {
          margin: 14px 0 0;
          color: var(--muted);
          font-size: 0.86rem;
          line-height: 1.55;
        }
        .signal-legend {
          display: grid;
          grid-template-columns: minmax(180px, 0.42fr) minmax(0, 1fr);
          gap: 14px;
          align-items: stretch;
          margin-top: 14px;
          padding: 14px;
          border: 1px solid var(--line);
          background: rgba(255, 255, 255, 0.032);
        }
        .signal-legend-head {
          display: grid;
          gap: 5px;
          align-content: center;
        }
        .signal-legend-head span,
        .signal-legend-head small {
          color: var(--muted);
          font-size: 0.72rem;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }
        .signal-legend-head strong {
          color: var(--ink);
          font-size: clamp(1.15rem, 2vw, 1.55rem);
          letter-spacing: -0.04em;
        }
        .signal-legend ul {
          list-style: none;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: center;
          margin: 0;
          padding: 0;
        }
        .signal-legend li {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          min-height: 34px;
          padding: 7px 10px;
          border: 1px solid var(--line);
          color: var(--muted);
          background: rgba(255, 255, 255, 0.03);
          font-size: 0.78rem;
        }
        .signal-legend i {
          width: 11px;
          height: 11px;
          border-radius: 999px;
          background: var(--legend-color);
          box-shadow: 0 0 18px var(--legend-color);
        }
        .source-health-panel { margin-bottom: 22px; overflow: hidden; }
        .source-health-panel .panel-heading > span {
          color: var(--muted);
          font-size: 0.8rem;
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
          font-size: 0.78rem;
        }
        .source-health-row a { color: var(--ink); overflow-wrap: anywhere; text-decoration: none; }
        .health-state-cell { display: flex; flex-direction: column; gap: 4px; }
        .health-state-cell strong { font-size: 0.82rem; }
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
          font-size: 0.78rem;
          line-height: 1.45;
        }

        @keyframes pulseFloat {
          0%, 100% { opacity: 0.78; filter: saturate(0.95); }
          50% { opacity: 1; filter: saturate(1.25); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        @media (max-width: 1080px) {
          .top-strip, .main-grid { grid-template-columns: 1fr; }
          .metric-grid, .bottom-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .filter-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .time-grid { grid-template-columns: 1fr; }
          .stream-panel { max-height: none; }
          .article-list { max-height: none; }
        }

        @media (max-width: 680px) {
          .pulse-shell { width: min(100% - 20px, 1480px); padding-top: 10px; }
          .title-block, .status-panel, .panel, .metric-card { border-radius: 0; }
          .metric-grid, .bottom-grid, .filter-grid { grid-template-columns: 1fr; }
          .top-strip, .main-grid, .metric-grid, .bottom-grid, .side-stack { gap: 10px; margin-bottom: 10px; }
          .title-block { min-height: 320px; padding: 24px; }
          h1 { font-size: clamp(3.2rem, 18vw, 5rem); }
          .signal-field { min-height: 0; aspect-ratio: 2 / 1; }
          .signal-legend { grid-template-columns: 1fr; }
          .signal-legend ul { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .signal-legend li { min-width: 0; }
          .panel-heading { flex-direction: column; }
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
