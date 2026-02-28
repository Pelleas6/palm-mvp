"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

const theme = {
  bg: "#FAF7F2",
  card: "#FFFFFF",
  border: "#E8E0D0",
  sage: "#7A9E7E",
  sageLight: "#EFF5F0",
  sageBorder: "#B5CDB7",
  sageDark: "#5C7E60",
  gold: "#C9A84C",
  goldLight: "#FBF6EC",
  text: "#3A3228",
  textLight: "#7A6F65",
  error: "#B85C5C",
};

const THEMES = [
  { id: "amour", emoji: "🌹", label: "Amour & Relations", desc: "Vie sentimentale, liens affectifs, capacité à aimer" },
  { id: "travail", emoji: "💼", label: "Travail & Carrière", desc: "Ambitions, talents, réussite professionnelle" },
  { id: "developpement", emoji: "🌱", label: "Développement personnel", desc: "Évolution intérieure, potentiel, croissance" },
  { id: "finances", emoji: "💰", label: "Finances & Abondance", desc: "Rapport à l'argent, ressources, prospérité" },
  { id: "famille", emoji: "👨‍👩‍👧", label: "Famille & Liens", desc: "Liens familiaux, ancrage, transmission" },
];

export default function Home() {
  const [leftFile, setLeftFile] = useState(null);
  const [rightFile, setRightFile] = useState(null);

  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [dateNaissance, setDateNaissance] = useState("");
  const [themeChoisi, setThemeChoisi] = useState("");

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null); // "MAIL_CONFIRMATION" | null
  const [error, setError] = useState(null);

  const [leftPreview, setLeftPreview] = useState(null);
  const [rightPreview, setRightPreview] = useState(null);

  const MAX_BYTES = 20 * 1024 * 1024; // 20 Mo
  const ALLOWED_TYPES = useMemo(() => new Set(["image/jpeg", "image/png", "image/webp"]), []);

  useEffect(() => {
    if (!leftFile) {
      setLeftPreview(null);
      return;
    }
    const url = URL.createObjectURL(leftFile);
    setLeftPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [leftFile]);

  useEffect(() => {
    if (!rightFile) {
      setRightPreview(null);
      return;
    }
    const url = URL.createObjectURL(rightFile);
    setRightPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [rightFile]);

  const canSubmit = useMemo(() => {
    return (
      !!leftFile &&
      !!rightFile &&
      prenom.trim().length > 0 &&
      nom.trim().length > 0 &&
      email.trim().length > 0 &&
      dateNaissance.trim().length > 0 &&
      themeChoisi.length > 0 &&
      !loading
    );
  }, [leftFile, rightFile, prenom, nom, email, dateNaissance, themeChoisi, loading]);

  async function safeJson(res) {
    try {
      return await res.json();
    } catch {
      return null;
    }
  }

  function clientValidateFiles() {
    if (!leftFile || !rightFile) {
      return "Merci de sélectionner les deux photos (main gauche + main droite).";
    }
    if (!ALLOWED_TYPES.has(leftFile.type)) {
      return "Main gauche : format non autorisé (jpg/png/webp).";
    }
    if (!ALLOWED_TYPES.has(rightFile.type)) {
      return "Main droite : format non autorisé (jpg/png/webp).";
    }
    if (leftFile.size > MAX_BYTES) {
      return "Main gauche : fichier trop lourd (max 20 Mo).";
    }
    if (rightFile.size > MAX_BYTES) {
      return "Main droite : fichier trop lourd (max 20 Mo).";
    }
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setResult(null);

    try {
      const fileErr = clientValidateFiles();
      if (fileErr) throw new Error(fileErr);

      setLoading(true);

      // 1) demander 2 URLs signées (json léger) -> plus de 413
      const preRes = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          left: { name: leftFile.name, type: leftFile.type, size: leftFile.size },
          right: { name: rightFile.name, type: rightFile.type, size: rightFile.size },
        }),
      });

      const preData = await safeJson(preRes);

      if (!preRes.ok) {
        throw new Error("UPLOAD-PREP ERROR\nstatus=" + preRes.status + "\nbody=" + JSON.stringify(preData, null, 2));
      }

      const leftPath = preData?.leftPath;
      const rightPath = preData?.rightPath;
      const leftSignedUrl = preData?.leftSignedUrl;
      const rightSignedUrl = preData?.rightSignedUrl;

      if (!leftPath || !rightPath || !leftSignedUrl || !rightSignedUrl) {
        throw new Error("Réponse /api/upload invalide : " + JSON.stringify(preData, null, 2));
      }

      // 2) upload direct Supabase (PUT) via URLs signées
      const upLeft = await fetch(leftSignedUrl, {
        method: "PUT",
        headers: { "Content-Type": leftFile.type },
        body: leftFile,
      });

      if (!upLeft.ok) {
        const t = await upLeft.text().catch(() => "");
        throw new Error("UPLOAD DIRECT LEFT FAILED\nstatus=" + upLeft.status + "\nbody=" + t);
      }

      const upRight = await fetch(rightSignedUrl, {
        method: "PUT",
        headers: { "Content-Type": rightFile.type },
        body: rightFile,
      });

      if (!upRight.ok) {
        const t = await upRight.text().catch(() => "");
        throw new Error("UPLOAD DIRECT RIGHT FAILED\nstatus=" + upRight.status + "\nbody=" + t);
      }

      // 3) analyse (json léger)
      const analyzeRes = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-secret": process.env.NEXT_PUBLIC_API_SECRET || "",
        },
        body: JSON.stringify({ leftPath, rightPath, prenom, nom, email, dateNaissance, themeChoisi }),
      });

      const analyzeData = await safeJson(analyzeRes);

      if (!analyzeRes.ok) {
        throw new Error("ANALYZE ERROR\nstatus=" + analyzeRes.status + "\nbody=" + JSON.stringify(analyzeData, null, 2));
      }

      setResult("MAIL_CONFIRMATION");

      // option premium : reset photos après envoi
      setLeftFile(null);
      setRightFile(null);
    } catch (err) {
      setError(String(err?.message || err));
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = {
    width: "100%",
    padding: "9px 12px",
    marginTop: 5,
    borderRadius: 8,
    border: `1px solid ${theme.border}`,
    backgroundColor: theme.bg,
    color: theme.text,
    fontSize: 13,
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "Georgia, serif",
  };

  const labelStyle = {
    fontSize: 11,
    fontWeight: 700,
    color: theme.textLight,
    letterSpacing: "0.05em",
    textTransform: "uppercase",
  };

  return (
    <div style={{ backgroundColor: theme.bg, minHeight: "100vh", fontFamily: "Georgia, serif" }}>
      <nav
        style={{
          position: "sticky",
          top: 0,
          zIndex: 100,
          backgroundColor: "rgba(250,247,242,0.95)",
          backdropFilter: "blur(8px)",
          borderBottom: `1px solid ${theme.border}`,
          padding: "0 40px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: 68,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 26 }}>🌿</span>
          <span style={{ fontWeight: 700, fontSize: 20, color: theme.text, letterSpacing: "0.02em" }}>Lecture de Mains</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <a href="#comment" style={{ fontSize: 14, color: theme.textLight, textDecoration: "none", padding: "6px 14px" }}>
            Comment ça marche
          </a>
          <a href="#form-card" style={{ fontSize: 14, color: theme.textLight, textDecoration: "none", padding: "6px 14px" }}>
            Thèmes
          </a>
          <a
            href="#form-card"
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "#fff",
              backgroundColor: theme.sage,
              textDecoration: "none",
              padding: "10px 22px",
              borderRadius: 8,
              letterSpacing: "0.02em",
              marginLeft: 8,
            }}
          >
            Lancer mon analyse
          </a>
        </div>
      </nav>

      <section
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: "64px 40px",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 56,
          alignItems: "start",
        }}
      >
        <div style={{ minWidth: 0, overflowWrap: "break-word" }}>
          <div
            style={{
              display: "inline-block",
              fontSize: 11,
              fontWeight: 700,
              color: theme.gold,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              marginBottom: 16,
            }}
          >
            ✦ Expert en chiromancie · 20 ans d'expérience
          </div>

          <h1 style={{ fontSize: 44, fontWeight: 700, color: theme.text, lineHeight: 1.2, margin: "0 0 28px" }}>
            Découvrez ce que vos mains révèlent de vous
          </h1>

          <p style={{ fontSize: 16, color: theme.textLight, lineHeight: 1.85, margin: "0 0 20px" }}>
            Une analyse personnalisée et approfondie de vos deux mains, orientée sur le thème qui vous tient le plus à cœur.
          </p>
          <p style={{ fontSize: 16, color: theme.textLight, lineHeight: 1.85, margin: "0 0 20px" }}>
            Chaque main raconte une histoire différente. La main gauche révèle votre potentiel inné, vos dispositions naturelles et ce que la vie
            vous a donné à la naissance — vos talents profonds, votre sensibilité, votre caractère originel. C'est la main de ce que vous auriez
            pu devenir si rien n'avait interféré.
          </p>
          <p style={{ fontSize: 16, color: theme.textLight, lineHeight: 1.85, margin: "0 0 20px" }}>
            La main droite, elle, reflète votre vécu, vos choix, les transformations que le temps a façonnées en vous. Elle porte les traces de
            vos expériences, de vos décisions, de vos épreuves et de vos réussites. C'est la main de ce que vous êtes devenus.
          </p>
          <p style={{ fontSize: 16, color: theme.textLight, lineHeight: 1.85, margin: "0 0 20px" }}>
            La comparaison des deux est au cœur de l'analyse : c'est là que se révèle votre véritable parcours de vie.
          </p>
          <p style={{ fontSize: 16, color: theme.textLight, lineHeight: 1.85, margin: "0 0 36px" }}>
            Notre expert analyse les deux avec rigueur et bienveillance — les lignes, la forme, les bifurcations — pour vous offrir une lecture
            concrète, ancrée dans ce qui est réellement visible, jamais inventée. Le thème que vous choisissez oriente l'intégralité de l'analyse :
            chaque observation est interprétée à travers ce prisme, pour un rapport qui vous parle vraiment.
          </p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 48 }}>
            {["Analyse personnalisée", "Réponse sous 24h", "Confidentiel & sécurisé"].map((b) => (
              <span
                key={b}
                style={{
                  fontSize: 12,
                  color: theme.sage,
                  border: `1px solid ${theme.sageBorder}`,
                  backgroundColor: theme.sageLight,
                  borderRadius: 20,
                  padding: "5px 14px",
                }}
              >
                {b}
              </span>
            ))}
          </div>

          <div id="comment">
            <div style={{ fontSize: 11, fontWeight: 700, color: theme.gold, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 14 }}>
              ✦ Votre analyse en trois étapes
            </div>

            <div style={{ fontSize: 13, color: theme.textLight, lineHeight: 1.7, marginBottom: 18 }}>
              Chaque analyse est réalisée individuellement. Aucune lecture automatisée, aucune interprétation générique.
            </div>

            {[
              {
                num: "1",
                title: "Renseignez vos informations personnelles",
                desc: "Votre prénom, votre date de naissance et le thème qui vous guide. Ces éléments permettent d’orienter la lecture avec justesse et précision.",
              },
              {
                num: "2",
                title: "Transmettez les photos de vos deux mains",
                desc: "Paume ouverte, lumière naturelle, lignes visibles. Chaque détail compte : forme, monts, lignes, bifurcations.",
              },
              {
                num: "3",
                title: "Recevez votre lecture personnalisée",
                desc: "Notre expert analyse vos deux mains avec attention. Votre rapport détaillé vous est adressé sous 24h, par email.",
              },
            ].map((step, idx) => (
              <div key={step.num} style={{ display: "flex", gap: 16, marginBottom: 22 }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                  <div
                    style={{
                      minWidth: 34,
                      height: 34,
                      borderRadius: "50%",
                      backgroundColor: theme.goldLight,
                      border: `1px solid ${theme.gold}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 13,
                      fontWeight: 700,
                      color: theme.gold,
                      flexShrink: 0,
                      boxShadow: "0 6px 18px rgba(201,168,76,0.18)",
                    }}
                  >
                    {step.num}
                  </div>
                  {idx < 2 ? (
                    <div style={{ width: 1, height: 36, backgroundColor: "rgba(201,168,76,0.45)", borderRadius: 1 }} />
                  ) : null}
                </div>

                <div
                  style={{
                    backgroundColor: theme.card,
                    border: `1px solid ${theme.border}`,
                    borderRadius: 14,
                    padding: "14px 16px",
                    boxShadow: "0 10px 28px rgba(0,0,0,0.05)",
                    flex: 1,
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 14, color: theme.text, marginBottom: 4 }}>{step.title}</div>
                  <div style={{ fontSize: 13, color: theme.textLight, lineHeight: 1.6 }}>{step.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div
          id="form-card"
          style={{
            backgroundColor: theme.card,
            borderRadius: 16,
            border: `1px solid ${theme.border}`,
            padding: "28px 24px",
            boxShadow: "0 8px 40px rgba(0,0,0,0.07)",
            position: "sticky",
            top: 84,
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 16, color: theme.text, marginBottom: 4 }}>Lancer mon analyse</div>
          <div style={{ fontSize: 12, color: theme.textLight, marginBottom: 16 }}>Résultats transmis sous 24h par email</div>

          <div style={{ backgroundColor: theme.bg, borderRadius: 10, padding: "12px 14px", marginBottom: 20, fontSize: 13 }}>
            <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: 8, marginBottom: 8, borderBottom: `1px solid ${theme.border}` }}>
              <span style={{ color: theme.textLight }}>Délai</span>
              <span style={{ color: theme.text, fontWeight: 600 }}>Sous 24h</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: 8, marginBottom: 8, borderBottom: `1px solid ${theme.border}` }}>
              <span style={{ color: theme.textLight }}>Livraison</span>
              <span style={{ color: theme.text, fontWeight: 600 }}>Par email</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: theme.textLight }}>Confidentialité</span>
              <span style={{ color: theme.text, fontWeight: 600 }}>Photos supprimées</span>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
              <div>
                <div style={labelStyle}>Prénom</div>
                <input
                  type="text"
                  value={prenom}
                  placeholder="Marie"
                  style={inputStyle}
                  onChange={(e) => {
                    setPrenom(e.target.value);
                    setResult(null);
                    setError(null);
                  }}
                />
              </div>
              <div>
                <div style={labelStyle}>Nom</div>
                <input
                  type="text"
                  value={nom}
                  placeholder="Dupont"
                  style={inputStyle}
                  onChange={(e) => {
                    setNom(e.target.value);
                    setResult(null);
                    setError(null);
                  }}
                />
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={labelStyle}>Email</div>
              <input
                type="email"
                value={email}
                placeholder="votre@email.com"
                style={inputStyle}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setResult(null);
                  setError(null);
                }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={labelStyle}>Date de naissance</div>
              <input
                type="date"
                value={dateNaissance}
                style={inputStyle}
                onChange={(e) => {
                  setDateNaissance(e.target.value);
                  setResult(null);
                  setError(null);
                }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={labelStyle}>Thème de lecture</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
                {THEMES.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => {
                      setThemeChoisi(t.id);
                      setResult(null);
                      setError(null);
                    }}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: `1.5px solid ${themeChoisi === t.id ? theme.sage : theme.border}`,
                      backgroundColor: themeChoisi === t.id ? theme.sageLight : theme.bg,
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    <div style={{ fontSize: 18, marginBottom: 4 }}>{t.emoji}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: themeChoisi === t.id ? theme.sage : theme.text, lineHeight: 1.3 }}>
                      {t.label}
                    </div>
                    <div style={{ fontSize: 10, color: theme.textLight, marginTop: 3, lineHeight: 1.4 }}>{t.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={labelStyle}>Photos de vos mains</div>

              <div style={{ marginTop: 6, fontSize: 11, color: theme.textLight, lineHeight: 1.5 }}>
                Formats : JPG, PNG, WEBP. Taille max : 20 Mo par photo.
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 8 }}>
                <label
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 10,
                    borderRadius: 10,
                    border: `2px dashed ${leftFile ? theme.sage : theme.border}`,
                    backgroundColor: leftFile ? theme.sageLight : theme.bg,
                    cursor: "pointer",
                    minHeight: 92,
                  }}
                >
                  {leftPreview ? (
                    <img src={leftPreview} alt="Main gauche" style={{ maxWidth: "100%", maxHeight: 92, borderRadius: 8 }} />
                  ) : (
                    <>
                      <span style={{ fontSize: 20 }}>🤚</span>
                      <span style={{ fontSize: 10, color: theme.textLight, marginTop: 4, textAlign: "center" }}>Main gauche</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      setLeftFile(e.target.files?.[0] || null);
                      setResult(null);
                      setError(null);
                    }}
                  />
                  {leftFile && leftFile.size > MAX_BYTES ? (
                    <div style={{ marginTop: 8, fontSize: 10, color: theme.error, textAlign: "center" }}>Fichier trop lourd (max 20 Mo)</div>
                  ) : null}
                </label>

                <label
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 10,
                    borderRadius: 10,
                    border: `2px dashed ${rightFile ? theme.sage : theme.border}`,
                    backgroundColor: rightFile ? theme.sageLight : theme.bg,
                    cursor: "pointer",
                    minHeight: 92,
                  }}
                >
                  {rightPreview ? (
                    <img src={rightPreview} alt="Main droite" style={{ maxWidth: "100%", maxHeight: 92, borderRadius: 8 }} />
                  ) : (
                    <>
                      <span style={{ fontSize: 20 }}>🤚</span>
                      <span style={{ fontSize: 10, color: theme.textLight, marginTop: 4, textAlign: "center" }}>Main droite</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      setRightFile(e.target.files?.[0] || null);
                      setResult(null);
                      setError(null);
                    }}
                  />
                  {rightFile && rightFile.size > MAX_BYTES ? (
                    <div style={{ marginTop: 8, fontSize: 10, color: theme.error, textAlign: "center" }}>Fichier trop lourd (max 20 Mo)</div>
                  ) : null}
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              style={{
                width: "100%",
                padding: "13px 0",
                borderRadius: 10,
                border: "none",
                backgroundColor: canSubmit ? theme.sage : theme.border,
                color: canSubmit ? "#fff" : theme.textLight,
                fontSize: 14,
                fontWeight: 600,
                fontFamily: "Georgia, serif",
                cursor: canSubmit ? "pointer" : "not-allowed",
                letterSpacing: "0.03em",
                transition: "background-color 0.2s",
              }}
            >
              {loading ? "✨ Analyse en cours..." : "✦ Envoyer ma demande"}
            </button>

            {!canSubmit && !loading && (
              <p style={{ textAlign: "center", marginTop: 8, fontSize: 11, color: theme.textLight }}>Remplissez tous les champs pour continuer.</p>
            )}

            <p style={{ textAlign: "center", marginTop: 12, fontSize: 11, color: theme.textLight, lineHeight: 1.5 }}>
              Vos photos sont supprimées après analyse. Données confidentielles.
            </p>
          </form>
        </div>
      </section>

      {error && (
        <div style={{ maxWidth: 760, margin: "24px auto", padding: "0 40px" }}>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              color: theme.error,
              fontSize: 12,
              backgroundColor: "#FDF0F0",
              padding: 16,
              borderRadius: 10,
              border: "1px solid #E8C0C0",
            }}
          >
            {error}
          </pre>
        </div>
      )}

      {result === "MAIL_CONFIRMATION" && (
        <section style={{ maxWidth: 760, margin: "40px auto", padding: "0 40px 60px" }}>
          <div
            style={{
              backgroundColor: theme.card,
              borderRadius: 16,
              border: `1px solid ${theme.border}`,
              padding: "32px 28px",
              boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, paddingBottom: 14, borderBottom: `1px solid ${theme.border}` }}>
              <div style={{ width: 3, height: 24, backgroundColor: theme.gold, borderRadius: 2 }} />
              <h2 style={{ margin: 0, fontSize: 18, color: theme.text, fontWeight: 700 }}>Demande enregistrée</h2>
            </div>

            <div style={{ fontSize: 14, lineHeight: 1.85, color: theme.text }}>
              <p style={{ marginTop: 0 }}>
                Nous vous remercions pour ces informations précieuses.
                <br />
                Votre demande est désormais en cours d’étude par notre expert en chiromancie.
              </p>

              <p>Après une analyse attentive et approfondie de vos deux mains, votre rapport personnalisé vous sera adressé par email demain, entre 09h00 et 19h45 (hors dimanche).</p>

              <p>Afin de garantir la bonne réception, nous vous invitons à consulter également votre dossier de courriers indésirables.</p>

              <p style={{ marginBottom: 0 }}>Vos données sont traitées avec la plus stricte confidentialité et les photographies sont supprimées après analyse.</p>
            </div>
          </div>
        </section>
      )}

      <footer style={{ borderTop: `1px solid ${theme.border}`, backgroundColor: theme.card, padding: "56px 40px 0" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 48, paddingBottom: 48 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <span style={{ fontSize: 22 }}>🌿</span>
              <span style={{ fontWeight: 700, fontSize: 17, color: theme.text }}>Lecture de Mains</span>
            </div>
            <p style={{ fontSize: 13, color: theme.textLight, lineHeight: 1.7, margin: 0, maxWidth: 260 }}>
              Analyse chiromantique personnalisée par un expert. Confidentiel, bienveillant et sérieux.
            </p>
          </div>

          <div>
            <div style={{ fontWeight: 700, fontSize: 12, color: theme.text, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 18 }}>
              Navigation
            </div>
            <a href="#comment" style={{ fontSize: 13, color: theme.textLight, marginBottom: 10, textDecoration: "none", display: "block" }}>
              Votre analyse en trois étapes
            </a>
            <a href="#form-card" style={{ fontSize: 13, color: theme.textLight, marginBottom: 10, textDecoration: "none", display: "block" }}>
              Lancer mon analyse
            </a>
          </div>

          <div>
            <div style={{ fontWeight: 700, fontSize: 12, color: theme.text, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 18 }}>
              Mentions
            </div>
            <Link href="/mentions-legales" style={{ fontSize: 13, color: theme.textLight, marginBottom: 10, textDecoration: "none", display: "block" }}>
              Mentions légales
            </Link>
            <Link href="/confidentialite" style={{ fontSize: 13, color: theme.textLight, marginBottom: 10, textDecoration: "none", display: "block" }}>
              Confidentialité
            </Link>
          </div>
        </div>

        <div style={{ maxWidth: 900, margin: "0 auto", borderTop: `1px solid ${theme.border}`, padding: "20px 0", display: "flex", justifyContent: "center", alignItems: "center", gap: 48 }}>
          <span style={{ fontSize: 12, color: theme.textLight }}>© 2026 Lecture de Mains</span>
          <span style={{ fontSize: 12, color: theme.textLight }}>Expert en chiromancie · 20 ans d'expérience</span>
        </div>
      </footer>
    </div>
  );
}
