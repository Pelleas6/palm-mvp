import Header from "../../components/Header";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { getWorldPulseSourceHealthSnapshot } from "../../lib/world-pulse.js";

function healthStateLabel(state) {
  const labels = {
    OK: "OK",
    RATE_LIMITED: "Rate limit",
    TIMEOUT: "Timeout",
    HTTP_ERROR: "HTTP KO",
    INVALID_RESPONSE: "Réponse KO",
    CACHE_STALE: "Cache stale",
    NOT_CHECKED: "Non testé",
  };
  return labels[state] || state || "—";
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "medium" }).format(date);
}

export default function SourceHealthPage() {
  const snapshot = getWorldPulseSourceHealthSnapshot();
  const items = Array.isArray(snapshot.items) ? snapshot.items : [];

  return (
    <>
      <Header dark={true} />
      <main className="health-shell">
        <section className="health-hero">
          <p>Le Pouls du Monde</p>
          <h1>Santé des sources</h1>
          <span>Lecture mémoire uniquement : cette page n'appelle ni RSS, ni GDELT Web N-Grams, ni GDELT DOC.</span>
        </section>

        <section className="health-meta">
          <div><span>Cache</span><strong>{snapshot.cache?.status || "empty"}</strong></div>
          <div><span>Généré</span><strong>{formatDate(snapshot.generatedAt)}</strong></div>
          <div><span>Servi</span><strong>{formatDate(snapshot.servedAt)}</strong></div>
          <div><span>Fraîcheur</span><strong>{Number.isFinite(snapshot.freshnessSeconds) ? `${snapshot.freshnessSeconds}s` : "—"}</strong></div>
        </section>

        <section className="health-table" aria-label="Matrice de santé des sources en mémoire">
          <div className="health-row health-head">
            <span>Source</span><span>Région</span><span>URL</span><span>HTTP</span><span>Articles/docs</span><span>Récent</span><span>État</span>
          </div>
          {items.length === 0 ? (
            <p className="empty">Aucune observation source en mémoire. Chargez d'abord le dashboard principal pour amorcer le cache serveur.</p>
          ) : items.map((item) => (
            <div className="health-row" key={`${item.source}-${item.url || item.checkedAt || item.state}`}>
              <span>{item.source}</span>
              <span>{item.region || "—"}</span>
              <span className="url">{item.url || "—"}</span>
              <span>{item.http ?? "—"}</span>
              <span>{item.articles ?? 0}</span>
              <span>{item.recent ? "oui" : "non"}</span>
              <strong>{healthStateLabel(item.state)}</strong>
            </div>
          ))}
        </section>

        <style>{`
          :root { color-scheme: dark; }
          body { margin: 0; background: #07110f; color: #eff8f3; font-family: "Aptos", "Segoe UI", Arial, sans-serif; }
          .health-shell { width: min(1180px, calc(100% - 32px)); margin: 0 auto; padding: 32px 0 48px; }
          .health-hero, .health-meta > div, .health-table { border: 1px solid rgba(157, 191, 179, 0.2); background: rgba(12, 29, 26, 0.9); box-shadow: 0 24px 90px rgba(0,0,0,.34); }
          .health-hero { padding: clamp(24px, 4vw, 44px); margin-bottom: 18px; }
          .health-hero p { margin: 0 0 10px; color: #3ed6c3; letter-spacing: .16em; text-transform: uppercase; font-size: .74rem; font-weight: 800; }
          .health-hero h1 { margin: 0 0 16px; font-size: clamp(2.4rem, 6vw, 5.2rem); line-height: .95; letter-spacing: -.07em; }
          .health-hero span, .health-meta span, .empty { color: #9dbfb3; }
          .health-meta { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; margin-bottom: 18px; }
          .health-meta > div { padding: 18px; display: grid; gap: 12px; }
          .health-meta span { font-size: .72rem; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; }
          .health-meta strong { font-size: clamp(1rem, 2vw, 1.6rem); overflow-wrap: anywhere; }
          .health-table { padding: 14px; overflow-x: auto; }
          .health-row { display: grid; grid-template-columns: 1.2fr .9fr minmax(240px, 2fr) .45fr .55fr .45fr .7fr; gap: 10px; align-items: center; padding: 12px; border-bottom: 1px solid rgba(157, 191, 179, 0.14); min-width: 920px; }
          .health-head { color: #9dbfb3; font-size: .72rem; letter-spacing: .12em; text-transform: uppercase; font-weight: 800; }
          .health-row .url { color: #9dbfb3; overflow-wrap: anywhere; }
          .health-row strong { color: #8ee37d; }
          @media (max-width: 760px) { .health-meta { grid-template-columns: 1fr; } .health-shell { width: min(100% - 20px, 1180px); padding-top: 18px; } }
        `}</style>
      </main>
    </>
  );
}
