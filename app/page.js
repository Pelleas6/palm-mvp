"use client";
import { useEffect, useMemo, useState } from "react";

export default function Home() {
  const [leftFile, setLeftFile] = useState(null);
  const [rightFile, setRightFile] = useState(null);
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [dateNaissance, setDateNaissance] = useState("");
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
      !loading
    );
  }, [leftFile, rightFile, prenom, nom, email, dateNaissance, loading]);

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
      if (!leftPath || !rightPath) throw new Error("UPLOAD OK mais leftPath/rightPath manquants: " + JSON.stringify(uploadData, null, 2));
      const analyzeRes = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-secret": process.env.NEXT_PUBLIC_API_SECRET || "",
        },
        body: JSON.stringify({ leftPath, rightPath, prenom, nom, email, dateNaissance }),
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
    padding: "10px 14px",
    marginTop: 6,
    borderRadius: 8,
    border: "1px solid #2e3347",
    backgroundColor: "#0f1117",
    color: "#e8eaf0",
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
  };

  const labelStyle = {
    fontSize: 13,
    color: "#9aa0b8",
    fontWeight: 500,
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#0f1117", color: "#e8eaf0", fontFamily: "'Segoe UI', Arial, sans-serif" }}>

      {/* HEADER */}
      <div style={{ padding: "20px 32px", borderBottom: "1px solid #1e2235", display: "flex", alignItems: "center" }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: "#4ecdc4", marginRight: 10 }} />
        <span style={{ fontSize: 15, fontWeight: 600, color: "#e8eaf0" }}>Lecture de Mains</span>
      </div>

      {/* HERO */}
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "60px 24px 40px" }}>
        <p style={{ fontSize: 13, color: "#4ecdc4", marginBottom: 12, letterSpacing: 1 }}>
          ANALYSE PERSONNALISÉE
        </p>
        <h1 style={{ fontSize: 38, fontWeight: 700, lineHeight: 1.2, margin: "0 0 16px", color: "#ffffff" }}>
          Découvrez ce que vos mains<br />révèlent de vous
        </h1>
        <p style={{ fontSize: 16, color: "#9aa0b8", maxWidth: 520, lineHeight: 1.7, margin: 0 }}>
          Une analyse sérieuse et bienveillante par un expert en chiromancie avec 20 ans d'expérience. Votre rapport personnalisé vous sera transmis sous 72 heures.
        </p>

        <div style={{ display: "flex", gap: 10, marginTop: 24, flexWrap: "wrap" }}>
          {["Analyse des deux mains", "Rapport détaillé", "Expertise de 20 ans"].map((tag) => (
            <span key={tag} style={{ padding: "6px 14px", borderRadius: 20, border: "1px solid #2e3347", fontSize: 13, color: "#9aa0b8" }}>
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* FORMULAIRE */}
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "0 24px 80px" }}>
        <div style={{ backgroundColor: "#151929", border: "1px solid #1e2235", borderRadius: 16, padding: "32px" }}>

          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 6, color: "#ffffff" }}>
            Soumettre votre analyse
          </h2>
          <p style={{ fontSize: 13, color: "#9aa0b8", marginBottom: 28 }}>
            Remplissez tous les champs et ajoutez vos deux photos pour continuer.
          </p>

          <form onSubmit={handleSubmit}>

            {/* Prénom + Nom */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>Prénom</label>
                <input type="text" value={prenom} placeholder="Votre prénom" style={inputStyle}
                  onChange={(e) => { setPrenom(e.target.value); setResult(null); setError(null); }} />
              </div>
              <div>
                <label style={labelStyle}>Nom</label>
                <input type="text" value={nom} placeholder="Votre nom" style={inputStyle}
                  onChange={(e) => { setNom(e.target.value); setResult(null); setError(null); }} />
              </div>
            </div>

            {/* Email + Date */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
              <div>
                <label style={labelStyle}>Email</label>
                <input type="email" value={email} placeholder="votre@email.com" style={inputStyle}
                  onChange={(e) => { setEmail(e.target.value); setResult(null); setError(null); }} />
              </div>
              <div>
                <label style={labelStyle}>Date de naissance</label>
                <input type="date" value={dateNaissance} style={{ ...inputStyle, colorScheme: "dark" }}
                  onChange={(e) => { setDateNaissance(e.target.value); setResult(null); setError(null); }} />
              </div>
            </div>

            {/* Photos */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 28 }}>
              {[
                { label: "Main gauche", file: leftFile, preview: leftPreview, key: "left", setter: setLeftFile, previewSetter: setLeftPreview },
                { label: "Main droite", file: rightFile, preview: rightPreview, key: "right", setter: setRightFile, previewSetter: setRightPreview },
              ].map(({ label, file, preview, key, setter }) => (
                <div key={key}>
                  <label style={labelStyle}>{label}</label>
                  <label style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    marginTop: 6,
                    padding: 16,
                    borderRadius: 10,
                    border: "1px dashed #2e3347",
                    backgroundColor: "#0f1117",
                    cursor: "pointer",
                    minHeight: 120,
                    transition: "border-color 0.2s",
                  }}>
                    {preview ? (
                      <img src={preview} alt={label} style={{ maxWidth: "100%", maxHeight: 150, borderRadius: 8 }} />
                    ) : (
                      <>
                        <span style={{ fontSize: 28, marginBottom: 8 }}>🖐️</span>
                        <span style={{ fontSize: 12, color: "#9aa0b8" }}>Cliquez pour ajouter</span>
                      </>
                    )}
                    <input type="file" accept="image/*" style={{ display: "none" }}
                      onChange={(e) => { setter(e.target.files?.[0] || null); setResult(null); setError(null); }} />
                  </label>
                  {file && <div style={{ fontSize: 11, color: "#4ecdc4", marginTop: 4 }}>✓ {file.name}</div>}
                </div>
              ))}
            </div>

            {/* Bouton */}
            <button type="submit" disabled={!canSubmit} style={{
              width: "100%",
              padding: "14px",
              borderRadius: 10,
              border: "none",
              backgroundColor: canSubmit ? "#4ecdc4" : "#1e2235",
              color: canSubmit ? "#0f1117" : "#4a5068",
              fontSize: 15,
              fontWeight: 600,
              cursor: canSubmit ? "pointer" : "not-allowed",
              transition: "background-color 0.2s",
            }}>
              {loading ? "Analyse en cours..." : "Lancer l'analyse"}
            </button>

            {!canSubmit && !loading && (
              <p style={{ textAlign: "center", fontSize: 12, color: "#4a5068", marginTop: 10 }}>
                Remplissez tous les champs et ajoutez vos 2 photos pour continuer.
              </p>
            )}
          </form>
        </div>

        {/* Erreur */}
        {error && (
          <pre style={{ marginTop: 20, padding: 16, backgroundColor: "#1a0f0f", border: "1px solid #5a1f1f", borderRadius: 10, whiteSpace: "pre-wrap", color: "#ff6b6b", fontSize: 13 }}>
            {error}
          </pre>
        )}

        {/* Résultat */}
        {result && (
          <>
            <div style={{
              marginTop: 24,
              padding: "16px 20px",
              backgroundColor: "#0d1f18",
              border: "1px solid #1e5c42",
              borderRadius: 10,
              color: "#4ecdc4",
              fontSize: 14,
              lineHeight: 1.7,
            }}>
              <strong>Merci pour votre envoi.</strong><br />
              Votre analyse est en cours de préparation. Vous consultez actuellement une version de démonstration.<br /><br />
              Dans la version finale, un expert étudiera vos deux mains et vous recevrez votre analyse détaillée par email sous <strong>72 heures maximum</strong>.
            </div>
            <div style={{
              marginTop: 24,
              backgroundColor: "#151929",
              border: "1px solid #1e2235",
              borderRadius: 16,
              padding: 32,
            }}>
              <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20, color: "#ffffff" }}>Votre analyse</h2>
              <pre style={{ whiteSpace: "pre-wrap", lineHeight: 1.8, fontSize: 14, color: "#c8ccd8", fontFamily: "inherit" }}>
                {result}
              </pre>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
