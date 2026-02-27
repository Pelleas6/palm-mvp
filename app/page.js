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
    try {
      return await res.json();
    } catch {
      return null;
    }
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
      if (!uploadRes.ok) {
        throw new Error(
          "UPLOAD ERROR\nstatus=" + uploadRes.status + "\nbody=" + JSON.stringify(uploadData, null, 2)
        );
      }
      const leftPath = uploadData?.leftPath;
      const rightPath = uploadData?.rightPath;
      if (!leftPath || !rightPath) {
        throw new Error("UPLOAD OK mais leftPath/rightPath manquants: " + JSON.stringify(uploadData, null, 2));
      }
      const analyzeRes = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-secret": process.env.NEXT_PUBLIC_API_SECRET || "",
        },
        body: JSON.stringify({ leftPath, rightPath, prenom, nom, email, dateNaissance }),
      });
      const analyzeData = await safeJson(analyzeRes);
      if (!analyzeRes.ok) {
        throw new Error(
          "ANALYZE ERROR\nstatus=" + analyzeRes.status + "\nbody=" + JSON.stringify(analyzeData, null, 2)
        );
      }
      setResult(analyzeData?.report || JSON.stringify(analyzeData, null, 2));
    } catch (err) {
      setError(String(err?.message || err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: 24, fontFamily: "Arial, sans-serif", maxWidth: 600 }}>
      <h1>Analyse de vos mains</h1>
      <form onSubmit={handleSubmit} style={{ marginTop: 16 }}>

        <div style={{ marginBottom: 12 }}>
          <div>Prénom (obligatoire)</div>
          <input
            type="text"
            value={prenom}
            placeholder="Votre prénom"
            onChange={(e) => { setPrenom(e.target.value); setResult(null); setError(null); }}
            style={{ width: "100%", padding: 8, marginTop: 4, borderRadius: 6, border: "1px solid #ccc" }}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <div>Nom (obligatoire)</div>
          <input
            type="text"
            value={nom}
            placeholder="Votre nom"
            onChange={(e) => { setNom(e.target.value); setResult(null); setError(null); }}
            style={{ width: "100%", padding: 8, marginTop: 4, borderRadius: 6, border: "1px solid #ccc" }}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <div>Email (obligatoire)</div>
          <input
            type="email"
            value={email}
            placeholder="votre@email.com"
            onChange={(e) => { setEmail(e.target.value); setResult(null); setError(null); }}
            style={{ width: "100%", padding: 8, marginTop: 4, borderRadius: 6, border: "1px solid #ccc" }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <div>Date de naissance (obligatoire)</div>
          <input
            type="date"
            value={dateNaissance}
            onChange={(e) => { setDateNaissance(e.target.value); setResult(null); setError(null); }}
            style={{ width: "100%", padding: 8, marginTop: 4, borderRadius: 6, border: "1px solid #ccc" }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <div>Main gauche (obligatoire)</div>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              setLeftFile(e.target.files?.[0] || null);
              setResult(null);
              setError(null);
            }}
          />
          {leftPreview && (
            <img
              src={leftPreview}
              alt="Aperçu main gauche"
              style={{ display: "block", marginTop: 8, maxWidth: 200, maxHeight: 200, borderRadius: 8, border: "1px solid #ccc" }}
            />
          )}
        </div>

        <div style={{ marginBottom: 16 }}>
          <div>Main droite (obligatoire)</div>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              setRightFile(e.target.files?.[0] || null);
              setResult(null);
              setError(null);
            }}
          />
          {rightPreview && (
            <img
              src={rightPreview}
              alt="Aperçu main droite"
              style={{ display: "block", marginTop: 8, maxWidth: 200, maxHeight: 200, borderRadius: 8, border: "1px solid #ccc" }}
            />
          )}
        </div>

        <button type="submit" disabled={!canSubmit}>
          {loading ? "Analyse en cours..." : "Lancer l'analyse"}
        </button>
        {!canSubmit && !loading && (
          <div style={{ marginTop: 10, fontSize: 12, color: "#888" }}>
            Remplissez tous les champs et ajoutez vos 2 photos pour continuer.
          </div>
        )}
      </form>

      {error && (
        <pre style={{ marginTop: 16, whiteSpace: "pre-wrap", color: "red" }}>
          {error}
        </pre>
      )}

      {result && (
        <>
          <div style={{
            marginTop: 24,
            padding: "14px 18px",
            backgroundColor: "#f0faf4",
            border: "1px solid #6dbf8b",
            borderRadius: 8,
            color: "#2d6a4f",
            fontSize: 14,
            lineHeight: 1.6,
          }}>
            <strong>Merci pour votre envoi.</strong><br />
            Votre analyse est en cours de préparation. Vous consultez actuellement une version de démonstration du rapport.<br /><br />
            Dans la version finale du service, un expert étudiera vos deux mains et vous recevrez un rapport détaillé par email sous <strong>72 heures maximum</strong>.
          </div>
          <div style={{ marginTop: 24 }}>
            <h2 style={{ marginBottom: 12 }}>Votre rapport</h2>
            <pre style={{ whiteSpace: "pre-wrap", lineHeight: 1.7, fontSize: 14 }}>
              {result}
            </pre>
          </div>
        </>
      )}
    </main>
  );
}
