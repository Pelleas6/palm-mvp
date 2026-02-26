"use client";

import { useMemo, useState } from "react";

export default function Home() {
  const [leftFile, setLeftFile] = useState(null);
  const [rightFile, setRightFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

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
          "UPLOAD ERROR\nstatus=" +
            uploadRes.status +
            "\nbody=" +
            JSON.stringify(uploadData, null, 2)
        );
      }

      const leftPath = uploadData?.leftPath;
      const rightPath = uploadData?.rightPath;

      if (!leftPath || !rightPath) {
        throw new Error(
          "UPLOAD OK mais leftPath/rightPath manquants: " +
            JSON.stringify(uploadData, null, 2)
        );
      }

      const analyzeRes = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leftPath, rightPath }),
      });

      const analyzeData = await safeJson(analyzeRes);

      if (!analyzeRes.ok) {
        throw new Error(
          "ANALYZE ERROR\nstatus=" +
            analyzeRes.status +
            "\nbody=" +
            JSON.stringify(analyzeData, null, 2)
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
        <div style={{ marginBottom: 12 }}>
          <div>Main gauche (obligatoire)</div>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setLeftFile(e.target.files?.[0] || null)}
          />
          {leftFile ? (
            <div style={{ fontSize: 12, marginTop: 4 }}>
              Sélectionné : {leftFile.name}
            </div>
          ) : null}
        </div>

        <div style={{ marginBottom: 12 }}>
          <div>Main droite (obligatoire)</div>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setRightFile(e.target.files?.[0] || null)}
          />
          {rightFile ? (
            <div style={{ fontSize: 12, marginTop: 4 }}>
              Sélectionné : {rightFile.name}
            </div>
          ) : null}
        </div>

        <button type="submit" disabled={!canSubmit}>
          {loading ? "Analyse en cours..." : "Lancer l'analyse"}
        </button>

        {!leftFile || !rightFile ? (
          <div style={{ marginTop: 10, fontSize: 12 }}>
            Le bouton s’active seulement quand les 2 photos sont ajoutées.
          </div>
        ) : null}
      </form>

      {error ? <pre style={{ marginTop: 16, whiteSpace: "pre-wrap" }}>{error}</pre> : null}
      {result ? <pre style={{ marginTop: 16, whiteSpace: "pre-wrap" }}>{result}</pre> : null}
    </main>
  );
}
