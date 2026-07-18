"use client";

import VisitCounter from "./VisitCounter";

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="footer-brand">
          <strong>Le Pouls du Monde</strong>
          <span>Un observatoire visuel des signaux médiatiques mondiaux.</span>
        </div>
        <VisitCounter />
        <nav aria-label="Informations du site">
          <a href="/a-propos">À propos</a>
          <a href="/carte-actualite-mondiale">Comprendre la carte</a>
          <a href="/methode-localisation-actualite">Méthode</a>
          <a href="/sources-rss-internationales">Sources RSS</a>
          <a href="/sante-sources">Santé des sources</a>
          <a href="/confidentialite">Confidentialité</a>
          <a href="/mentions-legales">Mentions légales</a>
        </nav>
      </div>

      <style jsx>{`
        .site-footer {
          border-top: 1px solid rgba(173, 213, 213, 0.14);
          background: #051117;
        }
        .site-footer-inner {
          width: min(1320px, calc(100% - 32px));
          margin: 0 auto;
          padding: 27px 0 32px;
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
          align-items: center;
          gap: 20px;
        }
        .footer-brand { display: grid; gap: 5px; }
        .footer-brand strong { color: #effafa; font-size: 0.84rem; }
        .footer-brand span { color: #78999a; font-size: 0.68rem; line-height: 1.45; }
        nav { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 7px 14px; }
        nav a { color: #a7c0c1; font-size: 0.68rem; text-decoration: none; }
        nav a:hover { color: #5fdac9; }
        @media (max-width: 760px) {
          .site-footer-inner { width: min(100% - 20px, 1320px); grid-template-columns: 1fr; gap: 12px; }
          nav { justify-content: flex-start; }
        }
      `}</style>
    </footer>
  );
}
