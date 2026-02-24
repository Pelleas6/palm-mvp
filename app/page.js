"use client";

import { useState } from "react";

export default function Home() {
  const [leftHand, setLeftHand] = useState(null);
  const [rightHand, setRightHand] = useState(null);
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!leftHand || !rightHand) {
      setError("Veuillez télécharger les deux mains.");
      return;
    }

    setError("");
    alert("Analyse envoyée (simulation).");
  };

  return (
    <main style={{
      minHeight: "100vh",
      background: "#f4f6f9",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "Arial, sans-serif"
    }}>
      <div style={{
        background: "white",
        padding: "40px",
        borderRadius: "12px",
        boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
        width: "100%",
        maxWidth: "500px"
      }}>
        <h1 style={{ marginBottom: "10px" }}>
          Lecture de Mains
        </h1>

        <p style={{ color: "#666", marginBottom: "30px" }}>
          Téléchargez une photo de votre main gauche et de votre main droite.
          Analyse personnalisée envoyée sous 24h.
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "20px" }}>
            <label>Main gauche</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setLeftHand(e.target.files[0])}
              style={{ display: "block", marginTop: "8px" }}
            />
          </div>

          <div style={{ marginBottom: "20px" }}>
            <label>Main droite</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setRightHand(e.target.files[0])}
              style={{ display: "block", marginTop: "8px" }}
            />
          </div>

          {error && (
            <p style={{ color: "red", marginBottom: "15px" }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            style={{
              width: "100%",
              padding: "12px",
              background: "#1f3c88",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "16px"
            }}
          >
            Envoyer mon analyse
          </button>
        </form>
      </div>
    </main>
  );
}
