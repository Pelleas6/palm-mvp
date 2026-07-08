export const metadata = {
  title: "Comment ça marche ? L'analyse de vos mains | Palm-MVP",
  description: "Découvrez notre processus d'analyse chiromancienne. Prenez vos mains en photo et recevez un rapport énergétique détaillé en 24h.",
};

export default function HowItWorksPage() {
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

  const steps = [
    {
      step: "1",
      title: "Prenez vos mains en photo",
      desc: "Une fois votre commande validée, nous vous guiderons pour prendre une photo claire de votre paume gauche et de votre paume droite. Assurez-vous d'avoir une bonne luminosité."
    },
    {
      step: "2",
      title: "Analyse personnalisée",
      desc: "Nous analysons les lignes majeures (ligne de vie, ligne de cœur, ligne de tête) ainsi que les monts énergétiques de vos mains pour dresser votre profil complet."
    },
    {
      step: "3",
      title: "Réception du rapport",
      desc: "Sous 24 à 48 heures, vous recevrez par email un rapport détaillé et illustré, mettant en lumière vos traits de personnalité, vos potentiels cachés et vos dynamiques émotionnelles."
    }
  ];

  return (
    <div style={{ backgroundColor: theme.bg, minHeight: "100vh", color: theme.text, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      {/* Header simple */}
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
            Comment ça marche ?
          </h1>
          <p style={{ color: theme.textSoft, fontSize: "1.1rem", lineHeight: "1.6", maxWidth: "600px", margin: "0 auto" }}>
            Notre processus est simple, rapide et conçu pour vous offrir la lecture la plus précise et personnalisée possible.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          {steps.map((item, idx) => (
            <div key={idx} style={{ 
              display: "flex", 
              alignItems: "flex-start",
              gap: "2rem",
              backgroundColor: theme.card, 
              padding: "2rem", 
              borderRadius: "16px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.03)",
              border: `1px solid ${theme.border}`
            }}>
              <div style={{
                backgroundColor: theme.goldLight,
                color: theme.goldDark,
                width: "60px",
                height: "60px",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.5rem",
                fontWeight: "bold",
                flexShrink: 0
              }}>
                {item.step}
              </div>
              <div>
                <h2 style={{ color: theme.sageDark, fontSize: "1.4rem", marginBottom: "0.5rem", marginTop: 0 }}>
                  {item.title}
                </h2>
                <p style={{ color: theme.textSoft, lineHeight: "1.7", margin: 0 }}>
                  {item.desc}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div style={{ marginTop: "4rem", textAlign: "center" }}>
          <a href="/" style={{
            display: "inline-block",
            backgroundColor: theme.sage,
            color: "#FFF",
            padding: "1rem 2rem",
            borderRadius: "50px",
            textDecoration: "none",
            fontWeight: "600",
            transition: "all 0.2s ease"
          }}>
            Lancer mon analyse maintenant
          </a>
        </div>
      </main>
    </div>
  );
}
