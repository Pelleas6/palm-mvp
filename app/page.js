"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "";
  const units = ["B", "KB", "MB", "GB"];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v = v / 1024;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export default function Page() {
  const [leftFile, setLeftFile] = useState(null);
  const [rightFile, setRightFile] = useState(null);

  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [dateNaissance, setDateNaissance] = useState("");
  const [themeChoisi, setThemeChoisi] = useState("general");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const MAX_BYTES = 20 * 1024 * 1024; // 20 Mo
  const allowedTypes = useMemo(() => new Set(["image/jpeg", "image/png", "image/webp"]), []);

  const canSubmit = useMemo(() => {
    if (loading) return false;
    if (!leftFile || !rightFile) return false;
    if (!email || !email.includes("@")) return false;
    if (leftFile.size > MAX_BYTES || rightFile.size > MAX_BYTES) return false;
    if (!allowedTypes.has(leftFile.type) || !allowedTypes.has(rightFile.type)) return false;
    return true;
  }, [loading, leftFile, rightFile, email, MAX_BYTES, allowedTypes]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setResult(null);

    try {
      if (!leftFile || !rightFile) {
        throw new Error("Merci de sélectionner les deux photos (main gauche + main droite).");
      }

      if (!allowedTypes.has(leftFile.type)) {
        throw new Error("Main gauche : format non autorisé (jpg/png/webp).");
      }
      if (!allowedTypes.has(rightFile.type)) {
        throw new Error("Main droite : format non autorisé (jpg/png/webp).");
      }

      if (leftFile.size > MAX_BYTES) {
        throw new Error("Main gauche : fichier trop lourd (max 20 Mo).");
      }
      if (rightFile.size > MAX_BYTES) {
        throw new Error("Main droite : fichier trop lourd (max 20 Mo).");
      }

      if (!email || !email.includes("@")) {
        throw new Error("Merci d’indiquer une adresse email valide.");
      }

      setLoading(true);

      // 1) demander au serveur 2 urls signées pour upload direct Supabase
      const preRes = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          left: { name: leftFile.name, type: leftFile.type, size: leftFile.size },
          right: { name: rightFile.name, type: rightFile.type, size: rightFile.size },
        }),
      });

      const preData = await safeJson(preRes);

      if (!preRes.ok) {
        throw new Error(
          "UPLOAD-PREP ERROR\nstatus=" +
            preRes.status +
            "\nbody=" +
            JSON.stringify(preData, null, 2)
        );
      }

      const leftPath = preData?.leftPath;
      const rightPath = preData?.rightPath;
      const leftSignedUrl = preData?.leftSignedUrl;
      const rightSignedUrl = preData?.rightSignedUrl;

      if (!leftPath || !rightPath || !leftSignedUrl || !rightSignedUrl) {
        throw new Error("Réponse /api/upload invalide : " + JSON.stringify(preData, null, 2));
      }

      // 2) upload direct vers Supabase (PUT sur signed upload url)
      const upLeft = await fetch(leftSignedUrl, {
        method: "PUT",
        headers: { "Content-Type": leftFile.type },
        body: leftFile,
      });

      if (!upLeft.ok) {
        const t = await upLeft.text().catch(() => "");
        throw new Error("UPLOAD DIRECT LEFT FAILED\nstatus=" + upLeft.status + "\nbody=" + t);
      }

      const upRight = await fetch(rightSignedUrl, {
        method: "PUT",
        headers: { "Content-Type": rightFile.type },
        body: rightFile,
      });

      if (!upRight.ok) {
        const t = await upRight.text().catch(() => "");
        throw new Error("UPLOAD DIRECT RIGHT FAILED\nstatus=" + upRight.status + "\nbody=" + t);
      }

      // 3) déclencher l'analyse (JSON léger)
      const analyzeRes = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leftPath,
          rightPath,
          prenom,
          nom,
          email,
          dateNaissance,
          themeChoisi,
        }),
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

      setResult(analyzeData || { ok: true });

      // option: reset fichiers après succès
      setLeftFile(null);
      setRightFile(null);
    } catch (err) {
      setError(String(err?.message || err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background:
          "radial-gradient(1200px 600px at 20% 10%, rgba(40, 80, 255, 0.20), transparent 60%), radial-gradient(900px 500px at 80% 20%, rgba(0, 200, 255, 0.12), transparent 60%), #070A12",
        color: "#E9EEFF",
      }}
    >
      <main style={{ flex: 1, display: "flex", justifyContent: "center", padding: "40px 16px" }}>
        <div style={{ width: "100%", maxWidth: 820 }}>
          <header style={{ marginBottom: 20 }}>
            <div
              style={{
                fontSize: 34,
                letterSpacing: -0.5,
                lineHeight: 1.1,
                marginBottom: 8,
              }}
            >
              Lecture de main
            </div>
            <div style={{ opacity: 0.85, maxWidth: 680, lineHeight: 1.5 }}>
              Téléverse 2 photos nettes (main gauche + main droite). L’analyse est envoyée par email.
              Formats acceptés : JPG, PNG, WEBP. Taille max : 20 Mo par photo.
            </div>
          </header>

          <section
            style={{
              border: "1px solid rgba(255,255,255,0.10)",
              background: "rgba(10, 14, 25, 0.75)",
              borderRadius: 18,
              padding: 18,
              boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
            }}
          >
            <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    border: "1px solid rgba(255,255,255,0.10)",
                    borderRadius: 14,
                    padding: 14,
                    background: "rgba(255,255,255,0.04)",
                  }}
                >
                  <div style={{ marginBottom: 8, opacity: 0.9 }}>Photo main gauche</div>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => setLeftFile(e.target.files?.[0] || null)}
                    disabled={loading}
                    style={{ width: "100%" }}
                  />
                  <div style={{ marginTop: 8, fontSize: 13, opacity: 0.8 }}>
                    {leftFile
                      ? `${leftFile.name} • ${formatBytes(leftFile.size)} • ${leftFile.type}`
                      : "Aucun fichier sélectionné"}
                  </div>
                  {leftFile && leftFile.size > MAX_BYTES ? (
                    <div style={{ marginTop: 6, fontSize: 13, color: "#FFB6B6" }}>
                      Fichier trop lourd (max 20 Mo)
                    </div>
                  ) : null}
                </div>

                <div
                  style={{
                    border: "1px solid rgba(255,255,255,0.10)",
                    borderRadius: 14,
                    padding: 14,
                    background: "rgba(255,255,255,0.04)",
                  }}
                >
                  <div style={{ marginBottom: 8, opacity: 0.9 }}>Photo main droite</div>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => setRightFile(e.target.files?.[0] || null)}
                    disabled={loading}
                    style={{ width: "100%" }}
                  />
                  <div style={{ marginTop: 8, fontSize: 13, opacity: 0.8 }}>
                    {rightFile
                      ? `${rightFile.name} • ${formatBytes(rightFile.size)} • ${rightFile.type}`
                      : "Aucun fichier sélectionné"}
                  </div>
                  {rightFile && rightFile.size > MAX_BYTES ? (
                    <div style={{ marginTop: 6, fontSize: 13, color: "#FFB6B6" }}>
                      Fichier trop lourd (max 20 Mo)
                    </div>
                  ) : null}
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                }}
              >
                <div style={{ display: "grid", gap: 8 }}>
                  <label style={{ fontSize: 14, opacity: 0.9 }}>Prénom (optionnel)</label>
                  <input
                    value={prenom}
                    onChange={(e) => setPrenom(e.target.value)}
                    disabled={loading}
                    placeholder="Ex : Karim"
                    style={{
                      padding: "10px 12px",
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.12)",
                      background: "rgba(0,0,0,0.25)",
                      color: "#E9EEFF",
                      outline: "none",
                    }}
                  />
                </div>

                <div style={{ display: "grid", gap: 8 }}>
                  <label style={{ fontSize: 14, opacity: 0.9 }}>Nom (optionnel)</label>
                  <input
                    value={nom}
                    onChange={(e) => setNom(e.target.value)}
                    disabled={loading}
                    placeholder="Ex : Soualem"
                    style={{
                      padding: "10px 12px",
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.12)",
                      background: "rgba(0,0,0,0.25)",
                      color: "#E9EEFF",
                      outline: "none",
                    }}
                  />
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                }}
              >
                <div style={{ display: "grid", gap: 8 }}>
                  <label style={{ fontSize: 14, opacity: 0.9 }}>Email (obligatoire)</label>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    placeholder="ex : contact@exemple.com"
                    style={{
                      padding: "10px 12px",
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.12)",
                      background: "rgba(0,0,0,0.25)",
                      color: "#E9EEFF",
                      outline: "none",
                    }}
                  />
                </div>

                <div style={{ display: "grid", gap: 8 }}>
                  <label style={{ fontSize: 14, opacity: 0.9 }}>Date de naissance (optionnel)</label>
                  <input
                    value={dateNaissance}
                    onChange={(e) => setDateNaissance(e.target.value)}
                    disabled={loading}
                    placeholder="JJ/MM/AAAA"
                    style={{
                      padding: "10px 12px",
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.12)",
                      background: "rgba(0,0,0,0.25)",
                      color: "#E9EEFF",
                      outline: "none",
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                <label style={{ fontSize: 14, opacity: 0.9 }}>Orientation (optionnel)</label>
                <select
                  value={themeChoisi}
                  onChange={(e) => setThemeChoisi(e.target.value)}
                  disabled={loading}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "rgba(0,0,0,0.25)",
                    color: "#E9EEFF",
                    outline: "none",
                  }}
                >
                  <option value="general">Général</option>
                  <option value="amour">Amour</option>
                  <option value="travail">Travail</option>
                  <option value="argent">Argent</option>
                  <option value="famille">Famille</option>
                  <option value="energie">Énergie</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={!canSubmit}
                style={{
                  marginTop: 6,
                  padding: "12px 14px",
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: canSubmit ? "rgba(90, 140, 255, 0.85)" : "rgba(255,255,255,0.10)",
                  color: canSubmit ? "#0B1020" : "rgba(233,238,255,0.55)",
                  cursor: canSubmit ? "pointer" : "not-allowed",
                  fontSize: 15,
                }}
              >
                {loading ? "Envoi en cours..." : "Envoyer"}
              </button>

              {error ? (
                <pre
                  style={{
                    marginTop: 6,
                    padding: 12,
                    borderRadius: 12,
                    background: "rgba(255, 80, 80, 0.12)",
                    border: "1px solid rgba(255, 80, 80, 0.35)",
                    color: "#FFD7D7",
                    whiteSpace: "pre-wrap",
                    overflowX: "auto",
                  }}
                >
                  {error}
                </pre>
              ) : null}

              {result ? (
                <div
                  style={{
                    marginTop: 6,
                    padding: 12,
                    borderRadius: 12,
                    background: "rgba(80, 255, 180, 0.10)",
                    border: "1px solid rgba(80, 255, 180, 0.30)",
                    color: "#D9FFE9",
                  }}
                >
                  Envoi déclenché. Tu vas recevoir le rapport par email.
                </div>
              ) : null}
            </form>

            <div style={{ marginTop: 14, opacity: 0.7, fontSize: 13, lineHeight: 1.45 }}>
              Conseils photo : main bien à plat, lumière naturelle, pas d’ombre forte, photo nette,
              doigts visibles, pas de filtre.
            </div>
          </section>
        </div>
      </main>

      <footer
        style={{
          borderTop: "1px solid rgba(255,255,255,0.10)",
          padding: "18px 16px",
          background: "rgba(0,0,0,0.25)",
        }}
      >
        <div
          style={{
            maxWidth: 820,
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ opacity: 0.75, fontSize: 13 }}>
            © {new Date().getFullYear()} ma-ligne-de-vie.fr
          </div>

          <div style={{ display: "flex", gap: 14, fontSize: 13 }}>
            <Link href="/mentions-legales" style={{ color: "#AFC4FF", textDecoration: "none" }}>
              Mentions légales
            </Link>
            <Link href="/confidentialite" style={{ color: "#AFC4FF", textDecoration: "none" }}>
              Confidentialité
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
