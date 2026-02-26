"use client";

import { useState } from "react";

export default function Home() {
  const [leftFile, setLeftFile] = useState(null);
  const [rightFile, setRightFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (!leftFile || !rightFile) {
      setError("Merci d'uploader la main gauche ET la main droite.");
      return;
    }

    try {
      setLoading(true);

      // -------------------------
      // 1️⃣ Upload vers Supabase
      // -------------------------
      const formData = new FormData();
      formData.append("left", leftFile);
      formData.append("right", rightFile);

      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const uploadData = await uploadRes.json();

      if (!uploadRes.ok) {
        throw new Error(uploadData.error || "Erreur upload");
      }

      const { leftPath, rightPath } = uploadData;

      // -------------------------
      // 2️⃣ Analyse OpenAI
      // -------------------------
      const analyzeRes = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          leftPath,
          rightPath,
        }),
      });

      const analyzeData = await analyzeRes.json();

      if (!analyzeRes.ok) {
        throw new Error(analyzeData.error || "Erreur analyse");
      }

      setResult(analyzeData.report);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: 40, fontFamily: "Arial" }}>
      <h1>Analyse de vos lignes de main</h1>

      <form onSubmit={handleSubmit}>

        <div style={{ marginBottom: 20 }}>
          <label>Main gauche :</label><br />
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setLeftFile(e.target.files[0])}
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label>Main droite :</label><br />
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setRightFile(e.target.files[0])}
          />
        </div>

        <button type="submit" disabled={loading}>
          {loading ? "Analyse en cours..." : "Lancer l'analyse"}
        </button>

      </form>

      {error && (
        <p style={{ color: "red", marginTop: 20 }}>
          {error}
        </p>
      )}

      {result && (
        <div style={{ marginTop: 30 }}>
          <h2>Votre rapport :</h2>
          <p style={{ whiteSpace: "pre-line" }}>
            {result}
          </p>
        </div>
      )}
    </main>
  );
}
