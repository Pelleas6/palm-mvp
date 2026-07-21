"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { feature } from "topojson-client";
import worldAtlas from "world-atlas/countries-110m.json";
import { SOURCE_COUNTRY_REGISTRY } from "../lib/world-pulse-geography.js";
import { WORLD_PULSE_SIGNAL_LEGEND } from "../lib/world-pulse-signals.js";

const EMPTY_COLLECTION = { type: "FeatureCollection", features: [] };
const WORLD_BOUNDS = [[-174, -58], [178, 80]];

const registryByNumeric = new Map(
  SOURCE_COUNTRY_REGISTRY.map((entry) => [String(entry.isoNumeric).padStart(3, "0"), entry]),
);

const rawCountries = feature(worldAtlas, worldAtlas.objects.countries);
const countryCollection = {
  type: "FeatureCollection",
  features: rawCountries.features.map((country) => {
    const entry = registryByNumeric.get(String(country.id).padStart(3, "0"));
    return {
      ...country,
      properties: {
        code: entry?.code || "",
        label: entry?.label || "",
      },
    };
  }),
};

const countryByCode = new Map(
  countryCollection.features
    .filter((country) => country.properties.code)
    .map((country) => [country.properties.code, country]),
);

const categoryColors = [
  "match", ["get", "c"],
  ...WORLD_PULSE_SIGNAL_LEGEND.flatMap((category) => [category.label, category.color]),
  "#aab9b5",
];

const baseStyle = {
  version: 8,
  sources: {},
  layers: [{ id: "background", type: "background", paint: { "background-color": "#06141b" } }],
};

function blankFilters() {
  return { category: "", country: "", source: "" };
}

function filterCollection(payload, filters) {
  const features = Array.isArray(payload?.geojson?.features) ? payload.geojson.features : [];
  return {
    type: "FeatureCollection",
    features: features.filter((item) => {
      const properties = item?.properties || {};
      return (!filters.category || properties.c === filters.category)
        && (!filters.country || properties.k === filters.country)
        && (!filters.source || properties.s === filters.source);
    }),
  };
}

function walkCoordinates(value, visitor) {
  if (!Array.isArray(value)) return;
  if (value.length >= 2 && Number.isFinite(Number(value[0])) && Number.isFinite(Number(value[1]))) {
    visitor(Number(value[0]), Number(value[1]));
    return;
  }
  value.forEach((part) => walkCoordinates(part, visitor));
}

function countryBounds(code) {
  const country = countryByCode.get(code);
  if (!country) return null;
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  walkCoordinates(country.geometry?.coordinates, (longitude, latitude) => {
    west = Math.min(west, longitude);
    south = Math.min(south, latitude);
    east = Math.max(east, longitude);
    north = Math.max(north, latitude);
  });
  if (![west, south, east, north].every(Number.isFinite) || east - west > 220) return null;
  return [[west, south], [east, north]];
}

function isMobile() {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 760px)").matches;
}

