"use client";

export default function Header({ backLink = null }) {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <a className="site-brand" href="/" aria-label="Le Pouls du Monde — accueil">
          <span>
            <small>Observatoire vivant</small>
            <strong>Le Pouls du Monde</strong>
          </span>
        </a>

        {backLink ? (
          <a className="header-back" href={backLink}>← Retour à l’observatoire</a>
        ) : (
          <nav className="site-nav" aria-label="Navigation principale">
            <a href="/#carte">La carte</a>
            <a href="/#methodologie">La méthode</a>
            <a href="/sante-sources">Les sources</a>
          </nav>
        )}
      </div>

      <style jsx>{`
        .site-header {
          position: sticky;
          top: 0;
          z-index: 50;
          border-bottom: 1px solid rgba(173, 213, 213, 0.14);
          background: rgba(5, 17, 23, 0.9);
          backdrop-filter: blur(18px);
        }
        .site-header-inner {
          width: min(1320px, calc(100% - 32px));
          min-height: 70px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
        }
        .site-brand {
          display: inline-flex;
          align-items: center;
          min-width: 0;
          color: #f1fbfb;
          text-decoration: none;
        }
        .site-brand small,
        .site-brand strong { display: block; }
        .site-brand small {
          margin-bottom: 2px;
          color: #80aaa9;
          font-size: 0.56rem;
          font-weight: 800;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }
        .site-brand strong { font-size: 0.92rem; letter-spacing: -0.02em; }
        .site-nav { display: flex; align-items: center; gap: 7px; }
        .site-nav a,
        .header-back {
          padding: 8px 10px;
          border: 1px solid transparent;
          color: #abc4c5;
          font-size: 0.72rem;
          font-weight: 750;
          letter-spacing: 0.03em;
          text-decoration: none;
          transition: color 0.16s ease, border-color 0.16s ease, background 0.16s ease;
        }
        .site-nav a:hover,
        .header-back:hover {
          border-color: rgba(95, 218, 201, 0.24);
          background: rgba(95, 218, 201, 0.06);
          color: #f1fbfb;
        }
        .site-nav a:focus-visible,
        .header-back:focus-visible,
        .site-brand:focus-visible { outline: 2px solid #5fdac9; outline-offset: 4px; }
        @media (max-width: 680px) {
          .site-header-inner { width: min(100% - 20px, 1320px); min-height: 62px; }
          .site-brand small { display: none; }
          .site-nav { gap: 0; }
          .site-nav a { padding: 8px 7px; font-size: 0.64rem; }
          .site-nav a:nth-child(2) { display: none; }
          .header-back { padding-right: 0; font-size: 0.67rem; }
        }
      `}</style>
    </header>
  );
}
