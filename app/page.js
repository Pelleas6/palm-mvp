"use client";

import { useState } from "react";

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = bytes;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

export default function Home() {
  const [leftHand, setLeftHand] = useState(null);
  const [rightHand, setRightHand] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [analysis, setAnalysis] = useState("");

  const handleSend = async () => {
    try {
      setError("");
      setInfo("");
      setAnalysis("");

      if (!leftHand || !rightHand) {
        setError("Veuillez télécharger la main gauche et la main droite.");
        return;
      }

      setLoading(true);

      // 1) upload
      setInfo("Upload en cours...");
      const formData = new FormData();
      formData.append("leftHand", leftHand);
      formData.append("rightHand", rightHand);

      const upRes = await fetch("/api/upload", {
        method: "POST",
        body: formData
      });

      const upText = await upRes.text();
      let upJson = null;
      try {
        upJson = JSON.parse(upText);
      } catch {}

      if (!upRes.ok) {
        setError((upJson && upJson.error) || upText || `Erreur upload (status ${upRes.status})`);
        setLoading(false);
        return;
      }

      const leftPath = upJson?.leftPath;
      const rightPath = upJson?.rightPath;

      if (!leftPath || !rightPath) {
        setError("Upload OK mais paths manquants.");
        setLoading(false);
        return;
      }

      // 2) analyze
      setInfo("Analyse IA en cours...");
      const anRes = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leftPath, rightPath })
      });

      const anText = await anRes.text();
      let anJson = null;
      try {
        anJson = JSON.parse(anText);
      } catch {}

      if (!anRes.ok) {
        setError((anJson && anJson.error) || anText || `Erreur analyse (status ${anRes.status})`);
        setLoading(false);
        return;
      }

      setInfo("Terminé.");
      setAnalysis(anJson?.analysis || "OK");
      setLoading(false);
    } catch (e) {
      setLoading(false);
      setError(e?.message || "Erreur inconnue");
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f4f6fb", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 760, background: "white", borderRadius: 14, padding: 28, boxShadow: "0 10px 30px rgba(0,0,0,0.08)" }}>
        <h1 style={{ margin: 0, fontSize: 40 }}>Lecture de Mains</h1>
        <p style={{ marginTop: 10, color: "#333" }}>
          Téléchargez une photo de votre main gauche et de votre main droite.
          <br />
          Analyse personnalisée envoyée sous 24h.
        </p>

        <div style={{ marginTop: 18 }}>
          <div style={{ marginBottom: 12 }}>
            <div style={{ marginBottom: 6 }}>Main gauche</div>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setLeftHand(e.target.files?.[0] || null)}
            />
            {leftHand ? (
              <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
                {leftHand.name} • {formatBytes(leftHand.size)}
              </div>
            ) : null}
          </div>

          <div style={{ marginBottom: 18 }}>
            <div style={{ marginBottom: 6 }}>Main droite</div>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setRightHand(e.target.files?.[0] || null)}
            />
            {rightHand ? (
              <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
                {rightHand.name} • {formatBytes(rightHand.size)}
              </div>
            ) : null}
          </div>

          {error ? (
            <div style={{ color: "#d11", marginBottom: 12 }}>{error}</div>
          ) : null}

          {info ? (
            <div style={{ color: "#0a7", marginBottom: 12 }}>{info}</div>
          ) : null}

          <button
            onClick={handleSend}
            disabled={loading}
            style={{
              width: "100%",
              background: "#1f3b8f",
              color: "white",
              border: "none",
              padding: "14px 16px",
              borderRadius: 10,
              fontSize: 18,
              cursor: loading ? "not-allowed" : "pointer"
            }}
          >
            {loading ? "Envoi..." : "Envoyer mon analyse"}
          </button>

          {analysis ? (
            <div style={{ marginTop: 18, whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.5, background: "#f7f7f7", padding: 14, borderRadius: 10 }}>
              {analysis}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
