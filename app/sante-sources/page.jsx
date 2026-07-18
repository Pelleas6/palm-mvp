import Header from "../../components/Header";
import Footer from "../../components/Footer";
import { getWorldPulseDashboardPayload } from "../../lib/world-pulse.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

export default async function SourceHealthPage() {
  const payload = await getWorldPulseDashboardPayload();
  const items = Array.isArray(payload.sourceHealth) ? payload.sourceHealth : [];
  const activeItems = items.filter((item) => item?.state === "OK").length;
  const snapshot = {
    cache: payload.cache || { status: "empty" },
    generatedAt: payload.generatedAt || null,
    servedAt: payload.servedAt || payload.generatedAt || null,
    freshnessSeconds: payload.freshnessSeconds,
  };

  return (
    <>
      <Header backLink="/" />
      <main className="health-shell">
        <section className="health-hero">
          <p>Le Pouls du Monde</p>
          <h1>Santé des sources</h1>
          <span>Contrôle réel au chargement : les flux publics sont audités côté serveur, puis leur état est réutilisé depuis le cache vérifié.</span>
        </section>

        <section className="health-meta">
          <div><span>Cache</span><strong>{snapshot.cache?.status || "empty"}</strong></div>
          <div><span>Généré</span><strong>{formatDate(snapshot.generatedAt)}</strong></div>
          <div><span>Servi</span><strong>{formatDate(snapshot.servedAt)}</strong></div>
          <div><span>Sources OK</span><strong>{items.length > 0 ? `${activeItems}/${items.length}` : "—"}</strong></div>
        </section>

        <section className="health-table" aria-label="Matrice de santé des sources auditée">
          <div className="health-row health-head">
            <span>Source</span><span>Région</span><span>URL</span><span>HTTP</span><span>Articles/docs</span><span>Récent</span><span>État</span>
          </div>
          {items.length === 0 ? (
            <p className="empty">Le contrôle n'a renvoyé aucune ligne exploitable. Réessayez dans quelques instants : aucune source n'est inventée.</p>
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
          body { margin: 0; background: #051117; color: #effafa; font-family: "Aptos", "Segoe UI", Arial, sans-serif; }
          .health-shell { width: min(1320px, calc(100% - 32px)); margin: 0 auto; padding: 32px 0 48px; }
          .health-hero, .health-meta > div, .health-table { border: 1px solid rgba(173, 213, 213, 0.17); background: rgba(11, 31, 39, 0.9); box-shadow: 0 24px 90px rgba(0,0,0,.34); }
          .health-hero { padding: clamp(24px, 4vw, 44px); margin-bottom: 18px; }
          .health-hero p { margin: 0 0 10px; color: #5fdac9; letter-spacing: .16em; text-transform: uppercase; font-size: .74rem; font-weight: 800; }
          .health-hero h1 { margin: 0 0 16px; font-size: clamp(2.4rem, 6vw, 5.2rem); line-height: .95; letter-spacing: -.07em; }
          .health-hero span, .health-meta span, .empty { color: #abc4c5; }
          .health-meta { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; margin-bottom: 18px; }
          .health-meta > div { padding: 18px; display: grid; gap: 12px; }
          .health-meta span { font-size: .72rem; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; }
          .health-meta strong { font-size: clamp(1rem, 2vw, 1.6rem); overflow-wrap: anywhere; }
          .health-table { padding: 14px; overflow-x: auto; }
          .health-row { display: grid; grid-template-columns: 1.2fr .9fr minmax(240px, 2fr) .45fr .55fr .45fr .7fr; gap: 10px; align-items: center; padding: 12px; border-bottom: 1px solid rgba(173, 213, 213, 0.14); min-width: 920px; }
          .health-head { color: #abc4c5; font-size: .72rem; letter-spacing: .12em; text-transform: uppercase; font-weight: 800; }
          .health-row .url { color: #abc4c5; overflow-wrap: anywhere; }
          .health-row strong { color: #8ee37d; }
          @media (max-width: 760px) { .health-meta { grid-template-columns: 1fr; } .health-shell { width: min(100% - 20px, 1320px); padding-top: 18px; } }
        `}</style>
      </main>
      <Footer />
    </>
  );
}
