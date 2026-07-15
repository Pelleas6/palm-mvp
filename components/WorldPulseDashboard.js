"use client";

import { useEffect, useMemo, useState } from "react";

const REFRESH_MS = 10 * 60 * 1000;
const COLORS = ["#3ed6c3", "#f5bd4f", "#ff6f61", "#83a8ff", "#8ee37d", "#d783ff", "#ff9868"];
const EMPTY_COUNTS = { articles: 0, domains: 0, countries: 0, languages: 0, labels: 0 };

function hashString(value) {
  const input = String(value || "gdelt");
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

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
  if (state === "gdelt_ok" || state === "ok") return "GDELT OK";
  if (state === "rss_fallback") return "RSS_FALLBACK OK";
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

function SignalField({ articles, state, loading }) {
  const particles = useMemo(
    () =>
      articles.map((article, index) => {
        const seed = hashString(article.id || article.url || article.title || index);
        const left = 5 + (seed % 9000) / 100;
        const top = 8 + (Math.floor(seed / 97) % 8200) / 100;
        const size = 9 + (Math.floor(seed / 131) % 16);
        const color = COLORS[seed % COLORS.length];
        return { ...article, left, top, size, color, delay: `${(index % 12) * 0.08}s` };
      }),
    [articles]
  );

  return (
    <div className="signal-field" aria-label="Carte de particules représentant les articles reçus">
      <div className="field-grid" aria-hidden="true" />
      {loading && particles.length === 0 ? (
        <div className="state-copy">
          <div className="loader" aria-hidden="true" />
          <strong>Interrogation de GDELT puis RSS secours si besoin</strong>
          <span>Aucun point n'est dessiné avant retour d'une source réelle.</span>
        </div>
      ) : null}
      {!loading && particles.length === 0 ? (
        <div className="state-copy">
          <strong>{state === "unavailable" ? "Sources indisponibles" : "Aucun signal exploitable"}</strong>
          <span>La visualisation reste vide tant qu'aucun article réel n'est reçu.</span>
        </div>
      ) : null}
      {particles.map((particle) => {
        const style = {
          left: `${particle.left}%`,
          top: `${particle.top}%`,
          width: `${particle.size}px`,
          height: `${particle.size}px`,
          "--particle-color": particle.color,
          "--particle-delay": particle.delay,
        };
        return (
          <a
            key={particle.id}
            className="particle"
            href={particle.url}
            target="_blank"
            rel="noreferrer"
            style={style}
            title={`${particle.title} — ${particle.domain}`}
            aria-label={`${particle.title} (${particle.domain})`}
          />
        );
      })}
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
              {article.label || "Autre signal"} · {article.labelType || "classification estimative"} · {article.sourceCountry} · {article.language}
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
  const counts = payload.counts || EMPTY_COUNTS;
  const groupings = payload.groupings || { domains: [], countries: [], languages: [], labels: [] };
  const hasRealData = payload.state === "gdelt_ok" || payload.state === "rss_fallback" || payload.state === "ok" || payload.state === "empty";
  const stateLabel = payload.stateLabel || relativeStateLabel(payload.state);
  const sourceName = payload.source?.name || "Source en attente";
  const activeSource = loading ? "Interrogation" : sourceName;
  const sourceMetric = payload.source?.active === "gdelt" ? "GDELT" : payload.source?.active === "rss_fallback" ? "RSS" : payload.source?.active === "none" ? "Aucune" : "—";
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
          <p className="eyebrow">Monitor mondial · GDELT primaire · RSS secours · cache serveur ≥5 min</p>
          <h1>Le Pouls du Monde</h1>
          <p>
            Tableau de bord expérimental des signaux médiatiques mondiaux. Les points, listes, compteurs et labels sont
            calculés uniquement depuis des articles réels retournés côté serveur par GDELT ou, en secours, par RSS public.
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
        <Metric label="Source active" value={loading ? "—" : sourceMetric} hint={sourceName} />
        <Metric label="Fraîcheur" value={loading ? "—" : freshness} hint={payload.source?.cached ? "cache serveur" : "généré maintenant"} />
        <Metric label="Labels" value={loading ? "—" : counts.labels} hint="classification estimative" />
      </section>

      <section className="main-grid">
        <article className="panel map-panel">
          <div className="panel-heading map-heading">
            <div>
              <p>Champ de signaux</p>
              <h2>Particules médiatiques</h2>
            </div>
            <span>{hasRealData ? `${articles.length} particules réelles` : "visualisation suspendue"}</span>
          </div>
          <SignalField articles={articles} state={payload.state} loading={loading} />
        </article>
        <ArticleStream articles={articles} state={payload.state} sourceName={sourceName} />
      </section>

      <section className="bottom-grid" aria-label="Regroupements dérivés des articles reçus">
        <CountList title="Pays sources" items={groupings.countries || []} emptyLabel="Aucun pays source reçu." />
        <CountList title="Domaines média" items={groupings.domains || []} emptyLabel="Aucun domaine reçu." />
        <CountList title="Labels estimatifs" items={groupings.labels || []} emptyLabel="Aucun label calculé." />
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
        .state-gdelt_ok .status-dot, .state-ok .status-dot { background: var(--ok); box-shadow: 0 0 0 8px rgba(142, 227, 125, 0.12); }
        .state-rss_fallback .status-dot { background: var(--warn); box-shadow: 0 0 0 8px rgba(245, 189, 79, 0.16); }
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
          min-height: clamp(440px, 54vw, 680px);
          overflow: hidden;
          border: 1px solid var(--line-strong);
          background:
            radial-gradient(circle at center, rgba(62, 214, 195, 0.12), transparent 32%),
            linear-gradient(135deg, rgba(255, 255, 255, 0.035), transparent 45%),
            #07110f;
        }
        .field-grid {
          position: absolute;
          inset: 0;
          opacity: 0.52;
          background-image:
            linear-gradient(rgba(157, 191, 179, 0.12) 1px, transparent 1px),
            linear-gradient(90deg, rgba(157, 191, 179, 0.12) 1px, transparent 1px);
          background-size: 52px 52px;
          mask-image: radial-gradient(circle at center, black 0 45%, transparent 82%);
        }
        .signal-field::before, .signal-field::after {
          content: "";
          position: absolute;
          border: 1px solid rgba(157, 191, 179, 0.18);
          border-radius: 999px;
          inset: 18%;
        }
        .signal-field::after { inset: 34%; border-style: dashed; }

        .particle {
          position: absolute;
          z-index: 2;
          display: block;
          min-width: 12px;
          min-height: 12px;
          transform: translate(-50%, -50%);
          border-radius: 999px;
          background: var(--particle-color);
          box-shadow: 0 0 0 6px color-mix(in srgb, var(--particle-color) 16%, transparent), 0 0 24px var(--particle-color);
          animation: pulseFloat 3.6s ease-in-out infinite;
          animation-delay: var(--particle-delay);
        }
        .particle:hover { z-index: 4; transform: translate(-50%, -50%) scale(1.45); }

        .state-copy {
          position: absolute;
          inset: 0;
          display: grid;
          place-content: center;
          gap: 12px;
          text-align: center;
          color: var(--muted);
          padding: 24px;
        }
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
          .signal-field { min-height: 430px; }
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
