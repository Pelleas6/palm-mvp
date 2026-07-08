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
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '60px 20px', fontFamily: 'Georgia, serif', color: theme.text, backgroundColor: theme.bg, minHeight: '100vh' }}>
      <header style={{ marginBottom: '40px', borderBottom: `1px solid ${theme.border}`, paddingBottom: '20px' }}>
        <a href="/" style={{ color: theme.sage, fontWeight: 800, textDecoration: 'none' }}>← Retour à l'accueil</a>
      </header>

      <h1 style={{ fontSize: '48px', fontWeight: '800', marginBottom: '24px', letterSpacing: '-0.02em' }}>La Ligne de Tête</h1>
      <p style={{ fontSize: '20px', lineHeight: '1.8', color: theme.textSoft, marginBottom: '40px' }}>
        Située au milieu de la paume, la ligne de tête est le reflet de vos facultés intellectuelles, de votre style de pensée et de votre manière d'appréhender le monde qui vous entoure.
      </p>

      <div style={{ background: '#FFFDF8', padding: '40px', borderRadius: '20px', border: `1px solid ${theme.border}` }}>
        <h2 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '16px', color: theme.sageDark }}>Votre façon de réfléchir</h2>
        <p style={{ fontSize: '18px', lineHeight: '1.7', color: theme.textSoft }}>
          Une ligne de tête droite suggère un esprit pratique, analytique et méthodique. Si elle est plus courbe, cela indique souvent une imagination vive, une intuition forte et une approche plus créative de la résolution des problèmes.
        </p>

        <h2 style={{ fontSize: '28px', fontWeight: '700', marginTop: '40px', marginBottom: '16px', color: theme.sageDark }}>Interactions et dynamiques</h2>
        <p style={{ fontSize: '18px', lineHeight: '1.7', color: theme.textSoft }}>
          L'analyse ne se fait jamais isolément. Votre ligne de tête interagit constamment avec votre ligne de vie et votre ligne de cœur, créant une dynamique unique qui définit votre personnalité entière.
        </p>
      </div>

      <div style={{ marginTop: '60px', padding: '40px', textAlign: 'center', background: theme.sageDark, borderRadius: '20px', color: '#fff' }}>
        <h3 style={{ fontSize: '24px', marginBottom: '20px' }}>Besoin d'éclaircissements ?</h3>
        <p style={{ marginBottom: '30px', opacity: 0.9 }}>Obtenez une analyse personnalisée et détaillée de votre profil intellectuel.</p>
        <a href="/#form-card" style={{ fontSize: '16px', fontWeight: '800', color: theme.sageDark, background: '#fff', textDecoration: 'none', padding: '16px 32px', borderRadius: '999px', display: 'inline-block' }}>Commencer mon analyse</a>
      </div>

      <div style={{ marginTop: '60px', padding: '40px', textAlign: 'center', borderTop: `1px solid ${theme.border}` }}>
        <h4 style={{ marginBottom: '20px', color: theme.sage }}>Autres lignes explorées</h4>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap' }}>
          <a href="/ligne-de-coeur" style={{ color: theme.textSoft }}>Ligne de cœur</a>
          <a href="/lecture-main-gauche-droite" style={{ color: theme.textSoft }}>Main gauche et droite</a>
        </div>
      </div>
    </div>
  );
}
