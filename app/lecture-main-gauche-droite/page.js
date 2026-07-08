import Header from "../../components/Header";

export default function Page() {
  const theme = {
    bg: "#F7F1E8",
    sage: "#55745A",
    sageDark: "#314D36",
    text: "#30281F",
    textSoft: "#5F5549",
    border: "#E6D8C3",
  };

  return (
    <div style={{ fontFamily: 'Georgia, serif', color: theme.text, backgroundColor: theme.bg, minHeight: '100vh' }}>
      <Header />
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '60px 20px' }}>
        <h1 style={{ fontSize: '48px', fontWeight: '800', marginBottom: '24px', letterSpacing: '-0.02em' }}>Main Gauche vs Main Droite</h1>
        <p style={{ fontSize: '20px', lineHeight: '1.8', color: theme.textSoft, marginBottom: '40px' }}>
          Dans la chiromancie moderne, l'analyse croisée des deux mains est fondamentale. Elle permet de distinguer le potentiel inné des réalisations acquises au fil de votre parcours.
        </p>

        <div style={{ background: '#FFFDF8', padding: '40px', borderRadius: '20px', border: `1px solid ${theme.border}` }}>
          <h2 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '16px', color: theme.sageDark }}>Potentiel inné vs Acquis</h2>
          <p style={{ fontSize: '18px', lineHeight: '1.7', color: theme.textSoft }}>
            Traditionnellement, la main gauche représente votre potentiel de naissance et vos aptitudes innées. La main droite, elle, reflète vos choix, vos actions et la manière dont vous avez utilisé ces capacités pour façonner votre vie.
          </p>

          <h2 style={{ fontSize: '28px', fontWeight: '700', marginTop: '40px', marginBottom: '16px', color: theme.sageDark }}>La valeur de la comparaison</h2>
          <p style={{ fontSize: '18px', lineHeight: '1.7', color: theme.textSoft }}>
            Observer les différences et les similarités entre vos deux mains offre une perspective précieuse sur votre évolution personnelle. C'est en croisant ces informations que nous pouvons vous offrir une analyse truly personnalisée.
          </p>
        </div>

        <div style={{ marginTop: '60px', padding: '40px', textAlign: 'center', background: theme.sageDark, borderRadius: '20px', color: '#fff' }}>
          <h3 style={{ fontSize: '24px', marginBottom: '20px' }}>Comparez vos mains</h3>
          <p style={{ marginBottom: '30px', opacity: 0.9 }}>Obtenez une analyse croisée et approfondie de vos deux paumes.</p>
          <a href="/#form-card" style={{ fontSize: '16px', fontWeight: '800', color: theme.sageDark, background: '#fff', textDecoration: 'none', padding: '16px 32px', borderRadius: '999px', display: 'inline-block' }}>Commencer mon analyse</a>
        </div>

        <div style={{ marginTop: '60px', padding: '40px', textAlign: 'center', borderTop: `1px solid ${theme.border}` }}>
          <h4 style={{ marginBottom: '20px', color: theme.sage }}>Autres lignes explorées</h4>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap' }}>
            <a href="/ligne-de-coeur" style={{ color: theme.textSoft }}>Ligne de cœur</a>
            <a href="/ligne-de-tete" style={{ color: theme.textSoft }}>Ligne de tête</a>
          </div>
        </div>
      </div>
    </div>
  );
}
