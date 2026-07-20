"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { geoCentroid, geoEquirectangular, geoGraticule10, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import worldAtlas from "world-atlas/countries-110m.json";
import { SOURCE_COUNTRY_REGISTRY } from "../lib/world-pulse-geography.js";
import { colorForWorldPulseSignalLabel } from "../lib/world-pulse-signals.js";
import {
  WORLD_PULSE_FILTER_ALL,
  WORLD_PULSE_LOCALIZATION_FILTERS,
  deriveWorldPulseExploration,
} from "../lib/world-pulse-exploration.js";

const REFRESH_MS = 30 * 1000;
const VIEWBOX_WIDTH = 1000;
const VIEWBOX_HEIGHT = 500;
const MIN_SCALE = 1;
const MAX_SCALE = 8;
const INITIAL_FILTERS = Object.freeze({
  region: WORLD_PULSE_FILTER_ALL,
  country: WORLD_PULSE_FILTER_ALL,
  source: WORLD_PULSE_FILTER_ALL,
  category: WORLD_PULSE_FILTER_ALL,
  location: WORLD_PULSE_LOCALIZATION_FILTERS.ALL,
});

const WORLD_FEATURE = feature(worldAtlas, worldAtlas.objects.countries);
const PROJECTION = geoEquirectangular().fitExtent([[8, 8], [992, 492]], { type: "Sphere" });
const PATH = geoPath(PROJECTION);
const COUNTRY_BY_NUMERIC = new Map(SOURCE_COUNTRY_REGISTRY.map((country) => [country.isoNumeric, country]));
const COUNTRY_PATHS = WORLD_FEATURE.features.map((country, index) => {
  const isoNumeric = String(country.id || "").padStart(3, "0");
  const registry = COUNTRY_BY_NUMERIC.get(isoNumeric) || null;
  const centroid = PROJECTION(geoCentroid(country));
  return {
    id: country.id || index,
    code: registry?.code || null,
    label: registry?.label || null,
    d: PATH(country),
    centroid,
  };
}).filter((country) => country.d);
const SPHERE_PATH = PATH({ type: "Sphere" });
const GRATICULE_PATH = PATH(geoGraticule10());

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatDate(value) {
  if (!value) return "Heure non précisée";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Heure non précisée";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function normalizedPoint(point, fallbackSize = 5) {
  return {
    ...point,
    mapX: clamp(Number(point?.x || 0), 0, 100) * 10,
    mapY: clamp(Number(point?.y || 0), 0, 100) * 5,
    size: Math.max(3, Number(point?.size || fallbackSize)),
    color: colorForWorldPulseSignalLabel(point?.label),
  };
}

function constrainView(view) {
  const scale = clamp(view.scale, MIN_SCALE, MAX_SCALE);
  if (scale === 1) return { scale: 1, x: 0, y: 0 };
  return {
    scale,
    x: clamp(view.x, VIEWBOX_WIDTH - VIEWBOX_WIDTH * scale, 0),
    y: clamp(view.y, VIEWBOX_HEIGHT - VIEWBOX_HEIGHT * scale, 0),
  };
}

