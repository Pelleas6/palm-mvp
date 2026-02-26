"use client";
import { useMemo, useState } from "react";

export default function Home() {
  const [leftFile, setLeftFile] = useState(null);
  const [rightFile, setRightFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const leftPreview = useMemo(() => leftFile ? URL.createObjectURL(leftFile) : null, [leftFile]);
  const rightPreview = useMemo(() => rightFile ? URL.createObjectURL(rightFile) : null, [rightFile]);

  const canSubmit = useMemo(() => {
    return !!leftFile && !!rightFile && !loading;
  }, [leftFile, rightFile, loading]);

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
    if (!leftFile || !rightFile) {
      setError("Il faut obligatoirement 2 photos : main gauche + main droite.");
      return;
    }
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leftPath, rightPath }),
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
    <main style={{ padding: 24, fontFamily: "Arial, sans-serif" }}>
      <h1>Analyse de vos mains</h1>
      <form onSubmit={handleSubmit} style={{ marginTop: 16 }}>
        <div style={{ marginBottom: 16 }}>
          <div>Main gauche (obligatoire)</div>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setLeftFile(e.target.files?.[0] || null)}
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
            onChange={(e) => setRightFile(e.target.files?.[0] || null)}
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
        {(!leftFile || !rightFile) && (
          <div style={{ marginTop: 10, fontSize: 12, color: "#888" }}>
            Le bouton s'active seulement quand les 2 photos sont ajoutées.
          </div>
        )}
      </form>
      {error && <pre style={{ marginTop: 16, whiteSpace: "pre-wrap", color: "red" }}>{error}</pre>}
      {result && <pre style={{ marginTop: 16, whiteSpace: "pre-wrap" }}>{result}</pre>}
    </main>
  );
}
