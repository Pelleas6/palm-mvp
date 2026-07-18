export default function Loading() {
  return (
    <main className="route-loading" aria-live="polite" aria-label="Chargement de Le Pouls du Monde">
      <section>
        <p>Le Pouls du Monde</p>
        <div className="route-loading-line" />
        <strong>Préparation de la carte</strong>
        <span>Connexion aux sources publiques…</span>
      </section>
      <style>{`
        .route-loading {
          min-height: 100vh;
          display: grid;
          place-items: center;
          padding: 24px;
          background:
            radial-gradient(circle at 50% 42%, rgba(95, 218, 201, 0.15), transparent 18rem),
            #051117;
          color: #effafa;
          font-family: "Aptos", "Segoe UI", "Helvetica Neue", Arial, sans-serif;
        }
        .route-loading section {
          width: min(360px, 100%);
          display: grid;
          gap: 12px;
          text-align: center;
        }
        .route-loading p {
          margin: 0;
          color: #5fdac9;
          font-size: 0.7rem;
          font-weight: 800;
          letter-spacing: 0.16em;
          text-transform: uppercase;
        }
        .route-loading strong { font-size: 1.08rem; }
        .route-loading span { color: #9ebbbb; font-size: 0.8rem; }
        .route-loading-line {
          height: 2px;
          overflow: hidden;
          border-radius: 999px;
          background: rgba(173, 213, 213, 0.16);
        }
        .route-loading-line::before {
          content: "";
          display: block;
          width: 38%;
          height: 100%;
          border-radius: inherit;
          background: #5fdac9;
          animation: route-loading-pulse 1.1s ease-in-out infinite alternate;
        }
        @keyframes route-loading-pulse {
          from { transform: translateX(0); opacity: 0.5; }
          to { transform: translateX(165%); opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .route-loading-line::before { animation: none; transform: translateX(82%); }
        }
      `}</style>
    </main>
  );
}
