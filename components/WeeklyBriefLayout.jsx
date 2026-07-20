import Header from "./Header";
import Footer from "./Footer";
import { formatBriefDate } from "../lib/weekly-briefs.js";

function SourceLink({ source }) {
  const external = /^https?:\/\//i.test(source.url);
  return (
    <li>
      <a href={source.url} {...(external ? { target: "_blank", rel: "noreferrer" } : {})}>{source.label}{external ? " ↗" : ""}</a>
      <span>{source.note}</span>
    </li>
  );
}

export default function WeeklyBriefLayout({ brief, index = false }) {
  if (index) {
    return (
      <>
        <Header backLink="/" />
        <main className="weekly-brief-shell weekly-brief-index">
          <section className="weekly-brief-index-hero">
            <p>Lecture éditoriale</p>
            <h1>Le brief mondial.</h1>
            <span>Une lecture périodique de la carte, des sources et de leurs limites. Les données de l’observatoire servent de point de départ ; chaque analyse doit rester vérifiable.</span>
          </section>

          <section className="weekly-brief-collection" aria-labelledby="brief-collection-title">
            <div className="weekly-brief-collection-heading">
              <p>Publications</p>
              <h2 id="brief-collection-title">Dernière édition</h2>
            </div>
            <a className="weekly-brief-preview" href={`/brief-mondial/${brief.slug}`}>
              <div className="weekly-brief-preview-meta">
                <span>{brief.eyebrow}</span>
                <time dateTime={brief.publishedAt}>{formatBriefDate(brief.publishedAt, { long: true })}</time>
              </div>
              <h3>{brief.title}</h3>
              <p>{brief.standfirst}</p>
              <strong>Lire l’édition <b>→</b></strong>
            </a>
          </section>
        </main>
        <Footer />
        <BriefStyles />
      </>
    );
  }

  return (
    <>
      <Header backLink="/brief-mondial" />
      <main className="weekly-brief-shell">
        <article className="weekly-brief-article">
          <header className="weekly-brief-hero">
            <div className="weekly-brief-eyebrow-line">
              <p>{brief.eyebrow}</p>
              {brief.pilot ? <span>Format en test</span> : null}
            </div>
            <div className="weekly-brief-period">
              <time dateTime={brief.publishedAt}>{brief.periodLabel}</time>
              <span>{brief.readingTime}</span>
            </div>
            <h1>{brief.title}</h1>
            <p className="weekly-brief-standfirst">{brief.standfirst}</p>
          </header>

          <section className="weekly-brief-opening" aria-label="Synthèse d’ouverture">
            <span>La lecture</span>
            <p>{brief.lead}</p>
          </section>

          <dl className="weekly-brief-metrics" aria-label="Repères de cette édition">
            {brief.metrics.map((metric) => (
              <div key={metric.label}>
                <dt>{metric.label}</dt>
                <dd>{metric.value}</dd>
                <small>{metric.detail}</small>
              </div>
            ))}
          </dl>

          <div className="weekly-brief-copy">
            {brief.sections.map((section) => (
              <section key={section.title}>
                <h2>{section.title}</h2>
                {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              </section>
            ))}
          </div>

          <aside className="weekly-brief-sources">
            <div>
              <p>Traçabilité</p>
              <h2>Sources et méthode</h2>
            </div>
            <ol>{brief.sources.map((source) => <SourceLink key={source.label} source={source} />)}</ol>
          </aside>

          <aside className="weekly-brief-limit">
            <strong>Limite de lecture</strong>
            <p>{brief.methodNote}</p>
          </aside>

          <footer className="weekly-brief-end">
            <span>Publié le {formatBriefDate(brief.publishedAt, { long: true })}</span>
            <a href="/#carte">Revenir à la carte <b>→</b></a>
          </footer>
        </article>
      </main>
      <Footer />
      <BriefStyles />
    </>
  );
}

function BriefStyles() {
  return (
    <style>{`
      .weekly-brief-shell { width: min(1040px, calc(100% - 32px)); margin: 0 auto; padding: 42px 0 64px; }
      .weekly-brief-article { border: 1px solid rgba(173, 213, 213, 0.17); background: rgba(7, 24, 32, 0.76); box-shadow: 0 24px 80px rgba(0, 0, 0, 0.2); }
      .weekly-brief-hero { padding: clamp(28px, 6vw, 68px); border-bottom: 1px solid rgba(173, 213, 213, 0.16); background: linear-gradient(116deg, rgba(95, 218, 201, 0.13), rgba(11, 31, 39, 0.22) 48%, rgba(120, 173, 255, 0.08)); }
      .weekly-brief-eyebrow-line, .weekly-brief-period, .weekly-brief-end, .weekly-brief-preview-meta { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
      .weekly-brief-eyebrow-line p, .weekly-brief-collection-heading p, .weekly-brief-sources > div > p, .weekly-brief-index-hero > p { margin: 0; color: #5fdac9; font-size: 0.67rem; font-weight: 850; letter-spacing: 0.15em; text-transform: uppercase; }
      .weekly-brief-eyebrow-line span { padding: 5px 8px; border: 1px solid rgba(233, 191, 109, 0.35); color: #e9d2a2; font-size: 0.63rem; font-weight: 750; letter-spacing: 0.06em; text-transform: uppercase; }
      .weekly-brief-period { margin-top: 28px; color: #9ebbbb; font-size: 0.78rem; }
      .weekly-brief-period span { color: #71999a; }
      .weekly-brief-hero h1 { max-width: 12ch; margin: 15px 0 0; color: #effafa; font-size: clamp(2.9rem, 7vw, 6.7rem); line-height: 0.91; letter-spacing: -0.075em; }
      .weekly-brief-standfirst { max-width: 670px; margin: 24px 0 0; color: #c0d4d5; font-size: clamp(1rem, 2vw, 1.22rem); line-height: 1.65; }
      .weekly-brief-opening { display: grid; grid-template-columns: 144px minmax(0, 1fr); gap: 30px; padding: 30px clamp(28px, 6vw, 68px); border-bottom: 1px solid rgba(173, 213, 213, 0.13); }
      .weekly-brief-opening > span { padding-top: 5px; color: #71999a; font-size: 0.66rem; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; }
      .weekly-brief-opening p { max-width: 700px; margin: 0; color: #effafa; font-size: clamp(1.08rem, 2.2vw, 1.42rem); font-weight: 620; line-height: 1.55; letter-spacing: -0.025em; }
      .weekly-brief-metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); margin: 0; padding: 14px clamp(28px, 6vw, 68px) 34px; gap: 10px; border-bottom: 1px solid rgba(173, 213, 213, 0.13); }
      .weekly-brief-metrics > div { min-width: 0; padding: 18px; border: 1px solid rgba(173, 213, 213, 0.17); background: rgba(6, 19, 25, 0.42); }
      .weekly-brief-metrics dt { color: #71999a; font-size: 0.62rem; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; }
      .weekly-brief-metrics dd { margin: 10px 0 6px; color: #effafa; font-size: clamp(1.75rem, 4vw, 2.55rem); font-weight: 800; letter-spacing: -0.06em; }
      .weekly-brief-metrics small { display: block; color: #9ebbbb; font-size: 0.73rem; line-height: 1.42; }
      .weekly-brief-copy { width: min(100% - 56px, 690px); margin: 0 auto; padding: 44px 0 20px; }
      .weekly-brief-copy section { padding-bottom: 28px; }
      .weekly-brief-copy h2, .weekly-brief-sources h2, .weekly-brief-collection h2 { margin: 0 0 12px; color: #effafa; font-size: clamp(1.35rem, 3vw, 1.85rem); line-height: 1.03; letter-spacing: -0.045em; }
      .weekly-brief-copy p { margin: 0 0 15px; color: #b6cccd; font-size: 1rem; line-height: 1.78; }
      .weekly-brief-sources { display: grid; grid-template-columns: 170px minmax(0, 1fr); gap: 28px; margin: 4px clamp(28px, 6vw, 68px) 0; padding: 30px 0; border-top: 1px solid rgba(173, 213, 213, 0.17); border-bottom: 1px solid rgba(173, 213, 213, 0.17); }
      .weekly-brief-sources h2 { margin-bottom: 0; }
      .weekly-brief-sources ol { display: grid; gap: 12px; margin: 0; padding: 0; list-style: none; counter-reset: sources; }
      .weekly-brief-sources li { position: relative; padding-left: 30px; color: #abc4c5; line-height: 1.45; counter-increment: sources; }
      .weekly-brief-sources li::before { position: absolute; left: 0; top: 0; color: #5fdac9; content: "0" counter(sources); font-size: 0.66rem; font-weight: 850; letter-spacing: 0.05em; }
      .weekly-brief-sources a { color: #effafa; font-weight: 720; text-decoration-color: rgba(95, 218, 201, 0.45); text-underline-offset: 4px; }
      .weekly-brief-sources a:hover { color: #5fdac9; }
      .weekly-brief-sources li span { display: block; margin-top: 2px; color: #78999a; font-size: 0.77rem; }
      .weekly-brief-limit { margin: 0 clamp(28px, 6vw, 68px); padding: 18px 0; border-bottom: 1px solid rgba(173, 213, 213, 0.17); }
      .weekly-brief-limit strong { color: #e9d2a2; font-size: 0.68rem; font-weight: 850; letter-spacing: 0.1em; text-transform: uppercase; }
      .weekly-brief-limit p { max-width: 690px; margin: 7px 0 0; color: #a9c2c3; font-size: 0.82rem; line-height: 1.6; }
      .weekly-brief-end { padding: 24px clamp(28px, 6vw, 68px) 30px; color: #71999a; font-size: 0.74rem; }
      .weekly-brief-end a { color: #5fdac9; font-weight: 800; text-decoration: none; }.weekly-brief-end b, .weekly-brief-preview b { margin-left: 8px; }
      .weekly-brief-index { display: grid; gap: 16px; }
      .weekly-brief-index-hero, .weekly-brief-collection { border: 1px solid rgba(173, 213, 213, 0.17); background: rgba(11, 31, 39, 0.82); }
      .weekly-brief-index-hero { padding: clamp(28px, 6vw, 60px); background: linear-gradient(118deg, rgba(95, 218, 201, 0.13), transparent 58%), rgba(11, 31, 39, 0.82); }
      .weekly-brief-index-hero h1 { max-width: 11ch; margin: 13px 0 0; font-size: clamp(3.1rem, 8vw, 7rem); line-height: 0.89; letter-spacing: -0.08em; }
      .weekly-brief-index-hero span { display: block; max-width: 680px; margin-top: 23px; color: #b6cccd; font-size: 1.05rem; line-height: 1.65; }
      .weekly-brief-collection { padding: clamp(24px, 4vw, 42px); }.weekly-brief-collection-heading { margin-bottom: 16px; }
      .weekly-brief-collection-heading h2 { margin: 7px 0 0; }
      .weekly-brief-preview { display: grid; gap: 14px; padding: clamp(22px, 4vw, 36px); border: 1px solid rgba(95, 218, 201, 0.24); background: linear-gradient(115deg, rgba(95, 218, 201, 0.08), transparent 54%), rgba(5, 17, 23, 0.42); color: inherit; text-decoration: none; transition: border-color .18s ease, transform .18s ease, background .18s ease; }
      .weekly-brief-preview:hover { border-color: rgba(95, 218, 201, 0.54); background: linear-gradient(115deg, rgba(95, 218, 201, 0.13), transparent 54%), rgba(5, 17, 23, 0.5); transform: translateY(-2px); }
      .weekly-brief-preview-meta { color: #81a4a5; font-size: 0.7rem; }.weekly-brief-preview-meta span { color: #5fdac9; font-weight: 850; letter-spacing: .11em; text-transform: uppercase; }
      .weekly-brief-preview h3 { max-width: 15ch; margin: 0; color: #effafa; font-size: clamp(1.75rem, 4vw, 3.3rem); line-height: .95; letter-spacing: -.06em; }.weekly-brief-preview p { max-width: 700px; margin: 0; color: #b6cccd; line-height: 1.65; }.weekly-brief-preview strong { color: #5fdac9; font-size: .77rem; letter-spacing: .04em; }
      @media (max-width: 680px) {
        .weekly-brief-shell { width: min(100% - 20px, 1040px); padding: 20px 0 34px; }
        .weekly-brief-opening, .weekly-brief-sources { grid-template-columns: 1fr; gap: 12px; }
        .weekly-brief-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); padding-top: 10px; }.weekly-brief-metrics > div:last-child { grid-column: span 2; }
        .weekly-brief-copy { width: min(100% - 40px, 690px); }.weekly-brief-period { margin-top: 20px; }.weekly-brief-period span { white-space: nowrap; }
        .weekly-brief-end { align-items: flex-start; flex-direction: column; gap: 12px; }.weekly-brief-preview:hover { transform: none; }
      }
    `}</style>
  );
}
