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

  const handleUpload = async () => {
    try {
      setError("");
      setInfo("");

      if (!leftHand || !rightHand) {
        setError("Veuillez télécharger la main gauche et la main droite.");
        return;
      }

      setLoading(true);

      const leftCompressed = await compressImageToJpeg(leftHand);
      const rightCompressed = await compressImageToJpeg(rightHand);

      const maxPerFileBytes = 2.5 * 1024 * 1024; // 2.5MB
      if (leftCompressed.size > maxPerFileBytes || rightCompressed.size > maxPerFileBytes) {
        setError(
          `Photos encore trop lourdes après compression. ` +
            `Gauche: ${formatBytes(leftCompressed.size)} / Droite: ${formatBytes(rightCompressed.size)}. ` +
            `Essaye une photo moins proche ou baisse la qualité.`
        );
        setLoading(false);
        return;
      }

      const formData = new FormData();
      formData.append("leftHand", leftCompressed);
      formData.append("rightHand", rightCompressed);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const text = await response.text();

      let json = null;
      try {
        json = JSON.parse(text);
      } catch {}

      if (!response.ok) {
        const msg = (json && (json.error || json.message)) || text || `Erreur serveur (status ${response.status})`;
        setError(msg);
        setLoading(false);
        return;
      }

      setInfo((json && (json.message || "OK")) || "OK");
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
          maxWidth: 640,
          background: "white",
          borderRadius: 14,
          padding: 28,
          boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
        }}
      >
        <h1 style={{ margin: 0, fontSize: 40 }}>Lecture de Mains</h1>
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
          {info ? <div style={{ color: "#0a7", marginBottom: 12 }}>{info}</div> : null}

          <button
            onClick={handleUpload}
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
