"use client";

const theme = {
  bg: "#F7F1E8",
  bg2: "#FFFDF8",
  card: "#FFFFFF",
  cardSoft: "rgba(255,255,255,0.82)",
  border: "#E6D8C3",
  borderStrong: "#D3BE98",
  sage: "#55745A",
  sageDark: "#314D36",
  sageLight: "#EEF5EF",
  sageBorder: "#AFC8B3",
  gold: "#B8933D",
  goldDark: "#8F6D22",
  goldLight: "#FFF7E6",
  text: "#30281F",
  textSoft: "#5F5549",
  textLight: "#85796B",
};

export default function Header() {
  return (
    <nav className="navWrap" style={{ position: "sticky", top: 0, zIndex: 100, height: 72, padding: "0 42px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,253,248,.82)", backdropFilter: "blur(16px)", borderBottom: `1px solid ${theme.border}` }}>
      <a href="/" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none" }}>
        <span style={{ width: 38, height: 38, borderRadius: 14, display: "grid", placeItems: "center", background: `linear-gradient(135deg, ${theme.sageDark}, ${theme.sage})`, color: "#fff", boxShadow: "0 10px 24px rgba(85,116,90,.22)" }}>✦</span>
        <span style={{ fontWeight: 800, fontSize: 20, color: theme.text, letterSpacing: ".01em" }}>Ligne de Vie</span>
      </a>

      <div className="navLinks" style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <a href="/#comment" className="focusable" style={{ fontSize: 14, color: theme.textSoft, textDecoration: "none", padding: "8px 14px" }}>Comment ça marche</a>
        <a href="/#confiance" className="focusable" style={{ fontSize: 14, color: theme.textSoft, textDecoration: "none", padding: "8px 14px" }}>Confidentialité</a>
        <a href="/#form-card" className="focusable primaryCta" style={{ fontSize: 14, fontWeight: 800, color: "#fff", background: `linear-gradient(135deg, ${theme.sageDark}, ${theme.sage})`, textDecoration: "none", padding: "12px 22px", borderRadius: 999, marginLeft: 8, boxShadow: "0 12px 28px rgba(85,116,90,.24)", transition: "all .18s" }}>Commencer</a>
      </div>
      <style jsx global>{`
        .focusable:focus { outline: 3px solid rgba(184,147,61,.22); outline-offset: 2px; }
        .primaryCta:hover { filter: brightness(.98); transform: translateY(-1px); }
        @media (max-width: 980px) {
          .navLinks { display: none !important; }
          .navWrap { padding: 0 18px !important; }
        }
      `}</style>
    </nav>
  );
}
