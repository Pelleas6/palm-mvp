"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function Merci() {
  const searchParams = useSearchParams();
  const [dots, setDots] = useState(".");

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((d) => (d.length >= 3 ? "." : d + "."));
    }, 600);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{
      minHeight: "100vh", backgroundColor: "#FAF7F2",
      fontFamily: "Georgia, serif", display: "flex",
      flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "32px 20px", boxSizing: "border-box",
    }}>
      <style>{`
        @keyframes fadeIn { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        .fade  { animation: fadeIn 0.7s ease forwards; }
        .fade2 { animation: fadeIn 0.7s ease 0.3s forwards; opacity:0; }
        .fade3 { animation: fadeIn 0.7s ease 0.6s forwards; opacity:0; }
        .fade4 { animation: fadeIn 0.7s ease 0.9s forwards; opacity:0; }
      `}</style>

      <div className="fade" style={{ textAlign: "center", marginBottom: 40 }}>
        <div style={{ fontSize: 32, marginBottom: 10 }}>🌿</div>
        <div style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "#C9A84C" }}>Ligne de Vie</div>
      </div>

      <div className="fade2" style={{
        backgroundColor: "#fff", borderRadius: 16, border: "1px solid #E8E0D0",
        padding: "40px 36px", maxWidth: 520, width: "100%",
        boxShadow: "0 8px 40px rgba(0,0,0,0.07)", textAlign: "center",
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: "50%",
          backgroundColor: "#EFF5F0", border: "1.5px solid #B5CDB7",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 24px", fontSize: 24, color: "#5C7E60", fontWeight: 700,
        }}>✓</div>

        <h1 style={{ margin: "0 0 12px", fontSize: 22, fontWeight: 700, color: "#3A3228" }}>
          Votre dossier est entre nos mains
        </h1>
        <p style={{ margin: "0 0 28px", fontSize: 15, color: "#7A6F65", lineHeight: 1.8 }}>
          Merci pour votre confiance. Votre paiement a bien été reçu et votre dossier est en cours de préparation.
        </p>

        <div style={{ width: 40, height: 1, backgroundColor: "#C9A84C", margin: "0 auto 28px" }} />

        <div style={{ display: "flex", flexDirection: "column", gap: 16, textAlign: "left", marginBottom: 32 }}>
          {[
            { n: "1", text: "Votre dossier a été transmis à notre expert" },
            { n: "2", text: "L'analyse de vos deux mains est en cours" },
            { n: "3", text: "Votre rapport vous sera envoyé par email sous 24h" },
          ].map((step) => (
            <div key={step.n} style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
              <div style={{
                minWidth: 28, height: 28, borderRadius: "50%",
                border: "1.5px solid #C9A84C", color: "#C9A84C",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontWeight: 700,
              }}>{step.n}</div>
              <p style={{ margin: 0, fontSize: 14, color: "#3A3228", lineHeight: 1.7, paddingTop: 4 }}>{step.text}</p>
            </div>
          ))}
        </div>

        <div style={{ backgroundColor: "#EFF5F0", borderRadius: 10, border: "1px solid #B5CDB7", padding: "12px 16px" }}>
          <p style={{ margin: 0, fontSize: 12, color: "#5C7E60", lineHeight: 1.6 }}>
            Vos photos ont été supprimées de nos serveurs après traitement.<br />
            Ce rapport est strictement personnel et confidentiel.
          </p>
        </div>
      </div>

      <div className="fade3" style={{ marginTop: 28, textAlign: "center" }}>
        <p style={{ margin: "0 0 8px", fontSize: 13, color: "#7A6F65" }}>Pensez à vérifier vos courriers indésirables.</p>
        <a href="/" style={{ fontSize: 13, color: "#7A9E7E", textDecoration: "none", borderBottom: "1px solid #B5CDB7", paddingBottom: 1 }}>
          ← Retour à l'accueil
        </a>
      </div>

      <div className="fade4" style={{ marginTop: 48, textAlign: "center" }}>
        <p style={{ margin: 0, fontSize: 11, color: "#7A6F65", letterSpacing: "0.04em" }}>
          © 2026 Ligne de Vie · ma-ligne-de-vie.fr · Confidentiel · Sérieux
        </p>
      </div>
    </div>
  );
}
