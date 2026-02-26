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

async function compressImageToJpeg(file, { maxWidth = 1600, quality = 0.82 } = {}) {
  if (!file) return null;

  const blobUrl = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = blobUrl;

    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });

    const ratio = img.width / img.height;
    let targetW = img.width;
    let targetH = img.height;

    if (img.width > maxWidth) {
      targetW = maxWidth;
      targetH = Math.round(maxWidth / ratio);
    }

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas non supporté");

    ctx.drawImage(img, 0, 0, targetW, targetH);

    const blob = await new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/jpeg", quality);
    });

    if (!blob) throw new Error("Compression impossible");

    const newName = file.name.replace(/\.[^.]+$/, "") + "_compressed.jpg";
    return new File([blob], newName, { type: "image/jpeg" });
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

export default function Home() {
  const [leftHand, setLeftHand] = useState(null);
  const [rightHand, setRightHand] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const handleUploadAndAnalyze = async () => {
    try {
      setError("");
      setInfo("");

      if (!leftHand || !rightHand) {
        setError("Veuillez télécharger la main gauche et la main droite.");
        return;
      }

      setLoading(true);
      setInfo("Compression des images...");

      // Compression côté navigateur
      const leftCompressed = await compressImageToJpeg(leftHand);
      const rightCompressed = await compressImageToJpeg(rightHand);

      if (!leftCompressed || !rightCompressed) {
        setError("Compression impossible.");
        setLoading(false);
        return;
      }

      // Garde-fou taille (front) — le serveur revalide à 5MB
      const maxPerFileBytes = 2.5 * 1024 * 1024; // 2.5MB
      if (leftCompressed.size > maxPerFileBytes || rightCompressed.size > maxPerFileBytes) {
        setError(
          `Photos encore trop lourdes après compression. ` +
            `Gauche: ${formatBytes(leftCompressed.size)} / Droite: ${formatBytes(
              rightCompressed.size
            )}. ` +
            `Essaye une photo un peu moins proche ou baisse la qualité.`
        );
        setLoading(false);
        return;
      }

      setInfo("Upload vers Supabase...");

      // 1) Upload
      const formData = new FormData();
      formData.append("leftHand", leftCompressed);
      formData.append("rightHand", rightCompressed);

      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      let uploadJson = null;
      try {
        uploadJson = await uploadRes.json();
      } catch {
        // ignore
      }

      if (!uploadRes.ok) {
        setError(uploadJson?.error || `Erreur upload (status ${uploadRes.status})`);
        setLoading(false);
        return;
      }

      const leftPath = uploadJson?.leftPath;
      const rightPath = uploadJson?.rightPath;

      if (!leftPath || !rightPath) {
        setError("Upload OK mais paths manquants.");
        setLoading(false);
        return;
      }

      setInfo("Analyse IA en cours...");

      // 2) Analyse
      const analyzeRes = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ leftPath, rightPath }),
      });

      let analyzeJson = null;
      try {
        analyzeJson = await analyzeRes.json();
      } catch {
        // ignore
      }

      if (!analyzeRes.ok) {
        setError(analyzeJson?.error || `Erreur analyse (status ${analyzeRes.status})`);
        setLoading(false);
        return;
      }

      const report = analyzeJson?.report;
      if (!report) {
        setError("Analyse OK mais rapport manquant.");
        setLoading(false);
        return;
      }

      setInfo(report);
      setLoading(false);
    } catch (e) {
      setLoading(false);
      setError(e?.message || "Erreur inconnue");
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f4f6fb",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 760,
          background: "white",
          borderRadius: 14,
          padding: 28,
          boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
        }}
      >
        <h1 style={{ margin: 0, fontSize: 44 }}>Lecture de Mains</h1>
        <p style={{ marginTop: 10, color: "#333" }}>
          Téléchargez une photo de votre main gauche et de votre main droite.
          <br />
          Analyse personnalisée envoyée sous 24h.
        </p>

        <div style={{ marginTop: 18 }}>
          <div style={{ marginBottom: 12 }}>
            <div style={{ marginBottom: 6 }}>Main gauche</div>
            <input type="file" accept="image/*" onChange={(e) => setLeftHand(e.target.files?.[0] || null)} />
            {leftHand ? (
              <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
                {leftHand.name} • {formatBytes(leftHand.size)}
              </div>
            ) : null}
          </div>

          <div style={{ marginBottom: 18 }}>
            <div style={{ marginBottom: 6 }}>Main droite</div>
            <input type="file" accept="image/*" onChange={(e) => setRightHand(e.target.files?.[0] || null)} />
            {rightHand ? (
              <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
                {rightHand.name} • {formatBytes(rightHand.size)}
              </div>
            ) : null}
          </div>

          {error ? <div style={{ color: "#d11", marginBottom: 12 }}>{error}</div> : null}

          {info ? (
            <div style={{ color: info.startsWith("Voilà ton analyse") ? "#111" : "#0a7", marginBottom: 12, whiteSpace: "pre-wrap" }}>
              {info}
            </div>
          ) : null}

          <button
            onClick={handleUploadAndAnalyze}
            disabled={loading}
            style={{
              width: "100%",
              background: "#1f3b8f",
              color: "white",
              border: "none",
              padding: "14px 16px",
              borderRadius: 10,
              fontSize: 18,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Envoi..." : "Envoyer mon analyse"}
          </button>
        </div>
      </div>
    </div>
  );
}
