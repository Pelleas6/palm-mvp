export const metadata = {
  title: "FAQ - Lecture de Mains & Chiromancie | Palm-MVP",
  description: "Découvrez toutes les réponses à vos questions sur la lecture des lignes de la main. Différence main gauche/droite, signification des lignes, et déroulement de votre analyse.",
};

export default function FAQPage() {
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

  const faqs = [
    {
      q: "Quelle est la différence entre la main gauche et la main droite ?",
      a: "Traditionnellement, on dit que la main non-dominante (généralement la gauche pour les droitiers) représente votre potentiel inné, votre passé et votre bagage hérité. La main dominante (souvent la droite) montre comment vous utilisez ce potentiel au quotidien, votre présent et la direction de votre avenir. Une lecture complète analyse toujours les deux."
    },
    {
      q: "Quelles sont les lignes principales de la main ?",
      a: "Les trois lignes majeures sont : la ligne de cœur (les émotions, l'amour, les relations), la ligne de tête (l'intellect, la façon de penser, la concentration) et la ligne de vie (la vitalité, l'énergie physique, les grands événements de la vie). Ces lignes principales forment la base de toute analyse chiromancienne."
    },
    {
      q: "Est-ce que la ligne de vie indique la durée de ma vie ?",
      a: "Non, c'est une idée reçue très courante ! La ligne de vie indique plutôt votre vitalité, votre niveau d'énergie, votre ancrage et les grands changements de parcours. Elle ne prédit pas la longévité."
    },
    {
      q: "Sous quel délai vais-je recevoir mon rapport personnalisé ?",
      a: "Une fois vos photos envoyées, notre analyse prend un soin particulier. Vous recevrez généralement votre rapport complet par email sous 24 à 48 heures ouvrées."
    },
    {
      q: "Comment bien photographier ma main ?",
      a: "Pour une analyse précise, nous avons besoin d'une photo claire, de bonne qualité et bien éclairée de la paume de chaque main. Placez votre main à plat, les doigts légèrement écartés, sous une lumière naturelle de préférence."
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

      {/* Hero FAQ */}
      <main style={{ maxWidth: "800px", margin: "0 auto", padding: "4rem 2rem" }}>
        <div style={{ textAlign: "center", marginBottom: "4rem" }}>
          <h1 style={{ color: theme.sageDark, fontSize: "2.5rem", marginBottom: "1rem" }}>
            Questions Fréquemment Posées
          </h1>
          <p style={{ color: theme.textSoft, fontSize: "1.1rem", lineHeight: "1.6", maxWidth: "600px", margin: "0 auto" }}>
            Tout ce que vous devez savoir sur la chiromancie, nos analyses et le déroulement de votre lecture.
          </p>
        </div>

        {/* Liste des FAQ */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {faqs.map((faq, idx) => (
            <div key={idx} style={{ 
              backgroundColor: theme.card, 
              padding: "2rem", 
              borderRadius: "16px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.03)",
              border: `1px solid ${theme.border}`
            }}>
              <h2 style={{ color: theme.goldDark, fontSize: "1.2rem", marginBottom: "1rem", marginTop: 0 }}>
                {faq.q}
              </h2>
              <p style={{ color: theme.textSoft, lineHeight: "1.7", margin: 0 }}>
                {faq.a}
              </p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div style={{ marginTop: "4rem", textAlign: "center", backgroundColor: theme.sageLight, padding: "3rem 2rem", borderRadius: "16px", border: `1px solid ${theme.sageBorder}` }}>
          <h3 style={{ color: theme.sageDark, fontSize: "1.5rem", marginTop: 0, marginBottom: "1rem" }}>
            Prêt à découvrir ce que révèlent vos mains ?
          </h3>
          <p style={{ color: theme.textSoft, marginBottom: "2rem" }}>
            Obtenez votre analyse énergétique détaillée basée sur la lecture de vos lignes.
          </p>
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
            Commencer mon analyse
          </a>
        </div>
      </main>
    </div>
  );
}
