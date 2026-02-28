"use client";

import { useMemo, useRef, useState } from "react";

const MAX_MB = 20;
const MAX_BYTES = MAX_MB * 1024 * 1024;

function formatBytes(n) {
  if (!Number.isFinite(n)) return "";
  const mb = n / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} Mo`;
  const kb = n / 1024;
  return `${kb.toFixed(0)} Ko`;
}

async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export default function Page() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [birthDate, setBirthDate] = useState("");

  const themes = useMemo(
    () => [
      {
        id: "amour",
        title: "Amour & Relations",
        desc: "Vie sentimentale, liens affectifs, capacité à aimer",
        emoji: "🌹",
      },
      {
        id: "travail",
        title: "Travail & Carrière",
        desc: "Ambitions, talents, réussite professionnelle",
        emoji: "💼",
      },
      {
        id: "dev",
        title: "Développement personnel",
        desc: "Évolution intérieure, potentiel, croissance",
        emoji: "🌿",
      },
      {
        id: "finance",
        title: "Finances & Abondance",
        desc: "Rapport à l'argent, ressources, prospérité",
        emoji: "💰",
      },
      {
        id: "famille",
        title: "Famille & Liens",
        desc: "Liens familiaux, équilibre, place dans le clan",
        emoji: "👨‍👩‍👧‍👦",
      },
      {
        id: "general",
        title: "Lecture générale",
        desc: "Vue d’ensemble, forces, tensions, synthèse",
        emoji: "🔎",
      },
    ],
    []
  );

  const [theme, setTheme] = useState("general");

  const [leftFile, setLeftFile] = useState(null);
  const [rightFile, setRightFile] = useState(null);

  const leftRef = useRef(null);
  const rightRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const isFormValid = useMemo(() => {
    if (!firstName.trim()) return false;
    if (!lastName.trim()) return false;
    if (!email.trim()) return false;
    if (!birthDate) return false;
    if (!leftFile || !rightFile) return false;
    return true;
  }, [firstName, lastName, email, birthDate, leftFile, rightFile]);

  function resetFiles() {
    setLeftFile(null);
    setRightFile(null);
    if (leftRef.current) leftRef.current.value = "";
    if (rightRef.current) rightRef.current.value = "";
  }

  function validateFile(file) {
    if (!file) return { ok: false, msg: "Fichier manquant." };
    const okType = ["image/jpeg", "image/png", "image/webp"].includes(file.type);
    if (!okType) return { ok: false, msg: "Format non supporté. (JPG, PNG, WEBP)" };
    if (file.size > MAX_BYTES) {
      return { ok: false, msg: `Fichier trop lourd: ${formatBytes(file.size)} (max ${MAX_MB} Mo)` };
    }
    return { ok: true, msg: "" };
  }

  function onPickLeft(e) {
    setError("");
    const f = e.target.files?.[0] || null;
    if (!f) {
      setLeftFile(null);
      return;
    }
    const v = validateFile(f);
    if (!v.ok) {
      setLeftFile(null);
      if (leftRef.current) leftRef.current.value = "";
      setError(`Main gauche: ${v.msg}`);
      return;
    }
    setLeftFile(f);
  }

  function onPickRight(e) {
    setError("");
    const f = e.target.files?.[0] || null;
    if (!f) {
      setRightFile(null);
      return;
    }
    const v = validateFile(f);
    if (!v.ok) {
      setRightFile(null);
      if (rightRef.current) rightRef.current.value = "";
      setError(`Main droite: ${v.msg}`);
      return;
    }
    setRightFile(f);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setResult(null);
    setError("");

    if (!leftFile || !rightFile) {
      setError("Ajoute bien les 2 photos (main gauche + main droite).");
      return;
    }

    const v1 = validateFile(leftFile);
    const v2 = validateFile(rightFile);
    if (!v1.ok || !v2.ok) {
      setError(`${!v1.ok ? `Main gauche: ${v1.msg}` : ""}${!v1.ok && !v2.ok ? " — " : ""}${
        !v2.ok ? `Main droite: ${v2.msg}` : ""
      }`);
      return;
    }

    setLoading(true);
    setStatus("Upload des photos…");

    try {
      const fd = new FormData();
      fd.append("left", leftFile);
      fd.append("right", rightFile);

      const uploadRes = await fetch("/api/upload", { method: "POST", body: fd });
      const uploadData = await safeJson(uploadRes);

      if (!uploadRes.ok) {
        throw new Error(
          "UPLOAD_ERROR\nstatus=" +
            uploadRes.status +
            "\nbody=" +
            JSON.stringify(uploadData, null, 2)
        );
      }

      const leftPath = uploadData?.leftPath;
      const rightPath = uploadData?.rightPath;

      if (!leftPath || !rightPath) {
        throw new Error("Chemins manquants: " + JSON.stringify(uploadData, null, 2));
      }

      setStatus("Analyse en cours…");

      const analyzeRes = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leftPath,
          rightPath,
          theme,
          user: {
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: email.trim(),
            birthDate,
          },
        }),
      });

      const analyzeData = await safeJson(analyzeRes);

      if (!analyzeRes.ok) {
        throw new Error(
          "ANALYZE_ERROR\nstatus=" +
            analyzeRes.status +
            "\nbody=" +
            JSON.stringify(analyzeData, null, 2)
        );
      }

      setResult(analyzeData);
      setStatus("Terminé.");
    } catch (err) {
      setStatus("");
      setError(err?.message || "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <header className="header">
        <nav className="topnav">
          <a className="brand" href="#top">
            <span className="leaf" aria-hidden="true">
              🌿
            </span>
            <span className="brandText">Lecture de Mains</span>
          </a>

          <div className="navlinks">
            <a href="#how">Comment ça marche</a>
            <a href="#themes">Thèmes</a>
          </div>

          <a className="cta" href="#form">
            Lancer mon analyse
          </a>
        </nav>
      </header>

      <main id="top" className="main">
        <section className="hero">
          <div className="hero-left">
            <div className="kicker">Expertise chiromancie • analyse personnalisée</div>
            <h1>Découvrez ce que vos lignes disent de vous</h1>
            <p className="sub">
              Uploadez 2 photos nettes (main gauche + main droite). Vous recevez un rapport clair et
              structuré.
            </p>

            <div className="bullets">
              <div className="bullet">
                <div className="bTitle">Délai</div>
                <div className="bValue">Sous 24h</div>
              </div>
              <div className="bullet">
                <div className="bTitle">Livraison</div>
                <div className="bValue">Par email</div>
              </div>
              <div className="bullet">
                <div className="bTitle">Confidentialité</div>
                <div className="bValue">Photos supprimées</div>
              </div>
            </div>

            <div id="themes" className="themes">
              {themes.map((t) => {
                const active = theme === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    className={`themeCard ${active ? "active" : ""}`}
                    onClick={() => setTheme(t.id)}
                    aria-pressed={active}
                  >
                    <div className="themeTop">
                      <span className="themeEmoji" aria-hidden="true">
                        {t.emoji}
                      </span>
                      <span className="themeTitle">{t.title}</span>
                    </div>
                    <div className="themeDesc">{t.desc}</div>
                  </button>
                );
              })}
            </div>

            <div id="how" className="how">
              <div className="howTitle">Comment ça marche</div>
              <ol className="howList">
                <li>Vous renseignez vos infos + vous choisissez un thème.</li>
                <li>Vous ajoutez 2 photos nettes (gauche + droite), max {MAX_MB} Mo chacune.</li>
                <li>Vous lancez l’analyse. Le rapport est envoyé par email.</li>
              </ol>
            </div>
          </div>

          <div id="form" className="formWrap">
            <div className="form-card">
              <div className="formHead">
                <div className="formTitle">Lancer mon analyse</div>
                <div className="formSubtitle">Résultats transmis sous 24h par email</div>
              </div>

              <div className="miniInfo">
                <div className="miniRow">
                  <span>Délai</span>
                  <span>Sous 24h</span>
                </div>
                <div className="miniRow">
                  <span>Livraison</span>
                  <span>Par email</span>
                </div>
                <div className="miniRow">
                  <span>Confidentialité</span>
                  <span>Photos supprimées</span>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="form">
                <div className="grid2">
                  <div className="field">
                    <label>Prénom</label>
                    <input
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Marie"
                      autoComplete="given-name"
                    />
                  </div>
                  <div className="field">
                    <label>Nom</label>
                    <input
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Dupont"
                      autoComplete="family-name"
                    />
                  </div>
                </div>

                <div className="field">
                  <label>Email</label>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="votre@email.com"
                    type="email"
                    autoComplete="email"
                  />
                </div>

                <div className="field">
                  <label>Date de naissance</label>
                  <input
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    type="date"
                    autoComplete="bday"
                  />
                </div>

                <div className="field">
                  <label>Thème de lecture</label>
                  <select value={theme} onChange={(e) => setTheme(e.target.value)}>
                    {themes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="uploadGrid">
                  <div className="uploadBox">
                    <div className="uploadLabel">Main gauche</div>
                    <input
                      ref={leftRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={onPickLeft}
                    />
                    <div className="uploadHint">
                      {leftFile ? `${leftFile.name} • ${formatBytes(leftFile.size)}` : `JPG/PNG/WEBP • max ${MAX_MB} Mo`}
                    </div>
                  </div>

                  <div className="uploadBox">
                    <div className="uploadLabel">Main droite</div>
                    <input
                      ref={rightRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={onPickRight}
                    />
                    <div className="uploadHint">
                      {rightFile ? `${rightFile.name} • ${formatBytes(rightFile.size)}` : `JPG/PNG/WEBP • max ${MAX_MB} Mo`}
                    </div>
                  </div>
                </div>

                <div className="actions">
                  <button className="primary" type="submit" disabled={loading || !isFormValid}>
                    {loading ? "Analyse en cours…" : "Envoyer"}
                  </button>
                  <button
                    className="ghost"
                    type="button"
                    onClick={() => {
                      setError("");
                      setStatus("");
                      setResult(null);
                      resetFiles();
                    }}
                    disabled={loading}
                  >
                    Réinitialiser
                  </button>
                </div>

                {status ? <div className="status">{status}</div> : null}
                {error ? <pre className="error">{error}</pre> : null}

                {result ? (
                  <div className="result">
                    <div className="resultTitle">Réponse API</div>
                    <pre className="resultBox">{JSON.stringify(result, null, 2)}</pre>
                  </div>
                ) : null}

                <div className="legalLine">
                  En envoyant, vous acceptez nos pages{" "}
                  <a href="/mentions-legales">mentions légales</a> et{" "}
                  <a href="/confidentialite">confidentialité</a>.
                </div>
              </form>
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="footerInner">
          <div className="footLeft">© {new Date().getFullYear()} ma-ligne-de-vie.fr</div>
          <div className="footLinks">
            <a href="/mentions-legales">Mentions légales</a>
            <a href="/confidentialite">Confidentialité</a>
          </div>
        </div>
      </footer>

      <style jsx global>{`
        :root {
          --bg: #f6f1e8;
          --card: rgba(255, 255, 255, 0.72);
          --ink: #1d1b16;
          --muted: rgba(29, 27, 22, 0.7);
          --line: rgba(29, 27, 22, 0.12);
          --shadow: 0 22px 60px rgba(0, 0, 0, 0.12);
          --radius: 18px;
          --accent: #6e8f78;
          --accent2: #5f7f6a;
        }

        html,
        body {
          padding: 0;
          margin: 0;
          background: var(--bg);
          color: var(--ink);
          font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial,
            "Apple Color Emoji", "Segoe UI Emoji";
        }

        a {
          color: inherit;
          text-decoration: none;
        }

        .page {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }

        .header {
          position: sticky;
          top: 0;
          z-index: 10;
          backdrop-filter: blur(12px);
          background: rgba(246, 241, 232, 0.7);
          border-bottom: 1px solid var(--line);
        }

        .topnav {
          max-width: 1120px;
          margin: 0 auto;
          height: 74px;
          padding: 0 22px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .leaf {
          width: 34px;
          height: 34px;
          display: grid;
          place-items: center;
          border-radius: 10px;
          background: rgba(110, 143, 120, 0.18);
          border: 1px solid rgba(110, 143, 120, 0.25);
        }

        .brandText {
          font-size: 18px;
          letter-spacing: 0.2px;
        }

        .navlinks {
          display: flex;
          gap: 18px;
          color: var(--muted);
        }

        .navlinks a:hover {
          color: var(--ink);
        }

        .cta {
          background: var(--accent);
          color: white;
          padding: 12px 16px;
          border-radius: 14px;
          border: 1px solid rgba(0, 0, 0, 0.05);
          box-shadow: 0 12px 24px rgba(110, 143, 120, 0.22);
          white-space: nowrap;
        }

        .cta:hover {
          background: var(--accent2);
        }

        .main {
          flex: 1;
        }

        .hero {
          max-width: 1120px;
          margin: 0 auto;
          padding: 44px 22px 46px;
          display: grid;
          grid-template-columns: 1.12fr 0.88fr;
          gap: 26px;
          align-items: start;
        }

        .hero-left {
          min-width: 0;
        }

        .kicker {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: var(--muted);
          border: 1px solid var(--line);
          background: rgba(255, 255, 255, 0.55);
          padding: 8px 12px;
          border-radius: 999px;
        }

        .hero-left h1 {
          margin: 14px 0 10px;
          font-size: 44px;
          line-height: 1.08;
          letter-spacing: -0.5px;
        }

        .sub {
          margin: 0 0 18px;
          color: var(--muted);
          font-size: 16px;
          line-height: 1.6;
          max-width: 56ch;
        }

        .bullets {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          margin: 18px 0 18px;
        }

        .bullet {
          border: 1px solid var(--line);
          background: rgba(255, 255, 255, 0.55);
          border-radius: 14px;
          padding: 12px 12px;
        }

        .bTitle {
          font-size: 12px;
          color: var(--muted);
          margin-bottom: 4px;
        }

        .bValue {
          font-size: 14px;
        }

        .themes {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
          margin-top: 14px;
        }

        .themeCard {
          text-align: left;
          border: 1px solid var(--line);
          background: rgba(255, 255, 255, 0.62);
          border-radius: 16px;
          padding: 14px 14px;
          cursor: pointer;
          transition: transform 0.06s ease, box-shadow 0.18s ease, border-color 0.18s ease;
        }

        .themeCard:hover {
          transform: translateY(-1px);
          box-shadow: 0 18px 40px rgba(0, 0, 0, 0.08);
        }

        .themeCard.active {
          border-color: rgba(110, 143, 120, 0.55);
          box-shadow: 0 18px 40px rgba(110, 143, 120, 0.18);
        }

        .themeTop {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 6px;
        }

        .themeEmoji {
          width: 34px;
          height: 34px;
          display: grid;
          place-items: center;
          border-radius: 12px;
          background: rgba(110, 143, 120, 0.14);
          border: 1px solid rgba(110, 143, 120, 0.22);
        }

        .themeTitle {
          font-size: 14px;
        }

        .themeDesc {
          font-size: 13px;
          color: var(--muted);
          line-height: 1.35;
        }

        .how {
          margin-top: 18px;
          border: 1px solid var(--line);
          background: rgba(255, 255, 255, 0.55);
          border-radius: 16px;
          padding: 14px 14px;
        }

        .howTitle {
          font-size: 14px;
          margin-bottom: 8px;
        }

        .howList {
          margin: 0;
          padding-left: 18px;
          color: var(--muted);
          line-height: 1.55;
          font-size: 13px;
        }

        .formWrap {
          min-width: 0;
        }

        .form-card {
          position: sticky;
          top: 96px;
          border: 1px solid var(--line);
          background: var(--card);
          border-radius: var(--radius);
          box-shadow: var(--shadow);
          padding: 18px 16px 16px;
        }

        .formHead {
          margin-bottom: 12px;
        }

        .formTitle {
          font-size: 20px;
          letter-spacing: -0.2px;
          margin-bottom: 4px;
        }

        .formSubtitle {
          font-size: 13px;
          color: var(--muted);
        }

        .miniInfo {
          border: 1px solid var(--line);
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.55);
          padding: 10px 12px;
          margin-bottom: 12px;
        }

        .miniRow {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          font-size: 13px;
          color: var(--muted);
          padding: 5px 0;
          border-bottom: 1px solid rgba(0, 0, 0, 0.06);
        }

        .miniRow:last-child {
          border-bottom: 0;
        }

        .form {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .grid2 {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .field label {
          display: block;
          font-size: 12px;
          color: var(--muted);
          margin: 0 0 6px;
        }

        input,
        select {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid var(--line);
          background: rgba(255, 255, 255, 0.82);
          border-radius: 12px;
          padding: 11px 12px;
          font-size: 14px;
          outline: none;
        }

        input:focus,
        select:focus {
          border-color: rgba(110, 143, 120, 0.6);
          box-shadow: 0 0 0 4px rgba(110, 143, 120, 0.14);
        }

        .uploadGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .uploadBox {
          border: 1px dashed rgba(29, 27, 22, 0.22);
          background: rgba(255, 255, 255, 0.5);
          border-radius: 14px;
          padding: 12px 12px;
        }

        .uploadLabel {
          font-size: 12px;
          color: var(--muted);
          margin-bottom: 8px;
        }

        .uploadHint {
          margin-top: 8px;
          font-size: 12px;
          color: var(--muted);
          word-break: break-word;
        }

        .actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-top: 2px;
        }

        .primary,
        .ghost {
          border-radius: 14px;
          padding: 12px 12px;
          font-size: 14px;
          cursor: pointer;
          border: 1px solid var(--line);
        }

        .primary {
          background: var(--accent);
          color: white;
          border-color: rgba(0, 0, 0, 0.05);
          box-shadow: 0 14px 30px rgba(110, 143, 120, 0.22);
        }

        .primary:hover {
          background: var(--accent2);
        }

        .primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          box-shadow: none;
        }

        .ghost {
          background: rgba(255, 255, 255, 0.75);
        }

        .ghost:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .status {
          margin-top: 6px;
          font-size: 13px;
          color: var(--muted);
        }

        .error {
          margin: 8px 0 0;
          background: rgba(255, 0, 0, 0.06);
          border: 1px solid rgba(255, 0, 0, 0.18);
          padding: 10px 10px;
          border-radius: 14px;
          font-size: 12px;
          color: rgba(150, 20, 20, 0.95);
          white-space: pre-wrap;
          overflow-wrap: anywhere;
        }

        .result {
          margin-top: 10px;
          border-top: 1px solid var(--line);
          padding-top: 10px;
        }

        .resultTitle {
          font-size: 13px;
          color: var(--muted);
          margin-bottom: 8px;
        }

        .resultBox {
          margin: 0;
          border: 1px solid var(--line);
          background: rgba(255, 255, 255, 0.65);
          border-radius: 14px;
          padding: 10px 10px;
          font-size: 12px;
          white-space: pre-wrap;
          overflow-wrap: anywhere;
        }

        .legalLine {
          margin-top: 10px;
          font-size: 12px;
          color: var(--muted);
          line-height: 1.45;
        }

        .legalLine a {
          text-decoration: underline;
          text-underline-offset: 3px;
        }

        .footer {
          border-top: 1px solid var(--line);
          background: rgba(246, 241, 232, 0.7);
          backdrop-filter: blur(12px);
        }

        .footerInner {
          max-width: 1120px;
          margin: 0 auto;
          padding: 18px 22px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          color: var(--muted);
          font-size: 13px;
        }

        .footLinks {
          display: flex;
          gap: 16px;
        }

        .footLinks a:hover {
          color: var(--ink);
        }

        /* mobile fixes (keeps desktop design identical) */
        @media (max-width: 900px) {
          .topnav {
            height: auto;
            padding: 12px 16px;
            flex-wrap: wrap;
            gap: 10px;
          }

          .navlinks {
            width: 100%;
            justify-content: flex-start;
            gap: 14px;
          }

          .cta {
            margin-left: auto;
          }

          .hero {
            grid-template-columns: 1fr;
            padding: 28px 16px 34px;
            gap: 20px;
          }

          .hero-left h1 {
            font-size: 32px;
            line-height: 1.18;
          }

          .bullets {
            grid-template-columns: 1fr;
          }

          .themes {
            grid-template-columns: 1fr;
          }

          .grid2 {
            grid-template-columns: 1fr;
          }

          .uploadGrid {
            grid-template-columns: 1fr;
          }

          .actions {
            grid-template-columns: 1fr;
          }

          .form-card {
            position: static;
            top: auto;
          }

          .footerInner {
            padding: 18px 16px;
            flex-direction: column;
            align-items: flex-start;
          }
        }
      `}</style>
    </div>
  );
}
