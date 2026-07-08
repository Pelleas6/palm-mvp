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
        <h1 style={{ fontSize: '48px', fontWeight: '800', marginBottom: '24px', letterSpacing: '-0.02em' }}>La Ligne de Cœur</h1>
        <p style={{ fontSize: '20px', lineHeight: '1.8', color: theme.textSoft, marginBottom: '40px' }}>
          La ligne de cœur est le reflet de votre vie affective. Située dans la partie supérieure de la paume, sous les doigts, elle révèle vos émotions, vos relations amoureuses et votre tempérament affectif.
        </p>

        <div style={{ background: '#FFFDF8', padding: '40px', borderRadius: '20px', border: `1px solid ${theme.border}` }}>
          <h2 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '16px', color: theme.sageDark }}>Comprendre votre ligne de cœur</h2>
          <p style={{ fontSize: '18px', lineHeight: '1.7', color: theme.textSoft }}>
            Une ligne de cœur longue et profonde indique souvent une nature émotionnelle riche et un besoin de connexions profondes. Si elle est courte, elle peut révéler une approche plus directe et indépendante des relations. La manière dont elle se courbe vers les doigts en dit long sur la façon dont vous exprimez vos sentiments.
          </p>

          <h2 style={{ fontSize: '28px', fontWeight: '700', marginTop: '40px', marginBottom: '16px', color: theme.sageDark }}>Les principaux types de lignes</h2>
          <p style={{ fontSize: '18px', lineHeight: '1.7', color: theme.textSoft }}>
            Il n'existe pas de "bonne" ou de "mauvaise" ligne de cœur. Chaque tracé est unique et raconte votre histoire. Que votre ligne soit droite, courbée, ou qu'elle présente des signes particuliers, elle est le témoin de votre parcours personnel.
          </p>
        </div>

        <div style={{ marginTop: '60px', padding: '40px', textAlign: 'center', background: theme.sageDark, borderRadius: '20px', color: '#fff' }}>
          <h3 style={{ fontSize: '24px', marginBottom: '20px' }}>Envie d'une analyse complète ?</h3>
          <p style={{ marginBottom: '30px', opacity: 0.9 }}>Découvrez ce que vos mains révèlent sur votre vie affective et bien plus.</p>
          <a href="/#form-card" style={{ fontSize: '16px', fontWeight: '800', color: theme.sageDark, background: '#fff', textDecoration: 'none', padding: '16px 32px', borderRadius: '999px', display: 'inline-block' }}>Commencer mon analyse</a>
        </div>

        <div style={{ marginTop: '60px', padding: '40px', textAlign: 'center', borderTop: `1px solid ${theme.border}` }}>
          <h4 style={{ marginBottom: '20px', color: theme.sage }}>Autres lignes explorées</h4>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap' }}>
            <a href="/ligne-de-tete" style={{ color: theme.textSoft }}>Ligne de tête</a>
            <a href="/lecture-main-gauche-droite" style={{ color: theme.textSoft }}>Main gauche et droite</a>
          </div>
        </div>
      </div>
    </div>
  );
}
