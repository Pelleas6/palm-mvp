"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { feature } from "topojson-client";
import worldAtlas from "world-atlas/countries-110m.json";
import { SOURCE_COUNTRY_REGISTRY } from "../lib/world-pulse-geography.js";

const EMPTY_GEOJSON = Object.freeze({
  type: "FeatureCollection",
  features: [],
});

const COUNTRY_BY_NUMERIC = new Map(
  SOURCE_COUNTRY_REGISTRY.map((entry) => [
    String(entry.isoNumeric).padStart(3, "0"),
    entry,
  ]),
);

const RAW_COUNTRIES = feature(worldAtlas, worldAtlas.objects.countries);
const COUNTRY_GEOJSON = {
  type: "FeatureCollection",
  features: RAW_COUNTRIES.features.map((country) => {
    const registry = COUNTRY_BY_NUMERIC.get(String(country.id).padStart(3, "0"));
    return {
      ...country,
      properties: {
        code: registry?.code || "",
        label: registry?.label || "",
      },
    };
  }),
};

const COUNTRY_FEATURE_BY_CODE = new Map(
  COUNTRY_GEOJSON.features
    .filter((country) => country.properties.code)
    .map((country) => [country.properties.code, country]),
);

const MAP_STYLE = {
  version: 8,
  sources: {},
  layers: [
    {
      id: "background",
      type: "background",
      paint: { "background-color": "#06141b" },
    },
  ],
};

const CATEGORY_COLOR_EXPRESSION = [
  "match",
  ["get", "c"],
  "Conflit/tension",
  "#d77a72",
  "Politique/élections",
  "#7f9bd0",
  "Économie/marchés",
  "#c59a59",
  "Climat/environnement",
  "#55a99f",
  "Santé",
  "#76aa7d",
  "Science/technologie",
  "#639db5",
  "Sécurité/défense",
  "#9a7fba",
  "Justice/société",
  "#c47d98",
  "Culture/médias",
  "#a78b5b",
  "Sport",
  "#5ea681",
  "Catastrophes/météo",
  "#c4876e",
  "Énergie/transport",
  "#69a7af",
  "#aab9b5",
];

function emptyFilters() {
  return { category: "", country: "", source: "" };
}

function filterSignals(payload, filters) {
  const features = Array.isArray(payload?.geojson?.features)
    ? payload.geojson.features
    : [];
  return {
    type: "FeatureCollection",
    features: features.filter((entry) => {
      const properties = entry?.properties || {};
      if (filters.category && properties.c !== filters.category) return false;
      if (filters.country && properties.k !== filters.country) return false;
      if (filters.source && properties.s !== filters.source) return false;
      return true;
    }),
  };
}

function visitCoordinates(coordinates, callback) {
  if (!Array.isArray(coordinates)) return;
  if (
    coordinates.length >= 2 &&
    Number.isFinite(Number(coordinates[0])) &&
    Number.isFinite(Number(coordinates[1]))
  ) {
    callback(Number(coordinates[0]), Number(coordinates[1]));
    return;
  }
  for (const part of coordinates) visitCoordinates(part, callback);
}

