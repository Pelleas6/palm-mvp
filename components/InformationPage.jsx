"use client";

import Header from "./Header";
import Footer from "./Footer";

export default function InformationPage({ eyebrow, title, intro, children }) {
  return (
    <>
      <Header backLink="/" />
      <main className="information-shell">
        <section className="information-hero">
          <p>{eyebrow}</p>
          <h1>{title}</h1>
          <span>{intro}</span>
        </section>
        <article className="information-card">{children}</article>
      </main>
      <Footer />

      <style jsx global>{`
        html { background: #051117; }
        body {
          margin: 0;
          min-height: 100%;
          background:
            radial-gradient(circle at 14% 7%, rgba(95, 218, 201, 0.12), transparent 29rem),
            radial-gradient(circle at 88% 0%, rgba(120, 173, 255, 0.1), transparent 28rem),
            #051117;
          color: #effafa;
          font-family: "Aptos", "Segoe UI", "Helvetica Neue", Arial, sans-serif;
        }
        .information-shell { width: min(900px, calc(100% - 32px)); margin: 0 auto; padding: 42px 0 58px; }
        .information-hero {
          padding: clamp(25px, 5vw, 52px);
          border: 1px solid rgba(173, 213, 213, 0.17);
          background: linear-gradient(125deg, rgba(95, 218, 201, 0.1), transparent 50%), rgba(11, 31, 39, 0.9);
          box-shadow: 0 24px 90px rgba(0, 0, 0, 0.3);
        }
        .information-hero p {
          margin: 0 0 12px;
          color: #5fdac9;
          font-size: 0.66rem;
          font-weight: 800;
          letter-spacing: 0.15em;
          text-transform: uppercase;
        }
        .information-hero h1 { max-width: 14ch; margin: 0; font-size: clamp(2.6rem, 7vw, 5.6rem); line-height: 0.92; letter-spacing: -0.07em; }
        .information-hero span { display: block; max-width: 620px; margin-top: 18px; color: #abc4c5; line-height: 1.65; }
        .information-card {
          margin-top: 16px;
          padding: clamp(24px, 4vw, 42px);
          border: 1px solid rgba(173, 213, 213, 0.17);
          background: rgba(11, 31, 39, 0.84);
        }
        .information-card h2 { margin: 30px 0 9px; color: #effafa; font-size: 1.12rem; letter-spacing: -0.02em; }
        .information-card h2:first-child { margin-top: 0; }
        .information-card p, .information-card li { color: #abc4c5; line-height: 1.75; }
        .information-card p { margin: 9px 0; }
        .information-card ul { padding-left: 20px; }
        .information-card a { color: #5fdac9; }
        .information-card .note {
          margin-top: 28px;
          padding: 14px 16px;
          border: 1px solid rgba(233, 191, 109, 0.35);
          background: rgba(233, 191, 109, 0.07);
          color: #e9d2a2;
          font-size: 0.83rem;
          line-height: 1.55;
        }
        .information-card .mini-label {
          color: #71999a;
          font-size: 0.67rem;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }
        @media (max-width: 680px) {
          .information-shell { width: min(100% - 20px, 900px); padding: 20px 0 34px; }
          .information-hero, .information-card { border-radius: 0; }
          .information-hero h1 { font-size: clamp(2.5rem, 15vw, 4.4rem); }
        }
      `}</style>
    </>
  );
}
