export default function Header({ backLink = "/", dark = false }) {
  const theme = dark ? {
    bg: "#07110f",
    card: "#0c1d1a",
    border: "rgba(157, 191, 179, 0.2)",
    gold: "#C9A84C",
    text: "#eff8f3",
    sage: "#7A9E7E",
  } : {
    bg: "#FAF7F2",
    card: "#FFFFFF",
    border: "#E8E0D0",
    gold: "#C9A84C",
    text: "#3A3228",
    sage: "#7A9E7E",
  };

  const topbar = {
    position: "sticky",
    top: 0,
    zIndex: 50,
    backgroundColor: dark ? "rgba(7, 17, 15, 0.95)" : "rgba(250, 247, 242, 0.95)",
    backdropFilter: "blur(8px)",
    borderBottom: `1px solid ${theme.border}`,
  };

  const topbarInner = {
    maxWidth: 1180,
    margin: "0 auto",
    padding: "14px 18px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  };

  const brand = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    textDecoration: "none",
  };

  const brandTitle = {
    fontWeight: 700,
    fontSize: 18,
    color: theme.text,
    letterSpacing: "0.02em",
  };

  const backBtn = {
    textDecoration: "none",
    color: theme.sage,
    fontSize: 13,
    border: `1px solid ${theme.border}`,
    backgroundColor: theme.card,
    padding: "8px 12px",
    borderRadius: 10,
  };

  return (
    <div style={topbar}>
      <div style={topbarInner}>
        <a href="/" style={brand}>
          <span style={{ fontSize: 22 }}>◉</span>
          <span style={brandTitle}>Le Pouls du Monde</span>
        </a>

        {backLink && (
          <a href={backLink} style={backBtn}>
            ← Retour
          </a>
        )}
      </div>
    </div>
  );
}