function formatDate(value) {
  const date = new Date(value || "");
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function selectionLabel(filters, payload) {
  const labels = [];
  if (filters.category) labels.push(filters.category);
  if (filters.country) {
    const country = payload?.filters?.countries?.find((entry) => entry.code === filters.country);
    labels.push(country?.label || filters.country);
  }
  if (filters.source) labels.push(filters.source);
  return labels.length ? labels.join(" · ") : "Monde entier";
}

function fitWorld(map, animate = true) {
  map?.fitBounds(WORLD_BOUNDS, {
    padding: isMobile() ? 8 : 28,
    duration: animate ? 420 : 0,
  });
}

function fitCountry(map, code) {
  if (!code) {
    fitWorld(map);
    return;
  }
  const bounds = countryBounds(code);
  if (!bounds) return;
  map?.fitBounds(bounds, {
    padding: isMobile() ? 48 : 86,
    maxZoom: 5.6,
    duration: 480,
  });
}

export default function WorldMap() {
  const canvasRef = useRef(null);
  const shellRef = useRef(null);
  const mapRef = useRef(null);
  const payloadRef = useRef(null);
  const filtersRef = useRef(blankFilters());
  const openCountryRef = useRef(null);
  const openArticleRef = useRef(null);

  const [payload, setPayload] = useState(null);
  const [filters, setFilters] = useState(blankFilters);
  const [, setStatus] = useState("map");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelTitle, setPanelTitle] = useState("Actualités");
  const [articles, setArticles] = useState([]);
  const [articlesStatus, setArticlesStatus] = useState("idle");
  const [fullscreen, setFullscreen] = useState(false);

  payloadRef.current = payload;
  filtersRef.current = filters;

  const filtered = useMemo(() => filterCollection(payload, filters), [payload, filters]);
  const filterCount = Object.values(filters).filter(Boolean).length;

  async function loadArticles({ articleId = "", filterOverride } = {}) {
    const active = filterOverride || filtersRef.current;
    const params = new URLSearchParams({ limit: articleId ? "1" : "18" });
    if (articleId) params.set("articleId", articleId);
    if (!articleId && active.category) params.set("category", active.category);
    if (!articleId && active.country) params.set("country", active.country);
    if (!articleId && active.source) params.set("source", active.source);

    setArticlesStatus("loading");
    setPanelOpen(true);
    try {
      const response = await fetch(`/api/map-articles?${params.toString()}`, {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = await response.json();
      setArticles(Array.isArray(body?.articles) ? body.articles : []);
      setArticlesStatus("ready");
    } catch (error) {
      console.error("Map article request failed:", error);
      setArticles([]);
      setArticlesStatus("error");
    }
  }

  openArticleRef.current = (properties) => {
    const id = String(properties?.i || "");
    if (!id) return;
    setPanelTitle(String(properties?.n || properties?.c || "Actualité"));
    loadArticles({ articleId: id });
  };

  openCountryRef.current = (code, showArticles = true) => {
    const next = { ...filtersRef.current, country: code };
    filtersRef.current = next;
    setFilters(next);
    setFiltersOpen(false);
    fitCountry(mapRef.current, code);
    if (showArticles) {
      const country = payloadRef.current?.filters?.countries?.find((entry) => entry.code === code);
      setPanelTitle(country?.label || "Actualités du pays");
      loadArticles({ filterOverride: next });
    }
  };

  useEffect(() => {
    if (!canvasRef.current || mapRef.current) return undefined;

    let stopped = false;
    let timer = null;
    let map = null;
    let observer = null;
    const controller = new AbortController();

    const refreshSignals = async () => {
      try {
        setStatus((current) => (current === "ready" ? current : "signals"));
        const response = await fetch("/api/map-signals", {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const body = await response.json();
        if (stopped) return;
        setPayload(body);
        setStatus("ready");
      } catch (error) {
        if (stopped || error?.name === "AbortError") return;
        console.error("Map signal request failed:", error);
        setStatus("error");
      }
    };

    const mount = async () => {
      try {
        const imported = await import("maplibre-gl");
        if (stopped || !canvasRef.current) return;
        const maplibregl = imported.default;
        const mobile = isMobile();

        map = new maplibregl.Map({
          container: canvasRef.current,
          style: baseStyle,
          center: [2, 18],
          zoom: mobile ? 0.45 : 1,
          minZoom: 0.25,
          maxZoom: 7,
          renderWorldCopies: false,
          dragRotate: false,
          pitchWithRotate: false,
          touchPitch: false,
          attributionControl: false,
          fadeDuration: 0,
        });
        mapRef.current = map;
        map.touchZoomRotate.disableRotation();

        map.once("load", () => {
          if (stopped) return;

          map.addSource("countries", { type: "geojson", data: countryCollection });
          map.addLayer({
            id: "countries",
            type: "fill",
            source: "countries",
            paint: { "fill-color": "#0b2730", "fill-opacity": 0.92 },
          });
          map.addLayer({
            id: "selected-country",
            type: "fill",
            source: "countries",
            filter: ["==", ["get", "code"], "__none__"],
            paint: { "fill-color": "#5fdac9", "fill-opacity": 0.2 },
          });
          map.addLayer({
            id: "country-lines",
            type: "line",
            source: "countries",
            paint: {
              "line-color": "#789ca5",
              "line-opacity": 0.56,
              "line-width": ["interpolate", ["linear"], ["zoom"], 0, 0.45, 5, 1.15],
            },
          });

          map.addSource("signals", {
            type: "geojson",
            data: EMPTY_COLLECTION,
            cluster: true,
            clusterRadius: mobile ? 42 : 52,
            clusterMaxZoom: 5,
          });
          map.addLayer({
            id: "cluster-halo",
            type: "circle",
            source: "signals",
            filter: ["has", "point_count"],
            paint: {
              "circle-color": "#5fdac9",
              "circle-opacity": 0.28,
              "circle-radius": ["step", ["get", "point_count"], 16, 12, 20, 35, 25, 90, 31],
            },
          });
          map.addLayer({
            id: "clusters",
            type: "circle",
            source: "signals",
            filter: ["has", "point_count"],
            paint: {
              "circle-color": "#51cbbb",
              "circle-opacity": 0.94,
              "circle-radius": ["step", ["get", "point_count"], 8, 12, 11, 35, 15, 90, 20],
              "circle-stroke-color": "rgba(5,20,27,0.56)",
              "circle-stroke-width": 0.7,
            },
          });
          map.addLayer({
            id: "points",
            type: "circle",
            source: "signals",
            filter: ["!", ["has", "point_count"]],
            paint: {
              "circle-color": categoryColors,
              "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 3.2, 6, 6.2],
              "circle-opacity": 0.98,
              "circle-stroke-color": "rgba(5,20,27,0.5)",
              "circle-stroke-width": 0.55,
            },
          });

          map.on("click", "clusters", async (event) => {
            const cluster = event.features?.[0];
            const id = cluster?.properties?.cluster_id;
            if (id === undefined) return;
            try {
              const source = map.getSource("signals");
              const zoom = await source.getClusterExpansionZoom(id);
              map.easeTo({ center: cluster.geometry.coordinates, zoom, duration: 360 });
            } catch (error) {
              console.error("Cluster expansion failed:", error);
            }
          });

          map.on("click", "points", (event) => {
            openArticleRef.current?.(event.features?.[0]?.properties);
          });

          map.on("click", "countries", (event) => {
            const signals = map.queryRenderedFeatures(event.point, { layers: ["clusters", "points"] });
            if (signals.length) return;
            const code = String(event.features?.[0]?.properties?.code || "");
            if (code) openCountryRef.current?.(code, true);
          });

          ["clusters", "points", "countries"].forEach((layer) => {
            map.on("mouseenter", layer, () => { map.getCanvas().style.cursor = "pointer"; });
            map.on("mouseleave", layer, () => { map.getCanvas().style.cursor = ""; });
          });

          fitWorld(map, false);
          refreshSignals();
          timer = window.setInterval(refreshSignals, 30_000);
        });

        if ("ResizeObserver" in window) {
          observer = new ResizeObserver(() => map?.resize());
          observer.observe(canvasRef.current);
        }
      } catch (error) {
        console.error("MapLibre startup failed:", error);
        setStatus("error");
      }
    };

    mount();
    return () => {
      stopped = true;
      controller.abort();
      if (timer) window.clearInterval(timer);
      observer?.disconnect();
      map?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const source = map?.getSource("signals");
    if (source?.setData) source.setData(filtered);
    if (map?.getLayer("selected-country")) {
      map.setFilter("selected-country", ["==", ["get", "code"], filters.country || "__none__"]);
    }
  }, [filtered, filters.country]);

  useEffect(() => {
    const resize = () => mapRef.current?.resize();
    window.addEventListener("resize", resize, { passive: true });
    return () => window.removeEventListener("resize", resize);
  }, []);

  useEffect(() => {
    const changed = () => {
      setFullscreen(document.fullscreenElement === shellRef.current);
      window.setTimeout(() => mapRef.current?.resize(), 70);
    };
    document.addEventListener("fullscreenchange", changed);
    return () => document.removeEventListener("fullscreenchange", changed);
  }, []);

  const updateFilter = (name, value) => {
    const next = { ...filtersRef.current, [name]: value };
    filtersRef.current = next;
    setFilters(next);
    if (name === "country") fitCountry(mapRef.current, value);
  };

  const reset = () => {
    const next = blankFilters();
    filtersRef.current = next;
    setFilters(next);
    setPanelOpen(false);
    setFiltersOpen(false);
    fitWorld(mapRef.current);
  };

  const showSelection = () => {
    setPanelTitle(selectionLabel(filters, payload));
    setFiltersOpen(false);
    loadArticles({ filterOverride: filters });
  };

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await shellRef.current?.requestFullscreen();
    } catch (error) {
      console.error("Fullscreen failed:", error);
    }
  };

  return (
    <section className="world-map" aria-labelledby="world-map-title">
      <div className="world-map__wrap">
        <header className="world-map__header">
          <div>
            <p className="world-map__eyebrow">Le Pouls du Monde · En direct</p>
            <h1 id="world-map-title">Les actualités prennent place sur la carte</h1>
            <p className="world-map__intro">
              Déplacez la carte, zoomez sur une bulle ou touchez un pays. Les articles détaillés sont chargés uniquement lors de leur ouverture.
            </p>
          </div>
        </header>

        <div ref={shellRef} className={`map-shell${fullscreen ? " is-fullscreen" : ""}`}>
          <div ref={canvasRef} className="map-canvas" aria-label="Carte mondiale interactive des actualités" />

          <div className="map-toolbar">
            <button type="button" onClick={() => setFiltersOpen((open) => !open)} aria-expanded={filtersOpen}>
              Filtres{filterCount ? ` · ${filterCount}` : ""}
            </button>
          </div>

          <div className="map-controls" aria-label="Commandes de la carte">
            <button type="button" onClick={() => mapRef.current?.zoomIn()} aria-label="Zoomer">+</button>
            <button type="button" onClick={() => mapRef.current?.zoomOut()} aria-label="Dézoomer">−</button>
            <button type="button" onClick={() => fitWorld(mapRef.current)} aria-label="Recentrer la carte">◎</button>
            <button type="button" onClick={toggleFullscreen} aria-label="Plein écran">{fullscreen ? "↙" : "↗"}</button>
          </div>

          {filtersOpen ? (
            <div className="filter-panel" role="dialog" aria-label="Filtres de la carte">
              <div className="panel-heading">
                <strong>Filtrer les signaux</strong>
                <button type="button" onClick={() => setFiltersOpen(false)} aria-label="Fermer">×</button>
              </div>
              <label>
                Catégorie
                <select value={filters.category} onChange={(event) => updateFilter("category", event.target.value)}>
                  <option value="">Toutes</option>
                  {(payload?.filters?.categories || []).map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </label>
              <label>
                Pays
                <select value={filters.country} onChange={(event) => updateFilter("country", event.target.value)}>
                  <option value="">Tous les pays</option>
                  {(payload?.filters?.countries || []).map((country) => <option key={country.code} value={country.code}>{country.label}</option>)}
                </select>
              </label>
              <label>
                Source
                <select value={filters.source} onChange={(event) => updateFilter("source", event.target.value)}>
                  <option value="">Toutes les sources</option>
                  {(payload?.filters?.sources || []).map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </label>
              <div className="filter-actions">
                <button type="button" onClick={reset}>Réinitialiser</button>
                <button type="button" className="primary" onClick={showSelection}>Voir les articles</button>
              </div>
            </div>
          ) : null}

          <aside className={`article-panel${panelOpen ? " is-open" : ""}`} aria-hidden={!panelOpen}>
            <div className="panel-heading article-heading">
              <div><small>Actualités sélectionnées</small><strong>{panelTitle}</strong></div>
              <button type="button" onClick={() => setPanelOpen(false)} aria-label="Fermer">×</button>
            </div>
            <div className="article-list">
              {articlesStatus === "loading" ? <p className="panel-message">Chargement…</p> : null}
              {articlesStatus === "error" ? <p className="panel-message">Les articles ne répondent pas pour le moment.</p> : null}
              {articlesStatus === "ready" && !articles.length ? <p className="panel-message">Aucun article pour cette sélection.</p> : null}
              {articles.map((article) => (
                <article key={article.id || article.url}>
                  <div className="article-meta"><span>{article.label}</span><time>{formatDate(article.seenAt)}</time></div>
                  <h2>{article.title}</h2>
                  <p>{article.mediaName}{article.eventCountry ? ` · ${article.eventCountry}` : ""}</p>
                  {article.url ? <a href={article.url} target="_blank" rel="noreferrer">Lire la source</a> : null}
                </article>
              ))}
            </div>
          </aside>

          <div className="map-hint"><i aria-hidden="true" />Une bulle regroupe plusieurs actualités proches</div>
        </div>

          <div className="world-map__legend" aria-label="Légende des couleurs des bulles">
            <span>Légende des couleurs</span>
            <div>
              {WORLD_PULSE_SIGNAL_LEGEND
                .filter((category) => {
                  const categories = payload?.filters?.categories;
                  return !Array.isArray(categories) || categories.length === 0 || categories.includes(category.label);
                })
                .map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    className={filters.category === category.label ? "is-active" : ""}
                    style={{ "--legend-color": category.color }}
                    onClick={() => updateFilter("category", filters.category === category.label ? "" : category.label)}
                    aria-pressed={filters.category === category.label}
                    title={`Filtrer : ${category.thematic === false ? "À qualifier" : category.label}`}
                  >
                    <i aria-hidden="true" />
                    {category.thematic === false ? "À qualifier" : category.label}
                  </button>
                ))}
            </div>
          </div>

      </div>

      <style jsx>{`
        .world-map { width: 100%; max-width: 100vw; overflow: clip; padding: 18px 0 8px; }
        .world-map__wrap { width: min(1440px, calc(100% - 28px)); min-width: 0; margin: 0 auto; }
        .world-map__header { display: block; padding: 18px 4px 14px; }
        .world-map__eyebrow { margin: 0 0 8px; color: #68d8c9; font-size: .72rem; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; }
        h1 { max-width: 850px; margin: 0; font-size: clamp(1.7rem, 4vw, 3.25rem); line-height: 1.02; letter-spacing: -.045em; }
        .world-map__intro { max-width: 760px; margin: 12px 0 0; color: #a9c4c7; font-size: clamp(.86rem, 1.35vw, 1rem); line-height: 1.55; }
        .world-map__legend { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; padding: 14px 4px 0; }
        .world-map__legend > span { color: #67d9c9; font-size: .62rem; font-weight: 800; letter-spacing: .11em; text-transform: uppercase; white-space: nowrap; }
        .world-map__legend > div { display: flex; flex: 1 1 700px; flex-wrap: wrap; gap: 5px 15px; }
        .world-map__legend button { display: inline-flex; align-items: center; gap: 6px; min-height: 22px; border: 0; background: transparent; color: #a9c4c7; padding: 2px 0; font: inherit; font-size: .68rem; line-height: 1.2; cursor: pointer; }
        .world-map__legend button:hover, .world-map__legend button:focus-visible, .world-map__legend button.is-active { color: #effafa; outline: none; }
        .world-map__legend button.is-active { text-decoration: underline; text-decoration-color: var(--legend-color); text-decoration-thickness: 2px; text-underline-offset: 4px; }
        .world-map__legend i { width: 9px; height: 9px; flex: 0 0 auto; border-radius: 50%; background: var(--legend-color); box-shadow: 0 0 10px color-mix(in srgb, var(--legend-color) 82%, transparent); }
        .map-shell { position: relative; width: 100%; max-width: 100%; height: clamp(520px, 72dvh, 790px); min-width: 0; overflow: hidden; border: 1px solid rgba(137,194,195,.24); border-radius: 22px; background: #06141b; box-shadow: 0 24px 70px rgba(0,0,0,.28); contain: layout paint; }
        .map-shell.is-fullscreen { width: 100vw; height: 100dvh; border: 0; border-radius: 0; }
        .map-canvas { position: absolute; inset: 0; width: 100%; height: 100%; min-width: 0; touch-action: none; }
        .map-toolbar { position: absolute; z-index: 5; top: 12px; left: 12px; max-width: calc(100% - 80px); pointer-events: none; }
        .map-toolbar button { min-height: 40px; padding: 0 14px; border: 1px solid rgba(115,216,201,.42); border-radius: 11px; background: rgba(8,34,40,.92); color: #e9fffb; font: inherit; font-size: .76rem; font-weight: 800; cursor: pointer; pointer-events: auto; }
        .map-controls { position: absolute; z-index: 6; top: 12px; right: 12px; display: grid; gap: 6px; }
        .map-controls button, .panel-heading > button { display: grid; place-items: center; width: 40px; height: 40px; padding: 0; border: 1px solid rgba(148,199,201,.22); border-radius: 11px; background: rgba(5,20,27,.9); color: #eafffb; font: inherit; font-size: 1.1rem; cursor: pointer; backdrop-filter: blur(10px); }
        .filter-panel { position: absolute; z-index: 9; top: 62px; left: 12px; display: grid; gap: 13px; width: min(340px, calc(100% - 88px)); max-height: calc(100% - 112px); overflow: auto; padding: 16px; border: 1px solid rgba(129,206,198,.3); border-radius: 16px; background: rgba(5,23,30,.97); box-shadow: 0 20px 60px rgba(0,0,0,.38); backdrop-filter: blur(16px); }
        .panel-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .panel-heading > button { width: 34px; height: 34px; background: rgba(255,255,255,.04); }
        .filter-panel label { display: grid; gap: 6px; color: #a9c5c7; font-size: .7rem; font-weight: 700; }
        .filter-panel select { width: 100%; min-height: 42px; padding: 0 34px 0 11px; border: 1px solid rgba(149,199,201,.2); border-radius: 10px; background: #0a2630; color: #effafa; font: inherit; font-size: .78rem; }
        .filter-actions { display: grid; grid-template-columns: 1fr 1.2fr; gap: 8px; }
        .filter-actions button { min-height: 42px; border: 1px solid rgba(149,199,201,.2); border-radius: 10px; background: rgba(255,255,255,.04); color: #d9efee; font: inherit; font-size: .72rem; font-weight: 800; cursor: pointer; }
        .filter-actions .primary { border-color: rgba(95,218,201,.5); background: #1b675f; color: white; }
        .article-panel { position: absolute; z-index: 8; top: 12px; right: 64px; bottom: 12px; display: grid; grid-template-rows: auto 1fr; width: min(380px, 34vw); overflow: hidden; border: 1px solid rgba(137,203,198,.28); border-radius: 16px; background: rgba(5,22,29,.97); box-shadow: 0 24px 70px rgba(0,0,0,.44); transform: translateX(calc(100% + 90px)); transition: transform 180ms ease-out; pointer-events: none; backdrop-filter: blur(16px); }
        .article-panel.is-open { transform: translateX(0); pointer-events: auto; }
        .article-heading { padding: 13px 13px 11px 16px; border-bottom: 1px solid rgba(157,202,202,.14); }
        .article-heading div { display: grid; gap: 3px; }
        .article-heading small { color: #6fcfc2; font-size: .62rem; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
        .article-heading strong { max-width: 275px; overflow: hidden; font-size: .85rem; text-overflow: ellipsis; white-space: nowrap; }
        .article-list { overflow: auto; overscroll-behavior: contain; padding: 8px; }
        .article-list article { padding: 13px; border-bottom: 1px solid rgba(151,196,197,.12); }
        .article-meta { display: flex; justify-content: space-between; gap: 8px; color: #75c9be; font-size: .61rem; font-weight: 700; }
        .article-list h2 { margin: 7px 0; font-size: .86rem; line-height: 1.35; letter-spacing: -.01em; }
        .article-list article p { margin: 0; color: #8eaaad; font-size: .66rem; }
        .article-list article a { display: inline-block; margin-top: 9px; color: #9be5da; font-size: .68rem; font-weight: 800; text-decoration: none; }
        .panel-message { margin: 0; padding: 24px 14px; color: #a7c0c2; font-size: .78rem; text-align: center; }
        .map-hint { position: absolute; z-index: 4; left: 12px; bottom: 12px; display: flex; align-items: center; gap: 7px; max-width: calc(100% - 24px); padding: 8px 10px; border-radius: 10px; background: rgba(4,18,24,.74); color: #9bb7ba; font-size: .65rem; pointer-events: none; backdrop-filter: blur(8px); }
        .map-hint i { width: 8px; height: 8px; flex: 0 0 auto; border-radius: 50%; background: #51cbbb; box-shadow: 0 0 8px rgba(81,203,187,.6); }
        @media (max-width: 760px) {
          .world-map { padding-top: 4px; }
          .world-map__wrap { width: 100%; }
          .world-map__header { padding: 14px 16px 10px; }
          h1 { font-size: clamp(1.65rem, 8.5vw, 2.35rem); }
          .world-map__intro { margin-top: 9px; font-size: .82rem; line-height: 1.45; }
          .world-map__legend { display: grid; gap: 8px; padding: 12px 2px 0; }
          .world-map__legend > div { gap: 5px 12px; }
          .world-map__legend button { font-size: .64rem; }
          .map-shell { height: clamp(390px, 66dvh, 620px); border-right: 0; border-left: 0; border-radius: 0; }
          .map-toolbar { top: 8px; left: 8px; max-width: calc(100% - 60px); }
          .map-toolbar button, .map-controls button { min-height: 44px; width: auto; }
          .map-controls { top: 8px; right: 8px; gap: 5px; }
          .map-controls button { width: 44px; height: 44px; }
          .filter-panel { top: 60px; right: 8px; left: 8px; width: auto; max-height: calc(100% - 68px); padding: 14px; }
          .filter-panel select, .filter-actions button { min-height: 46px; }
          .article-panel { top: auto; right: 8px; bottom: 8px; left: 8px; width: auto; max-height: 52%; border-radius: 16px; transform: translateY(calc(100% + 20px)); }
          .article-panel.is-open { transform: translateY(0); }
          .article-list { min-height: 90px; }
          .map-hint { right: 8px; bottom: 8px; left: 8px; justify-content: center; font-size: .61rem; }
        }
        @media (prefers-reduced-motion: reduce) { .article-panel { transition: none; } }
      `}</style>
    </section>
  );
}
