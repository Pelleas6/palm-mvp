import Link from "next/link";

export const metadata = {
  title: "Page introuvable | Le Pouls du Monde",
  description: "Cette adresse n'existe pas ou a été définitivement retirée.",
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
      noarchive: true,
      nosnippet: true,
    },
  },
};

export default function NotFound() {
  return (
    <main className="not-found-page">
      <section>
        <p>Erreur 404</p>
        <h1>Cette page n’existe plus.</h1>
        <span>L’adresse demandée ne fait pas partie du Pouls du Monde.</span>
        <Link href="/">Revenir à la carte mondiale</Link>
      </section>
      <style>{`
        .not-found-page {
          min-height: 100vh;
          display: grid;
          place-items: center;
          padding: 24px;
          background: radial-gradient(circle at 50% 35%, rgba(95, 218, 201, .16), transparent 22rem), #051117;
          color: #effafa;
        }
        .not-found-page section {
          width: min(560px, 100%);
          padding: clamp(28px, 6vw, 52px);
          border: 1px solid rgba(173, 213, 213, .2);
          border-radius: 22px;
          background: rgba(11, 31, 39, .92);
          text-align: center;
          box-shadow: 0 24px 70px rgba(0, 0, 0, .28);
        }
        .not-found-page p {
          margin: 0 0 12px;
          color: #5fdac9;
          font-size: .72rem;
          font-weight: 800;
          letter-spacing: .16em;
          text-transform: uppercase;
        }
        .not-found-page h1 {
          margin: 0;
          font-size: clamp(2rem, 7vw, 3.6rem);
          line-height: 1;
          letter-spacing: -.045em;
        }
        .not-found-page span {
          display: block;
          margin: 18px auto 28px;
          color: #9ebbbb;
          line-height: 1.6;
        }
        .not-found-page a {
          display: inline-flex;
          min-height: 44px;
          align-items: center;
          justify-content: center;
          padding: 0 20px;
          border-radius: 999px;
          background: #5fdac9;
          color: #051117;
          font-weight: 800;
          text-decoration: none;
        }
      `}</style>
    </main>
  );
}
