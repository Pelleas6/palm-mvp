export const metadata = {
  title: "Tarifs - Analyse et Lecture des Lignes de la Main | Palm-MVP",
  description: "Découvrez nos offres pour la lecture des lignes de la main. Obtenez un rapport personnalisé de votre main gauche et main droite en 24h.",
};

export default function PricingPage() {
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

  return (
    <div style={{ backgroundColor: theme.bg, minHeight: "100vh", color: theme.text, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      {/* Header */}
      <header style={{ backgroundColor: theme.card, padding: "1rem 2rem", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontWeight: "600", fontSize: "1.2rem", color: theme.sageDark }}>
          Palm-MVP
        </div>
        <a href="/" style={{ textDecoration: "none", color: theme.textSoft, fontSize: "0.9rem", fontWeight: "500" }}>
          ← Retour à l'accueil
        </a>
      </header>

      <main style={{ maxWidth: "800px", margin: "0 auto", padding: "4rem 2rem" }}>
        <div style={{ textAlign: "center", marginBottom: "4rem" }}>
          <h1 style={{ color: theme.sageDark, fontSize: "2.5rem", marginBottom: "1rem" }}>
            Nos Tarifs
          </h1>
          <p style={{ color: theme.textSoft, fontSize: "1.1rem", lineHeight: "1.6", maxWidth: "600px", margin: "0 auto" }}>
            Choisissez l'analyse qui vous correspond. Chaque rapport personnalisé est conçu pour vous offrir des clés de compréhension uniques grâce à la lecture des lignes de la main.
          </p>
        </div>

        {/* Pricing Cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem", alignItems: "center" }}>
          
          <div style={{ 
            backgroundColor: theme.card, 
            padding: "3rem", 
            borderRadius: "16px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.03)",
            border: `1px solid ${theme.border}`,
            maxWidth: "500px",
            width: "100%",
            textAlign: "center"
          }}>
            <h2 style={{ color: theme.goldDark, fontSize: "1.8rem", marginTop: 0, marginBottom: "0.5rem" }}>
              Lecture Complète
            </h2>
            <div style={{ color: theme.textSoft, fontSize: "1rem", marginBottom: "2rem" }}>
              L'analyse approfondie de votre parcours
            </div>
            
            <div style={{ fontSize: "3rem", fontWeight: "bold", color: theme.sageDark, marginBottom: "2rem" }}>
              29€
            </div>

            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 2rem 0", textAlign: "left", color: theme.textSoft, lineHeight: "1.8" }}>
              <li style={{ marginBottom: "0.5rem" }}>✨ Analyse détaillée : main gauche et main droite</li>
              <li style={{ marginBottom: "0.5rem" }}>✨ Décryptage de la ligne de vie</li>
              <li style={{ marginBottom: "0.5rem" }}>✨ Interprétation de la ligne de coeur</li>
              <li style={{ marginBottom: "0.5rem" }}>✨ Etude de la ligne de tête</li>
              <li style={{ marginBottom: "0.5rem" }}>✨ Rapport personnalisé complet</li>
              <li style={{ marginBottom: "0.5rem" }}>✨ Lecture en 24h chrono (format PDF)</li>
            </ul>

            <a href="/" style={{
              display: "block",
              backgroundColor: theme.sage,
              color: "#FFF",
              padding: "1rem",
              borderRadius: "50px",
              textDecoration: "none",
              fontWeight: "600",
              transition: "all 0.2s ease"
            }}>
              Commander mon analyse
            </a>
          </div>

        </div>
      </main>
    </div>
  );
}