function boundsForCountry(country) {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  visitCoordinates(country?.geometry?.coordinates, (longitude, latitude) => {
    west = Math.min(west, longitude);
    south = Math.min(south, latitude);
    east = Math.max(east, longitude);
    north = Math.max(north, latitude);
  });
  if (![west, south, east, north].every(Number.isFinite)) return null;
  if (east - west > 220) return null;
  return [
    [west, south],
    [east, north],
  ];
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function filtersLabel(filters, payload) {
  const parts = [];
  if (filters.category) parts.push(filters.category);
  if (filters.country) {
    const country = payload?.filters?.countries?.find(
      (entry) => entry.code === filters.country,
    );
    parts.push(country?.label || filters.country);
  }
  if (filters.source) parts.push(filters.source);
  return parts.length ? parts.join(" · ") : "Monde entier";
}

export default function WorldMapLibre() {
  const mapContainerRef = useRef(null);
  const mapShellRef = useRef(null);
  const mapRef = useRef(null);
  const filtersRef = useRef(emptyFilters());
  const fetchArticlesRef = useRef(null);

  const [payload, setPayload] = useState(null);
  const [loadState, setLoadState] = useState("map");
  const [filters, setFilters] = useState(emptyFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [articles, setArticles] = useState([]);
  const [articlesState, setArticlesState] = useState("idle");
  const [panelTitle, setPanelTitle] = useState("Actualités");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  filtersRef.current = filters;

  const filteredGeojson = useMemo(
    () => filterSignals(payload, filters),
    [payload, filters],
  );

  const visibleCount = filteredGeojson.features.length;
  const activeFiltersCount = Object.values(filters).filter(Boolean).length;

  const fetchArticles = useCallback(async ({ articleId = "", overrideFilters } = {}) => {
    const activeFilters = overrideFilters || filtersRef.current;
    const params = new URLSearchParams({ limit: articleId ? "1" : "18" });
    if (articleId) params.set("articleId", articleId);
    if (!articleId && activeFilters.category) params.set("category", activeFilters.category);
    if (!articleId && activeFilters.country) params.set("country", activeFilters.country);
    if (!articleId && activeFilters.source) params.set("source", activeFilters.source);

    setArticlesState("loading");
    setPanelOpen(true);
    try {
      const response = await fetch(`/api/map-articles?${params.toString()}`, {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = await response.json();
      setArticles(Array.isArray(body?.articles) ? body.articles : []);
      setArticlesState("ready");
    } catch (error) {
      console.error("Map articles fetch error:", error);
      setArticles([]);
      setArticlesState("error");
    }
  }, []);

  fetchArticlesRef.current = fetchArticles;

  const fitWorld = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    map.fitBounds(
      [
        [-174, -58],
        [178, 80],
      ],
      {
        padding: isMobile ? 8 : 28,
        duration: 420,
      },
    );
  }, [isMobile]);

  const focusCountry = useCallback(
    (code) => {
      const map = mapRef.current;
      if (!map) return;
      if (!code) {
        fitWorld();
        return;
      }
      const country = COUNTRY_FEATURE_BY_CODE.get(code);
      const bounds = boundsForCountry(country);
      if (!bounds) return;
      map.fitBounds(bounds, {
        padding: isMobile ? 52 : 88,
        maxZoom: 5.6,
        duration: 520,
      });
    },
    [fitWorld, isMobile],
  );

  const applyCountry = useCallback(
    (code, openArticles = false) => {
      const next = { ...filtersRef.current, country: code };
      filtersRef.current = next;
      setFilters(next);
      setFiltersOpen(false);
      focusCountry(code);
      if (openArticles) {
        const label = payload?.filters?.countries?.find(
          (entry) => entry.code === code,
        )?.label;
        setPanelTitle(label || "Actualités du pays");
        fetchArticlesRef.current?.({ overrideFilters: next });
      }
    },
    [focusCountry, payload],
  );

  useEffect(() => {
    const onResize = () => {
      setIsMobile(window.matchMedia("(max-width: 760px)").matches);
      mapRef.current?.resize();
    };
    onResize();
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const onFullscreen = () => {
      setIsFullscreen(document.fullscreenElement === mapShellRef.current);
      window.setTimeout(() => mapRef.current?.resize(), 80);
    };
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => document.removeEventListener("fullscreenchange", onFullscreen);
  }, []);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return undefined;

    let disposed = false;
    let mapInstance = null;
    let refreshTimer = null;
    const controller = new AbortController();

    async function loadSignals() {
      try {
        setLoadState((current) => (current === "ready" ? current : "signals"));
        const response = await fetch("/api/map-signals", {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const body = await response.json();
        if (disposed) return;
        setPayload(body);
        setLoadState("ready");
      } catch (error) {
        if (error?.name === "AbortError" || disposed) return;
        console.error("Map signals fetch error:", error);
        setLoadState("error");
      }
    }

    async function mountMap() {
      try {
        const module = await import("maplibre-gl");
        if (disposed || !mapContainerRef.current) return;
        const maplibregl = module.default;
        const mobile = window.matchMedia("(max-width: 760px)").matches;

        mapInstance = new maplibregl.Map({
          container: mapContainerRef.current,
          style: MAP_STYLE,
          center: [2, 18],
          zoom: mobile ? 0.45 : 1.05,
          minZoom: 0.25,
          maxZoom: 7,
          renderWorldCopies: false,
          dragRotate: false,
          pitchWithRotate: false,
          touchPitch: false,
          attributionControl: false,
          fadeDuration: 0,
        });
        mapRef.current = mapInstance;
        mapInstance.touchZoomRotate.disableRotation();

        mapInstance.once("load", () => {
          if (disposed) return;

          mapInstance.addSource("countries", {
            type: "geojson",
            data: COUNTRY_GEOJSON,
          });
          mapInstance.addLayer({
            id: "countries-fill",
            type: "fill",
            source: "countries",
            paint: {
              "fill-color": "#0b2730",
              "fill-opacity": 0.92,
            },
          });
          mapInstance.addLayer({
            id: "country-selected",
            type: "fill",
            source: "countries",
            filter: ["==", ["get", "code"], "__none__"],
            paint: {
              "fill-color": "#5fdac9",
              "fill-opacity": 0.2,
            },
          });
          mapInstance.addLayer({
            id: "countries-line",
            type: "line",
            source: "countries",
            paint: {
              "line-color": "#789ca5",
              "line-opacity": 0.54,
              "line-width": [
                "interpolate",
                ["linear"],
                ["zoom"],
                0,
                0.45,
                5,
                1.1,
              ],
            },
          });

          mapInstance.addSource("news-signals", {
            type: "geojson",
            data: EMPTY_GEOJSON,
            cluster: true,
            clusterRadius: mobile ? 42 : 52,
            clusterMaxZoom: 5,
          });
          mapInstance.addLayer({
            id: "news-cluster-halo",
            type: "circle",
            source: "news-signals",
            filter: ["has", "point_count"],
            paint: {
              "circle-color": "#5fdac9",
              "circle-opacity": 0.13,
              "circle-radius": [
                "step",
                ["get", "point_count"],
                16,
                12,
                20,
                35,
                25,
                90,
                31,
              ],
            },
          });
          mapInstance.addLayer({
            id: "news-clusters",
            type: "circle",
            source: "news-signals",
            filter: ["has", "point_count"],
            paint: {
              "circle-color": "#51cbbb",
              "circle-opacity": 0.82,
              "circle-radius": [
                "step",
                ["get", "point_count"],
                8,
                12,
                11,
                35,
                15,
                90,
                20,
              ],
              "circle-stroke-color": "rgba(224,255,250,0.74)",
              "circle-stroke-width": 1,
            },
          });
          mapInstance.addLayer({
            id: "news-points",
            type: "circle",
            source: "news-signals",
            filter: ["!", ["has", "point_count"]],
            paint: {
              "circle-color": CATEGORY_COLOR_EXPRESSION,
              "circle-radius": [
                "interpolate",
                ["linear"],
                ["zoom"],
                1,
                3.2,
                6,
                6.2,
              ],
              "circle-opacity": 0.92,
              "circle-stroke-color": "rgba(238,255,252,0.82)",
              "circle-stroke-width": 0.8,
            },
          });

          mapInstance.on("click", "news-clusters", async (event) => {
            const cluster = event.features?.[0];
            const clusterId = cluster?.properties?.cluster_id;
            if (clusterId === undefined) return;
            try {
              const source = mapInstance.getSource("news-signals");
              const zoom = await source.getClusterExpansionZoom(clusterId);
              mapInstance.easeTo({
                center: cluster.geometry.coordinates,
                zoom,
                duration: 380,
              });
            } catch (error) {
              console.error("Cluster expansion error:", error);
            }
          });

          mapInstance.on("click", "news-points", (event) => {
            const point = event.features?.[0];
            const articleId = String(point?.properties?.i || "");
            if (!articleId) return;
            setPanelTitle(
              String(point?.properties?.n || point?.properties?.c || "Actualité"),
            );
            fetchArticlesRef.current?.({ articleId });
          });

          mapInstance.on("click", "countries-fill", (event) => {
            const signalAtPoint = mapInstance.queryRenderedFeatures(event.point, {
              layers: ["news-clusters", "news-points"],
            });
            if (signalAtPoint.length) return;
            const code = String(event.features?.[0]?.properties?.code || "");
            if (!code) return;
            applyCountry(code, true);
          });

          for (const layer of ["news-clusters", "news-points", "countries-fill"]) {
            mapInstance.on("mouseenter", layer, () => {
              mapInstance.getCanvas().style.cursor = "pointer";
            });
            mapInstance.on("mouseleave", layer, () => {
              mapInstance.getCanvas().style.cursor = "";
            });
          }

          mapInstance.fitBounds(
            [
              [-174, -58],
              [178, 80],
            ],
            { padding: mobile ? 8 : 28, duration: 0 },
          );
          loadSignals();
          refreshTimer = window.setInterval(loadSignals, 30_000);
        });

        const resizeObserver = new ResizeObserver(() => mapInstance?.resize());
        resizeObserver.observe(mapContainerRef.current);
        mapInstance.__pulseResizeObserver = resizeObserver;
      } catch (error) {
        console.error("MapLibre initialization error:", error);
        setLoadState("error");
      }
    }

    mountMap();

    return () => {
      disposed = true;
      controller.abort();
      if (refreshTimer) window.clearInterval(refreshTimer);
      mapInstance?.__pulseResizeObserver?.disconnect();
      mapInstance?.remove();
      mapRef.current = null;
    };
  }, [applyCountry]);

  useEffect(() => {
    const map = mapRef.current;
    const source = map?.getSource("news-signals");
    if (source?.setData) source.setData(filteredGeojson);

    if (map?.getLayer("country-selected")) {
      map.setFilter("country-selected", [
        "==",
        ["get", "code"],
        filters.country || "__none__",
      ]);
    }
  }, [filteredGeojson, filters.country]);

  const resetFilters = () => {
    const next = emptyFilters();
    filtersRef.current = next;
    setFilters(next);
    setFiltersOpen(false);
    setPanelOpen(false);
    fitWorld();
  };

  const showFilteredArticles = () => {
    setPanelTitle(filtersLabel(filters, payload));
    fetchArticles({ overrideFilters: filters });
    setFiltersOpen(false);
  };

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await mapShellRef.current?.requestFullscreen();
      }
    } catch (error) {
      console.error("Fullscreen error:", error);
    }
  };

  const statusText =
    loadState === "map"
      ? "Initialisation WebGL"
      : loadState === "signals"
        ? "Chargement des signaux"
        : loadState === "error"
          ? "Carte temporairement indisponible"
          : `${visibleCount.toLocaleString("fr-FR")} signaux visibles`;

  return (
    <section className="live-world" aria-labelledby="live-world-title">
      <div className="live-world__inner">
        <header className="live-world__header">
          <div>
            <p className="live-world__eyebrow">Le Pouls du Monde · En direct</p>
            <h1 id="live-world-title">Les actualités prennent place sur la carte</h1>
            <p className="live-world__intro">
              Déplacez la carte, zoomez sur une bulle ou touchez un pays. Les articles
              détaillés ne sont chargés qu’au moment où vous les ouvrez.
            </p>
          </div>
          <div className={`live-world__status live-world__status--${loadState}`}>
            <span aria-hidden="true" />
            <strong>{statusText}</strong>
            {payload?.generatedAt ? (
              <small>Actualisé {formatDate(payload.generatedAt)}</small>
            ) : null}
          </div>
        </header>

        <div
          className={`live-map-shell${isFullscreen ? " live-map-shell--fullscreen" : ""}`}
          ref={mapShellRef}
        >
          <div className="live-map-canvas" ref={mapContainerRef} aria-label="Carte mondiale interactive des actualités" />

          <div className="live-map-topbar">
            <button
              type="button"
              className="live-map-filter-button"
              onClick={() => setFiltersOpen((current) => !current)}
              aria-expanded={filtersOpen}
            >
              Filtres{activeFiltersCount ? ` · ${activeFiltersCount}` : ""}
            </button>
            <span>{filtersLabel(filters, payload)}</span>
          </div>

          <div className="live-map-controls" aria-label="Commandes de la carte">
            <button type="button" onClick={() => mapRef.current?.zoomIn()} aria-label="Zoomer">+</button>
            <button type="button" onClick={() => mapRef.current?.zoomOut()} aria-label="Dézoomer">−</button>
            <button type="button" onClick={fitWorld} aria-label="Recentrer le monde">◎</button>
            <button type="button" onClick={toggleFullscreen} aria-label={isFullscreen ? "Quitter le plein écran" : "Afficher en plein écran"}>
              {isFullscreen ? "↙" : "↗"}
            </button>
          </div>

          {filtersOpen ? (
            <div className="live-map-filters" role="dialog" aria-label="Filtres de la carte">
              <div className="live-map-filters__heading">
                <strong>Filtrer les signaux</strong>
                <button type="button" onClick={() => setFiltersOpen(false)} aria-label="Fermer les filtres">×</button>
              </div>

              <label>
                Catégorie
                <select
                  value={filters.category}
                  onChange={(event) => {
                    const next = { ...filtersRef.current, category: event.target.value };
                    filtersRef.current = next;
                    setFilters(next);
                  }}
                >
                  <option value="">Toutes</option>
                  {(payload?.filters?.categories || []).map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </label>

              <label>
                Pays
                <select
                  value={filters.country}
                  onChange={(event) => applyCountry(event.target.value)}
                >
                  <option value="">Tous les pays</option>
                  {(payload?.filters?.countries || []).map((country) => (
                    <option key={country.code} value={country.code}>{country.label}</option>
                  ))}
                </select>
              </label>

              <label>
                Source
                <select
                  value={filters.source}
                  onChange={(event) => {
                    const next = { ...filtersRef.current, source: event.target.value };
                    filtersRef.current = next;
                    setFilters(next);
                  }}
                >
                  <option value="">Toutes les sources</option>
                  {(payload?.filters?.sources || []).map((source) => (
                    <option key={source} value={source}>{source}</option>
                  ))}
                </select>
              </label>

              <div className="live-map-filters__actions">
                <button type="button" onClick={resetFilters}>Réinitialiser</button>
                <button type="button" className="primary" onClick={showFilteredArticles}>
                  Voir les articles
                </button>
              </div>
            </div>
          ) : null}

          <aside className={`live-map-articles${panelOpen ? " is-open" : ""}`} aria-hidden={!panelOpen}>
            <div className="live-map-articles__heading">
              <div>
                <small>Actualités sélectionnées</small>
                <strong>{panelTitle}</strong>
              </div>
              <button type="button" onClick={() => setPanelOpen(false)} aria-label="Fermer les actualités">×</button>
            </div>

            <div className="live-map-articles__body">
              {articlesState === "loading" ? <p className="live-map-message">Chargement…</p> : null}
              {articlesState === "error" ? <p className="live-map-message">Les articles ne répondent pas pour le moment.</p> : null}
              {articlesState === "ready" && articles.length === 0 ? <p className="live-map-message">Aucun article pour cette sélection.</p> : null}
              {articles.map((article) => (
                <article key={article.id || article.url}>
                  <div>
                    <span>{article.label}</span>
                    <time>{formatDate(article.seenAt)}</time>
                  </div>
                  <h2>{article.title}</h2>
                  <p>{article.mediaName}{article.eventCountry ? ` · ${article.eventCountry}` : ""}</p>
                  {article.url ? (
                    <a href={article.url} target="_blank" rel="noreferrer">Lire la source</a>
                  ) : null}
                </article>
              ))}
            </div>
          </aside>

          <div className="live-map-hint">
            <span className="live-map-hint__dot" aria-hidden="true" />
            Une bulle regroupe plusieurs actualités proches
          </div>
        </div>
      </div>

      <style jsx>{`
        .live-world {
          width: 100%;
          max-width: 100vw;
          overflow: clip;
          padding: 22px 0 8px;
        }
        .live-world__inner {
          width: min(1440px, calc(100% - 28px));
          margin: 0 auto;
          min-width: 0;
        }
        .live-world__header {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 24px;
          align-items: end;
          padding: 18px 4px 20px;
        }
        .live-world__eyebrow {
          margin: 0 0 8px;
          color: #68d8c9;
          font-size: 0.72rem;
          font-weight: 800;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }
        h1 {
          max-width: 850px;
          margin: 0;
          font-size: clamp(1.7rem, 4vw, 3.25rem);
          line-height: 1.02;
          letter-spacing: -0.045em;
        }
        .live-world__intro {
          max-width: 760px;
          margin: 12px 0 0;
          color: #a9c4c7;
          font-size: clamp(0.86rem, 1.35vw, 1rem);
          line-height: 1.55;
        }
        .live-world__status {
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 2px 9px;
          min-width: 210px;
          padding: 11px 14px;
          border: 1px solid rgba(124, 188, 190, 0.22);
          border-radius: 14px;
          background: rgba(7, 25, 32, 0.76);
          backdrop-filter: blur(12px);
        }
        .live-world__status span {
          width: 8px;
          height: 8px;
          margin-top: 5px;
          border-radius: 50%;
          background: #67d9c9;
          box-shadow: 0 0 12px rgba(95, 218, 201, 0.65);
        }
        .live-world__status--error span { background: #d88a79; }
        .live-world__status strong { font-size: 0.78rem; }
        .live-world__status small {
          grid-column: 2;
          color: #86a6aa;
          font-size: 0.65rem;
        }
        .live-map-shell {
          position: relative;
          width: 100%;
          max-width: 100%;
          height: clamp(520px, 72dvh, 790px);
          min-width: 0;
          overflow: hidden;
          border: 1px solid rgba(137, 194, 195, 0.24);
          border-radius: 22px;
          background: #06141b;
          box-shadow: 0 24px 70px rgba(0, 0, 0, 0.28);
          contain: layout paint;
        }
        .live-map-shell--fullscreen {
          width: 100vw;
          height: 100dvh;
          border: 0;
          border-radius: 0;
        }
        .live-map-canvas {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          min-width: 0;
          touch-action: none;
        }
        .live-map-topbar {
          position: absolute;
          z-index: 4;
          top: 12px;
          left: 12px;
          display: flex;
          align-items: center;
          gap: 10px;
          max-width: calc(100% - 84px);
          pointer-events: none;
        }
        .live-map-topbar span {
          overflow: hidden;
          padding: 9px 12px;
          border: 1px solid rgba(154, 205, 205, 0.18);
          border-radius: 11px;
          background: rgba(5, 20, 27, 0.78);
          color: #b7ced0;
          font-size: 0.72rem;
          text-overflow: ellipsis;
          white-space: nowrap;
          backdrop-filter: blur(10px);
        }
        .live-map-filter-button {
          pointer-events: auto;
          min-height: 40px;
          padding: 0 14px;
          border: 1px solid rgba(115, 216, 201, 0.42);
          border-radius: 11px;
          background: rgba(8, 34, 40, 0.91);
          color: #e9fffb;
          font: inherit;
          font-size: 0.76rem;
          font-weight: 800;
          cursor: pointer;
        }
        .live-map-controls {
          position: absolute;
          z-index: 5;
          top: 12px;
          right: 12px;
          display: grid;
          gap: 6px;
        }
        .live-map-controls button,
        .live-map-filters__heading button,
        .live-map-articles__heading button {
          display: grid;
          place-items: center;
          width: 40px;
          height: 40px;
          padding: 0;
          border: 1px solid rgba(148, 199, 201, 0.22);
          border-radius: 11px;
          background: rgba(5, 20, 27, 0.88);
          color: #eafffb;
          font: inherit;
          font-size: 1.1rem;
          cursor: pointer;
          backdrop-filter: blur(10px);
        }
        .live-map-filters {
          position: absolute;
          z-index: 8;
          top: 62px;
          left: 12px;
          display: grid;
          gap: 13px;
          width: min(340px, calc(100% - 88px));
          max-height: calc(100% - 112px);
          overflow: auto;
          padding: 16px;
          border: 1px solid rgba(129, 206, 198, 0.3);
          border-radius: 16px;
          background: rgba(5, 23, 30, 0.96);
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.38);
          backdrop-filter: blur(16px);
        }
        .live-map-filters__heading,
        .live-map-articles__heading {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
        }
        .live-map-filters__heading button,
        .live-map-articles__heading button {
          width: 34px;
          height: 34px;
          background: rgba(255, 255, 255, 0.04);
        }
        .live-map-filters label {
          display: grid;
          gap: 6px;
          color: #a9c5c7;
          font-size: 0.7rem;
          font-weight: 700;
        }
        .live-map-filters select {
          width: 100%;
          min-height: 42px;
          padding: 0 34px 0 11px;
          border: 1px solid rgba(149, 199, 201, 0.2);
          border-radius: 10px;
          background: #0a2630;
          color: #effafa;
          font: inherit;
          font-size: 0.78rem;
        }
        .live-map-filters__actions {
          display: grid;
          grid-template-columns: 1fr 1.2fr;
          gap: 8px;
        }
        .live-map-filters__actions button {
          min-height: 42px;
          border: 1px solid rgba(149, 199, 201, 0.2);
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.04);
          color: #d9efee;
          font: inherit;
          font-size: 0.72rem;
          font-weight: 800;
          cursor: pointer;
        }
        .live-map-filters__actions .primary {
          border-color: rgba(95, 218, 201, 0.5);
          background: #1b675f;
          color: white;
        }
        .live-map-articles {
          position: absolute;
          z-index: 7;
          top: 12px;
          right: 64px;
          bottom: 12px;
          display: grid;
          grid-template-rows: auto 1fr;
          width: min(380px, 34vw);
          overflow: hidden;
          border: 1px solid rgba(137, 203, 198, 0.28);
          border-radius: 16px;
          background: rgba(5, 22, 29, 0.96);
          box-shadow: 0 24px 70px rgba(0, 0, 0, 0.44);
          transform: translateX(calc(100% + 90px));
          transition: transform 180ms ease-out;
          pointer-events: none;
          backdrop-filter: blur(16px);
        }
        .live-map-articles.is-open {
          transform: translateX(0);
          pointer-events: auto;
        }
        .live-map-articles__heading {
          padding: 13px 13px 11px 16px;
          border-bottom: 1px solid rgba(157, 202, 202, 0.14);
        }
        .live-map-articles__heading div { display: grid; gap: 3px; }
        .live-map-articles__heading small {
          color: #6fcfc2;
          font-size: 0.62rem;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .live-map-articles__heading strong {
          max-width: 275px;
          overflow: hidden;
          font-size: 0.85rem;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .live-map-articles__body {
          overflow: auto;
          overscroll-behavior: contain;
          padding: 8px;
        }
        .live-map-articles article {
          padding: 13px;
          border-bottom: 1px solid rgba(151, 196, 197, 0.12);
        }
        .live-map-articles article:last-child { border-bottom: 0; }
        .live-map-articles article > div {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          color: #75c9be;
          font-size: 0.61rem;
          font-weight: 700;
        }
        .live-map-articles h2 {
          margin: 7px 0;
          font-size: 0.86rem;
          line-height: 1.35;
          letter-spacing: -0.01em;
        }
        .live-map-articles article p {
          margin: 0;
          color: #8eaaad;
          font-size: 0.66rem;
        }
        .live-map-articles article a {
          display: inline-block;
          margin-top: 9px;
          color: #9be5da;
          font-size: 0.68rem;
          font-weight: 800;
          text-decoration: none;
        }
        .live-map-message {
          margin: 0;
          padding: 24px 14px;
          color: #a7c0c2;
          font-size: 0.78rem;
          text-align: center;
        }
        .live-map-hint {
          position: absolute;
          z-index: 3;
          left: 12px;
          bottom: 12px;
          display: flex;
          align-items: center;
          gap: 7px;
          max-width: calc(100% - 24px);
          padding: 8px 10px;
          border-radius: 10px;
          background: rgba(4, 18, 24, 0.72);
          color: #9bb7ba;
          font-size: 0.65rem;
          pointer-events: none;
          backdrop-filter: blur(8px);
        }
        .live-map-hint__dot {
          width: 8px;
          height: 8px;
          flex: 0 0 auto;
          border-radius: 50%;
          background: #51cbbb;
          box-shadow: 0 0 8px rgba(81, 203, 187, 0.6);
        }
        @media (max-width: 760px) {
          .live-world { padding-top: 6px; }
          .live-world__inner { width: 100%; }
          .live-world__header {
            grid-template-columns: 1fr;
            gap: 12px;
            padding: 14px 16px 16px;
          }
          h1 { font-size: clamp(1.65rem, 8.5vw, 2.35rem); }
          .live-world__intro {
            margin-top: 9px;
            font-size: 0.82rem;
            line-height: 1.45;
          }
          .live-world__status {
            width: fit-content;
            min-width: 0;
            padding: 8px 11px;
          }
          .live-map-shell {
            height: clamp(390px, 66dvh, 620px);
            border-right: 0;
            border-left: 0;
            border-radius: 0;
          }
          .live-map-topbar {
            top: 8px;
            left: 8px;
            max-width: calc(100% - 60px);
          }
          .live-map-topbar span { display: none; }
          .live-map-filter-button {
            min-height: 44px;
            padding: 0 13px;
          }
          .live-map-controls {
            top: 8px;
            right: 8px;
            gap: 5px;
          }
          .live-map-controls button {
            width: 44px;
            height: 44px;
          }
          .live-map-filters {
            top: 60px;
            right: 8px;
            left: 8px;
            width: auto;
            max-height: calc(100% - 70px);
            padding: 14px;
          }
          .live-map-filters select,
          .live-map-filters__actions button { min-height: 46px; }
          .live-map-articles {
            top: auto;
            right: 8px;
            bottom: 8px;
            left: 8px;
            width: auto;
            max-height: 52%;
            border-radius: 16px;
            transform: translateY(calc(100% + 20px));
          }
          .live-map-articles.is-open { transform: translateY(0); }
          .live-map-articles__body { min-height: 90px; }
          .live-map-hint {
            right: 8px;
            bottom: 8px;
            left: 8px;
            justify-content: center;
            font-size: 0.61rem;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .live-map-articles { transition: none; }
        }
      `}</style>
    </section>
  );
}
