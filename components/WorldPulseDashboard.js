"use client";

import { useEffect, useMemo, useState } from "react";
import { geoEquirectangular, geoGraticule10, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import worldAtlas from "world-atlas/countries-110m.json";
import { WORLD_PULSE_SIGNAL_LEGEND, colorForWorldPulseSignalLabel } from "../lib/world-pulse-signals.js";

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
  mapPoints: 0,
  unavailableSources: 0,
};
const WORLD_FEATURE = feature(worldAtlas, worldAtlas.objects.countries);
const WORLD_VIEWBOX_WIDTH = 1000;
const WORLD_VIEWBOX_HEIGHT = 500;
const WORLD_PROJECTION = geoEquirectangular().fitExtent([[8, 8], [992, 492]], { type: "Sphere" });
const WORLD_PATH = geoPath(WORLD_PROJECTION);
const WORLD_COUNTRY_PATHS = WORLD_FEATURE.features
  .map((country, index) => ({ id: country.id || index, d: WORLD_PATH(country) }))
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

function WorldMapBackdrop() {
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
      {WORLD_COUNTRY_PATHS.map((country) => (
        <path key={country.id} className="map-land" d={country.d} />
      ))}
    </svg>
  );
}

function useGdeltPulse() {
  const [payload, setPayload] = useState({ state: "loading" });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let timer;

    async function load() {
      setLoading(true);
      try {
        const response = await fetch("/api/gdelt", { cache: "no-store" });
        const data = await response.json().catch(() => null);
        if (!active) return;
        if (!data || typeof data !== "object") {
          setPayload({
            state: "error",
            error: { reason: `Réponse locale illisible (${response.status})` },
            articles: [],
            counts: EMPTY_COUNTS,
            groupings: { domains: [], countries: [], languages: [], labels: [] },
          });
          return;
        }
        setPayload(data);
      } catch (error) {
        if (!active) return;
        setPayload({
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
  }, []);

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
    <div className="signal-legend" aria-label="Légende des couleurs des catégories de signaux">
      <div className="signal-legend-head">
        <span>Légende couleurs</span>
        <strong>{visibleLabel}</strong>
        <small>repère média 6-8px · particule article 3-5px</small>
      </div>
      <ul>
        {WORLD_PULSE_SIGNAL_LEGEND.map((item) => (
          <li key={item.label}>
            <i aria-hidden="true" style={{ "--legend-color": item.color }} />
            <span>{item.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SignalField({ mediaMarkers, articleParticles, unlocalized, state, loading }) {
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
    articleParticles.map((point, index) => ({
      ...point,
      kind: "article",
      left: clamp(point.x, 4, 96),
      top: clamp(point.y, 8, 88),
      size: point.size || 4,
      color: colorForLabel(point.label),
      delay: `${((index + 4) % 18) * 0.06}s`,
    }))
  ), [articleParticles]);
  const hasVisiblePoints = markers.length > 0 || particles.length > 0;

  function renderPoint(point, className) {
    const safeOffset = Math.ceil((point.size || 8) / 2 + 10);
    const sourceCountry = point.sourceCountry || point.location?.label || "Non précisé";
    const countLabel = point.kind === "media" ? formatArticleCount(point.articleCount) : "1 article";
    const typeLabel = point.kind === "media" ? "Repère média" : "Particule article";
    const titlePart = point.kind === "article" && point.title ? ` — ${point.title}` : "";
    const tooltip = `${typeLabel} — ${point.mediaName}${titlePart} — pays source : ${sourceCountry} — ${countLabel} — catégorie : ${point.label}`;
    const style = {
      left: `clamp(${safeOffset}px, ${point.left}%, calc(100% - ${safeOffset}px))`,
      top: `clamp(${safeOffset}px, ${point.top}%, calc(100% - ${safeOffset}px))`,
      width: `${point.size}px`,
      height: `${point.size}px`,
      "--particle-color": point.color,
      "--particle-delay": point.delay,
      "--particle-safe-offset": `${safeOffset}px`,
    };
    return (
      <a
        key={`${point.kind}-${point.id}`}
        className={`particle ${className}`}
        href={point.url || "#"}
        target="_blank"
        rel="noreferrer"
        style={style}
        title={tooltip}
        aria-label={`${typeLabel}, ${point.mediaName}, pays source : ${sourceCountry}, ${countLabel}, catégorie : ${point.label}`}
      >
        <span className="particle-tooltip" role="tooltip">
          <strong>{point.mediaName}</strong>
          <span>{typeLabel}</span>
          {point.title ? <span>{point.title}</span> : null}
          <span>Pays source : {sourceCountry}</span>
          <span>{countLabel}</span>
          <span>Catégorie : {point.label}</span>
        </span>
      </a>
    );
  }

  return (
    <div className="signal-field" aria-label="Carte du monde des sources médias localisées : repères médias et particules articles">
      <WorldMapBackdrop />
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
      {markers.map((marker) => renderPoint(marker, "media-marker"))}
      {unlocalized > 0 ? (
        <div className="unlocalized-badge" aria-label={`${unlocalized} articles sans localisation fiable`}>
          <span>Hors carte</span>
          <strong>{unlocalized}</strong>
          <small>source non localisée</small>
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

function healthStateLabel(state) {
  const labels = {
    OK: "OK",
    RATE_LIMITED: "Rate limit",
    TIMEOUT: "Timeout",
    HTTP_ERROR: "HTTP KO",
    INVALID_RESPONSE: "Réponse KO",
    CACHE_STALE: "Cache stale",
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
            <span>{healthStateLabel(item.state)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function GlobalTrends({ trends }) {
  const labels = Array.isArray(trends?.labels) ? trends.labels : [];
  const titles = Array.isArray(trends?.topTitles) ? trends.topTitles : [];
  return (
    <section className="panel mini-panel trace-panel" aria-label="Tendances globales GDELT Web N-Grams">
      <h2>Tendances GDELT Web N-Grams</h2>
      <p className="muted">
        TOC {trends?.timestamp || "non chargé"} · cycle {trends?.cycleMinutes || 15} min · retard ~{trends?.delayMinutes || 5} min · {trends?.documents || 0} document(s).
      </p>
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
              {article.label || "Autre signal"} · {article.labelType || "classification estimative"} · média source : {article.sourceLocation?.label || `${article.sourceCountry} non localisé`} · événement non géolocalisé par ce tableau · {article.language}
            </span>
          </a>
        ))}
      </div>
    </aside>
  );
}

export default function WorldPulseDashboard() {
  const { payload, loading } = useGdeltPulse();
  const articles = Array.isArray(payload.articles) ? payload.articles : [];
  const legacyMapPoints = Array.isArray(payload.mapPoints) ? payload.mapPoints : [];
  const mediaMarkers = Array.isArray(payload.mediaMarkers) ? payload.mediaMarkers : legacyMapPoints;
  const articleParticles = Array.isArray(payload.articleParticles) ? payload.articleParticles : [];
  const sourceHealth = Array.isArray(payload.sourceHealth) ? payload.sourceHealth : [];
  const globalTrends = payload.globalTrends || { documents: 0, labels: [], topTitles: [], cycleMinutes: 15, delayMinutes: 5 };
  const payloadCounts = payload.counts || {};
  const counts = { ...EMPTY_COUNTS, ...payloadCounts };
  const groupings = payload.groupings || { domains: [], mediaSources: [], countries: [], sourceRegions: [], locations: [], languages: [], labels: [] };
  const localizedCount = counts.localized;
  const unlocalizedCount = counts.unlocalized;
  const visibleMediaCount = countFromPayload(payloadCounts, "mediaMarkers", mediaMarkers.length);
  const visibleArticleParticleCount = countFromPayload(payloadCounts, "articleParticles", articleParticles.length);
  const totalMediaCount = Math.max(countFromPayload(payloadCounts, "mediaSources", counts.mediaSources), visibleMediaCount);
  const visibleMediaLabel = loading ? "— repères médias" : `${visibleMediaCount}/${totalMediaCount} repères médias · ${visibleArticleParticleCount} particules articles`;
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
        <Metric label="Articles" value={loading ? "—" : counts.articles} hint="liens uniques" />
        <Metric label="Médias" value={loading ? "—" : counts.mediaSources} hint="sources agrégées" />
        <Metric label="Repères médias" value={loading ? "—" : `${visibleMediaCount}/${totalMediaCount}`} hint="6-8px, source agrégée" />
        <Metric label="Particules articles" value={loading ? "—" : visibleArticleParticleCount} hint="3-5px, articles localisés" />
        <Metric label="Hors carte" value={loading ? "—" : unlocalizedCount} hint="sans localisation inventée" />
        <Metric label="Source active" value={loading ? "—" : sourceMetric} hint={sourceName} />
        <Metric label="Docs tendances" value={loading ? "—" : (globalTrends.documents || 0)} hint="GDELT Web N-Grams TOC" />
        <Metric label="Fraîcheur" value={loading ? "—" : freshness} hint={payload.source?.cached ? "cache serveur" : "généré maintenant"} />
      </section>

      <section className="main-grid">
        <article className="panel map-panel">
          <div className="panel-heading map-heading">
            <div>
              <p>Carte géographique</p>
              <h2>Sources média localisées</h2>
            </div>
            <span>{hasRealData ? `${visibleMediaLabel} · ${localizedCount} articles source localisés · ${unlocalizedCount} hors carte` : "visualisation suspendue"}</span>
          </div>
          <SignalField mediaMarkers={mediaMarkers} articleParticles={articleParticles} unlocalized={unlocalizedCount} state={payload.state} loading={loading} />
          <SignalLegend visibleLabel={visibleMediaLabel} />
          <p className="map-note">
            Les grands repères représentent les médias sources localisés (6-8px) et les petites particules représentent les articles reçus (3-5px). Ils ne prétendent pas localiser l'événement raconté par l'article.
          </p>
        </article>
        <ArticleStream articles={articles} state={payload.state} sourceName={sourceName} />
      </section>

      <section className="bottom-grid" aria-label="Regroupements dérivés des articles reçus">
        <CountList title="Médias sources" items={groupings.mediaSources || []} emptyLabel="Aucun média source reçu." />
        <CountList title="Régions sources" items={groupings.sourceRegions || []} emptyLabel="Aucune région source reçue." />
        <CountList title="Pays sources" items={groupings.countries || []} emptyLabel="Aucun pays source reçu." />
        <CountList title="Localisations carte" items={groupings.locations || []} emptyLabel="Aucune source localisable." />
        <CountList title="Domaines média" items={groupings.domains || []} emptyLabel="Aucun domaine reçu." />
        <CountList title="Labels estimatifs" items={groupings.labels || []} emptyLabel="Aucun label calculé." />
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
              <dt>Articles</dt>
              <dd>{loading ? "—" : counts.articles}</dd>
            </div>
            <div>
              <dt>Localisés carte</dt>
              <dd>{loading ? "—" : localizedCount}</dd>
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
              <dd>{payload.query || "—"}</dd>
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

        .main-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.55fr) minmax(340px, 0.75fr);
          gap: 18px;
          margin-bottom: 18px;
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
          white-space: nowrap;
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
          transform: translate(-50%, -50%);
          border-radius: 999px;
          background: var(--particle-color);
          animation: pulseFloat 3.6s ease-in-out infinite;
          animation-delay: var(--particle-delay);
        }
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
          grid-template-columns: minmax(150px, 1.2fr) minmax(110px, 0.75fr) minmax(260px, 1.8fr) 70px 86px 80px 78px 92px;
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
          .stream-panel { max-height: none; }
          .article-list { max-height: none; }
        }

        @media (max-width: 680px) {
          .pulse-shell { width: min(100% - 20px, 1480px); padding-top: 10px; }
          .title-block, .status-panel, .panel, .metric-card { border-radius: 0; }
          .metric-grid, .bottom-grid { grid-template-columns: 1fr; }
          .top-strip, .main-grid, .metric-grid, .bottom-grid { gap: 10px; margin-bottom: 10px; }
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