function useLivePayload(initialPayload) {
  const [payload, setPayload] = useState(() => initialPayload || { state: "loading", articles: [] });
  const [loading, setLoading] = useState(() => !initialPayload);
  const versionRef = useRef(initialPayload?.generatedAt || null);

  useEffect(() => {
    let active = true;
    let refreshing = false;

    async function loadPayload() {
      try {
        const response = await fetch("/api/gdelt", { cache: "no-store" });
        const data = await response.json();
        if (!active || !response.ok || !data || typeof data !== "object") return;
        setPayload(data);
        versionRef.current = response.headers.get("x-world-pulse-version") || data.generatedAt || null;
      } catch {
        // Le tableau analytique historique reste affiché sous la carte en cas d'incident réseau.
      } finally {
        if (active) setLoading(false);
      }
    }

    async function refreshIfChanged() {
      if (refreshing) return;
      refreshing = true;
      try {
        const knownVersion = versionRef.current;
        const response = await fetch("/api/gdelt", {
          method: "HEAD",
          cache: "no-store",
          headers: knownVersion ? { "If-None-Match": `W/"${knownVersion}"` } : undefined,
        });
        if (!active || response.status === 304 || !response.ok) return;
        const nextVersion = response.headers.get("x-world-pulse-version");
        if (!knownVersion || !nextVersion || nextVersion !== knownVersion) await loadPayload();
      } catch {
        // Aucun faux état d'erreur n'est injecté : le dernier snapshot fiable reste visible.
      } finally {
        refreshing = false;
      }
    }

    if (!initialPayload) loadPayload();
    const timer = window.setInterval(refreshIfChanged, REFRESH_MS);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [initialPayload]);

  return { payload, loading };
}

function FloatingSelect({ label, value, options, onChange }) {
  return (
    <label className="iwm-select">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value={WORLD_PULSE_FILTER_ALL}>Tous</option>
        {options.map((option) => (
          <option key={`${label}-${option.value}`} value={option.value}>
            {option.label} · {option.count}
          </option>
        ))}
      </select>
    </label>
  );
}

function ArticlePanel({ articles, open, onToggle, selectedArticleId, onSelectArticle }) {
  return (
    <aside className={`iwm-news-panel${open ? " is-open" : " is-closed"}`} aria-label="Actualités correspondant aux filtres">
      <button type="button" className="iwm-panel-toggle" onClick={onToggle} aria-expanded={open}>
        <span>{open ? "Masquer" : "Actualités"}</span>
        <strong>{articles.length}</strong>
      </button>
      {open ? (
        <div className="iwm-news-content">
          <div className="iwm-news-heading">
            <div>
              <span>Flux filtré</span>
              <h2>Actualités</h2>
            </div>
            <button type="button" onClick={onToggle} aria-label="Masquer le panneau d'actualités">×</button>
          </div>
          <div className="iwm-news-list">
            {articles.length === 0 ? <p>Aucun article ne correspond aux filtres actifs.</p> : null}
            {articles.slice(0, 40).map((article) => (
              <a
                key={article.id}
                href={article.url || "#"}
                target="_blank"
                rel="noreferrer"
                className={article.id === selectedArticleId ? "is-selected" : ""}
                onMouseEnter={() => onSelectArticle(article.id)}
                onFocus={() => onSelectArticle(article.id)}
              >
                <span>{article.label || "À qualifier"} · {article.eventCountry || "À localiser"}</span>
                <strong>{article.title}</strong>
                <small>{article.mediaName || article.domain || "Source"} · {formatDate(article.seenAt)}</small>
              </a>
            ))}
          </div>
        </div>
      ) : null}
    </aside>
  );
}

export default function InteractiveWorldMap({ initialPayload = null }) {
  const { payload, loading } = useLivePayload(initialPayload);
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [selectedArticleId, setSelectedArticleId] = useState(null);
  const [showMedia, setShowMedia] = useState(false);
  const [newsOpen, setNewsOpen] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const svgRef = useRef(null);
  const frameRef = useRef(null);
  const dragRef = useRef(null);

  const exploration = useMemo(
    () => deriveWorldPulseExploration(payload || {}, filters, selectedPoint),
    [payload, filters, selectedPoint]
  );
  const articles = exploration.articles || [];
  const categoryOptions = exploration.filterOptions?.categories || [];
  const countryOptions = exploration.filterOptions?.countries || [];
  const sourceOptions = exploration.filterOptions?.sources || [];
  const availableCountries = useMemo(() => new Set(exploration.availableCountryCodes || []), [exploration.availableCountryCodes]);
  const particles = useMemo(
    () => (exploration.articleParticles || []).filter((point) => !point.clusterId).map((point) => normalizedPoint(point, 4)),
    [exploration.articleParticles]
  );
  const clusters = useMemo(
    () => (exploration.articleClusters || []).map((point) => normalizedPoint(point, 16)),
    [exploration.articleClusters]
  );
  const mediaMarkers = useMemo(
    () => showMedia ? (exploration.mediaMarkers || []).map((point) => normalizedPoint(point, 8)) : [],
    [exploration.mediaMarkers, showMedia]
  );
  const topCategories = categoryOptions.slice(0, 7);
  const localizedCount = Number(exploration.counts?.eventLocalizedArticles || 0);
  const countryCount = Number(exploration.counts?.eventCountries || 0);
  const transform = `translate(${view.x} ${view.y}) scale(${view.scale})`;
  const activeCountry = filters.country !== WORLD_PULSE_FILTER_ALL ? filters.country : null;

  useEffect(() => {
    const legacyMap = document.querySelector(".legacy-world-dashboard .map-experience#carte");
    if (legacyMap) legacyMap.id = "carte-archivee";
  }, []);

  function updateFilter(name, value) {
    setFilters((current) => ({ ...current, [name]: value || WORLD_PULSE_FILTER_ALL }));
    setSelectedPoint(null);
    setSelectedArticleId(null);
  }

  function resetFilters() {
    setFilters(INITIAL_FILTERS);
    setSelectedPoint(null);
    setSelectedArticleId(null);
  }

  function zoomAt(nextScale, anchorX = VIEWBOX_WIDTH / 2, anchorY = VIEWBOX_HEIGHT / 2) {
    setView((current) => {
      const scale = clamp(nextScale, MIN_SCALE, MAX_SCALE);
      const ratio = scale / current.scale;
      return constrainView({
        scale,
        x: anchorX - (anchorX - current.x) * ratio,
        y: anchorY - (anchorY - current.y) * ratio,
      });
    });
  }

  function handleWheel(event) {
    event.preventDefault();
    const bounds = svgRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const anchorX = ((event.clientX - bounds.left) / bounds.width) * VIEWBOX_WIDTH;
    const anchorY = ((event.clientY - bounds.top) / bounds.height) * VIEWBOX_HEIGHT;
    const factor = event.deltaY < 0 ? 1.22 : 0.82;
    zoomAt(view.scale * factor, anchorX, anchorY);
  }

  function handlePointerDown(event) {
    if (event.button !== 0) return;
    const bounds = svgRef.current?.getBoundingClientRect();
    if (!bounds) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startView: view,
      xRatio: VIEWBOX_WIDTH / bounds.width,
      yRatio: VIEWBOX_HEIGHT / bounds.height,
    };
    svgRef.current.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = (event.clientX - drag.startClientX) * drag.xRatio;
    const dy = (event.clientY - drag.startClientY) * drag.yRatio;
    setView(constrainView({ ...drag.startView, x: drag.startView.x + dx, y: drag.startView.y + dy }));
  }

  function handlePointerUp(event) {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
    if (svgRef.current?.hasPointerCapture?.(event.pointerId)) svgRef.current.releasePointerCapture(event.pointerId);
  }

  async function toggleFullscreen() {
    const frame = frameRef.current;
    if (!frame) return;
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (frame.requestFullscreen) await frame.requestFullscreen();
  }

  function selectCountry(code) {
    if (!code || !availableCountries.has(code)) return;
    updateFilter("country", code);
    setSelectedPoint({ type: "country", code });
    setNewsOpen(true);
  }

  function selectMapPoint(type, point) {
    setSelectedPoint({ type, id: point.id });
    setSelectedArticleId(point.articleId || null);
    setNewsOpen(true);
  }

  return (
    <section className="interactive-world-shell" id="carte" aria-label="Carte interactive de l'actualité mondiale">
      <div className="iwm-intro">
        <div>
          <p>Atlas vivant de l’actualité mondiale</p>
          <h1>Le Pouls <span>du Monde</span></h1>
          <small>Zoomez, déplacez la carte et filtrez les événements sans perdre la lecture des sources.</small>
        </div>
        <div className="iwm-live-status">
          <i aria-hidden="true" />
          <span>{loading ? "Actualisation…" : `${localizedCount} signaux · ${countryCount} pays`}</span>
          <small>{formatDate(payload?.generatedAt)}</small>
        </div>
      </div>

      <div className={`iwm-workspace${newsOpen ? " news-open" : " news-closed"}`} ref={frameRef}>
        <div className="iwm-map-column">
          <div className="iwm-toolbar" aria-label="Filtres intégrés à la carte">
            <button type="button" className="iwm-filter-toggle" onClick={() => setFiltersOpen((current) => !current)} aria-expanded={filtersOpen}>
              Filtres {filtersOpen ? "−" : "+"}
            </button>
            <div className="iwm-category-row">
              <button
                type="button"
                className={filters.category === WORLD_PULSE_FILTER_ALL ? "is-active" : ""}
                onClick={() => updateFilter("category", WORLD_PULSE_FILTER_ALL)}
              >
                Tout
              </button>
              {topCategories.map((category) => (
                <button
                  key={category.value}
                  type="button"
                  className={filters.category === category.value ? "is-active" : ""}
                  onClick={() => updateFilter("category", category.value)}
                >
                  {category.label === "Non déterminé" ? "À qualifier" : category.label}
                </button>
              ))}
            </div>
            {filtersOpen ? (
              <div className="iwm-filter-drawer">
                <FloatingSelect label="Pays" value={filters.country} options={countryOptions} onChange={(value) => updateFilter("country", value)} />
                <FloatingSelect label="Source" value={filters.source} options={sourceOptions} onChange={(value) => updateFilter("source", value)} />
                <label className="iwm-localized-only">
                  <input
                    type="checkbox"
                    checked={filters.location === WORLD_PULSE_LOCALIZATION_FILTERS.LOCALIZED}
                    onChange={(event) => updateFilter("location", event.target.checked ? WORLD_PULSE_LOCALIZATION_FILTERS.LOCALIZED : WORLD_PULSE_LOCALIZATION_FILTERS.ALL)}
                  />
                  <span>Seulement sur la carte</span>
                </label>
                <button type="button" className="iwm-secondary" onClick={() => setShowMedia((current) => !current)}>
                  {showMedia ? "Masquer les médias" : "Voir les médias"}
                </button>
                <button type="button" className="iwm-reset" onClick={resetFilters}>Réinitialiser</button>
              </div>
            ) : null}
          </div>

          <div className="iwm-map-frame">
            <svg
              ref={svgRef}
              className="iwm-map"
              viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
              role="img"
              aria-label="Carte du monde zoomable et déplaçable"
              onWheel={handleWheel}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            >
              <defs>
                <linearGradient id="iwmLand" x1="0%" x2="100%" y1="0%" y2="100%">
                  <stop offset="0%" stopColor="#203e43" />
                  <stop offset="100%" stopColor="#10242d" />
                </linearGradient>
                <filter id="iwmGlow" x="-100%" y="-100%" width="300%" height="300%">
                  <feGaussianBlur stdDeviation="2.4" result="blur" />
                  <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              </defs>
              <rect width="1000" height="500" className="iwm-ocean" />
              <g transform={transform}>
                <path d={SPHERE_PATH} className="iwm-sphere" />
                <path d={GRATICULE_PATH} className="iwm-graticule" />
                {COUNTRY_PATHS.map((country) => {
                  const selectable = country.code && availableCountries.has(country.code);
                  const selected = country.code && country.code === activeCountry;
                  return (
                    <path
                      key={country.id}
                      d={country.d}
                      className={`iwm-country${selectable ? " is-selectable" : ""}${selected ? " is-selected" : ""}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        selectCountry(country.code);
                      }}
                    />
                  );
                })}
                {view.scale >= 1.55 ? COUNTRY_PATHS.filter((country) => country.label && country.centroid && availableCountries.has(country.code)).map((country) => (
                  <text
                    key={`label-${country.code}`}
                    x={country.centroid[0]}
                    y={country.centroid[1]}
                    className="iwm-country-label"
                    fontSize={clamp(12 / Math.sqrt(view.scale), 4.6, 8)}
                  >
                    {country.label}
                  </text>
                )) : null}
                {particles.map((point) => {
                  const radius = clamp(point.size * 0.56 / Math.sqrt(view.scale), 2.2, 7);
                  const selected = selectedPoint?.type === "article" && selectedPoint.id === point.id;
                  return (
                    <g key={`article-${point.id}`} className={`iwm-point${selected ? " is-selected" : ""}`} onClick={(event) => { event.stopPropagation(); selectMapPoint("article", point); }}>
                      <circle cx={point.mapX} cy={point.mapY} r={radius * 2.7} fill={point.color} opacity="0.12" />
                      <circle cx={point.mapX} cy={point.mapY} r={radius} fill={point.color} filter="url(#iwmGlow)" />
                      <title>{`${point.eventCountry || point.location?.label || "Événement"} · ${point.label || "À qualifier"}`}</title>
                    </g>
                  );
                })}
                {clusters.map((point) => {
                  const radius = clamp(point.size * 0.48 / Math.sqrt(view.scale), 5.4, 18);
                  const selected = selectedPoint?.type === "cluster" && selectedPoint.id === point.id;
                  return (
                    <g key={`cluster-${point.id}`} className={`iwm-point iwm-cluster${selected ? " is-selected" : ""}`} onClick={(event) => { event.stopPropagation(); selectMapPoint("cluster", point); }}>
                      <circle cx={point.mapX} cy={point.mapY} r={radius * 1.7} fill={point.color} opacity="0.16" />
                      <circle cx={point.mapX} cy={point.mapY} r={radius} fill={point.color} opacity="0.84" />
                      <text x={point.mapX} y={point.mapY} fontSize={clamp(radius * 0.86, 6, 13)}>{point.count || point.articleCount || 0}</text>
                      <title>{`${point.eventCountry || point.location?.label || "Zone"} · ${point.count || 0} articles`}</title>
                    </g>
                  );
                })}
                {mediaMarkers.map((point) => {
                  const radius = clamp(point.size * 0.48 / Math.sqrt(view.scale), 3, 9);
                  return (
                    <g key={`media-${point.id}`} className="iwm-point iwm-media" onClick={(event) => { event.stopPropagation(); selectMapPoint("marker", point); }}>
                      <circle cx={point.mapX} cy={point.mapY} r={radius * 1.8} fill="#f4d792" opacity="0.12" />
                      <circle cx={point.mapX} cy={point.mapY} r={radius} fill="#f4d792" />
                      <title>{`${point.mediaName || "Média"} · ${point.articleCount || 0} articles`}</title>
                    </g>
                  );
                })}
              </g>
            </svg>

            <div className="iwm-map-controls" aria-label="Commandes de la carte">
              <button type="button" onClick={() => zoomAt(view.scale * 1.35)} aria-label="Zoomer">+</button>
              <button type="button" onClick={() => zoomAt(view.scale / 1.35)} aria-label="Dézoomer">−</button>
              <button type="button" onClick={() => setView({ scale: 1, x: 0, y: 0 })} aria-label="Revenir à la vue mondiale">◎</button>
              <button type="button" onClick={toggleFullscreen} aria-label="Afficher la carte en plein écran">⛶</button>
            </div>
            <div className="iwm-map-hint">Molette ou boutons pour zoomer · glissez pour déplacer · cliquez sur un pays</div>
          </div>
        </div>

        <ArticlePanel
          articles={articles}
          open={newsOpen}
          onToggle={() => setNewsOpen((current) => !current)}
          selectedArticleId={selectedArticleId}
          onSelectArticle={setSelectedArticleId}
        />
      </div>

      <style jsx global>{`
        .legacy-world-dashboard .top-strip,
        .legacy-world-dashboard .map-experience { display: none !important; }
        .legacy-world-dashboard .pulse-shell { padding-top: 12px; }
        .interactive-world-shell {
          width: min(1500px, calc(100% - 24px));
          margin: 14px auto 0;
          color: #effafa;
          font-family: var(--font-sans, "Segoe UI", sans-serif);
        }
        .iwm-intro {
          display: flex;
          align-items: end;
          justify-content: space-between;
          gap: 18px;
          padding: 20px 22px;
          border: 1px solid rgba(173, 213, 213, 0.18);
          border-bottom: 0;
          background: linear-gradient(115deg, rgba(95,218,201,.10), transparent 46%), rgba(8,25,33,.94);
        }
        .iwm-intro p { margin: 0 0 7px; color: #5fdac9; font-size: .66rem; font-weight: 800; letter-spacing: .13em; text-transform: uppercase; }
        .iwm-intro h1 { margin: 0; font-size: clamp(2.25rem, 4.2vw, 4.7rem); line-height: .9; letter-spacing: -.065em; }
        .iwm-intro h1 span { color: #5fdac9; }
        .iwm-intro small { display: block; max-width: 680px; margin-top: 10px; color: #a9c3c6; font-size: .82rem; line-height: 1.45; }
        .iwm-live-status { display: grid; grid-template-columns: auto auto; align-items: center; gap: 4px 8px; min-width: 205px; padding: 11px 13px; border: 1px solid rgba(173,213,213,.18); background: rgba(3,14,20,.52); }
        .iwm-live-status i { width: 9px; height: 9px; border-radius: 50%; background: #72d39a; box-shadow: 0 0 0 5px rgba(114,211,154,.12); }
        .iwm-live-status span { font-size: .76rem; font-weight: 760; }
        .iwm-live-status small { grid-column: 2; margin: 0; color: #799da1; font-size: .65rem; }
        .iwm-workspace { position: relative; display: grid; grid-template-columns: minmax(0, 1fr) 360px; min-height: clamp(540px, 72vh, 850px); border: 1px solid rgba(173,213,213,.2); background: #06141b; overflow: hidden; }
        .iwm-workspace.news-closed { grid-template-columns: minmax(0, 1fr) 54px; }
        .iwm-map-column { position: relative; min-width: 0; display: grid; grid-template-rows: auto minmax(0, 1fr); }
        .iwm-toolbar { position: relative; z-index: 6; display: flex; flex-wrap: wrap; align-items: center; gap: 7px; padding: 9px; border-bottom: 1px solid rgba(173,213,213,.17); background: rgba(10,28,38,.96); }
        .iwm-toolbar button, .iwm-toolbar select { font: inherit; }
        .iwm-filter-toggle, .iwm-category-row button, .iwm-secondary, .iwm-reset { min-height: 32px; border: 1px solid rgba(173,213,213,.18); border-radius: 8px; background: rgba(255,255,255,.035); color: #aac4c6; padding: 0 10px; font-size: .66rem; font-weight: 740; cursor: pointer; }
        .iwm-filter-toggle { color: #5fdac9; }
        .iwm-category-row { display: flex; flex-wrap: wrap; gap: 6px; }
        .iwm-category-row button.is-active { color: #051117; border-color: #5fdac9; background: #5fdac9; }
        .iwm-filter-drawer { width: 100%; display: grid; grid-template-columns: minmax(130px, 1fr) minmax(150px, 1fr) auto auto auto; align-items: end; gap: 8px; padding-top: 2px; }
        .iwm-select { display: grid; gap: 4px; }
        .iwm-select span { color: #799da1; font-size: .58rem; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; }
        .iwm-select select { min-width: 0; min-height: 34px; border: 1px solid rgba(173,213,213,.18); background: #0b222c; color: #effafa; padding: 0 8px; font-size: .68rem; }
        .iwm-select option { color: #071117; background: #fff; }
        .iwm-localized-only { min-height: 34px; display: flex; align-items: center; gap: 7px; padding: 0 9px; border: 1px solid rgba(173,213,213,.18); color: #aac4c6; font-size: .65rem; white-space: nowrap; }
        .iwm-localized-only input { accent-color: #5fdac9; }
        .iwm-reset { color: #d6b476; }
        .iwm-map-frame { position: relative; min-height: 0; overflow: hidden; background: radial-gradient(circle at 49% 42%, rgba(59,203,191,.11), transparent 38%), #06131b; }
        .iwm-map { width: 100%; height: 100%; min-height: 480px; display: block; cursor: grab; touch-action: none; user-select: none; }
        .iwm-map:active { cursor: grabbing; }
        .iwm-ocean { fill: #06131b; }
        .iwm-sphere { fill: rgba(5,20,27,.72); stroke: rgba(175,216,219,.32); stroke-width: 1; vector-effect: non-scaling-stroke; }
        .iwm-graticule { fill: none; stroke: rgba(173,213,213,.08); stroke-width: .72; vector-effect: non-scaling-stroke; }
        .iwm-country { fill: url(#iwmLand); stroke: rgba(190,223,224,.46); stroke-width: .68; vector-effect: non-scaling-stroke; transition: fill .14s ease, stroke .14s ease; }
        .iwm-country.is-selectable { cursor: pointer; fill: #17343d; }
        .iwm-country.is-selectable:hover { fill: #23515a; stroke: #8fe3dc; }
        .iwm-country.is-selected { fill: #2a6d70; stroke: #b8fff7; stroke-width: 1.4; }
        .iwm-country-label { fill: rgba(228,244,244,.78); text-anchor: middle; dominant-baseline: middle; pointer-events: none; paint-order: stroke; stroke: rgba(5,17,23,.92); stroke-width: 2px; font-weight: 720; letter-spacing: .02em; }
        .iwm-point { cursor: pointer; }
        .iwm-point circle { transition: opacity .15s ease; }
        .iwm-point:hover circle, .iwm-point.is-selected circle { opacity: 1; }
        .iwm-cluster text { fill: #041011; text-anchor: middle; dominant-baseline: central; pointer-events: none; font-weight: 900; }
        .iwm-map-controls { position: absolute; z-index: 5; right: 12px; bottom: 44px; display: grid; gap: 6px; }
        .iwm-map-controls button { width: 36px; height: 36px; border: 1px solid rgba(173,213,213,.28); border-radius: 8px; background: rgba(5,20,27,.92); color: #effafa; font: 800 1rem/1 sans-serif; cursor: pointer; box-shadow: 0 8px 25px rgba(0,0,0,.28); }
        .iwm-map-controls button:hover { color: #5fdac9; border-color: #5fdac9; }
        .iwm-map-hint { position: absolute; z-index: 4; left: 12px; bottom: 12px; max-width: calc(100% - 76px); padding: 7px 9px; border: 1px solid rgba(173,213,213,.15); background: rgba(5,20,27,.86); color: #8caeb1; font-size: .62rem; }
        .iwm-news-panel { position: relative; z-index: 8; min-width: 0; border-left: 1px solid rgba(173,213,213,.18); background: #0a1824; }
        .iwm-news-panel.is-closed { display: grid; place-items: start center; padding-top: 10px; }
        .iwm-panel-toggle { display: none; }
        .iwm-news-panel.is-closed .iwm-panel-toggle { display: grid; gap: 7px; place-items: center; width: 38px; min-height: 116px; border: 1px solid rgba(173,213,213,.2); background: rgba(255,255,255,.035); color: #5fdac9; cursor: pointer; }
        .iwm-news-panel.is-closed .iwm-panel-toggle span { writing-mode: vertical-rl; transform: rotate(180deg); font-size: .64rem; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
        .iwm-news-panel.is-closed .iwm-panel-toggle strong { color: #effafa; font-size: .7rem; }
        .iwm-news-content { height: 100%; min-height: 0; display: grid; grid-template-rows: auto minmax(0, 1fr); }
        .iwm-news-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 16px; border-bottom: 1px solid rgba(173,213,213,.15); }
        .iwm-news-heading span { color: #5fdac9; font-size: .59rem; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
        .iwm-news-heading h2 { margin: 4px 0 0; font-size: 1.22rem; }
        .iwm-news-heading button { width: 31px; height: 31px; border: 1px solid rgba(173,213,213,.2); border-radius: 50%; background: transparent; color: #aac4c6; font-size: 1.1rem; cursor: pointer; }
        .iwm-news-list { min-height: 0; overflow: auto; padding: 8px; }
        .iwm-news-list > p { margin: 14px; color: #aac4c6; font-size: .75rem; }
        .iwm-news-list a { display: grid; gap: 7px; padding: 12px; border-bottom: 1px solid rgba(173,213,213,.12); color: inherit; text-decoration: none; transition: background .15s ease, border .15s ease; }
        .iwm-news-list a:hover, .iwm-news-list a.is-selected { background: rgba(95,218,201,.075); border-color: rgba(95,218,201,.3); }
        .iwm-news-list a span { color: #7ea9ad; font-size: .61rem; font-weight: 720; }
        .iwm-news-list a strong { color: #effafa; font-size: .82rem; line-height: 1.3; }
        .iwm-news-list a small { color: #78969b; font-size: .63rem; line-height: 1.35; }
        .iwm-workspace:fullscreen { width: 100vw; height: 100vh; min-height: 100vh; background: #06141b; }
        .iwm-workspace:fullscreen .iwm-map { min-height: 0; }
        @media (max-width: 980px) {
          .iwm-workspace, .iwm-workspace.news-open { grid-template-columns: minmax(0, 1fr); min-height: 720px; }
          .iwm-workspace.news-closed { grid-template-columns: minmax(0, 1fr); }
          .iwm-news-panel { position: absolute; inset: auto 8px 8px 8px; max-height: 48%; border: 1px solid rgba(173,213,213,.22); box-shadow: 0 18px 58px rgba(0,0,0,.5); }
          .iwm-news-panel.is-closed { inset: auto 8px 8px auto; padding: 0; border: 0; background: transparent; }
          .iwm-news-panel.is-closed .iwm-panel-toggle { width: auto; min-height: 38px; display: flex; padding: 0 12px; }
          .iwm-news-panel.is-closed .iwm-panel-toggle span { writing-mode: horizontal-tb; transform: none; }
          .iwm-filter-drawer { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 680px) {
          .interactive-world-shell { width: calc(100% - 12px); margin-top: 6px; }
          .iwm-intro { align-items: start; flex-direction: column; padding: 16px; }
          .iwm-intro h1 { font-size: clamp(2.35rem, 13vw, 3.65rem); }
          .iwm-live-status { width: 100%; }
          .iwm-workspace { min-height: 680px; }
          .iwm-toolbar { align-items: flex-start; }
          .iwm-category-row { max-width: 100%; overflow-x: auto; flex-wrap: nowrap; padding-bottom: 3px; }
          .iwm-category-row button { white-space: nowrap; }
          .iwm-filter-drawer { grid-template-columns: 1fr; }
          .iwm-map { min-height: 510px; }
          .iwm-map-hint { display: none; }
          .iwm-map-controls { right: 8px; bottom: 8px; }
          .iwm-news-panel { max-height: 52%; }
        }
      `}</style>
    </section>
  );
}
