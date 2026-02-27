"use client";
import { useEffect, useMemo, useState } from "react";

const theme = {
  bg: "#FAF7F2",
  card: "#FFFFFF",
  border: "#E8E0D0",
  sage: "#7A9E7E",
  sageLight: "#EFF5F0",
  sageBorder: "#B5CDB7",
  gold: "#C9A84C",
  goldLight: "#FBF6EC",
  text: "#3A3228",
  textLight: "#7A6F65",
  error: "#B85C5C",
};

const THEMES = [
  { id: "amour", label: "🌹 Amour & Relations" },
  { id: "travail", label: "💼 Travail & Carrière" },
  { id: "developpement", label: "🌱 Développement personnel" },
  { id: "finances", label: "💰 Finances & Abondance" },
  { id: "famille", label: "👨‍👩‍👧 Famille & Liens" },
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
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [leftPreview, setLeftPreview] = useState(null);
  const [rightPreview, setRightPreview] = useState(null);

  useEffect(() => {
    if (!leftFile) { setLeftPreview(null); return; }
    const url = URL.createObjectURL(leftFile);
    setLeftPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [leftFile]);

  useEffect(() => {
    if (!rightFile) { setRightPreview(null); return; }
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
    try { return await res.json(); } catch { return null; }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setResult(null);
    try {
      setLoading(true);
      const fd = new FormData();
      fd.append("left", leftFile);
      fd.append("right", rightFile);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: fd });
      const uploadData = await safeJson(uploadRes);
      if (!uploadRes.ok) throw new Error("UPLOAD ERROR\nstatus=" + uploadRes.status + "\nbody=" + JSON.stringify(uploadData, null, 2));
      const leftPath = uploadData?.leftPath;
      const rightPath = uploadData?.rightPath;
      if (!leftPath || !rightPath) throw new Error("UPLOAD OK mais chemins manquants: " + JSON.stringify(uploadData, null, 2));
      const analyzeRes = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-secret": process.env.NEXT_PUBLIC_API_SECRET || "",
        },
        body: JSON.stringify({ leftPath, rightPath, prenom, nom, email, dateNaissance, themeChoisi }),
      });
      const analyzeData = await safeJson(analyzeRes);
      if (!analyzeRes.ok) throw new Error("ANALYZE ERROR\nstatus=" + analyzeRes.status + "\nbody=" + JSON.stringify(analyzeData, null, 2));
      setResult(analyzeData?.report || JSON.stringify(analyzeData, null, 2));
    } catch (err) {
      setError(String(err?.message || err));
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = {
    width: "100%",
    padding: "10px 12px",
    marginTop: 6,
    borderRadius: 8,
    border: `1px solid ${theme.border}`,
    backgroundColor: theme.bg,
    color: theme.text,
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
  };

  const labelStyle = {
    fontSize: 13,
    fontWeight: 600,
    color: theme.textLight,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
  };

  return (
    <main style={{ backgroundColor: theme.bg, minHeight: "100vh", padding: "40px 16px", fontFamily: "Georgia, serif" }}>

      {/* En-tête */}
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>🌿</div>
        <h1 style={{ fontSize: 28, color: theme.text, margin: 0, fontWeight: 700, letterSpacing: "0.02em" }}>
          Lecture de vos mains
        </h1>
        <p style={{ color: theme.textLight, marginTop: 10, fontSize: 15, lineHeight: 1.6 }}>
          Une analyse personnalisée par notre expert en chiromancie
        </p>
        <div style={{ width: 50, height: 2, backgroundColor: theme.gold, margin: "16px auto 0" }} />
      </div>

      {/* Carte formulaire */}
      <div style={{
        maxWidth: 560,
        margin: "0 auto",
        backgroundColor: theme.card,
        borderRadius: 16,
        border: `1px solid ${theme.border}`,
        padding: "32px 28px",
        boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
      }}>
        <form onSubmit={handleSubmit}>

          {/* Infos personnelles */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: theme.gold, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16 }}>
              ✦ Vos informations
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <div style={labelStyle}>Prénom</div>
                <input type="text" value={prenom} placeholder="Marie" style={inputStyle}
                  onChange={(e) => { setPrenom(e.target.value); setResult(null); setError(null); }} />
              </div>
              <div>
                <div style={labelStyle}>Nom</div>
                <input type="text" value={nom} placeholder="Dupont" style={inputStyle}
                  onChange={(e) => { setNom(e.target.value); setResult(null); setError(null); }} />
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <div style={labelStyle}>Email</div>
              <input type="email" value={email} placeholder="votre@email.com" style={inputStyle}
                onChange={(e) => { setEmail(e.target.value); setResult(null); setError(null); }} />
            </div>
            <div style={{ marginTop: 12 }}>
              <div style={labelStyle}>Date de naissance</div>
              <input type="date" value={dateNaissance} style={inputStyle}
                onChange={(e) => { setDateNaissance(e.target.value); setResult(null); setError(null); }} />
            </div>
          </div>

          {/* Thème */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: theme.gold, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16 }}>
              ✦ Votre thème de lecture
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {THEMES.map((t) => (
                <label
                  key={t.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: `1px solid ${themeChoisi === t.id ? theme.sage : theme.border}`,
                    backgroundColor: themeChoisi === t.id ? theme.sageLight : theme.bg,
                    cursor: "pointer",
                    fontSize: 14,
                    color: theme.text,
                    transition: "all 0.15s",
                  }}
                >
                  <input
                    type="radio"
                    name="theme"
                    value={t.id}
                    checked={themeChoisi === t.id}
                    onChange={() => { setThemeChoisi(t.id); setResult(null); setError(null); }}
                    style={{ accentColor: theme.sage }}
                  />
                  {t.label}
                </label>
              ))}
            </div>
          </div>

          {/* Photos */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: theme.gold, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16 }}>
              ✦ Vos photos
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <div style={labelStyle}>Main gauche</div>
                <label style={{
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  marginTop: 6, padding: 12, borderRadius: 10,
                  border: `2px dashed ${leftFile ? theme.sage : theme.border}`,
                  backgroundColor: leftFile ? theme.sageLight : theme.bg,
                  cursor: "pointer", minHeight: 100,
                }}>
                  {leftPreview ? (
                    <img src={leftPreview} alt="Main gauche" style={{ maxWidth: "100%", maxHeight: 120, borderRadius: 6 }} />
                  ) : (
                    <>
                      <span style={{ fontSize: 24 }}>🤚</span>
                      <span style={{ fontSize: 11, color: theme.textLight, marginTop: 6 }}>Cliquez pour ajouter</span>
                    </>
                  )}
                  <input type="file" accept="image/*" style={{ display: "none" }}
                    onChange={(e) => { setLeftFile(e.target.files?.[0] || null); setResult(null); setError(null); }} />
                </label>
              </div>
              <div>
                <div style={labelStyle}>Main droite</div>
                <label style={{
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  marginTop: 6, padding: 12, borderRadius: 10,
                  border: `2px dashed ${rightFile ? theme.sage : theme.border}`,
                  backgroundColor: rightFile ? theme.sageLight : theme.bg,
                  cursor: "pointer", minHeight: 100,
                }}>
                  {rightPreview ? (
                    <img src={rightPreview} alt="Main droite" style={{ maxWidth: "100%", maxHeight: 120, borderRadius: 6 }} />
                  ) : (
                    <>
                      <span style={{ fontSize: 24 }}>🤚</span>
                      <span style={{ fontSize: 11, color: theme.textLight, marginTop: 6 }}>Cliquez pour ajouter</span>
                    </>
                  )}
                  <input type="file" accept="image/*" style={{ display: "none" }}
                    onChange={(e) => { setRightFile(e.target.files?.[0] || null); setResult(null); setError(null); }} />
                </label>
              </div>
            </div>
          </div>

          {/* Bouton */}
          <button
            type="submit"
            disabled={!canSubmit}
            style={{
              width: "100%",
              padding: "14px 0",
              borderRadius: 10,
              border: "none",
              backgroundColor: canSubmit ? theme.sage : theme.border,
              color: canSubmit ? "#FFFFFF" : theme.textLight,
              fontSize: 15,
              fontWeight: 600,
              fontFamily: "Georgia, serif",
              cursor: canSubmit ? "pointer" : "not-allowed",
              letterSpacing: "0.04em",
              transition: "background-color 0.2s",
            }}
          >
            {loading ? "✨ Analyse en cours..." : "✦ Lancer l'analyse"}
          </button>

          {!canSubmit && !loading && (
            <p style={{ textAlign: "center", marginTop: 10, fontSize: 12, color: theme.textLight }}>
              Remplissez tous les champs, choisissez un thème et ajoutez vos 2 photos.
            </p>
          )}

        </form>
      </div>

      {/* Erreur */}
      {error && (
        <div style={{ maxWidth: 560, margin: "20px auto 0" }}>
          <pre style={{ whiteSpace: "pre-wrap", color: theme.error, fontSize: 13, backgroundColor: "#FDF0F0", padding: 16, borderRadius: 10, border: "1px solid #E8C0C0" }}>
            {error}
          </pre>
        </div>
      )}

      {/* Résultat */}
      {result && (
        <div style={{ maxWidth: 560, margin: "32px auto 0" }}>
          <div style={{
            padding: "16px 20px",
            backgroundColor: theme.sageLight,
            border: `1px solid ${theme.sageBorder}`,
            borderRadius: 12,
            color: theme.sage,
            fontSize: 14,
            lineHeight: 1.7,
            marginBottom: 24,
          }}>
            <strong style={{ color: theme.text }}>Merci pour votre confiance.</strong><br />
            Vous consultez actuellement une version de démonstration de votre analyse.<br /><br />
            Dans la version finale, un expert étudiera vos deux mains et vous recevrez votre analyse détaillée par email sous <strong>72 heures maximum</strong>.
          </div>
          <div style={{
            backgroundColor: theme.card,
            borderRadius: 16,
            border: `1px solid ${theme.border}`,
            padding: "28px 24px",
            boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, paddingBottom: 16, borderBottom: `1px solid ${theme.border}` }}>
              <div style={{ width: 3, height: 24, backgroundColor: theme.gold, borderRadius: 2 }} />
              <h2 style={{ margin: 0, fontSize: 18, color: theme.text, fontWeight: 700 }}>Votre analyse</h2>
            </div>
            <pre style={{ whiteSpace: "pre-wrap", lineHeight: 1.8, fontSize: 14, color: theme.text, margin: 0, fontFamily: "Georgia, serif" }}>
              {result}
            </pre>
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ textAlign: "center", marginTop: 48, paddingBottom: 24 }}>
        <div style={{ width: 30, height: 1, backgroundColor: theme.border, margin: "0 auto 12px" }} />
        <p style={{ fontSize: 12, color: theme.textLight }}>
          Expert en chiromancie · 20 ans d'expérience
        </p>
      </div>

    </main>
  );
}
